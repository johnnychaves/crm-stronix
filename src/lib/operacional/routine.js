// Rotina do Operacional: meta diária e régua de dias, prospecção (total e por
// dia), tarefas concluídas por tipo e atrasados agora. Mesmas réguas da Meta
// Diária (src/lib/dailyGoal.js); a equipe é sempre a soma das pessoas.

import { volumeTargetFor, interactionOwnerAuthUid } from '../dailyGoal.js';
import { dayKeyOf } from './month.js';

// Chave de quem não está em ctx.users: ex-consultor ou lead sem consultor.
// Somada às pessoas, bate com a equipe.
export const OTHERS_ID = '__outros__';

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

// Ordem de coluna da régua, de segunda a domingo (0 = domingo é o último).
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Sem dias (meta dos colegas ainda não carregou): cabeçalho padrão Seg a Sex.
const DEFAULT_COLUMNS = [1, 2, 3, 4, 5];

// Monta a grade da régua de dias a partir dos dias de meta do mês (`cells`,
// no formato de metaCalendar). As COLUNAS são os dias da semana que aparecem
// em `cells`, em ordem a partir de segunda — todo mês tem cada dia da semana
// pelo menos 4 vezes, então o que aparece em `cells` é sempre o conjunto
// configurado em Metas & ritmo, nunca um recorte parcial do mês. Isso evita
// duas quebras: meta com fim de semana (ex.: só domingo) não gera mais
// `weekday - 1` negativo, e meta de 6 dias não fica espremida numa grade de
// 5 colunas. Os ESPAÇOS antes do primeiro dia são a posição do weekday dele
// nessa lista de colunas (não weekday - 1); o fim da última linha completa
// com espaços em branco do mesmo jeito.
export function calendarGrid(cells) {
  const list = cells || [];
  if (!list.length) return { columns: DEFAULT_COLUMNS, slots: [] };
  const present = new Set(list.map((c) => c.weekday));
  const columns = WEEKDAY_ORDER.filter((w) => present.has(w));
  const lead = columns.indexOf(list[0].weekday);
  const slots = [...Array(lead).fill(null), ...list];
  while (slots.length % columns.length !== 0) slots.push(null);
  return { columns, slots };
}

// Lead criado pela importação de clientes (src/lib/clientImport.js): leva a
// origem "Importação ..." e a marca do lote. Não é prospecção de ninguém, e o
// createdAt dele é a data da planilha, ou a da importação. Lead que já existia
// e só casou com a planilha também ganha a marca, mas mantém a origem de
// quando foi cadastrado e continua contando.
export const isImportCreatedLead = (l) => Boolean(l?.importBatchId || l?.importSource)
  && typeof l?.source === 'string' && l.source.startsWith('Importação');

// Ações por dia de meta (fechados + hoje): lead criado (dono = consultantId,
// qualquer balde; o criado pela importação não conta) e interação com
// volumeKind (dono = quem fez). Com `end` (o corte), nada criado a partir dele
// conta, nem no próprio dia do corte.
export function prospectionSummary({ users, interactions, leadsCreated, metaDays, end = null }) {
  const days = metaDays.filter((d) => d.state !== 'future');
  const idxOf = new Map(days.map((d, i) => [d.key, i]));
  const byUser = new Map((users || []).map((u) => [u.id, { target: volumeTargetFor(u), perDay: days.map(() => 0) }]));
  const userOfAuth = new Map((users || []).map((u) => [u.authUid, u.id]));
  const afterCut = (d) => end != null && d >= end;
  const seenLead = new Set();
  (leadsCreated || []).forEach((l) => {
    if (!l?.id || seenLead.has(l.id) || isImportCreatedLead(l) || l.createdAtMissing || !(l.createdAt instanceof Date) || afterCut(l.createdAt)) return;
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
  const teamAuth = new Set((users || []).map((u) => u.authUid).filter(Boolean));
  const auth = userId && userId !== OTHERS_ID ? (users || []).find((u) => u.id === userId)?.authUid : null;
  // Pessoa: as que ela fez. OTHERS_ID: as de autor fora da equipe, ou sem autor.
  const mine = !userId ? null
    : userId === OTHERS_ID ? (i) => !teamAuth.has(interactionOwnerAuthUid(i))
      : (i) => interactionOwnerAuthUid(i) === auth;
  const out = Object.fromEntries(TASK_ROWS.map((r) => [r.id, 0]));
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (i.type !== 'daily_goal_done' || !(i.createdAt instanceof Date) || i.createdAt < start || i.createdAt >= end) return;
    const task = TASK_OF_CATEGORY[i.dailyGoalCategory];
    if (!task) return;
    if (mine && !mine(i)) return;
    // Autor entra na chave: duas pessoas concluindo a MESMA tarefa (mesmo
    // lead, categoria e dia) são duas ações de verdade, uma de cada uma — sem
    // o autor aqui, a equipe dava 1 e a soma das pessoas dava 2, quebrando a
    // regra "a equipe é a soma das pessoas".
    const key = `${i.leadId}|${i.dailyGoalCategory}|${dayKeyOf(i.createdAt)}|${interactionOwnerAuthUid(i)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out[task] += 1;
  });
  out.total = TASK_ROWS.reduce((a, r) => a + out[r.id], 0);
  return out;
}

// Mesma condição da categoria Atrasados da Meta Diária: lead fora de Venda e
// Perda com próximo contato antes do início de hoje. Lead de quem não está na
// equipe (ou sem consultor) fica em OTHERS_ID, chave que só aparece se houver.
export function overdueNow({ liveLeads, users, now }) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byUser = new Map((users || []).map((u) => [u.id, 0]));
  let others = 0;
  (liveLeads || []).forEach((l) => {
    if (l.status === 'Venda' || l.status === 'Perda') return;
    if (!(l.nextFollowUp instanceof Date) || l.nextFollowUp >= todayStart) return;
    if (byUser.has(l.consultantId)) byUser.set(l.consultantId, byUser.get(l.consultantId) + 1);
    else others += 1;
  });
  if (others > 0) byUser.set(OTHERS_ID, others);
  return { total: [...byUser.values()].reduce((a, b) => a + b, 0), byUser };
}
