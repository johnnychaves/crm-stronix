// O que a tela Rotinas do gestor desenha a partir da regra do dia
// (src/lib/rotinas.js): a linha do dia e os resumos do cartão do modelo, o dia
// do modelo aberto e, na aba Hoje, o dia de cada consultor e o da equipe. Puro
// e testado em node (src/lib/__tests__/rotinasTela.test.js). Só importa
// ./rotinas.js, e o src/lib/__tests__/rotinasImports.test.js trava isso: a
// regra do dia continua num lugar só.
// Spec: docs/superpowers/specs/2026-10-06-rotinas-dos-consultores-design.md.
// Mockups: 2026-10-08-rotinas-intro-e-polimento.html (Página B · Linha do dia)
// e 2026-10-08-rotinas-aba-hoje.html (Hoje A · Por pessoa).
import { byTime, durationText, hhmmOf, markDoneAt, minutesOf, modelOfUser, routineDayKey, taskStateAt, tasksForDay } from './rotinas.js';

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

// ---------- A aba Hoje ----------

const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();
// A hora de um instante: o "Às 07:58" das observações e o "Ao vivo · 10:47".
export const clockText = (date) => hhmmOf(minutesOfDay(date));
export const isDoneState = (state) => state === 'done' || state === 'doneLate';

// O dia a escrever no "Atualizado às 23:50" da aba Hoje quando a leitura está
// parada (o portão de ociosidade fechou as assinaturas) e o relógio de verdade
// já passou da meia-noite: sem o dia, o gestor leria a hora como se fosse de
// hoje. '' no mesmo dia, 'ontem' no dia anterior e 'em 06/10' mais atrás.
// `frozen` é o instante parado, e `live` o relógio de agora.
export function frozenDayText(frozen, live) {
  const day = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const gap = Math.round((day(live) - day(frozen)) / 86_400_000);
  if (gap === 0) return '';
  return gap === 1 ? 'ontem' : `em ${pad(frozen.getDate())}/${pad(frozen.getMonth() + 1)}`;
}

// O dia de uma pessoa: as tarefas de hoje do modelo que ela segue, com o check
// e o estado de cada uma no instante `now`. marks é o Map tarefa -> check da
// pessoa no dia ({ doneAt, note }), do useTeamRoutineMarks. O check só conta
// quando a hora dele cai no próprio dia (markDoneAt, a mesma regra do cartão
// da Meta); o que não conta fica fora, e a observação dele vai junto.
export function personDay(model, marks, now, metaWeekdays) {
  const dayKey = routineDayKey(now);
  const nowMinutes = minutesOfDay(now);
  const rows = tasksForDay(model, now, metaWeekdays).map((task) => {
    const mark = marks?.get(task.id) || null;
    const doneAt = mark ? markDoneAt(mark, dayKey) : null;
    return { task, doneAt, note: doneAt ? (mark.note || '') : '', state: taskStateAt(task, doneAt, now) };
  });
  const timed = rows.filter((r) => isTimed(r.task));
  const done = rows.filter((r) => isDoneState(r.state)).length;
  const firstAt = timed.length ? minutesOf(timed[0].task.time) : null;
  const later = timed.findIndex((r) => minutesOf(r.task.time) > nowMinutes);
  return {
    rows,
    timed,
    free: rows.filter((r) => !isTimed(r.task)),
    done,
    late: rows.filter((r) => r.state === 'late').length,
    total: rows.length,
    // Onde a linha do agora entra entre as tarefas com horário: antes da
    // primeira que ainda não chegou, ou no fim. Sem tarefa com horário, null.
    nowIndex: timed.length ? (later === -1 ? timed.length : later) : null,
    // Antes da primeira tarefa com horário, e sem nada feito, o cartão só diz
    // quando a rotina começa.
    startsAt: firstAt != null && firstAt > nowMinutes && done === 0 ? timed[0].task.time : null,
  };
}

// "Era às 10:00, há 47 min", na lista "Atrasadas agora".
export const lateText = (task, now) => `Era às ${task.time}, há ${durationText(minutesOfDay(now) - minutesOf(task.time))}`;

