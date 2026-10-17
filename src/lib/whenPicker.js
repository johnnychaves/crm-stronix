// O "Quando" dos pop-ups da Meta Diária (mockup B, 16/10/2026): atalhos de dia,
// o dia e o horário em campos separados e a frase que confirma o resultado.
// Puro, testado em node. O instante que sai daqui é o que o pop-up grava.

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const WHEN_PRESETS = Object.freeze([
  Object.freeze({ id: 'hoje', label: 'Hoje', days: 0 }),
  Object.freeze({ id: 'amanha', label: 'Amanhã', days: 1 }),
  Object.freeze({ id: '3d', label: 'Em 3 dias', days: 3 }),
  Object.freeze({ id: '7d', label: 'Em 7 dias', days: 7 }),
  Object.freeze({ id: 'outro', label: 'Outro dia', days: null }),
]);

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// 'AAAA-MM-DD' no fuso local, o valor de <input type="date">.
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// 'HH:MM' de uma data, para começar o horário no do agendamento.
export const hourOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// O "Quando" num atalho. O "Outro dia" mantém o dia que estava escolhido, e sem
// ele começa amanhã.
export function whenFromPreset(presetId, time, today = new Date(), current = null) {
  const preset = WHEN_PRESETS.find((p) => p.id === presetId) || WHEN_PRESETS[1];
  const date = preset.days == null
    ? (parseDay(current?.date) ? current.date : isoDay(addDays(today, 1)))
    : isoDay(addDays(today, preset.days));
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

// "hoje às 16:30", "ontem às 16:30", "amanhã às 16:30" ou "em 14/10 às 16:30".
export function dayRefText(date, now = new Date()) {
  const diff = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
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
  if (startOfDay(at).getTime() === startOfDay(now).getTime()) return `hoje, às ${when.time}`;
  const wd = at.getDay();
  const article = wd === 0 || wd === 6 ? 'no' : 'na';
  return `${article} ${WEEKDAYS[wd]}, ${pad(at.getDate())}/${pad(at.getMonth() + 1)}, às ${when.time}`;
}

// O dia por extenso, para o atalho escolhido: "sábado, 17/10".
export function dayLabel(when) {
  const day = parseDay(when?.date);
  return day ? `${WEEKDAYS[day.getDay()]}, ${pad(day.getDate())}/${pad(day.getMonth() + 1)}` : '';
}
