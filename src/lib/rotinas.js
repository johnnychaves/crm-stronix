// Rotinas dos consultores: a regra única do dia, usada pelo cartão da Meta
// diária, pela tela Rotinas e, na parte 3, pelo histórico do Operacional. Pura
// e sem import de tela (nada de lucide-react), para a api/ poder usar.
// A api/ lê este arquivo (admin-users.js grava a versão do modelo quando quem o
// segue vira professor ou é excluído), então ele só pode importar ./acesso.js e
// ./operacional/month.js, que não importam nada. Quem trava isso é o
// src/lib/__tests__/rotinasImports.test.js.
// Spec: docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md.
import { isGestor, isSeller } from './acesso.js';
import { dayKeyOf } from './operacional/month.js';

// A tarefa com horário fica "agora" do horário até essa folga depois, e
// atrasada a partir daí. O check dado depois da folga é "depois do horário".
export const ROUTINE_ON_TIME_MINUTES = 30;
export const MODEL_NAME_MAX = 40;
export const TASK_TITLE_MAX = 80;
export const TASK_HOW_MAX = 240;
export const NOTE_MAX = 140;
export const MAX_TASKS_PER_MODEL = 30;
export const ALL_DAYS = 'all';
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// A mesma chave de dia da Meta (dgDateKey): calendário local, AAAA-MM-DD.
export const routineDayKey = (date) => dayKeyOf(date);

// O check só conta quando a hora dele cai no próprio dia do check. As regras
// do Firestore (routineMarkDayOk) deixam uma folga de um dia na virada da
// meia-noite, e o consultor grava o próprio check: a leitura fecha a folga.
export function markDoneAt(mark, dateKey) {
  const raw = mark?.doneAt;
  const doneAt = raw instanceof Date ? raw : typeof raw?.toDate === 'function' ? raw.toDate() : null;
  return doneAt instanceof Date && routineDayKey(doneAt) === dateKey ? doneAt : null;
}
export const markIdOf = (consultantId, dateKey, taskId) => `${consultantId}_${dateKey}_${taskId}`;

const pad = (n) => String(n).padStart(2, '0');
const clean = (s) => (typeof s === 'string' ? s.trim() : '');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const joinPt = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`);
const minutesOfDate = (d) => d.getHours() * 60 + d.getMinutes();

export const namesText = (names) => joinPt(names);
export const firstName = (name) => clean(name).split(/\s+/)[0] || '';

export function minutesOf(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
export const hhmmOf = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const byTime = (a, b) => (minutesOf(a.time) ?? 9999) - (minutesOf(b.time) ?? 9999);

// Quem pode seguir modelo: consultor ativo, com nome. Gestor e professor não
// seguem. É o isMetaParticipant de acesso.js escrito pelo isSeller, que é o
// que o acessoSweep.test.js cobra das listas de pessoas.
export const routineParticipants = (users) =>
  (users || []).filter((u) => u?.id && u.name && u.active !== false && isSeller(u) && !isGestor(u));

export function taskRunsOn(task, date, metaWeekdays) {
  if (!task || task.active === false) return false;
  const weekday = date.getDay();
  if (task.days === ALL_DAYS) return (metaWeekdays || []).includes(weekday);
  return Array.isArray(task.days) && task.days.includes(weekday);
}

export const tasksForDay = (model, date, metaWeekdays) =>
  (model?.tasks || []).filter((t) => taskRunsOn(t, date, metaWeekdays)).sort(byTime);

// Estado num instante: 'done', 'doneLate', 'now', 'late', 'later' ou 'open'
// (sem horário e sem check). doneAt é a hora do check (Date) ou null.
// Só olha a hora do dia de `now` e de `doneAt`: quem chama passa instantes do mesmo dia (o histórico passa o fim daquele dia, 23:59).
export function taskStateAt(task, doneAt, now) {
  const t = minutesOf(task?.time);
  if (doneAt instanceof Date) {
    return t != null && minutesOfDate(doneAt) > t + ROUTINE_ON_TIME_MINUTES ? 'doneLate' : 'done';
  }
  if (t == null) return 'open';
  const n = minutesOfDate(now);
  if (n < t) return 'later';
  if (n <= t + ROUTINE_ON_TIME_MINUTES) return 'now';
  return 'late';
}

export const durationText = (minutes) =>
  (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`);

