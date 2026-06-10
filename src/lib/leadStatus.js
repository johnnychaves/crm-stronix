import { getLeadAppointmentType, getLeadAppointmentDate } from './leads.js';

// --- HELPERS DE TEMPERATURA DO LEAD ---
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Tamanho de página das listas longas (Leads, Agendamentos): renderiza só os
// primeiros N e revela mais sob demanda — evita pintar centenas de linhas no
// DOM de uma vez.
const LIST_PAGE_SIZE = 50;

// Normaliza a lista de opções de quantidade de aulas experimentais:
// inteiros positivos, sem repetição, ordenados. Aceita também um número
// legado `fallbackMax` (config antiga com maxTrialClasses) → vira [1..max].
// Nunca retorna vazio: cai para [1, 2, 3].
const normalizeTrialClassOptions = (raw, fallbackMax) => {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (Number.isFinite(Number(fallbackMax)) && Number(fallbackMax) > 0) {
    const max = Math.floor(Number(fallbackMax));
    list = Array.from({ length: max }, (_, i) => i + 1);
  }
  const clean = Array.from(new Set(
    list.map(n => Math.floor(Number(n))).filter(n => Number.isFinite(n) && n >= 1 && n <= 99)
  )).sort((a, b) => a - b);
  return clean.length ? clean : [1, 2, 3];
};

// Dias da semana (0=dom..6=sáb) em que a Meta Diária vale. Default seg–sex.
const normalizeMetaWeekdays = (raw) => {
  if (!Array.isArray(raw)) return [1, 2, 3, 4, 5];
  const clean = Array.from(new Set(
    raw.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  )).sort((a, b) => a - b);
  return clean.length ? clean : [1, 2, 3, 4, 5];
};

// SLA de atrasados: dias de atraso a partir dos quais o lead vira "crítico".
// Inteiro 1..30; fora disso (ou ausente) cai no default 3.
const normalizeSlaOverdueDays = (raw) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : 3;
};

// Índice leadId -> { count, lastDate } construído UMA vez em O(interações).
// Antes, cada card/linha recomputava interactions.filter() por lead — dava
// O(leads × interações) a cada render/tecla. Monte num useMemo([interactions])
// e passe lastDate aos badges (LeadTemperatureBadge/DaysSinceContactBadge) e
// use nos filtros (ex: "Apenas Hot").
const buildInteractionIndex = (interactions) => {
  const idx = new Map();
  (interactions || []).forEach(i => {
    let e = idx.get(i.leadId);
    if (!e) { e = { count: 0, lastDate: null }; idx.set(i.leadId, e); }
    e.count += 1;
    if (i.createdAt instanceof Date && (!e.lastDate || i.createdAt > e.lastDate)) {
      e.lastDate = i.createdAt;
    }
  });
  return idx;
};

const isLeadActive = (lead) => {
  return lead && lead.status !== 'Venda' && lead.status !== 'Perda';
};

// --- Predicados de temperatura/recência. Recebem a última data de interação
// já resolvida (via buildInteractionIndex.get(id)?.lastDate), sem varrer o
// array por lead — O(1) por lead em listas. ---

const getDaysSinceFromDate = (lead, lastInteractionDate) => {
  const last = (lastInteractionDate instanceof Date ? lastInteractionDate : null) || lead?.createdAt;
  if (!(last instanceof Date) || isNaN(last.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - last.getTime()) / DAY_MS));
};

const isHotLeadFromDate = (lead, lastInteractionDate) => {
  if (!isLeadActive(lead)) return false;
  const now = Date.now();

  // Critério 1: lead recém-criado (últimas 6 horas)
  if (lead.createdAt instanceof Date) {
    const ageMs = now - lead.createdAt.getTime();
    if (ageMs >= 0 && ageMs <= 6 * HOUR_MS) return true;
  }

  // Critério 2: interação nas últimas 24h
  if (lastInteractionDate instanceof Date) {
    const sinceMs = now - lastInteractionDate.getTime();
    if (sinceMs >= 0 && sinceMs <= 24 * HOUR_MS) return true;
  }

  // Critério 3: visita ou aula experimental agendada nas próximas 48h
  const appointmentType = getLeadAppointmentType(lead);
  const appointmentDate = getLeadAppointmentDate(lead);
  if (appointmentType && appointmentDate instanceof Date && !isNaN(appointmentDate.getTime())) {
    const untilMs = appointmentDate.getTime() - now;
    if (untilMs >= 0 && untilMs <= 48 * HOUR_MS) return true;
  }

  return false;
};

const isColdLeadFromDate = (lead, lastInteractionDate) => {
  if (!isLeadActive(lead)) return false;
  // Hot e cold são mutuamente exclusivos — hot tem prioridade
  if (isHotLeadFromDate(lead, lastInteractionDate)) return false;
  const days = getDaysSinceFromDate(lead, lastInteractionDate);
  return days !== null && days >= 7;
};
export { HOUR_MS, DAY_MS, LIST_PAGE_SIZE, normalizeTrialClassOptions, normalizeMetaWeekdays, normalizeSlaOverdueDays, buildInteractionIndex, isLeadActive, getDaysSinceFromDate, isHotLeadFromDate, isColdLeadFromDate };
