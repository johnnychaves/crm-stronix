// Consultas e regras da carga do CRM (hooks/useCrmSources.js). Puras, sem SDK:
// o hook traduz com specToConstraints. As três consultas são de campo único
// (range e orderBy no mesmo campo): índice automático do Firestore, nada a
// publicar. Os três campos são Timestamp, conferido em produção em 14/09/2026.

import {
  monthWindowSpec, unionById, shouldStoreMonthEntry, currentMonthLeadsWindow, leadsWindowSince
} from '../operacional/queries.js';
import { addMonthsToKey } from '../operacional/month.js';
import { getSafeDateOrNull } from '../dates.js';
import { AULA_STATUS } from '../aulas.js';
import { isConvertedStatusName } from '../leads.js';

export const convertedInMonthSpec = (startMs, endMs) => monthWindowSpec('convertedAt', startMs, endMs);
export const lostInMonthSpec = (startMs, endMs) => monthWindowSpec('lostAt', startMs, endMs);
// Aula e visita se separam no navegador (isAulaRecord): juntar `type` com o
// intervalo de scheduledFor pede índice composto e falha com FAILED_PRECONDITION.
export const aulasInMonthSpec = (startMs, endMs) => monthWindowSpec('scheduledFor', startMs, endMs);

// Aulas de mês fechado que vêm do servidor, e não do cache conferido por
// contagem. A contagem só enxerga registro entrando ou saindo da janela de
// scheduledFor. O desfecho (status, outcomeAt) e a conversão (converted, que
// markConvertingAula grava na matrícula, às vezes semanas depois) mudam o
// registro sem mudar a data, e o cache do aparelho ficaria com a versão velha:
// o número mudaria de aparelho para aparelho. Valem os dois meses anteriores
// ao corrente, uma vez por sessão (a entrada vai para a memória). Os mais
// antigos seguem com a contagem, e a conversão gravada depois numa aula deles
// pode não chegar enquanto o cache tiver a versão velha: limite aceito.
export const aulasFromServerFor = (key, currentKey) =>
  key >= addMonthsToKey(currentKey, -2) && key < currentKey;

// Meses que a tela precisa, em ordem (Decisão 5 do plano). A tendência pede os
// 6 meses até o exibido. A safra de mês fechado é acompanhada até hoje, então
// entram os meses do exibido até o corrente. O comparado, quando é cortado
// (mês exibido em andamento), entra com o mês seguinte a ele, porque o
// agendamento marcado antes do corte pode ser para uma data do mês seguinte;
// quando não é cortado, entra com os meses até o corrente. Cada trecho tem no
// máximo 36 meses, para uma chave malformada não prender o laço; o pior caso
// da tela (11 meses para trás contra o mesmo mês do ano anterior) dá 24.
const MAX_SPAN_MONTHS = 36;
export function crmMonthKeys({ monthKey, compareOn, compareKey, currentKey }) {
  const keys = new Set();
  const span = (from, to) => {
    let k = from;
    for (let i = 0; i < MAX_SPAN_MONTHS && k <= to; i++, k = addMonthsToKey(k, 1)) keys.add(k);
  };
  span(addMonthsToKey(monthKey, -5), monthKey);
  span(monthKey, currentKey);
  if (compareOn && compareKey) {
    if (monthKey === currentKey) {
      keys.add(compareKey);
      keys.add(addMonthsToKey(compareKey, 1));
    } else span(compareKey, currentKey);
  }
  return [...keys].sort();
}

// Maior instante (ms) de um campo de data na lista, ou null.
export function newestTimeOf(list, field) {
  let newest = null;
  (list || []).forEach((x) => {
    const t = getSafeDateOrNull(x?.[field])?.getTime();
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  });
  return newest;
}

// Janela da busca incremental do mês corrente para um campo: desde a âncora
// (o mais novo já devolvido pelo servidor, limitado ao instante da busca, menos
// a folga) até o fim do mês. Sem âncora, o mês inteiro. É a regra dos leads
// criados do Operacional, reusada daqui para não haver duas.
export const currentFieldWindow = (key, newest, fetchedAt) =>
  currentMonthLeadsWindow(key, leadsWindowSince({ newestCreatedAt: newest, fetchedAt }));

// Busca que falhou em todas as tentativas: o mês entra vazio e marcado, para
// a tela não ficar presa carregando.
export const failedCrmEntry = (closed) => ({ closed, converted: [], lost: [], aulas: [], failed: true });

