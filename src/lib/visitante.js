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

const endDayOf = (fp) => startOfLocalDay(fp?.endsAt);
const nul = (v) => (v === undefined ? null : v);

// Corre enquanto não foi encerrado à mão e o último dia não passou. Por aulas
// sem o fim marcado (a entrega 2 grava o dia da última aula), corre sempre.
export function isFreepassRunning(fp, now = new Date()) {
  if (!fp || fp.status !== FREEPASS_STATUS.CORRENDO) return false;
  const end = endDayOf(fp);
  return !end || calendarDaysBetween(now, end) >= 0;
}

// Os freepass que fazem da pessoa um Visitante agora. A perda e a matrícula
// não gravam nada no freepass: o lead em Perda não é Visitante, e um contrato
// atual diferente do que a pessoa tinha no lançamento quer dizer que houve
// matrícula ou renovação. Assim todo caminho que matricula ou marca perda
// encerra o freepass sem mexer em nenhum deles. Limite aceito: o lead
// reativado da Perda dentro do prazo volta a aparecer como Visitante.
export function activeFreepassesOf(lead, freepasses, now = new Date()) {
  if (!lead || lead.status === 'Perda') return [];
  const contract = lead.currentContractId || null;
  return (freepasses || []).filter(fp => (fp.contractAtStart || null) === contract && isFreepassRunning(fp, now));
}

export const FREEPASS_SUMMARY_EMPTY = Object.freeze({
  freepassId: null, freepassKind: null, freepassTotal: null, freepassTypeName: null,
  freepassModalidadeName: null, freepassStartsAt: null, freepassEndsAt: null,
  freepassAulas: null, freepassStatus: null, freepassContractAtStart: null
});

// O resumo que vai para o lead, para as listas e o cabeçalho saberem quem é
// Visitante sem ler a coleção. Com mais de um correndo, o que termina
// primeiro; o por aulas sem fim marcado fica por último.
export function freepassSummaryPatch(freepasses, now = new Date()) {
  const running = (freepasses || []).filter(fp => isFreepassRunning(fp, now));
  if (!running.length) return { ...FREEPASS_SUMMARY_EMPTY };
  const endMs = (fp) => endDayOf(fp)?.getTime() ?? Infinity;
  const fp = running.slice().sort((a, b) => endMs(a) - endMs(b))[0];
  return {
    freepassId: fp.id, freepassKind: fp.kind, freepassTotal: fp.total, freepassTypeName: nul(fp.typeName),
    freepassModalidadeName: nul(fp.modalidadeName), freepassStartsAt: nul(fp.startsAt), freepassEndsAt: nul(fp.endsAt),
    freepassAulas: fp.aulas ?? 0, freepassStatus: fp.status, freepassContractAtStart: fp.contractAtStart || null
  };
}

const summaryOf = (lead) => ({
  id: lead.freepassId, kind: lead.freepassKind, total: lead.freepassTotal, typeName: lead.freepassTypeName,
  modalidadeName: lead.freepassModalidadeName, startsAt: lead.freepassStartsAt, endsAt: lead.freepassEndsAt,
  aulas: lead.freepassAulas, status: lead.freepassStatus, contractAtStart: lead.freepassContractAtStart
});

// Quem é Visitante agora, pelo resumo do lead. null quando não é.
export function visitorOf(lead, now = new Date()) {
  if (!lead?.freepassId) return null;
  const fp = summaryOf(lead);
  if (!activeFreepassesOf(lead, [fp], now).length) return null;
  return { ...fp, shortText: freepassShortText(fp, now), longText: freepassLongText(fp, now) };
}

// O andamento para a etiqueta: "faltam 3 dias", "termina hoje", "1 de 2 aulas".
export function freepassShortText(fp, now = new Date()) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return `${fp.aulas ?? 0} de ${fp.total} aulas`;
  const start = startOfLocalDay(fp.startsAt);
  if (start && calendarDaysBetween(now, start) > 0) return `começa em ${ddmm(start)}`;
  const d = calendarDaysBetween(now, endDayOf(fp));
  if (d === 0) return 'termina hoje';
  return d === 1 ? 'falta 1 dia' : `faltam ${d} dias`;
}

// O andamento para o cartão da aba Contratos.
export function freepassLongText(fp, now = new Date()) {
  if (fp.kind === FREEPASS_KINDS.AULAS) return `${fp.aulas ?? 0} de ${fp.total} aulas agendadas`;
  const start = startOfLocalDay(fp.startsAt);
  const end = endDayOf(fp);
  if (start && calendarDaysBetween(now, start) > 0) return `Começa em ${ddmm(start)} e vai até ${ddmm(end)}`;
  const d = calendarDaysBetween(now, end);
  if (d === 0) return `Termina hoje, ${ddmm(end)}`;
  return `${d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`}, até ${ddmm(end)}`;
}

export const FREEPASS_INTERACTION_TYPE = 'freepass';

// Um freepass por modalidade (decisão do Johnny, 26/11/2026). Conta qualquer
// freepass da pessoa na modalidade, correndo ou encerrado. O gestor libera
// com uma confirmação.
export function launchCheck({ type, freepasses, modalidadeName, gestor }) {
  const repeated = (freepasses || []).some(fp => fp.modalidadeId === type?.modalidadeId);
  if (!repeated) return null;
  const why = `Essa pessoa já teve um freepass de ${modalidadeName}.`;
  return gestor ? { confirm: `${why} Lançar outro mesmo assim?` } : { block: `${why} Só o gestor libera outro.` };
}

// O início que a janela aceita: de 7 dias atrás (lançamento atrasado) a 30 dias
// à frente.
export function launchStartRange(now = new Date()) {
  const today = startOfLocalDay(now);
  return { min: addDays(today, -7), max: addDays(today, 30) };
}

// O documento de stronix_freepass, sem a hora do servidor (quem grava põe o
// createdAt). Por aulas, o início é o dia do lançamento e o fim fica null até
// a entrega 2 gravar o dia da última aula.
export function buildFreepassDoc({ lead, type, modalidadeName, startsAt, appUser, via }) {
  const start = startOfLocalDay(getSafeDateOrNull(startsAt) || new Date());
  return {
    leadId: lead.id,
    typeId: type.id, typeName: type.name,
    modalidadeId: type.modalidadeId, modalidadeName: modalidadeName || null,
    kind: type.kind, total: type.quantity,
    startsAt: start,
    endsAt: type.kind === FREEPASS_KINDS.DIAS ? addDays(start, type.quantity - 1) : null,
    aulas: 0,
    status: FREEPASS_STATUS.CORRENDO,
    contractAtStart: lead.currentContractId || null,
    consultantId: lead.consultantId || null, consultantName: lead.consultantName || null,
    createdById: appUser?.id || null, createdByName: appUser?.name || null, createdByAuthUid: appUser?.authUid || null,
    via
  };
}

export function freepassLaunchText(fp) {
  const head = `Freepass lançado: ${fp.typeName} (${fp.modalidadeName})`;
  if (fp.kind === FREEPASS_KINDS.AULAS) return `${head}, ${freepassQuantityText({ kind: fp.kind, quantity: fp.total })} para agendar.`;
  return `${head}, de ${ddmm(getSafeDateOrNull(fp.startsAt))} a ${ddmm(getSafeDateOrNull(fp.endsAt))}.`;
}

export const freepassEndText = (fp) => `Freepass encerrado: ${fp.typeName}.`;
