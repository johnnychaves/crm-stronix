// Trocas de etapa do CRM (spec §4 e §5): a passagem entre etapas, a etapa em
// que o lead se perdeu e a carteira de agora. As trocas são as interações
// status_change gravadas desde a PR #208, com fromStatus, toStatus, funnelId
// e, na troca de funil, fromFunnelId. O nome da etapa é o da hora da troca.
// Puro.

import { isConvertedStatusName } from '../leads.js';
import { deriveLeadBucket } from '../leadDerived.js';
import { getSafeDateOrNull } from '../dates.js';
import { isItemInFunnel } from '../funnels.js';
import { median, rankCounts } from './stats.js';
import { convertedAtOf } from './cohort.js';

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

// Passagem entre etapas de um funil no mês [start, end), acompanhada até asOf.
// `ownerOk` recorta entraram, avançaram e perderam pela pessoa; a mediana é da
// academia inteira, porque mediana não soma nem se recorta (README §6).
export function stagePassageOf({ moves, funnelId, defaultFunnelId, stages, start, end, asOf, ownerOk, leadOf }) {
  const inMonth = (m) => m.createdAt >= start && m.createdAt < end;
  const sameFunnel = (id) => id === funnelId || (!id && funnelId === defaultFunnelId);
  const isLeadStage = (name) => Boolean(name) && name !== 'Perda' && !isConvertedStatusName(name);
  const names = [...(stages || [])];
  moves.forEach((list) => list.forEach((m) => {
    if (inMonth(m) && sameFunnel(m.funnelId) && isLeadStage(m.toStatus) && !names.includes(m.toStatus)) names.push(m.toStatus);
  }));
  const orderOf = new Map(names.map((n, i) => [n, i]));
  const rows = new Map(names.map((n) => [n, { entered: 0, advanced: 0, lost: 0, durations: [] }]));

  moves.forEach((list, leadId) => {
    const lead = leadOf(leadId);
    const mine = ownerOk(lead);
    list.forEach((m, idx) => {
      if (!inMonth(m)) return;
      // Entrada na etapa.
      const entry = sameFunnel(m.funnelId) ? rows.get(m.toStatus) : null;
      if (entry && mine) {
        entry.entered += 1;
        const next = list[idx + 1];
        const byMove = Boolean(next) && next.createdAt <= asOf && (isConvertedStatusName(next.toStatus)
          || (sameFunnel(next.funnelId) && (orderOf.get(next.toStatus) ?? -1) > orderOf.get(m.toStatus)));
        const conv = convertedAtOf(lead);
        const byEnroll = Boolean(conv) && conv > m.createdAt && conv <= asOf;
        if (byMove || byEnroll) entry.advanced += 1;
      }
      // Saída da etapa: perda e tempo na etapa.
      const fromFunnel = m.fromFunnelId !== undefined ? m.fromFunnelId : m.funnelId;
      const exit = sameFunnel(fromFunnel) ? rows.get(m.fromStatus) : null;
      if (!exit) return;
      if (m.toStatus === 'Perda' && mine) exit.lost += 1;
      const prev = list.slice(0, idx).reverse().find((x) => x.toStatus === m.fromStatus && sameFunnel(x.funnelId));
      const firstStage = orderOf.get(m.fromStatus) === 0;
      const enteredAt = prev
        ? prev.createdAt
        : (firstStage && lead?.createdAt instanceof Date && !lead.createdAtMissing ? lead.createdAt : null);
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

// Etapa em que o lead foi perdido: o fromStatus das trocas para Perda do mês.
export function lossStagesOf({ moves, start, end, inScope, leadOf }) {
  const map = new Map();
  moves.forEach((list, leadId) => {
    if (!inScope(leadOf(leadId))) return;
    list.forEach((m) => {
      if (m.toStatus !== 'Perda' || m.createdAt < start || m.createdAt >= end) return;
      const name = String(m.fromStatus || '').trim() || 'Sem etapa';
      map.set(name, (map.get(name) || 0) + 1);
    });
  });
  return rankCounts(map);
}

// Carteira agora (spec §4, "Agora"): leads em jogo (balde ativo) neste
// instante. Com um funil, por etapa na ordem do funil, com a etapa que não
// está mais nele no fim; sem funil, por funil de lead, e quem está num funil
// que não existe mais em "Sem funil". Sem próximo contato: em jogo sem
// nextFollowUp, que por isso não aparece na Meta Diária de ninguém.
export function pipelineNowOf(liveLeads, { funnelId, funnels, defaultFunnelId, stages, ownerOk, funnelOk }) {
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
  return { total: open.length, rows, noNext: open.filter((l) => !getSafeDateOrNull(l.nextFollowUp)).length };
}
