// Uma função calcula tudo (README do handoff §6): o mês exibido, o comparado e
// cada ponto de tendência chamam metricsOf. A fonte é sempre o detalhe; o
// número da equipe é a soma; nenhuma taxa é guardada.

import { monthRange, effectiveEnd, metaDaysOfMonth, isCurrentMonthKey, addMonthsToKey } from './month.js';
import { computeBaseMovement, computeChurn, cancellationsByReason, salesInWindow } from './base.js';
import { renewalCohort, summarizeCohort, milestones, milestoneSpanDays, upcomingExpirations } from './renewal.js';
import {
  OTHERS_ID, metaDaysSummary, pickMeta, metaCalendar, prospectionSummary, pickProspection, tasksByType, overdueNow
} from './routine.js';

// Quem não está em ctx.users (ex-consultor ou sem consultor). Somado às
// pessoas, bate com a equipe. Mora em routine.js porque o overdueNow usa.
export { OTHERS_ID };

const DAY_MS = 86400000;

// Soma dos valores do mapa; com `keep`, só das chaves que passam.
const sumMap = (m, keep = null) => {
  let total = 0;
  m.forEach((v, k) => { if (!keep || keep(k)) total += v; });
  return total;
};

// Meses depois de `monthKey` cujas interações os marcos precisam. O intervalo
// de um marco cruzado no último instante do mês vai até milestoneSpanDays
// depois do fim dele e para no corte (asOf); mês que começa depois disso não
// entra. Com o corte em agora (ou no fim do mês corrente, na carga da tela), a
// lista não passa do mês corrente. [90, 60, 30] pede o mês seguinte, e março
// para janeiro, porque fevereiro é curto; [90, 30] pede dois meses, e três
// para dezembro e janeiro fora de ano bissexto (janeiro de 2026 alcança 2 de
// abril; em 2028, com fevereiro de 29 dias, para em 1º de abril).
export function milestoneMonthsAfter(monthKey, { checkpoints, asOf }) {
  const limit = Math.min(monthRange(monthKey).end.getTime() + milestoneSpanDays(checkpoints) * DAY_MS, asOf.getTime());
  const keys = [];
  for (let k = addMonthsToKey(monthKey, 1); monthRange(k).start.getTime() < limit; k = addMonthsToKey(k, 1)) keys.push(k);
  return keys;
}

// Janela do mês: início, fim do mês, fim efetivo (agora no mês em andamento,
// ou o corte pró-rata) e o instante do desfecho de renovação. No corte
// pró-rata vale o que existia no corte; nos demais casos, o que existe hoje
// (renovação atrasada ainda conta).
function windowOf(ctx, monthKey, cutEnd) {
  const { start, end: monthEnd } = monthRange(monthKey);
  const end = cutEnd || effectiveEnd(monthKey, ctx.now);
  return { start, monthEnd, end, asOf: end < monthEnd ? end : ctx.now };
}

const sameItems = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Cache por ctx (WeakMap: ctx novo, cache novo). Um desenho da tela chama
// metricsOf dezenas de vezes (mês, comparado, pessoas, tendências). O resultado
// fica guardado por mês, pessoa e corte, e é compartilhado: não mutar. O que é
// da academia e não depende da pessoa fica à parte, por mês e fim efetivo.
// Trocar um insumo no mesmo objeto de ctx zera o cache, e um mês carregado
// depois em ctx.months não devolve resultado velho.
const caches = new WeakMap();

function cacheOf(ctx) {
  const sig = [ctx.now?.getTime(), ctx.users, ctx.contracts, ctx.config, ctx.leadsById, ctx.liveLeads, ctx.months, ctx.historyOwnerOnly, Boolean(ctx.historyUnavailable)];
  let cache = caches.get(ctx);
  if (!cache || cache.sig.some((v, i) => v !== sig[i])) {
    cache = { sig, results: new Map(), academy: new Map() };
    caches.set(ctx, cache);
  }
  return cache;
}

// Ponte, trancados, churn, cancelamentos, vendas por vendedor e linhas da
// coorte: iguais para a equipe e para qualquer pessoa filtrada.
function academyOf(ctx, cache, { monthKey, start, monthEnd, end, asOf }) {
  const key = `${monthKey}|${end.getTime()}`;
  const hit = cache.academy.get(key);
  if (hit) return hit;
  const contracts = ctx.contracts || [];
  const grace = ctx.config?.renewalGraceDays;
  const movement = computeBaseMovement(contracts, { start, end });
  const parts = {
    known: contracts.some((c) => c.startsAt && c.startsAt < end),
    movement,
    locked: movement.locked,
    churn: computeChurn(contracts, { start, end, graceDays: grace, activeAtStart: movement.startCount }),
    cancels: cancellationsByReason(contracts, { start, end }),
    sales: salesInWindow(contracts, { start, end }),
    cohortRows: renewalCohort(contracts, { start, end: monthEnd, asOf, graceDays: grace, leadsById: ctx.leadsById })
  };
  cache.academy.set(key, parts);
  return parts;
}

export function metricsOf(ctx, { monthKey, userId = null, cutEnd = null }) {
  const cache = cacheOf(ctx);
  const win = windowOf(ctx, monthKey, cutEnd);
  const src = ctx.months?.[monthKey] || null;
  // Os marcos também olham as interações dos meses que o intervalo deles
  // alcança depois do fim do mês, quando carregados.
  const after = milestoneMonthsAfter(monthKey, { checkpoints: ctx.config?.renewalCheckpoints, asOf: win.asOf })
    .map((k) => ctx.months?.[k] || null);
  const key = `${monthKey}|${userId ?? ''}|${cutEnd?.getTime() ?? ''}`;
  const hit = cache.results.get(key);
  if (hit && hit.src === src && sameItems(hit.after, after)) return hit.value;
  const value = computeMetrics(ctx, cache, { monthKey, userId, cutEnd, src, after, win });
  cache.results.set(key, { src, after, value });
  return value;
}

