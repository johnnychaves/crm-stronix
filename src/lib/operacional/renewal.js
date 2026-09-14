// Renovação a partir dos contratos: coorte do mês (fim da vigência no mês),
// desfecho de cada contrato, quando renovou, taxa, motivos de quem não vai
// renovar, contatos nos marcos e a vencer. A carteira é do responsável ATUAL
// pelo cliente (doc do lead); sem o doc, vale o consultor do contrato.

import { getSafeDateOrNull } from '../dates.js';
import { contractStateAt, hasOpenPause, indexContracts } from './base.js';
import { dayKeyOf } from './month.js';

const DAY_MS = 86400000;
const OTHER_REASON = 'Outro';

export function ownerOf(contract, leadsById) {
  return leadsById?.get(contract.leadId)?.consultantId || contract.consultantId || 'sem-consultor';
}

// Filtro de dono: null = todos; um id; ou uma função (id → boolean), que o
// metricsOf usa para quem está fora da equipe.
const ownerFilter = (owner) => {
  if (!owner) return null;
  return typeof owner === 'function' ? owner : (id) => id === owner;
};

// A lista da pessoa no índice vem em ordem de início: o mais recente é o último.
const isLatestOfPerson = (c, index) => {
  const list = index.byPerson.get(c.personKey) || [];
  const last = list[list.length - 1];
  return !c.startsAt || !last?.startsAt || last.startsAt <= c.startsAt;
};

// Contratos da mesma pessoa que começam depois deste.
const laterOfPerson = (c, index) => (index.byPerson.get(c.personKey) || [])
  .filter((o) => o !== c && o.startsAt && c.startsAt && o.startsAt > c.startsAt);

// Sucessor = renovação ligada (renewedFromId) ou outro contrato da mesma pessoa
// criado até o fim + tolerância (cobre a reativação feita pela ficha, que nasce
// como matrícula). Só conta o que já existia no corte (asOf).
function successorOf(c, index, graceMs, asOf) {
  const limit = c.endsAt ? c.endsAt.getTime() + graceMs : null;
  let best = null;
  const take = (o) => {
    if (o === c || !o.createdAt || o.createdAt > asOf) return;
    if (!best || o.createdAt < best.createdAt) best = o;
  };
  (index.byRenewedFrom.get(c.id) || []).forEach(take);
  if (limit != null) {
    laterOfPerson(c, index).forEach((o) => {
      if (o.createdAt && o.createdAt.getTime() <= limit) take(o);
    });
  }
  return best;
}

function declineOf(c, index, leadsById, asOf) {
  const lead = leadsById?.get(c.leadId);
  if (!lead?.renewalDeclined || !isLatestOfPerson(c, index)) return null;
  const at = getSafeDateOrNull(lead.renewalDeclinedAt);
  if (at && at > asOf) return null;
  return { reason: lead.renewalDeclineReason || OTHER_REASON };
}

export function renewalCohort(contracts, { start, end, asOf, graceDays, leadsById }) {
  const index = indexContracts(contracts);
  const graceMs = (Number(graceDays) || 0) * DAY_MS;
  const rows = [];
  (contracts || []).forEach((c) => {
    if (!c.endsAt || c.endsAt < start || c.endsAt >= end) return;
    if (c.cancelledAt && c.cancelledAt < c.endsAt) return;
    // Trancado não vence: o fim anda na reativação e o contrato vai para a
    // coorte do mês em que passar a vencer.
    if (hasOpenPause(c)) return;
    const s = successorOf(c, index, graceMs, asOf);
    let outcome;
    let when = null;
    let reason = null;
    if (s) {
      outcome = 'renew';
      const sk = dayKeyOf(s.createdAt);
      const ek = dayKeyOf(c.endsAt);
      when = sk < ek ? 'antes' : sk === ek ? 'no' : 'depois';
    } else {
      const decline = declineOf(c, index, leadsById, asOf);
      if (decline) { outcome = 'wont'; reason = decline.reason; }
      else outcome = c.endsAt <= asOf ? 'lapsed' : 'pending';
    }
    rows.push({ contract: c, owner: ownerOf(c, leadsById), outcome, when, reason });
  });
  return rows;
}

export function summarizeCohort(rows, { owner = null } = {}) {
  const match = ownerFilter(owner);
  const pick = match ? rows.filter((r) => match(r.owner)) : rows;
  const counts = { renew: 0, wont: 0, lapsed: 0, pending: 0 };
  const when = { antes: 0, no: 0, depois: 0 };
  const reasons = new Map();
  pick.forEach((r) => {
    counts[r.outcome] += 1;
    if (r.when) when[r.when] += 1;
    if (r.reason) reasons.set(r.reason, (reasons.get(r.reason) || 0) + 1);
  });
  const decided = counts.renew + counts.wont + counts.lapsed;
  return {
    counts,
    when,
    cohort: pick.length,
    decided,
    rate: decided > 0 ? Math.round((counts.renew / decided) * 100) : null,
    wontReasons: {
      total: counts.wont,
      items: [...reasons].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    }
  };
}

