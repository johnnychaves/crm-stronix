// Histórico de troca de professor no lead (spec
// docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md). O lead
// guarda o professor atual em professorId e, desde a primeira troca, a lista
// professorHistory: { professorId, since }, na ordem, com since null na
// primeira entrada (o professor de antes do histórico). Sem a lista, a
// renovação da carteira não sabe quem era o professor no dia do vencimento.
//
// Toda gravação do professor do lead passa por professorChangePatch, e a
// varredura historicoDoProfessor.sweep.test.js cobra isso. Puro, e só importa
// ./dates.js, porque a api/ do perfil vai ler a carteira por aqui.
import { getSafeDateOrNull } from './dates.js';

const idOf = (v) => (typeof v === 'string' && v.trim() ? v : null);
const historyOf = (lead) => (Array.isArray(lead?.professorHistory) ? lead.professorHistory : []);

// O patch da troca de professor, ou null quando nada muda.
// O primeiro professor de um lead sem professor e sem histórico não grava
// histórico: vale desde sempre, a mesma leitura do lead sem histórico. A
// primeira troca de verdade grava também quem era antes, com since null.
// shortcut: grava a lista inteira a partir do lead em mãos, então duas abas
// trocando o professor do mesmo lead no mesmo instante podem perder uma
// entrada. Trocar por arrayUnion se isso aparecer.
export function professorChangePatch(lead, nextId, nextName = null, at = new Date()) {
  const prev = idOf(lead?.professorId);
  const next = idOf(nextId);
  if (prev === next) return null;
  const patch = { professorId: next, professorName: next ? (nextName || null) : null };
  const history = historyOf(lead);
  if (!history.length && !prev) return patch;
  const before = history.length ? history : [{ professorId: prev, since: null }];
  return { ...patch, professorHistory: [...before, { professorId: next, since: at }] };
}

// Quem era o professor do lead num instante. Lead sem histórico, ou data
// inválida, devolve o professor atual. No instante da troca já vale o novo.
export function professorAt(lead, date) {
  const history = historyOf(lead);
  const when = getSafeDateOrNull(date)?.getTime();
  if (!history.length || when == null) return idOf(lead?.professorId);
  let current = null;
  for (const entry of history) {
    if (entry?.since == null) {
      current = idOf(entry?.professorId);
      continue;
    }
    const since = getSafeDateOrNull(entry.since)?.getTime();
    if (since != null && since <= when) current = idOf(entry.professorId);
  }
  return current;
}