const byPersonName = (a, b) => String(a.person.name || '').localeCompare(String(b.person.name || ''), 'pt-BR');

// A equipe hoje. people são os consultores que podem seguir modelo
// (routineParticipants), na ordem da equipe; marksByPerson é o Map consultor ->
// (Map tarefa -> check). Devolve um cartão por pessoa, com quem está sem
// modelo no fim; a soma de quem segue modelo; as atrasadas em ordem de horário
// (e de nome no empate); e as observações, a mais recente primeiro.
export function teamToday({ people, models, marksByPerson, now, metaWeekdays }) {
  const cards = (people || []).map((person) => {
    const model = modelOfUser(models, person.id);
    return model
      ? { person, model, ...personDay(model, marksByPerson?.get(person.id), now, metaWeekdays) }
      : { person, model: null };
  });
  cards.sort((a, b) => Number(!a.model) - Number(!b.model));
  const following = cards.filter((c) => c.model);
  const sum = (key) => following.reduce((acc, c) => acc + c[key], 0);
  const lateRows = following
    .flatMap((c) => c.rows.filter((r) => r.state === 'late').map((r) => ({ person: c.person, task: r.task, text: lateText(r.task, now) })))
    .sort((a, b) => byTime(a.task, b.task) || byPersonName(a, b));
  const notes = following
    .flatMap((c) => c.rows.filter((r) => r.note).map((r) => ({ person: c.person, task: r.task, doneAt: r.doneAt, note: r.note })))
    .sort((a, b) => b.doneAt - a.doneAt);
  return {
    cards,
    lateRows,
    notes,
    done: sum('done'),
    total: sum('total'),
    late: sum('late'),
    following: following.length,
    withoutModel: cards.length - following.length,
  };
}

// A frase do topo da aba Hoje, em pedaços. O pedaço com destaque leva em:
// 'brand' (a conta) ou 'late' (as atrasadas). A frase é a junção dos textos.
export function todayHeadline({ peopleCount, following, done, total, late }) {
  if (!peopleCount) return [{ text: 'Nenhum consultor na equipe ainda.' }];
  if (!following) return [{ text: 'Ninguém segue um modelo ainda.' }];
  if (!total) return [{ text: 'Hoje não tem tarefa da rotina para a equipe.' }];
  const head = [
    { text: 'A equipe fez ' },
    { text: `${done} de ${total}`, em: 'brand' },
    { text: ` ${total === 1 ? 'tarefa' : 'tarefas'} da rotina até agora` },
  ];
  if (!late) return [...head, { text: '. Nenhuma está atrasada.' }];
  return [...head, { text: ', e ' }, { text: `${late} ${late === 1 ? 'está atrasada' : 'estão atrasadas'}`, em: 'late' }, { text: '.' }];
}

// A tarefa escolhida na aba Hoje ({ personId, taskId }), com o dia dela. null
// quando nada foi escolhido ou quando ela sumiu (o modelo mudou, a pessoa
// trocou de modelo ou saiu da equipe).
export function findSelection(cards, selected) {
  if (!selected) return null;
  const card = (cards || []).find((c) => c.model && c.person.id === selected.personId);
  const row = card?.rows.find((r) => r.task.id === selected.taskId);
  return row ? { person: card.person, ...row } : null;
}

// Os ids do DOM da tela Rotinas, para devolver o foco: ao Fechar o detalhe, à
// tarefa que estava aberta (ou, se a linha dela saiu da tela, ao cartão da
// pessoa); ao Escolher modelo, ao seletor daquela pessoa. O id de uma tarefa ou
// de uma pessoa vem do Firestore, e o que não for letra, número, hífen ou
// sublinhado vira sublinhado. O do cartão não começa com `rot-`, para nunca
// cair no id de uma tarefa nem no de um seletor.
const domPart = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, '_');
export const taskDomId = (personId, taskId) => `rot-${domPart(personId)}-${domPart(taskId)}`;
export const modelSelectDomId = (personId) => `rot-modelo-${domPart(personId)}`;
export const personDomId = (personId) => `rotcartao-${domPart(personId)}`;
