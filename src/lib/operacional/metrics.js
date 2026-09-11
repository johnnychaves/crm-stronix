// Uma função calcula tudo (README do handoff §6): o mês exibido, o comparado e
// cada ponto de tendência chamam metricsOf. A fonte é sempre o detalhe; o
// número da equipe é a soma; nenhuma taxa é guardada.

import { monthRange, effectiveEnd, metaDaysOfMonth, isCurrentMonthKey, addMonthsToKey } from './month.js';
import { computeBaseMovement, computeChurn, cancellationsByReason, salesInWindow, countLockedAt } from './base.js';
import { renewalCohort, summarizeCohort, milestones, upcomingExpirations } from './renewal.js';
import { metaDaysSummary, pickMeta, metaCalendar, prospectionSummary, pickProspection, tasksByType, overdueNow } from './routine.js';

const sumMap = (m) => [...m.values()].reduce((a, b) => a + b, 0);

export function metricsOf(ctx, { monthKey, userId = null, cutEnd = null }) {
  const { start, end: monthEnd } = monthRange(monthKey);
  const running = isCurrentMonthKey(monthKey, ctx.now);
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  // Desfecho de renovação: no corte pró-rata vale o que existia no corte; nos
  // demais casos, o que existe hoje (renovação atrasada ainda conta).
  const asOf = end < monthEnd ? end : ctx.now;
  const snapshot = running && !cutEnd;
  const src = ctx.months?.[monthKey] || null;
  const users = ctx.users || [];
  const contracts = ctx.contracts || [];
  const grace = ctx.config?.renewalGraceDays;
  const metaDays = metaDaysOfMonth(monthKey, ctx.config?.metaWeekdays || [], end);

  const meta = src ? metaDaysSummary({ users, history: src.history, metaDays }) : null;
  const prospSummary = src ? prospectionSummary({ users, interactions: src.interactions, leadsCreated: src.leadsCreated, metaDays }) : null;

  const baseKnown = contracts.some((c) => c.startsAt && c.startsAt < end);
  const movement = computeBaseMovement(contracts, { start, end });
  const sales = salesInWindow(contracts, { start, end });
  const cohortRows = renewalCohort(contracts, { start, end: monthEnd, asOf, graceDays: grace, leadsById: ctx.leadsById });

  return {
    monthKey,
    running,
    start,
    end,
    hasSource: Boolean(src),
    meta: meta ? pickMeta(meta, userId) : null,
    calendar: meta ? metaCalendar({ metaDays, hitsBy: meta.hitsBy, userId }) : [],
    prosp: prospSummary ? pickProspection(prospSummary, userId) : null,
    tasks: src ? tasksByType({ interactions: src.interactions, users, userId, start, end }) : null,
    late: snapshot ? overdueNow({ liveLeads: ctx.liveLeads, users, now: ctx.now }) : null,
    base: {
      known: baseKnown,
      active: baseKnown ? movement.endCount : null,
      movement,
      locked: countLockedAt(contracts, new Date(end.getTime() - 1)),
      churn: computeChurn(contracts, { start, end, graceDays: grace }),
      cancels: cancellationsByReason(contracts, { start, end })
    },
    entered: userId ? (sales.entered.get(userId) || 0) : sumMap(sales.entered),
    enteredBy: sales.entered,
    upgrades: userId ? (sales.upgrades.get(userId) || 0) : sumMap(sales.upgrades),
    upgradesBy: sales.upgrades,
    renewal: summarizeCohort(cohortRows, { owner: userId }),
    milestones: src
      ? milestones(contracts, { start, end, checkpoints: ctx.config?.renewalCheckpoints, interactions: src.interactions, leadsById: ctx.leadsById, owner: userId })
      : null,
    upcoming: snapshot ? upcomingExpirations(contracts, { now: ctx.now, leadsById: ctx.leadsById, owner: userId }) : null
  };
}

const ppText = (v) => `${String(v).replace('.', ',')} p.p.`;

