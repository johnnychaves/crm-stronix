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
