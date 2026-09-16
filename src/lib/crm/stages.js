// Trocas de etapa do CRM (spec §4 e §5): a passagem entre etapas, a etapa em
// que o lead se perdeu e a carteira de agora. As trocas são as interações
// status_change gravadas desde a PR #208, com fromStatus, toStatus, funnelId
// e, na troca de funil, fromFunnelId. O nome da etapa é o da hora da troca.
// Puro.

import { isConvertedStatusName } from '../leads.js';
import { deriveLeadBucket } from '../leadDerived.js';
import { getSafeDateOrNull } from '../dates.js';
import { isItemInFunnel } from '../funnels.js';
import { isImportCreatedLead } from '../operacional/routine.js';
import { median, rankCounts } from './stats.js';
import { firstEnrolledAtOf } from './cohort.js';

const DAY_MS = 86400000;

// A troca anterior ao registro (só o texto "Movido para a etapa [X]") não tem
// toStatus e fica de fora.
export const isStageMove = (i) =>
  i?.type === 'status_change' && typeof i.toStatus === 'string' && i.createdAt instanceof Date;

// leadId → trocas em ordem de data, sem repetir id.
export function movesByLead(interactions) {
  const map = new Map();
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (!isStageMove(i) || !i.leadId) return;
    if (i.id) {
      if (seen.has(i.id)) return;
      seen.add(i.id);
    }
    const list = map.get(i.leadId) || [];
    list.push(i);
    map.set(i.leadId, list);
  });
  map.forEach((list) => list.sort((a, b) => a.createdAt - b.createdAt));
  return map;
}

// Passagem entre etapas de um funil no mês [start, end), acompanhada até asOf
// (spec §4). Por etapa:
// - entraram: as trocas do mês para a etapa e os leads de `newLeads`
//   cadastrados no mês, a partir de `trackingSince`, na etapa em que nasceram.
//   A etapa e o funil de nascimento são a origem da primeira troca real do
//   lead; sem troca, a etapa e o funil de hoje. Importado e lead sem data de
//   cadastro não entram pelo cadastro, como nos leads novos;
// - de cada entrada, a troca real seguinte do lead, até asOf, decide: para
//   Perda, perderam; para etapa de ordem maior no mesmo funil ou com nome de
//   matrícula, avançaram; o resto (etapa menor, outro funil) segue na etapa.
//   Sem troca seguinte, a primeira matrícula depois da entrada é avanço.
//   Avanço e perda são das entradas do mês e nunca passam de entraram;
// - mediana: nas saídas do mês, o tempo desde a entrada na etapa, que é a
//   troca anterior, quando foi ela que levou o lead para a etapa, ou, na
//   primeira troca real de quem foi cadastrado a partir de trackingSince, o
//   cadastro. Quem foi cadastrado antes pode ter trocado de etapa sem registro
//   ou num mês fora da carga (metrics.js, loadedRunStart).
// Troca que não muda nada (mesma etapa e mesmo funil, com o padrão no lugar do
// funil vazio) é ignorada em tudo. `ownerOk` recorta entraram, avançaram e
// perderam pela pessoa; a mediana é da academia inteira, porque mediana não
// soma nem se recorta (README §6).
export function stagePassageOf({
  moves, funnelId, defaultFunnelId, stages, start, end, asOf, ownerOk, leadOf, newLeads = [], trackingSince = null
}) {
  const inMonth = (t) => t >= start && t < end;
  const sameFunnel = (id) => id === funnelId || (!id && funnelId === defaultFunnelId);
  const effFunnel = (id) => id || defaultFunnelId || null;
  const fromFunnelOf = (m) => (m.fromFunnelId !== undefined ? m.fromFunnelId : m.funnelId);
  const changes = (m) => m.fromStatus !== m.toStatus || effFunnel(fromFunnelOf(m)) !== effFunnel(m.funnelId);
  const tracked = (l) => l?.createdAt instanceof Date && !l.createdAtMissing && (!trackingSince || l.createdAt >= trackingSince);
  const isLeadStage = (name) => Boolean(name) && name !== 'Perda' && !isConvertedStatusName(name);

  // Só as trocas reais de cada lead, em ordem.
  const real = new Map();
  moves.forEach((list, leadId) => {
    const kept = list.filter(changes);
    if (kept.length) real.set(leadId, kept);
  });

  const names = [...(stages || [])];
  real.forEach((list) => list.forEach((m) => {
    if (inMonth(m.createdAt) && sameFunnel(m.funnelId) && isLeadStage(m.toStatus) && !names.includes(m.toStatus)) names.push(m.toStatus);
  }));
  const orderOf = new Map(names.map((n, i) => [n, i]));
  const rows = new Map(names.map((n) => [n, { entered: 0, advanced: 0, lost: 0, durations: [] }]));

  // Uma entrada na etapa, no instante `at`. A troca real seguinte, até asOf,
  // decide o destino; sem ela, só a primeira matrícula depois da entrada.
  const enter = (row, stage, at, next, lead) => {
    row.entered += 1;
    if (next && next.createdAt <= asOf) {
      if (next.toStatus === 'Perda') row.lost += 1;
      else if (isConvertedStatusName(next.toStatus)
        || (sameFunnel(next.funnelId) && (orderOf.get(next.toStatus) ?? -1) > orderOf.get(stage))) row.advanced += 1;
      return;
    }
    const enrolled = firstEnrolledAtOf(lead);
    if (enrolled && enrolled > at && enrolled <= asOf) row.advanced += 1;
  };

  // Entrada pelo cadastro.
  const seenNew = new Set();
  (newLeads || []).forEach((l) => {
    if (!l?.id || seenNew.has(l.id)) return;
    seenNew.add(l.id);
    if (!tracked(l) || !inMonth(l.createdAt) || isImportCreatedLead(l) || !ownerOk(l)) return;
    const first = (real.get(l.id) || [])[0];
    const stage = first ? first.fromStatus : l.status;
    const row = sameFunnel(first ? fromFunnelOf(first) : l.funnelId) ? rows.get(stage) : null;
    if (row) enter(row, stage, l.createdAt, first, l);
  });

  // Entrada pela troca, e a saída, que dá o tempo na etapa.
  real.forEach((list, leadId) => {
    const lead = leadOf(leadId);
    const mine = ownerOk(lead);
    list.forEach((m, idx) => {
      if (!inMonth(m.createdAt)) return;
      const entry = sameFunnel(m.funnelId) ? rows.get(m.toStatus) : null;
      if (entry && mine) enter(entry, m.toStatus, m.createdAt, list[idx + 1], lead);
      const exit = sameFunnel(fromFunnelOf(m)) ? rows.get(m.fromStatus) : null;
      if (!exit) return;
      const prev = list[idx - 1];
      let enteredAt = null;
      if (prev) {
        if (prev.toStatus === m.fromStatus && sameFunnel(prev.funnelId)) enteredAt = prev.createdAt;
      } else if (tracked(lead)) {
        enteredAt = lead.createdAt;
      }
      if (enteredAt && m.createdAt >= enteredAt) exit.durations.push((m.createdAt - enteredAt) / 60000);
    });
  });

  const out = names.map((name) => {
    const r = rows.get(name);
    return { name, entered: r.entered, advanced: r.advanced, lost: r.lost, medianMin: median(r.durations) };
  });
  const worst = out.filter((r) => r.entered > 0 && r.lost > 0)
    .sort((a, b) => b.lost / b.entered - a.lost / a.entered || b.lost - a.lost)[0] || null;
  return { rows: out, worst };
}