export function deltaOf(cur, prev, { kind = 'count' } = {}) {
  if (cur == null || prev == null) return { none: true, text: 'sem base' };
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return { flat: true, value: 0, text: 'igual' };
  const abs = Math.abs(d);
  const num = kind === 'pp' ? ppText(abs) : abs.toLocaleString('pt-BR');
  return { up: d > 0, value: d, text: `${d > 0 ? '+' : '−'}${num}` };
}

const TASK_TEXT = {
  novos: 'Tarefas de novos leads concluídas',
  contatos: 'Contatos concluídos',
  agenda: 'Visitas e aulas concluídas',
  atrasados: 'Tarefas de atrasados concluídas',
  renovacoes: 'Tarefas de renovação concluídas',
  vencidos: 'Tarefas de vencidos concluídas'
};

const CANCEL_TEXT = {
  Financeiro: 'por motivo financeiro',
  'Mudou de cidade': 'por mudança de cidade',
  'Insatisfação': 'por insatisfação',
  'Saúde ou lesão': 'por saúde ou lesão',
  'Foi para outra academia': 'para outra academia',
  Outro: 'por outros motivos'
};

// Destaques NÃO repetem as 5 métricas da faixa: só o que está no fundo da tela.
export function buildHighlights(cur, prev, { limit = 3 } = {}) {
  if (!cur || !prev) return [];
  const out = [];
  const add = (label, c, p, { kind = 'count', unit = ['', ''], goodUp = true } = {}) => {
    if (c == null || p == null) return;
    const d = Math.round((c - p) * 10) / 10;
    if (d === 0) return;
    const abs = Math.abs(d);
    const show = (v) => (kind === 'pp' ? `${v}%` : v.toLocaleString('pt-BR'));
    out.push({
      text: `${label}: de ${show(p)} para ${show(c)}`,
      delta: kind === 'pp' ? ppText(abs) : `${abs.toLocaleString('pt-BR')} ${abs === 1 ? unit[0] : unit[1]}`.trim(),
      up: d > 0,
      bad: (d > 0) !== goodUp,
      score: kind === 'pp' ? abs : (abs / Math.max(p, 4)) * 60
    });
  };
  if (cur.tasks && prev.tasks) {
    Object.entries(TASK_TEXT).forEach(([k, label]) => add(label, cur.tasks[k], prev.tasks[k], { unit: ['tarefa', 'tarefas'] }));
  }
  (cur.milestones || []).forEach((m) => {
    const pm = (prev.milestones || []).find((x) => x.days === m.days);
    add(`Contatos no marco de ${m.days} dias`, m.pct, pm?.pct ?? null, { kind: 'pp' });
  });
  add('Upgrades', cur.upgrades, prev.upgrades, { unit: ['venda', 'vendas'] });
  const count = (m, name) => m.base?.cancels?.items?.find((r) => r.name === name)?.count || 0;
  const names = new Set([...(cur.base?.cancels?.items || []), ...(prev.base?.cancels?.items || [])].map((r) => r.name));
  names.forEach((n) => add(`Cancelamentos ${CANCEL_TEXT[n] || `(${n})`}`, count(cur, n), count(prev, n), { unit: ['pessoa', 'pessoas'], goodUp: false }));
  if (cur.renewal?.when && prev.renewal?.when) {
    add('Renovações fechadas antes de vencer', cur.renewal.when.antes, prev.renewal.when.antes, { unit: ['contrato', 'contratos'] });
    add('Renovações no dia do vencimento', cur.renewal.when.no, prev.renewal.when.no, { unit: ['contrato', 'contratos'] });
    add('Renovações depois de vencer', cur.renewal.when.depois, prev.renewal.when.depois, { unit: ['contrato', 'contratos'] });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Tendência dos `months` meses até o exibido. Mês sem valor fica fora; o rótulo
// da tela diz quantos meses entraram.
export function seriesOf(ctx, { monthKey, userId = null, pick, months = 6 }) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(addMonthsToKey(monthKey, -i));
  return keys
    .map((key) => ({ key, value: pick(metricsOf(ctx, { monthKey: key, userId })) }))
    .filter((p) => p.value != null);
}