// Quando cada candidato a sucessor foi criado (ms), pela regra da coorte:
// renovação ligada ou outro contrato da mesma pessoa que começa depois.
function successorTimes(c, index) {
  const out = [];
  const add = (o) => { if (o !== c && o.createdAt) out.push(o.createdAt.getTime()); };
  (index.byRenewedFrom.get(c.id) || []).forEach(add);
  laterOfPerson(c, index).forEach((o) => { if (o.renewedFromId !== c.id) add(o); });
  return out;
}

// Marcos da academia (renewalCheckpoints) prontos para a conta: números
// positivos, sem repetição, do maior para o menor. Lista malformada vira vazia.
export function normalizeCheckpoints(checkpoints) {
  const list = Array.isArray(checkpoints) ? checkpoints : [];
  return [...new Set(list.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => b - a);
}

// Quanto o intervalo de um marco pode passar do fim do mês, em dias: o maior
// intervalo, do marco até o seguinte (ou até o fim, no menor). Um marco
// cruzado no último instante do mês conta contatos até esse tanto depois.
// [90, 60, 30] dá 30; [90, 30] dá 60.
export function milestoneSpanDays(checkpoints) {
  const cps = normalizeCheckpoints(checkpoints);
  return cps.reduce((max, cp, i) => Math.max(max, cp - (cps[i + 1] ?? 0)), 0);
}

// Marco C cruza em fim − C dias, e o cruzamento tem de cair no mês. Chegou ao
// marco quem estava vigente e ainda sem sucessor nesse dia. Feito = tarefa de
// renovação concluída (de qualquer autor) ou sucessor criado entre o
// cruzamento e o marco seguinte (o fim, no menor marco): o intervalo passa do
// fim do mês em até milestoneSpanDays, mas não do corte (asOf). As interações
// precisam cobrir esse intervalo; o metricsOf manda as do mês e as dos meses
// que ele alcança (metrics.milestoneMonthsAfter).
export function milestones(contracts, { start, end, asOf = null, checkpoints, interactions, leadsById, owner = null }) {
  const index = indexContracts(contracts);
  const cps = normalizeCheckpoints(checkpoints);
  const doneByLead = new Map();
  (interactions || []).forEach((i) => {
    if (i.type !== 'daily_goal_done' || i.dailyGoalCategory !== 'renovacao' || !(i.createdAt instanceof Date)) return;
    const arr = doneByLead.get(i.leadId);
    if (arr) arr.push(i.createdAt.getTime()); else doneByLead.set(i.leadId, [i.createdAt.getTime()]);
  });
  const startMs = start.getTime();
  const endMs = end.getTime();
  const asOfMs = asOf ? asOf.getTime() : Infinity;
  const match = ownerFilter(owner);
  return cps.map((cp, i) => {
    const next = cps[i + 1];
    let total = 0;
    let done = 0;
    (contracts || []).forEach((c) => {
      if (!c.endsAt) return;
      const endsMs = c.endsAt.getTime();
      const xMs = endsMs - cp * DAY_MS;
      if (xMs < startMs || xMs >= endMs) return;
      if (match && !match(ownerOf(c, leadsById))) return;
      if (contractStateAt(c, new Date(xMs)) !== 'vigente') return;
      const successors = successorTimes(c, index);
      if (successors.some((t) => t < xMs)) return;
      total += 1;
      const untilMs = Math.min(next ? endsMs - next * DAY_MS : endsMs, asOfMs);
      const inside = (t) => t >= xMs && t < untilMs;
      if ((doneByLead.get(c.leadId) || []).some(inside) || successors.some(inside)) done += 1;
    });
    return { days: cp, total, done, pct: total > 0 ? Math.round((done / total) * 100) : null };
  });
}

// Contratos vigentes, sem o próximo já fechado, em faixas a partir de agora.
export function upcomingExpirations(contracts, { now, leadsById, owner = null }) {
  const index = indexContracts(contracts);
  const nowMs = now.getTime();
  const match = ownerFilter(owner);
  const buckets = { d30: 0, d60: 0, d90: 0 };
  (contracts || []).forEach((c) => {
    if (!c.endsAt) return;
    const days = (c.endsAt.getTime() - nowMs) / DAY_MS;
    // Vigente agora tem fim depois de agora; fora das faixas nem precisa de mais conta.
    if (days <= 0 || days > 90) return;
    if (contractStateAt(c, now) !== 'vigente' || !isLatestOfPerson(c, index)) return;
    if (match && !match(ownerOf(c, leadsById))) return;
    if (days <= 30) buckets.d30 += 1;
    else if (days <= 60) buckets.d60 += 1;
    else buckets.d90 += 1;
  });
  return buckets;
}
