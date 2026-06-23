// Safe date parsing helpers. Centralized here because both App.jsx and
// (eventually) feature modules need them, and the rules around Firestore
// Timestamps + raw Date + missing values are easy to get wrong.

// Returns a Date instance for the given value. Falls back to `new Date()`
// when the input is missing or invalid — used for fields where we want to
// always render *something*.
export const getSafeDate = (val) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

// Same idea but returns null when the input is missing or invalid. Use
// this when an empty value is semantically meaningful (e.g. nextFollowUp).
export const getSafeDateOrNull = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Normalizes free-text appointment types ("Aula Experimental", "Visita")
// into the slugs we store in lead.appointmentType.
export const normalizeAppointmentType = (value) => {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  if (raw.includes('aula')) return 'aula_experimental';
  if (raw.includes('visita')) return 'visita';
  return null;
};

// Converte uma data (Date/Timestamp/string) para o valor 'yyyy-mm-dd' usado
// em <input type="date">, no fuso LOCAL. Evita o shift de 1 dia que ocorre
// ao serializar via toISOString em fusos negativos (Brasil = UTC-3).
export const toDateInputValue = (date) => {
  const d = getSafeDateOrNull(date);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Interpreta 'yyyy-mm-dd' de um <input type="date"> como meia-noite LOCAL
// (não UTC) — assim a data não "volta" um dia em fusos negativos. Retorna
// null para string vazia/ inválida.
export const fromDateInputValue = (str) => {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return getSafeDateOrNull(str);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

// Soma `months` meses a uma data, preservando a hora e tratando o
// "estouro" de fim de mês: 31/jan + 1 mês → 28/29 fev (último dia),
// nunca 02/mar. Aceita Date, Timestamp do Firestore ou string; retorna
// null se a data ou a quantidade de meses forem inválidas. Usado para
// calcular o fim da vigência de um contrato (endsAt = início + duração).
export const addMonths = (date, months) => {
  const base = getSafeDateOrNull(date);
  const n = Number(months);
  if (!base || !Number.isFinite(n)) return null;
  const result = new Date(base.getTime());
  const targetDay = result.getDate();
  result.setMonth(result.getMonth() + n);
  // Se o dia mudou, houve overflow (ex.: 31 → 02): volta pro último dia
  // do mês pretendido.
  if (result.getDate() !== targetDay) result.setDate(0);
  return result;
};
