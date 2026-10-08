// O que a tela Rotinas do gestor desenha a partir da regra do dia
// (src/lib/rotinas.js): a linha do dia e os resumos do cartão do modelo, o dia
// do modelo aberto e, na aba Hoje, o dia de cada consultor e o da equipe. Puro
// e testado em node (src/lib/__tests__/rotinasTela.test.js). Só importa
// ./rotinas.js, e o src/lib/__tests__/rotinasImports.test.js trava isso: a
// regra do dia continua num lugar só.
// Spec: docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md.
// Mockups: 2026-10-08-rotinas-intro-e-polimento.html (Página B · Linha do dia)
// e 2026-10-08-rotinas-aba-hoje.html (Hoje A · Por pessoa).
import { byTime, minutesOf, tasksForDay } from './rotinas.js';

// A linha do dia do cartão do modelo vai das 06h às 21h.
export const DAY_LINE_START = 6 * 60;
export const DAY_LINE_END = 21 * 60;
// Distância mínima entre dois rótulos da linha, em % da largura, para um não
// encostar no outro.
const LABEL_GAP_PCT = 8;
// No modelo aberto, duas tarefas seguidas a essa distância ou mais ganham,
// entre elas, a linha "2h30 sem tarefa".
export const MODEL_GAP_MINUTES = 90;

const pad = (n) => String(n).padStart(2, '0');
const isActive = (task) => task?.active !== false;
const isTimed = (task) => minutesOf(task?.time) != null;
const tarefas = (n) => `${n} ${n === 1 ? 'tarefa' : 'tarefas'}`;
const windowText = (first, last) => (first === last ? `às ${first}` : `das ${first} às ${last}`);

// Posição de um horário (minutos do dia) na linha, em %. O que passa das
// pontas fica na ponta.
export const dayLinePct = (minutes) =>
  ((Math.min(Math.max(minutes, DAY_LINE_START), DAY_LINE_END) - DAY_LINE_START) / (DAY_LINE_END - DAY_LINE_START)) * 100;

// "06h", "13h", "13h30".
export const hourLabel = (minutes) => `${pad(Math.floor(minutes / 60))}h${minutes % 60 ? pad(minutes % 60) : ''}`;

// Os horários das tarefas ativas do modelo, em minutos e em ordem.
export const modelTimes = (model) =>
  (model?.tasks || []).filter((t) => isActive(t) && isTimed(t)).map((t) => minutesOf(t.time)).sort((a, b) => a - b);

// Os rótulos da linha do dia: as pontas (06h e 21h) sempre, e o primeiro e o
// último horário do modelo quando não encostam num rótulo que já está ali.
// align diz onde o texto fica em relação ao ponto: start (começa nele), end
// (termina nele) e center (centrado nele).
export function dayLineLabels(times) {
  const labels = [
    { pct: 0, text: hourLabel(DAY_LINE_START), align: 'start' },
    { pct: 100, text: hourLabel(DAY_LINE_END), align: 'end' },
  ];
  const sorted = [...(times || [])].sort((a, b) => a - b);
  for (const minutes of [sorted[0], sorted[sorted.length - 1]]) {
    if (minutes == null) continue;
    const pct = dayLinePct(minutes);
    if (labels.every((l) => Math.abs(l.pct - pct) >= LABEL_GAP_PCT)) labels.push({ pct, text: hourLabel(minutes), align: 'center' });
  }
  return labels.sort((a, b) => a.pct - b.pct);
}

// As tarefas ativas do modelo: quantas têm horário, quantas valem a qualquer
// hora, e o primeiro e o último horário.
export function modelSummary(model) {
  const active = (model?.tasks || []).filter(isActive);
  const timed = active.filter(isTimed).sort(byTime);
  return {
    timed: timed.length,
    free: active.length - timed.length,
    first: timed[0]?.time ?? null,
    last: timed[timed.length - 1]?.time ?? null,
  };
}

// O resumo do cartão do modelo na lista:
// "8 tarefas · das 06:00 às 13:00 · 3 a qualquer hora".
export function modelCardSummary(model) {
  const s = modelSummary(model);
  if (!s.timed && !s.free) return (model?.tasks || []).length ? 'Nenhuma tarefa ativa' : 'Nenhuma tarefa ainda';
  if (!s.timed) return `${tarefas(s.free)} a qualquer hora`;
  const parts = [tarefas(s.timed), windowText(s.first, s.last)];
  if (s.free) parts.push(`${s.free} a qualquer hora`);
  return parts.join(' · ');
}

// As etiquetas do modelo aberto:
// ["8 tarefas no horário, das 06:00 às 13:00", "3 a qualquer hora"].
export function modelChips(model) {
  const s = modelSummary(model);
  const chips = [];
  if (s.timed) chips.push(`${tarefas(s.timed)} no horário, ${windowText(s.first, s.last)}`);
  if (s.free) chips.push(`${s.free} a qualquer hora`);
  return chips;
}

// "O dia do modelo": as tarefas ativas com horário, em ordem, e um vão entre
// duas seguidas que ficam MODEL_GAP_MINUTES ou mais longe uma da outra. A
// pausada não entra, porque não aparece na Meta.
export function modelDayRows(model) {
  const timed = (model?.tasks || []).filter((t) => isActive(t) && isTimed(t)).sort(byTime);
  const rows = [];
  timed.forEach((task, i) => {
    rows.push({ kind: 'task', key: task.id, task });
    const next = timed[i + 1];
    const gap = next ? minutesOf(next.time) - minutesOf(task.time) : 0;
    if (gap >= MODEL_GAP_MINUTES) rows.push({ kind: 'gap', key: `vao-${task.id}`, minutes: gap });
  });
  return rows;
}

// "2h30 sem tarefa", "3h sem tarefa".
export const gapText = (minutes) => `${Math.floor(minutes / 60)}h${minutes % 60 ? pad(minutes % 60) : ''} sem tarefa`;

// Os grupos de baixo do modelo aberto: as ativas sem horário, na ordem do
// modelo, e as pausadas, em ordem de horário.
export const modelFreeTasks = (model) => (model?.tasks || []).filter((t) => isActive(t) && !isTimed(t));
export const modelPausedTasks = (model) => (model?.tasks || []).filter((t) => !isActive(t)).sort(byTime);

// A linha de cada consultor na lista: o dia de hoje dele no modelo,
// "11 tarefas hoje · das 06:00 às 13:00".
export function personTodayText(model, now, metaWeekdays) {
  const today = tasksForDay(model, now, metaWeekdays);
  if (!today.length) return 'Nenhuma tarefa hoje';
  const head = `${tarefas(today.length)} hoje`;
  const timed = today.filter(isTimed);
  return timed.length ? `${head} · ${windowText(timed[0].time, timed[timed.length - 1].time)}` : head;
}
