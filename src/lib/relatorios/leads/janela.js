// Carga dos Relatórios de Leads (spec 2026-10-09, "A carga" e "As contas").
// Puro. A carga é a do painel CRM (useCrmSources), por mês e com a mesma
// memória de sessão: aqui se decide quais meses pedir e se monta o índice deles,
// juntando os baldes pela mesma função do painel (newestRecordsOf, em
// src/lib/crm/metrics.js).

import { addMonthsToKey, monthKeyOf } from '../../operacional/month.js';
import { contactTimesByLead } from '../../crm/contact.js';
import { recordsByLeadOf, visitOutcomesByLead } from '../../crm/appointments.js';
import { newestRecordsOf } from '../../crm/metrics.js';

// O mesmo teto do painel (crmMonthKeys): uma data torta não prende o laço.
const MAX_SPAN_MONTHS = 36;

// Meses que a tela pede, em ordem: do mês do início mais antigo (o período ou
// o comparado) até o mês atual. A safra da Conversão é acompanhada até agora,
// e o primeiro contato olha o mês seguinte ao do cadastro, então os meses
// depois do período também entram.
export function reportMonthKeys(period, cmp, currentKey) {
  const starts = [period?.start, cmp?.start].filter((d) => d instanceof Date).map((d) => d.getTime());
  if (!starts.length) return [currentKey];
  const keys = [];
  let k = monthKeyOf(new Date(Math.min(...starts)));
  for (let i = 0; i < MAX_SPAN_MONTHS && k <= currentKey; i++, k = addMonthsToKey(k, 1)) keys.push(k);
  return keys.length ? keys : [currentKey];
}

// Índices de toda a carga, os mesmos do painel: registros de agendamento por
// lead, instantes de contato e desfechos de visita pela linha do tempo. Os
// registros vão sem repetir id, com a cópia do mês mais novo. As interações
// entram como no cacheOf do painel, sem tirar repetidos aqui: as duas funções
// do painel (contactTimesByLead e visitOutcomesByLead) já tiram pelo id, e a
// interação que veio sem id continua contando.
function buildIndex(months) {
  const interactions = Object.values(months || {}).flatMap((m) => m.interactions || []);
  const records = newestRecordsOf(months, 'aulas');
  return {
    records,
    recordsByLead: recordsByLeadOf(records),
    contactTimes: contactTimesByLead(interactions),
    visitOutcomes: visitOutcomesByLead(interactions),
  };
}

// O índice depende só dos meses carregados, e a tela refaz o relatório a cada
// clique num número ou numa linha de recorte, a cada virada de minuto e a cada
// período novo. Refazê-lo a cada vez era reler as interações de todos os meses
// à toa, e era a maior parte da conta da Conversão. Por isso ele fica guardado
// pelo objeto de meses, como o cacheOf do painel (src/lib/crm/metrics.js)
// guarda pelo ctx: a useCrmSources entrega o mesmo objeto enquanto nada muda e
// outro quando chega interação, lead ou registro, e aí o índice é refeito. O
// resultado é compartilhado e ninguém o altera. Quem muda um insumo entrega
// outro objeto de meses; mexer por dentro do mesmo objeto devolve o índice
// velho.
const indexes = new WeakMap();

export function reportIndex(months) {
  if (!months || typeof months !== 'object') return buildIndex(months);
  let index = indexes.get(months);
  if (!index) {
    index = buildIndex(months);
    indexes.set(months, index);
  }
  return index;
}

// Estado da carga dos meses pedidos: pronta quando todos chegaram; com falha
// quando algum falhou, e aí a tela mostra o aviso e nenhum número.
export function loadState(months, keys) {
  const entries = (keys || []).map((k) => months?.[k] || null);
  return { ready: entries.every(Boolean), failed: entries.some((e) => Boolean(e?.failed)) };
}