function computeMetrics(ctx, cache, { monthKey, userId, cutEnd, src, after, win }) {
  const { start, monthEnd, end, asOf } = win;
  const running = isCurrentMonthKey(monthKey, ctx.now);
  const snapshot = running && !cutEnd;
  const users = ctx.users || [];
  const contracts = ctx.contracts || [];
  const metaDays = metaDaysOfMonth(monthKey, ctx.config?.metaWeekdays || [], end);

  // OTHERS_ID: só o que dá para atribuir a quem não está em ctx.users. Meta e
  // prospecção são de quem tem usuário, então ficam sem número.
  const others = userId === OTHERS_ID;
  const team = new Set(users.map((u) => u.id));
  const owner = others ? (id) => !team.has(id) : userId;
  // Histórico só da própria pessoa (ctx.historyOwnerOnly = id dela): a meta de
  // qualquer outro recorte sairia zerada. Equipe, colegas e OTHERS_ID ficam
  // sem número e com a marca, para a tela dizer "indisponível" em vez de
  // "carregando". Se nem a assinatura da pessoa responde
  // (ctx.historyUnavailable), a marca vale para todo recorte, inclusive o
  // dela. Histórico ainda sem resposta (null) também deixa a meta sem número,
  // mas sem a marca.
  const ownerOnly = ctx.historyOwnerOnly ?? null;
  const metaHidden = Boolean(ctx.historyUnavailable) || (ownerOnly !== null && userId !== ownerOnly);
  const meta = src?.history && !others && !metaHidden ? metaDaysSummary({ users, history: src.history, metaDays }) : null;
  const prospSummary = src && !others
    ? prospectionSummary({ users, interactions: src.interactions, leadsCreated: src.leadsCreated, metaDays, end })
    : null;
  const academy = academyOf(ctx, cache, { monthKey, start, monthEnd, end, asOf });
  const { sales } = academy;
  const salesOf = (m) => {
    if (!userId) return sumMap(m);
    return others ? sumMap(m, (seller) => !team.has(seller)) : (m.get(userId) || 0);
  };

  return {
    monthKey,
    running,
    start,
    end,
    hasSource: Boolean(src),
    meta: meta ? pickMeta(meta, userId) : null,
    metaHidden,
    calendar: meta ? metaCalendar({ metaDays, hitsBy: meta.hitsBy, userId }) : [],
    prosp: prospSummary ? pickProspection(prospSummary, userId) : null,
    tasks: src ? tasksByType({ interactions: src.interactions, users, userId, start, end }) : null,
    late: snapshot ? overdueNow({ liveLeads: ctx.liveLeads, users, now: ctx.now }) : null,
    base: {
      known: academy.known,
      active: academy.known ? academy.movement.endCount : null,
      movement: academy.movement,
      locked: academy.locked,
      churn: academy.churn,
      cancels: academy.cancels
    },
    // Sem contrato nenhum antes do fim, o sistema ainda não tinha base: sem número.
    entered: academy.known ? salesOf(sales.entered) : null,
    enteredBy: sales.entered,
    upgrades: academy.known ? salesOf(sales.upgrades) : null,
    upgradesBy: sales.upgrades,
    renewal: summarizeCohort(academy.cohortRows, { owner }),
    // O intervalo de cada marco vai até o marco seguinte e passa do fim do mês
    // quando o corte (asOf) passa. Aí entram as interações dos meses que ele
    // alcança (after). Sem algum deles, ou com a busca dele falhando (entra
    // vazio e marcado), o número sairia menor do que é: fica sem número.
    milestones: src && after.every((s) => s && !s.failed)
      ? milestones(contracts, {
        start,
        end,
        asOf,
        checkpoints: ctx.config?.renewalCheckpoints,
        interactions: after.length ? [src, ...after].flatMap((s) => s.interactions || []) : src.interactions,
        leadsById: ctx.leadsById,
        owner
      })
      : null,
    upcoming: snapshot ? upcomingExpirations(contracts, { now: ctx.now, leadsById: ctx.leadsById, owner }) : null
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
  // Upgrades, cancelamentos e renovações saem dos contratos: sem base num dos
  // lados, a diferença seria inventada.
  if (cur.base?.known && prev.base?.known) {
    add('Upgrades', cur.upgrades, prev.upgrades, { unit: ['venda', 'vendas'] });
    const count = (m, name) => m.base?.cancels?.items?.find((r) => r.name === name)?.count || 0;
    const names = new Set([...(cur.base?.cancels?.items || []), ...(prev.base?.cancels?.items || [])].map((r) => r.name));
    names.forEach((n) => add(`Cancelamentos ${CANCEL_TEXT[n] || `(${n})`}`, count(cur, n), count(prev, n), { unit: ['pessoa', 'pessoas'], goodUp: false }));
    if (cur.renewal?.when && prev.renewal?.when) {
      add('Renovações fechadas antes de vencer', cur.renewal.when.antes, prev.renewal.when.antes, { unit: ['contrato', 'contratos'] });
      add('Renovações no dia do vencimento', cur.renewal.when.no, prev.renewal.when.no, { unit: ['contrato', 'contratos'] });
      add('Renovações depois de vencer', cur.renewal.when.depois, prev.renewal.when.depois, { unit: ['contrato', 'contratos'] });
    }
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