export function daysText(days) {
  if (days === ALL_DAYS) return 'Todos os dias de trabalho';
  const sorted = WEEK_ORDER.filter((d) => (days || []).includes(d));
  if (!sorted.length) return '';
  const idx = sorted.map((d) => WEEK_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (sorted.length >= 3 && contiguous) return `${cap(DAY_LONG[sorted[0]])} a ${DAY_LONG[sorted[sorted.length - 1]]}`;
  return cap(joinPt(sorted.map((d) => `${DAY_LONG[d]}s`)));
}

export function stateText(task, state, doneAt, now) {
  const t = minutesOf(task?.time);
  if (state === 'done') return `Feita às ${hhmmOf(minutesOfDate(doneAt))}`;
  if (state === 'doneLate') return `Feita às ${hhmmOf(minutesOfDate(doneAt))}, depois do horário`;
  if (state === 'now') return 'É agora';
  if (state === 'late') return `Era às ${task.time}, atrasada há ${durationText(minutesOfDate(now) - t)}`;
  if (state === 'later') return `Em ${durationText(t - minutesOfDate(now))}`;
  return task?.days === ALL_DAYS ? 'Até o fim do dia' : `${daysText(task?.days)} · até o fim do dia`;
}

export function spanText(model) {
  const active = (model?.tasks || []).filter((t) => t.active !== false);
  const timed = active.filter((t) => minutesOf(t.time) != null).sort(byTime);
  const free = active.length - timed.length;
  const parts = [];
  if (timed.length === 1) parts.push(`às ${timed[0].time}`);
  if (timed.length > 1) parts.push(`${timed[0].time} às ${timed[timed.length - 1].time}`);
  if (free) parts.push(`${free} sem horário`);
  return parts.join(' · ');
}

export function copyName(name, models) {
  const taken = new Set((models || []).map((m) => clean(m.name).toLowerCase()));
  const base = `Cópia de ${clean(name)}`;
  for (let n = 1; n < 100; n += 1) {
    const suffix = n === 1 ? '' : ` (${n})`;
    const candidate = `${base.slice(0, MODEL_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base.slice(0, MODEL_NAME_MAX).trimEnd();
}

export function modelNameProblem(name, models, ownId = null) {
  const value = clean(name);
  if (!value) return 'Escreva o nome do modelo.';
  if (value.length > MODEL_NAME_MAX) return `O nome pode ter até ${MODEL_NAME_MAX} caracteres.`;
  const repeated = (models || []).some((m) => m.id !== ownId && clean(m.name).toLowerCase() === value.toLowerCase());
  return repeated ? 'Já existe um modelo com esse nome.' : null;
}

// input: { title, how, days ('all' ou lista), time ('HH:MM' ou null), active }
export function taskProblems(input) {
  const errors = {};
  const title = clean(input.title);
  if (!title) errors.title = 'Escreva o nome da tarefa.';
  else if (title.length > TASK_TITLE_MAX) errors.title = `O nome pode ter até ${TASK_TITLE_MAX} caracteres.`;
  const validDays = input.days === ALL_DAYS
    || (Array.isArray(input.days) && input.days.length > 0 && input.days.every((d) => WEEK_ORDER.includes(d)));
  if (!validDays) errors.days = 'Escolha pelo menos um dia.';
  if (input.time !== null && minutesOf(input.time) == null) errors.time = 'Escolha o horário.';
  if (clean(input.how).length > TASK_HOW_MAX) errors.how = `Até ${TASK_HOW_MAX} caracteres.`;
  return errors;
}

export const normalizeTask = (input, id) => ({
  id,
  title: clean(input.title),
  how: clean(input.how),
  days: input.days === ALL_DAYS ? ALL_DAYS : WEEK_ORDER.filter((d) => (Array.isArray(input.days) ? input.days : []).includes(d)),
  time: minutesOf(input.time) != null ? input.time : null,
  active: input.active !== false,
});

// Fora de contexto seguro (preview por IP em http) crypto.randomUUID não existe.
// O id é curto e só precisa não repetir dentro do modelo (até 30 tarefas).
export function newTaskId() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID().replace(/-/g, '').slice(0, 12);
  let id = '';
  while (id.length < 12) id += Math.random().toString(36).slice(2);
  return id.slice(0, 12);
}

export function upsertTask(tasks, next) {
  const list = tasks || [];
  const i = list.findIndex((t) => t.id === next.id);
  return i >= 0 ? list.map((t, j) => (j === i ? next : t)) : [...list, next];
}
export const removeTask = (tasks, taskId) => (tasks || []).filter((t) => t.id !== taskId);

export const modelOfUser = (models, userId) =>
  (models || []).find((m) => (m.followerIds || []).includes(userId)) || null;

// Pôr pessoas num modelo tira cada uma do modelo em que estava: cada consultor
// segue um modelo só. Devolve um Map modeloId -> followerIds novo, com o modelo
// de destino sempre presente; sem o modelo de destino, devolve o Map vazio e
// ninguém muda.
export function followerChanges(models, targetModelId, addIds = [], removeIds = []) {
  const changes = new Map();
  const target = (models || []).find((m) => m.id === targetModelId);
  if (!target) return changes;
  const current = (m) => changes.get(m.id) ?? (m.followerIds || []);
  for (const pid of addIds) {
    for (const m of models) {
      if (m.id !== targetModelId && current(m).includes(pid)) changes.set(m.id, current(m).filter((x) => x !== pid));
    }
  }
  let ids = current(target).filter((x) => !removeIds.includes(x));
  for (const pid of addIds) if (!ids.includes(pid)) ids = [...ids, pid];
  changes.set(target.id, ids);
  return changes;
}

// O modelo e a versão do dia, sem as datas do servidor (quem grava acrescenta).
export function modelDocs({ modelId, name, tasks, followerIds, deleted = false, userId, dateKey }) {
  const model = { name: clean(name), tasks: tasks || [], followerIds: deleted ? [] : (followerIds || []) };
  return {
    model,
    version: { id: `${modelId}_${dateKey}`, data: { modelId, date: dateKey, ...model, deleted, savedBy: userId } },
  };
}
