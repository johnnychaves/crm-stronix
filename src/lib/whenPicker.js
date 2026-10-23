// O "Quando" dos pop-ups da Meta Diária (mockup B, 16/10/2026): atalhos de dia,
// o dia e o horário em campos separados e a frase que confirma o resultado.
// Puro, testado em node. O instante que sai daqui é o que o pop-up grava.

import { addDays, calendarDaysBetween, fromDateInputValue, startOfLocalDay, toDateInputValue } from './dates.js';
import { formatHourLabel } from './format.js';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const WHEN_PRESETS = Object.freeze([
  Object.freeze({ id: 'hoje', label: 'Hoje', days: 0 }),
  Object.freeze({ id: 'amanha', label: 'Amanhã', days: 1 }),
  Object.freeze({ id: '3d', label: 'Em 3 dias', days: 3 }),
  Object.freeze({ id: '7d', label: 'Em 7 dias', days: 7 }),
  Object.freeze({ id: 'outro', label: 'Outro dia', days: null }),
]);

// 'AAAA-MM-DD' no fuso local, o valor de <input type="date">, e a volta para a
// meia-noite local (os dois de lib/dates.js). Só aceita o dia completo.
export const isoDay = toDateInputValue;
const parseDay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? fromDateInputValue(s) : null);

// 'HH:MM' de uma data, para começar o horário no do agendamento.
export const hourOf = formatHourLabel;

// O "Quando" num atalho. O "Outro dia" mantém o dia que estava escolhido, e sem
// ele começa amanhã.
export function whenFromPreset(presetId, time, today = new Date(), current = null) {
  const preset = WHEN_PRESETS.find((p) => p.id === presetId) || WHEN_PRESETS[1];
  const date = preset.days == null
    ? (parseDay(current?.date) ? current.date : isoDay(addDays(startOfLocalDay(today), 1)))
    : isoDay(addDays(startOfLocalDay(today), preset.days));
  return { preset: preset.id, date, time };
}

// O instante escolhido, ou null quando o dia ou o horário não fecham.
export function whenInstant(when) {
  const day = parseDay(when?.date);
  const m = /^(\d{2}):(\d{2})$/.exec(when?.time || '');
  if (!day || !m) return null;
  day.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return day;
}

export const whenIsFuture = (when, nowMs = Date.now()) => {
  const at = whenInstant(when);
  return Boolean(at && at.getTime() > nowMs);
};

// O Reagendar e o "Quando voltar a falar?" só aceitam a partir de amanhã
// (decisão do Johnny, 21/10/2026). O contato reagendado para mais tarde hoje
// ficava com a marca de feito do dia: a tarefa nova sumia da Meta como feita,
// ou nascia pendente no mesmo dia e o dia não batia.
export const whenIsFromTomorrow = (when, nowMs = Date.now()) => {
  const at = whenInstant(when);
  return Boolean(at && calendarDaysBetween(new Date(nowMs), at) >= 1);
};

// O que falta no "Quando": 'missing' sem dia ou horário, 'today' quando só vale
// a partir de amanhã e o dia é hoje (ou antes), 'past' quando o instante já
// passou. Null quando está tudo certo.
export function whenProblem(when, nowMs = Date.now(), { fromTomorrow = false } = {}) {
  if (!whenInstant(when)) return 'missing';
  if (fromTomorrow) return whenIsFromTomorrow(when, nowMs) ? null : 'today';
  return whenIsFuture(when, nowMs) ? null : 'past';
}

// Os atalhos de dia do "Quando". A partir de amanhã, sem o "Hoje".
export const whenPresetsFor = ({ fromTomorrow = false } = {}) =>
  (fromTomorrow ? WHEN_PRESETS.filter((p) => p.days !== 0) : WHEN_PRESETS);

// "hoje às 16:30", "ontem às 16:30", "amanhã às 16:30" ou "em 14/10 às 16:30".
export function dayRefText(date, now = new Date()) {
  const diff = calendarDaysBetween(now, date);
  const at = `às ${hourOf(date)}`;
  if (diff === 0) return `hoje ${at}`;
  if (diff === -1) return `ontem ${at}`;
  if (diff === 1) return `amanhã ${at}`;
  return `em ${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${at}`;
}

// A frase da confirmação: "hoje, às 16:30" ou "no sábado, 17/10, às 16:30".
export function whenText(when, now = new Date()) {
  const at = whenInstant(when);
  if (!at) return '';
  if (calendarDaysBetween(now, at) === 0) return `hoje, às ${when.time}`;
  const wd = at.getDay();
  const article = wd === 0 || wd === 6 ? 'no' : 'na';
  return `${article} ${WEEKDAYS[wd]}, ${pad(at.getDate())}/${pad(at.getMonth() + 1)}, às ${when.time}`;
}

// O dia por extenso, para o atalho escolhido: "sábado, 17/10".
export function dayLabel(when) {
  const day = parseDay(when?.date);
  return day ? `${WEEKDAYS[day.getDay()]}, ${pad(day.getDate())}/${pad(day.getMonth() + 1)}` : '';
}
