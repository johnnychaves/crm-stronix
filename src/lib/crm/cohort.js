// Safra e eventos de lead do CRM (spec §4): leads novos, matrículas, perdas
// por motivo, desfecho da safra num instante, canais e dias até a matrícula.
// Puro. As listas chegam com a versão mais nova de cada lead.

import { getSafeDateOrNull } from '../dates.js';
import { deriveLeadBucket } from '../leadDerived.js';
import { isImportCreatedLead } from '../operacional/routine.js';
import { median, countBy, rankCounts } from './stats.js';

const DAY_MS = 86400000;

const inWindow = (d, start, end) => d instanceof Date && d >= start && d < end;

// Só o carimbo real da matrícula e da perda: nunca cai no cadastro.
export const convertedAtOf = (l) => getSafeDateOrNull(l?.convertedAt);
export const lostAtOf = (l) => getSafeDateOrNull(l?.lostAt);

// Tira repetido por id, mantendo o primeiro.
function unique(list) {
  const seen = new Set();
  return (list || []).filter((l) => {
    if (!l?.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

// Leads novos: cadastrados em [start, end), sem os criados pela importação e
// sem os de data de cadastro ausente (createdAtMissing, o normalizeLeadDoc põe
// "agora" neles).
export const newLeadsOf = (leads, { start, end, inScope }) => unique(leads).filter((l) =>
  !l.createdAtMissing && inWindow(l.createdAt, start, end) && !isImportCreatedLead(l) && inScope(l));

// Matrículas: convertedAt em [start, end), sem os importados.
export const enrollmentsOf = (leads, { start, end, inScope }) => unique(leads).filter((l) =>
  inWindow(convertedAtOf(l), start, end) && !isImportCreatedLead(l) && inScope(l));

// Perdas: quem está em Perda hoje e não é cliente, com lostAt em [start, end),
// por motivo. Perda sem motivo entra em "Sem motivo".
export function lossesOf(leads, { start, end, inScope }) {
  const list = unique(leads).filter((l) =>
    deriveLeadBucket(l) === 'perda' && inWindow(lostAtOf(l), start, end) && inScope(l));
  return { total: list.length, reasons: rankCounts(countBy(list, (l) => String(l.lossReason || '').trim() || 'Sem motivo')) };
}

// Desfecho de um lead da safra no instante asOf.
export function outcomeAt(lead, asOf) {
  const conv = convertedAtOf(lead);
  if (conv && conv <= asOf) return 'enrolled';
  const lost = lostAtOf(lead);
  if (deriveLeadBucket(lead) === 'perda' && lost && lost <= asOf) return 'lost';
  return 'open';
}

// Canais: a origem do cadastro dos leads novos e quantos deles matricularam
// até asOf. Do maior volume para o menor.
export function channelsOf(cohort, asOf) {
  const map = new Map();
  (cohort || []).forEach((l) => {
    const name = String(l.source || '').trim() || 'Sem origem';
    const row = map.get(name) || { name, leads: 0, enrolled: 0 };
    row.leads += 1;
    if (outcomeAt(l, asOf) === 'enrolled') row.enrolled += 1;
    map.set(name, row);
  });
  return [...map.values()].sort((a, b) =>
    b.leads - a.leads || b.enrolled - a.enrolled || a.name.localeCompare(b.name, 'pt-BR'));
}

// Faixas do histograma de dias até a matrícula (handoff, linha 1351).
export const DAYS_BUCKETS = [
  { name: '0 a 1', min: 0, max: 1 },
  { name: '2 a 3', min: 2, max: 3 },
  { name: '4 a 7', min: 4, max: 7 },
  { name: '8 a 14', min: 8, max: 14 },
  { name: '15 a 30', min: 15, max: 30 },
  { name: '31+', min: 31, max: Infinity }
];

// Dias inteiros do cadastro à matrícula das matrículas do mês.
export function daysToEnrollOf(enrollments) {
  const days = (enrollments || [])
    .filter((l) => !l.createdAtMissing && l.createdAt instanceof Date && convertedAtOf(l))
    .map((l) => Math.max(0, Math.floor((convertedAtOf(l) - l.createdAt) / DAY_MS)));
  return {
    total: days.length,
    median: median(days),
    buckets: DAYS_BUCKETS.map((b) => days.filter((d) => d >= b.min && d <= b.max).length)
  };
}
