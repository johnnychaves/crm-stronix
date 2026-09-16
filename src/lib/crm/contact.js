// Tempo até o primeiro contato (spec §4): do cadastro até a primeira interação
// registrada do lead. Quem chama passa o limite: o fim do mês seguinte ao do
// cadastro, ou o corte pró-rata. Puro.

import { isRegistrationNote } from '../leads.js';
import { medianWithMissing } from './stats.js';

// A troca de responsável é registro administrativo, não contato. Vai como
// status_change sem toStatus, com o texto "Responsável alterado de [X] para
// [Y]." (ownerChangeNote, em clientRegistration.js).
const isOwnerChange = (i) => i.type === 'status_change' && typeof i.toStatus !== 'string'
  && typeof i.text === 'string' && i.text.startsWith('Responsável alterado');

// Não contam como contato: a observação do cadastro, a indicação, a
// importação e a troca de responsável. Qualquer outra interação registrada
// conta, inclusive a de quem já saiu da equipe, porque o contato aconteceu.
export const isContactInteraction = (i) => Boolean(i)
  && i.type !== 'referral'
  && i.type !== 'import'
  && !(i.type === 'note' && isRegistrationNote(i.text))
  && !isOwnerChange(i);

// leadId → instantes (ms) das interações que contam como contato, em ordem.
export function contactTimesByLead(interactions) {
  const map = new Map();
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (!i?.leadId || !(i.createdAt instanceof Date) || !isContactInteraction(i)) return;
    if (i.id) {
      if (seen.has(i.id)) return;
      seen.add(i.id);
    }
    const list = map.get(i.leadId) || [];
    list.push(i.createdAt.getTime());
    map.set(i.leadId, list);
  });
  map.forEach((list) => list.sort((a, b) => a - b));
  return map;
}

// Minutos corridos do cadastro ao primeiro contato de cada lead da safra, só
// com interação em [cadastro, limit). Sem interação no prazo: sem contato. Dos
// sem contato, `noneLate` conta os que já tinham mais de 24 horas no limite:
// eles também passaram de 24 horas sem primeiro contato.
export function firstContactOf(cohort, { contactTimes, limit }) {
  const list = cohort || [];
  const values = list.map((l) => {
    if (!(l.createdAt instanceof Date)) return null;
    const from = l.createdAt.getTime();
    const t = (contactTimes.get(l.id) || []).find((x) => x >= from && x < limit);
    return t == null ? null : (t - from) / 60000;
  });
  const waitedLong = (l) => l.createdAt instanceof Date && (limit - l.createdAt.getTime()) / 60000 > 1440;
  return {
    total: values.length,
    h1: values.filter((v) => v != null && v <= 60).length,
    h24: values.filter((v) => v != null && v > 60 && v <= 1440).length,
    over: values.filter((v) => v != null && v > 1440).length,
    none: values.filter((v) => v == null).length,
    noneLate: list.filter((l, idx) => values[idx] == null && waitedLong(l)).length,
    median: medianWithMissing(values)
  };
}