// Etapa em que o lead foi perdido (spec §4), para os mesmos leads perdidos do
// card de perdas (lossesOf): o fromStatus da última troca do lead para Perda
// dentro de [start, end). Sem troca gravada no mês, "Sem etapa". Assim os dois
// blocos do card, por motivo e por etapa, somam o mesmo total.
export function lossStagesOf({ lostLeads, moves, start, end }) {
  const map = new Map();
  (lostLeads || []).forEach((l) => {
    const last = (moves.get(l.id) || [])
      .filter((m) => m.toStatus === 'Perda' && m.createdAt >= start && m.createdAt < end)
      .pop();
    const name = String(last?.fromStatus || '').trim() || 'Sem etapa';
    map.set(name, (map.get(name) || 0) + 1);
  });
  return rankCounts(map);
}

// Carteira agora (spec §4, "Agora"): leads em jogo (balde ativo) neste
// instante. Com um funil, por etapa na ordem do funil, com a etapa que não
// está mais nele no fim; sem funil, por funil de lead, e quem está num funil
// que não existe mais em "Sem funil". Sem próximo contato: em jogo sem
// nextFollowUp, que por isso não aparece na Meta Diária de ninguém. O lead
// cadastrado há menos de 24 horas de `now` fica fora dessa conta, porque a
// Meta ainda o cobre como "Novo lead 24h" (dailyGoal.js). O lead sem data de
// cadastro fica dentro: a Meta não o cobre.
export function pipelineNowOf(liveLeads, { funnelId, funnels, defaultFunnelId, stages, ownerOk, funnelOk, now = null }) {
  const coveredByMeta = (l) => now instanceof Date && !l.createdAtMissing && l.createdAt instanceof Date
    && now.getTime() - l.createdAt.getTime() < DAY_MS;
  const open = [];
  const seen = new Set();
  (liveLeads || []).forEach((l) => {
    if (!l?.id || seen.has(l.id)) return;
    seen.add(l.id);
    if (deriveLeadBucket(l) === 'ativo' && ownerOk(l) && funnelOk(l)) open.push(l);
  });
  let rows;
  if (funnelId) {
    const names = [...(stages || [])];
    open.forEach((l) => { if (l.status && !names.includes(l.status)) names.push(l.status); });
    rows = names.map((name) => ({ name, count: open.filter((l) => l.status === name).length }));
  } else {
    const placed = new Set();
    rows = (funnels || []).map((f) => {
      const inIt = open.filter((l) => isItemInFunnel(l, f.id, defaultFunnelId));
      inIt.forEach((l) => placed.add(l.id));
      return { id: f.id, name: f.name, count: inIt.length };
    }).filter((r) => r.count > 0);
    const rest = open.filter((l) => !placed.has(l.id)).length;
    if (rest > 0) rows.push({ id: null, name: 'Sem funil', count: rest });
  }
  return {
    total: open.length,
    rows,
    noNext: open.filter((l) => !getSafeDateOrNull(l.nextFollowUp) && !coveredByMeta(l)).length
  };
}
