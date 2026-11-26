// src/lib/visitante.js
// Visitante e freepass (spec docs/superpowers/specs/2026-11-26-visitante-e-freepass-design.md).
// Regra pura e sem pacote: a api/ vai ler este arquivo na entrega 2 (cartão do
// Stronizap e agendamento pela ponte). O nome não é freepass.js porque no APFS,
// que não diferencia maiúscula, ele colidiria com o freePass.js que já existe.
import { addDays, calendarDaysBetween, getSafeDateOrNull, startOfLocalDay } from './dates.js';

export const FREEPASS_KINDS = Object.freeze({ DIAS: 'dias', AULAS: 'aulas' });
export const FREEPASS_STATUS = Object.freeze({ CORRENDO: 'correndo', ENCERRADO: 'encerrado' });
export const FREEPASS_MAX = 99;

const kindOf = (k) => (k === FREEPASS_KINDS.DIAS || k === FREEPASS_KINDS.AULAS ? k : null);
const qtyOf = (n) => {
  const q = Math.floor(Number(n));
  return Number.isFinite(q) && q >= 1 && q <= FREEPASS_MAX ? q : null;
};
const fold = (s) => String(s || '').trim().toLocaleLowerCase('pt-BR');
const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Os tipos que o gestor cadastra em Configurações → Agendamento, gravados em
// stronix_config/general.freepassTypes. Descarta o que não fecha e deixa um
// padrão só por modalidade (o primeiro ativo), que é o que a ponte do Stronizap
// usa na entrega 2.
export function normalizeFreepassTypes(raw) {
  if (!Array.isArray(raw)) return [];
  const padroes = new Set();
  const out = [];
  for (const t of raw) {
    const id = typeof t?.id === 'string' ? t.id : '';
    const name = typeof t?.name === 'string' ? t.name.trim() : '';
    const modalidadeId = typeof t?.modalidadeId === 'string' ? t.modalidadeId : '';
    const kind = kindOf(t?.kind);
    const quantity = qtyOf(t?.quantity);
    if (!id || !name || !modalidadeId || !kind || !quantity) continue;
    const ativo = t.ativo !== false;
    const padrao = Boolean(t.padrao) && ativo && !padroes.has(modalidadeId);
    if (padrao) padroes.add(modalidadeId);
    out.push({ id, name, modalidadeId, kind, quantity, padrao, ativo });
  }
  return out;
}

// O que falta no formulário do tipo, um problema por vez, na ordem dos campos.
export function freepassTypeProblem(draft, types) {
  const name = String(draft?.name || '').trim();
  if (!name) return { field: 'name', message: 'Dê um nome ao freepass.' };
  if ((types || []).some(t => t.id !== draft.id && fold(t.name) === fold(name))) {
    return { field: 'name', message: 'Já existe um freepass com esse nome.' };
  }
  if (!draft?.modalidadeId) return { field: 'modalidadeId', message: 'Escolha a modalidade.' };
  if (!kindOf(draft?.kind)) return { field: 'kind', message: 'Diga se vale por dias ou por aulas.' };
  if (!qtyOf(draft?.quantity)) return { field: 'quantity', message: 'A quantidade vai de 1 a 99.' };
  return null;
}

// A lista nova depois de salvar um tipo: troca pelo id ou acrescenta no fim. O
// padrão novo tira o padrão dos outros tipos da mesma modalidade.
export function saveFreepassType(types, draft) {
  const clean = {
    id: draft.id, name: String(draft.name).trim(), modalidadeId: draft.modalidadeId,
    kind: draft.kind, quantity: qtyOf(draft.quantity), padrao: Boolean(draft.padrao), ativo: draft.ativo !== false
  };
  const base = (types || []).map(t => (
    clean.padrao && t.id !== clean.id && t.modalidadeId === clean.modalidadeId ? { ...t, padrao: false } : t
  ));
  const i = base.findIndex(t => t.id === clean.id);
  if (i === -1) return [...base, clean];
  const out = base.slice();
  out[i] = clean;
  return out;
}

export function freepassQuantityText({ kind, quantity }) {
  const n = Number(quantity) || 0;
  if (kind === FREEPASS_KINDS.DIAS) return `${n} ${n === 1 ? 'dia' : 'dias'}`;
  return `${n} ${n === 1 ? 'aula' : 'aulas'}`;
}
