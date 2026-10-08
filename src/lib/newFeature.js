import { toDateInputValue } from './dates.js';

// Até quando o balão "Novo" de uma tela nova aparece (NewFeatureBadge): até o
// dia `until` (AAAA-MM-DD), inclusive, no dia do aparelho. Data fora do formato
// não mostra o balão, para ele nunca ficar para sempre. Quem desenha algo junto
// com o balão (o ponto vermelho do menu recolhido) usa a mesma conta, para os
// dois sumirem no mesmo dia.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isNewFeatureOn(until, now = new Date()) {
  if (typeof until !== 'string' || !DAY_RE.test(until)) return false;
  return toDateInputValue(now) <= until;
}
