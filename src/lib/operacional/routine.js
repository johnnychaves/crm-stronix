// Rotina do Operacional: meta diária e régua de dias, prospecção (total e por
// dia), tarefas concluídas por tipo e atrasados agora. Mesmas réguas da Meta
// Diária (src/lib/dailyGoal.js); a equipe é sempre a soma das pessoas.

import { volumeTargetFor, interactionOwnerAuthUid } from '../dailyGoal.js';
import { dayKeyOf } from './month.js';

export const TASK_ROWS = [
  { id: 'novos', label: 'Novos leads' },
  { id: 'contatos', label: 'Contatos' },
  { id: 'agenda', label: 'Visitas e aulas' },
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'renovacoes', label: 'Renovações' },
  { id: 'vencidos', label: 'Vencidos' }
];

const TASK_OF_CATEGORY = {
  novo_24h: 'novos',
  contato_hoje: 'contatos',
  visita_hoje: 'agenda',
  aula_hoje: 'agenda',
  atrasado: 'atrasados',
  renovacao: 'renovacoes',
  vencido: 'vencidos'
};

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// hitsBy: userId → Set de dias batidos no mês (inclui hoje, para a régua).
export function metaDaysSummary({ users, history, metaDays }) {
  const closed = metaDays.filter((d) => d.state === 'closed');
  const monthDays = new Set(metaDays.map((d) => d.key));
  const hitsBy = new Map((users || []).map((u) => [u.id, new Set()]));
  (history || []).forEach((h) => {
    const set = hitsBy.get(h.consultantId);
    if (set && monthDays.has(h.date)) set.add(h.date);
  });
  const byUser = new Map();
  hitsBy.forEach((set, id) => {
    byUser.set(id, { done: closed.filter((d) => set.has(d.key)).length, total: closed.length });
  });
  return { closedCount: closed.length, hitsBy, byUser };
}

export function pickMeta(summary, userId = null) {
  const rows = userId ? [summary.byUser.get(userId)].filter(Boolean) : [...summary.byUser.values()];
  const done = rows.reduce((a, r) => a + r.done, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { done, total, pct: pct(done, total) };
}

export function metaCalendar({ metaDays, hitsBy, userId = null }) {
  return metaDays.map((d) => ({
    key: d.key,
    day: d.day,
    weekday: d.weekday,
    state: d.state,
    hits: [...hitsBy.values()].filter((s) => s.has(d.key)).length,
    me: userId ? Boolean(hitsBy.get(userId)?.has(d.key)) : null
  }));
}

// Ações por dia de meta (fechados + hoje): lead criado (dono = consultantId,
// qualquer balde) e interação com volumeKind (dono = quem fez). Com `end` (o
// corte), nada criado a partir dele conta, nem no próprio dia do corte.
export function prospectionSummary({ users, interactions, leadsCreated, metaDays, end = null }) {
  const days = metaDays.filter((d) => d.state !== 'future');
  const idxOf = new Map(days.map((d, i) => [d.key, i]));
  const byUser = new Map((users || []).map((u) => [u.id, { target: volumeTargetFor(u), perDay: days.map(() => 0) }]));
  const userOfAuth = new Map((users || []).map((u) => [u.authUid, u.id]));
  const afterCut = (d) => end != null && d >= end;
  const seenLead = new Set();
  (leadsCreated || []).forEach((l) => {
    if (!l?.id || seenLead.has(l.id) || l.createdAtMissing || !(l.createdAt instanceof Date) || afterCut(l.createdAt)) return;
    seenLead.add(l.id);
    const i = idxOf.get(dayKeyOf(l.createdAt));
    const row = byUser.get(l.consultantId);
    if (i != null && row) row.perDay[i] += 1;
  });
  (interactions || []).forEach((it) => {
    if (!it.volumeKind || !(it.createdAt instanceof Date) || afterCut(it.createdAt)) return;
    const i = idxOf.get(dayKeyOf(it.createdAt));
    const row = byUser.get(userOfAuth.get(interactionOwnerAuthUid(it)));
    if (i != null && row) row.perDay[i] += 1;
  });
  byUser.forEach((row) => {
    row.on = row.target > 0;
    row.done = row.perDay.reduce((a, b) => a + b, 0);
    row.targetTotal = row.target * days.length;
  });
  return { days, byUser };
}

// Equipe = só quem tem alvo. Alvo 0 é prospecção desligada, não 0%.
export function pickProspection(summary, userId = null) {
  const rows = userId ? [summary.byUser.get(userId)].filter(Boolean) : [...summary.byUser.values()];
  const on = rows.filter((r) => r.on);
  const done = on.reduce((a, r) => a + r.done, 0);
  const target = on.reduce((a, r) => a + r.targetTotal, 0);
  return {
    on: on.length > 0,
    done,
    target,
    dailyTarget: on.reduce((a, r) => a + r.target, 0),
    pct: pct(done, target),
    perDay: summary.days.map((_, i) => on.reduce((a, r) => a + r.perDay[i], 0)),
    days: summary.days
  };
}

export function tasksByType({ interactions, users, userId = null, start, end }) {
  const auth = userId ? (users || []).find((u) => u.id === userId)?.authUid : null;
  const out = Object.fromEntries(TASK_ROWS.map((r) => [r.id, 0]));
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (i.type !== 'daily_goal_done' || !(i.createdAt instanceof Date) || i.createdAt < start || i.createdAt >= end) return;
    const task = TASK_OF_CATEGORY[i.dailyGoalCategory];
    if (!task) return;
    if (userId && interactionOwnerAuthUid(i) !== auth) return;
    const key = `${i.leadId}|${i.dailyGoalCategory}|${dayKeyOf(i.createdAt)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out[task] += 1;
  });
  out.total = TASK_ROWS.reduce((a, r) => a + out[r.id], 0);
  return out;
}

// Mesma condição da categoria Atrasados da Meta Diária: lead fora de Venda e
// Perda com próximo contato antes do início de hoje.
export function overdueNow({ liveLeads, users, now }) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byUser = new Map((users || []).map((u) => [u.id, 0]));
  (liveLeads || []).forEach((l) => {
    if (l.status === 'Venda' || l.status === 'Perda') return;
    if (!(l.nextFollowUp instanceof Date) || l.nextFollowUp >= todayStart) return;
    if (byUser.has(l.consultantId)) byUser.set(l.consultantId, byUser.get(l.consultantId) + 1);
  });
  return { total: [...byUser.values()].reduce((a, b) => a + b, 0), byUser };
}
