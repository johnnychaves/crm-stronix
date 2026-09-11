// Renovação a partir dos contratos: coorte do mês (fim da vigência no mês),
// desfecho de cada contrato, quando renovou, taxa, motivos de quem não vai
// renovar, contatos nos marcos e a vencer. A carteira é do responsável ATUAL
// pelo cliente (doc do lead); sem o doc, vale o consultor do contrato.

import { getSafeDateOrNull } from '../dates.js';
import { contractStateAt, hasOpenPause } from './base.js';
import { dayKeyOf } from './month.js';

const DAY_MS = 86400000;
const OTHER_REASON = 'Outro';

export function ownerOf(contract, leadsById) {
  return leadsById?.get(contract.leadId)?.consultantId || contract.consultantId || 'sem-consultor';
}

const isLatestOfPerson = (c, contracts) =>
  !contracts.some((o) => o !== c && o.personKey === c.personKey && o.startsAt && c.startsAt && o.startsAt > c.startsAt);

// Sucessor = renovação ligada (renewedFromId) ou outro contrato da mesma pessoa
// criado até o fim + tolerância (cobre a reativação feita pela ficha, que nasce
// como matrícula). Só conta o que já existia no corte (asOf).
function successorOf(c, contracts, graceMs, asOf) {
  const limit = c.endsAt ? c.endsAt.getTime() + graceMs : null;
  const cands = contracts.filter((o) => {
    if (o === c || !o.createdAt || o.createdAt > asOf) return false;
    if (o.renewedFromId === c.id) return true;
    return o.personKey === c.personKey && o.startsAt && c.startsAt && o.startsAt > c.startsAt
      && limit != null && o.createdAt.getTime() <= limit;
  });
  return cands.sort((a, b) => a.createdAt - b.createdAt)[0] || null;
}

function declineOf(c, contracts, leadsById, asOf) {
  const lead = leadsById?.get(c.leadId);
  if (!lead?.renewalDeclined || !isLatestOfPerson(c, contracts)) return null;
  const at = getSafeDateOrNull(lead.renewalDeclinedAt);
  if (at && at > asOf) return null;
  return { reason: lead.renewalDeclineReason || OTHER_REASON };
}

export function renewalCohort(contracts, { start, end, asOf, graceDays, leadsById }) {
  const graceMs = (Number(graceDays) || 0) * DAY_MS;
  const rows = [];
  (contracts || []).forEach((c) => {
    if (!c.endsAt || c.endsAt < start || c.endsAt >= end) return;
    if (c.cancelledAt && c.cancelledAt < c.endsAt) return;
    // Trancado não vence: o fim anda na reativação e o contrato vai para a
    // coorte do mês em que passar a vencer.
    if (hasOpenPause(c)) return;
    const s = successorOf(c, contracts, graceMs, asOf);
    let outcome;
    let when = null;
    let reason = null;
    if (s) {
      outcome = 'renew';
      const sk = dayKeyOf(s.createdAt);
      const ek = dayKeyOf(c.endsAt);
      when = sk < ek ? 'antes' : sk === ek ? 'no' : 'depois';
    } else {
      const decline = declineOf(c, contracts, leadsById, asOf);
      if (decline) { outcome = 'wont'; reason = decline.reason; }
      else outcome = c.endsAt <= asOf ? 'lapsed' : 'pending';
    }
    rows.push({ contract: c, owner: ownerOf(c, leadsById), outcome, when, reason });
  });
  return rows;
}

export function summarizeCohort(rows, { owner = null } = {}) {
  const pick = owner ? rows.filter((r) => r.owner === owner) : rows;
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

// Marco C cruza em fim − C dias. Chegou ao marco no mês quem estava vigente e
// ainda sem renovação nesse dia. Feito = tarefa de renovação concluída (ou
// renovação) entre o cruzamento e o marco seguinte, dentro da janela do mês.
export function milestones(contracts, { start, end, checkpoints, interactions, leadsById, owner = null }) {
  const cps = [...new Set((checkpoints || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => b - a);
  const doneByLead = new Map();
  (interactions || []).forEach((i) => {
    if (i.type !== 'daily_goal_done' || i.dailyGoalCategory !== 'renovacao' || !(i.createdAt instanceof Date)) return;
    const arr = doneByLead.get(i.leadId);
    if (arr) arr.push(i.createdAt); else doneByLead.set(i.leadId, [i.createdAt]);
  });
  return cps.map((cp, idx) => {
    const next = cps[idx + 1];
    let total = 0;
    let done = 0;
    (contracts || []).forEach((c) => {
      if (!c.endsAt || (owner && ownerOf(c, leadsById) !== owner)) return;
      const x = new Date(c.endsAt.getTime() - cp * DAY_MS);
      if (x < start || x >= end || contractStateAt(c, x) !== 'vigente') return;
      if (contracts.some((o) => o.renewedFromId === c.id && o.createdAt && o.createdAt < x)) return;
      total += 1;
      const until = new Date(Math.min(next ? c.endsAt.getTime() - next * DAY_MS : c.endsAt.getTime(), end.getTime()));
      const contacted = (doneByLead.get(c.leadId) || []).some((t) => t >= x && t < until);
      const renewed = contracts.some((o) => o.renewedFromId === c.id && o.createdAt && o.createdAt >= x && o.createdAt < until);
      if (contacted || renewed) done += 1;
    });
    return { days: cp, total, done, pct: total > 0 ? Math.round((done / total) * 100) : null };
  });
}

// Contratos vigentes, sem o próximo já fechado, em faixas a partir de agora.
export function upcomingExpirations(contracts, { now, leadsById, owner = null }) {
  const buckets = { d30: 0, d60: 0, d90: 0 };
  (contracts || []).forEach((c) => {
    if (!c.endsAt || contractStateAt(c, now) !== 'vigente' || !isLatestOfPerson(c, contracts)) return;
    if (owner && ownerOf(c, leadsById) !== owner) return;
    const days = (c.endsAt.getTime() - now.getTime()) / DAY_MS;
    if (days <= 30) buckets.d30 += 1;
    else if (days <= 60) buckets.d60 += 1;
    else if (days <= 90) buckets.d90 += 1;
  });
  return buckets;
}
