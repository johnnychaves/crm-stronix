// Formatos do CRM, usados pelas contas (texto da diferença) e pela tela.

import { fmtNum } from '../format.js';
import { monthLabel } from '../operacional/month.js';

// Minutos em "42 min", "2 h 10 min" ou "4 dias". Arredonda antes de dividir
// para não sair "1 h 60 min".
export function fmtDuration(min) {
  if (min == null || !Number.isFinite(min)) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.round(m / 1440);
  return `${d} ${d === 1 ? 'dia' : 'dias'}`;
}

// Dias com uma casa decimal e vírgula: "6 dias", "6,5 dias".
export function fmtDays(d) {
  if (d == null || !Number.isFinite(d)) return '—';
  const v = Math.round(d * 10) / 10;
  return `${String(v).replace('.', ',')} ${v === 1 ? 'dia' : 'dias'}`;
}

export const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

// Mês em texto corrido: "agosto", ou "setembro de 2025" quando o ano é outro.
export function monthName(key, refKey) {
  const name = monthLabel(key, { capitalized: false, withYear: false });
  return key.slice(0, 4) === refKey.slice(0, 4) ? name : `${name} de ${key.slice(0, 4)}`;
}