// Memória da sessão: só entrada completa, e o mês só anda de aberto para fechado.
export const shouldRememberCrmEntry = (prev, next) =>
  Boolean(next) && !next.failed && shouldStoreMonthEntry(prev, next);

const maxOf = (a, b) => {
  const v = [a, b].filter(Number.isFinite);
  return v.length ? Math.max(...v) : null;
};

// Busca do mês corrente entrando na entrada que já estava na memória (Decisão
// 6). Matrículas e perdas se unem por id, e a busca mais recente ganha; os
// agendamentos são trocados pelos da busca mais recente, porque o desfecho
// muda o registro sem mudar nenhuma data e eles vêm inteiros a cada abertura.
// Entrada ausente, de mês fechado ou que falhou fica como está.
export function mergeCrmCurrent(entry, fresh) {
  if (!entry || entry.closed || entry.failed) return entry;
  const newer = !Number.isFinite(entry.fetchedAt) || fresh.fetchedAt >= entry.fetchedAt;
  const join = (older, latest) => (newer ? unionById(older, latest) : unionById(latest, older));
  return {
    ...entry,
    converted: join(entry.converted, fresh.converted),
    lost: join(entry.lost, fresh.lost),
    aulas: newer ? fresh.aulas : entry.aulas,
    fetchedAt: newer ? fresh.fetchedAt : entry.fetchedAt,
    newestConvertedAt: maxOf(entry.newestConvertedAt, newestTimeOf(fresh.converted, 'convertedAt')),
    newestLostAt: maxOf(entry.newestLostAt, newestTimeOf(fresh.lost, 'lostAt'))
  };
}

// Leads citados pelos meses carregados (agendamentos e trocas de etapa
// gravadas) que não estão em `known`. A tela precisa do dono e do funil deles
// (Decisão 7). O registro sem leadId e o cancelado ficam fora: nenhuma conta
// procura o dono deles, e o `loading` esperaria essa busca à toa. Em ordem,
// para a busca ser estável.
export function referencedLeadIds(months, known) {
  const ids = new Set();
  Object.values(months || {}).forEach((m) => {
    (m.aulas || []).forEach((r) => {
      if (r?.leadId && r.status !== AULA_STATUS.CANCELLED && !known.has(r.leadId)) ids.add(r.leadId);
    });
    (m.interactions || []).forEach((i) => {
      if (i?.type === 'status_change' && typeof i.toStatus === 'string' && i.leadId && !known.has(i.leadId)) ids.add(i.leadId);
    });
  });
  return [...ids].sort();
}

// A versão mais nova de cada lead conhecido, da menos fresca para a mais:
// meses fechados em ordem (em cada um, criados, perdidos e matriculados; o
// mês fechado pode ter vindo do cache do aparelho), os buscados por id nesta
// sessão, o mês corrente (do servidor) e os ao vivo do App. Busca por id que
// não achou o lead (null) não entra.
export function mergeLeadsById({ months, currentKey, fetched, liveLeads }) {
  const map = new Map();
  const put = (l) => { if (l?.id) map.set(l.id, l); };
  const putMonth = (m) => {
    if (!m) return;
    (m.leadsCreated || []).forEach(put);
    (m.lost || []).forEach(put);
    (m.converted || []).forEach(put);
  };
  Object.keys(months || {}).sort().filter((k) => k !== currentKey).forEach((k) => putMonth(months[k]));
  (fetched || new Map()).forEach((l) => put(l));
  putMonth(months?.[currentKey]);
  (liveLeads || []).forEach(put);
  return map;
}

// Sinal de matrícula ou perda feita com a tela aberta: o maior createdAt (ms)
// entre as trocas de etapa (status_change) para Perda ou para etapa com nome
// de matrícula, nas interações ao vivo. A troca é gravada no mesmo lote que o
// lead (logInteraction e a matrícula), então quando ela chega a matrícula ou a
// perda já está no servidor. Sem nenhuma, 0.
export function liveOutcomeSignal(interactions) {
  let newest = 0;
  (interactions || []).forEach((i) => {
    if (i?.type !== 'status_change' || typeof i.toStatus !== 'string') return;
    if (i.toStatus !== 'Perda' && !isConvertedStatusName(i.toStatus)) return;
    const t = getSafeDateOrNull(i.createdAt)?.getTime();
    if (Number.isFinite(t) && t > newest) newest = t;
  });
  return newest;
}
