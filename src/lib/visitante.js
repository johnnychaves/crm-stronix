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
  if (!end) return fp.kind !== FREEPASS_KINDS.DIAS;
  return calendarDaysBetween(now, end) >= 0;
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
  if (!endDayOf(fp)) return '';
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
  if (!end) return '';
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
  if (fp.kind === FREEPASS_KINDS.AULAS) {
    const qtd = freepassQuantityText({ kind: fp.kind, quantity: fp.total });
    // Pelo Agendar, as aulas nascem marcadas; pela aba Contratos, ficam para agendar.
    if ((fp.aulas ?? 0) >= fp.total) return `${head}, ${qtd} ${fp.total === 1 ? 'marcada' : 'marcadas'}.`;
    return `${head}, ${qtd} para agendar.`;
  }
  return `${head}, de ${ddmm(getSafeDateOrNull(fp.startsAt))} a ${ddmm(getSafeDateOrNull(fp.endsAt))}.`;
}

export const freepassEndText = (fp) => `Freepass encerrado: ${fp.typeName}.`;

// Status do registro de aula, os mesmos de AULA_STATUS em src/lib/aulas.js
// (aqui literais, porque este arquivo só pode importar dates.js).
const AULA_AGENDADA = 'agendada';
const AULA_CANCELADA = 'cancelled';

const fpModalidadeOf = (fps, modalidadeId) => (fps || []).filter(fp => fp.modalidadeId === modalidadeId);

// O que o Agendar faz com o freepass da modalidade. Ordem de decisão: usa o que
// corre (ou avulsa se por aulas já está cheio), avulsa se já teve, avulsa se a
// modalidade não tem tipo, avulsa se quem agenda não lança, senão lança.
export function freepassChoiceFor({ lead, freepasses, types, modalidadeId, canLaunch, movingFreepassId = null, now = new Date() }) {
  const runningHere = activeFreepassesOf(lead, fpModalidadeOf(freepasses, modalidadeId), now);
  // O Agendar de aula move a aula pendente: ela já ocupa uma vaga do freepass e a vaga volta a ser livre.
  const moving = movingFreepassId && runningHere.find(fp => fp.id === movingFreepassId);
  if (moving) {
    const aulasLeft = moving.kind === FREEPASS_KINDS.AULAS ? moving.total - (moving.aulas ?? 0) + 1 : null;
    return { kind: 'use', freepass: moving, aulasLeft, moving: true };
  }
  const running = runningHere[0];
  if (running) {
    const aulasLeft = running.kind === FREEPASS_KINDS.AULAS ? running.total - (running.aulas ?? 0) : null;
    if (aulasLeft !== null && aulasLeft <= 0) return { kind: 'avulsa', reason: 'full', freepass: running };
    return { kind: 'use', freepass: running, aulasLeft };
  }
  const had = fpModalidadeOf(freepasses, modalidadeId);
  if (had.length) {
    const ms = (fp) => getSafeDateOrNull(fp.startsAt)?.getTime() ?? 0;
    const latest = had.slice().sort((a, b) => ms(b) - ms(a))[0];
    return { kind: 'avulsa', reason: 'repeated', since: getSafeDateOrNull(latest.startsAt) };
  }
  const ativos = (types || []).filter(t => t.modalidadeId === modalidadeId && t.ativo !== false);
  if (!ativos.length) return { kind: 'avulsa', reason: 'noType' };
  if (!canLaunch) return { kind: 'avulsa', reason: 'noLaunch' };
  return { kind: 'launch', types: [...ativos.filter(t => t.padrao), ...ativos.filter(t => !t.padrao)] };
}

// Para quem não escolhe tipo (Remarcar, Stronizap, IA): o lançamento sai com o
// tipo padrão da modalidade, e sem padrão a aula é avulsa.
export function autoFreepassFor(args) {
  const c = freepassChoiceFor(args);
  if (c.kind !== 'launch') return c;
  const type = c.types.find(t => t.padrao);
  return type ? { kind: 'launch', type } : { kind: 'avulsa', reason: 'noType' };
}

// A escolha feita no passo Freepass ainda vale com os dados de agora? A aula
// avulsa vale sempre; usar pede o mesmo freepass correndo e com vaga; lançar
// pede o mesmo tipo entre os que ainda podem nascer.
export function freepassPickMatches(pick, choice) {
  if (pick?.kind === 'avulsa') return true;
  if (pick?.kind === 'use') return choice?.kind === 'use' && choice.freepass?.id === pick.freepassId;
  if (pick?.kind === 'launch') return choice?.kind === 'launch' && choice.types.some(t => t.id === pick.typeId);
  return false;
}

// A linha do Remarcar e o aviso do passo do Agendar.
export function freepassChoiceText(choice, modalidadeName) {
  switch (choice.kind) {
    case 'use': {
      const { freepass: fp } = choice;
      if (choice.moving) return `Continua no freepass ${fp.typeName}`;
      const head = `Entra no freepass ${fp.typeName}`;
      return fp.kind === FREEPASS_KINDS.AULAS ? `${head} (${(fp.aulas ?? 0) + 1} de ${fp.total})` : head;
    }
    case 'launch': return `Nasce o freepass ${(choice.type || choice.types[0]).name}`;
    case 'avulsa':
      if (choice.reason === 'repeated') return `Aula avulsa: já teve freepass de ${modalidadeName} em ${ddmm(choice.since)}`;
      if (choice.reason === 'full') {
        const n = choice.freepass.total;
        return `Aula avulsa: o freepass já tem ${n === 1 ? 'a 1 aula' : `as ${n} aulas`}`;
      }
      if (choice.reason === 'noType') return `Aula avulsa: ${modalidadeName} não tem freepass cadastrado`;
      return 'Aula avulsa: só o consultor lança freepass';
    default: return '';
  }
}

// O contador de aulas do freepass e, quando por aulas completa, o fim: o começo
// do dia da última aula. Por dias não mexe no fim.
export function freepassAulasPatch({ freepass, records }) {
  const mine = (records || []).filter(r => r.freepassId === freepass.id && r.status !== AULA_CANCELADA);
  const aulas = mine.length;
  if (freepass.kind !== FREEPASS_KINDS.AULAS) return { aulas, endsAt: freepass.endsAt };
  if (aulas < freepass.total) return { aulas, endsAt: null };
  const last = Math.max(...mine.map(r => getSafeDateOrNull(r.scheduledFor)?.getTime() ?? -Infinity));
  return { aulas, endsAt: Number.isFinite(last) ? startOfLocalDay(new Date(last)) : null };
}

// A aula da vez do lead anda para a aula de freepass de hoje, mas só quando a
// atual já passou (dia anterior), já tem desfecho ou não existe: a aula de hoje
// que ainda vai acontecer não se mexe.
export function currentAulaToAdvance({ lead, records, now = new Date() }) {
  const appt = getSafeDateOrNull(lead?.appointmentScheduledFor);
  const done = !appt || Boolean(lead?.appointmentOutcome) || calendarDaysBetween(now, appt) < 0;
  if (!done) return null;
  const today = (records || [])
    .filter(r => r.freepassId && r.status === AULA_AGENDADA && r.id !== lead?.currentAulaId)
    .map(r => ({ r, at: getSafeDateOrNull(r.scheduledFor) }))
    .filter(x => x.at && calendarDaysBetween(now, x.at) === 0)
    .sort((a, b) => a.at - b.at);
  return today[0]?.r || null;
}

// A aula que o lead mostra como a da vez depois de uma gravação: a mais cedo
// do freepass, de hoje em diante.
export function nextFreepassAula({ records, freepassId, now = new Date() }) {
  return (records || [])
    .filter(r => r.freepassId === freepassId && r.status === AULA_AGENDADA)
    .map(r => ({ r, at: getSafeDateOrNull(r.scheduledFor) }))
    .filter(x => x.at && calendarDaysBetween(now, x.at) >= 0)
    .sort((a, b) => a.at - b.at)[0]?.r || null;
}

// Para onde o agendamento do lead aponta depois de gravar aula de freepass:
// para a nextFreepassAula, a não ser que a aula atual do lead (currentAulaId,
// a que acabou de ser gravada) esteja pendente e seja mais cedo ou igual.
// null quer dizer "fica na atual".
export function freepassAulaDaVez({ records, freepassId, currentAulaId, now = new Date() }) {
  const next = nextFreepassAula({ records, freepassId, now });
  if (!next || next.id === currentAulaId) return null;
  const cur = (records || []).find(r => r.id === currentAulaId && r.status === AULA_AGENDADA);
  const curAt = getSafeDateOrNull(cur?.scheduledFor);
  if (curAt && curAt <= getSafeDateOrNull(next.scheduledFor)) return null;
  return next;
}

// A etiqueta da ficha e das listas: quem já é aluno com contrato ativo e faz
// freepass de outra modalidade está num upgrade, não visitando.
export function freepassTagOf({ lead, contractActive, now = new Date() }) {
  const v = visitorOf(lead, now);
  if (!v) return null;
  if (contractActive) return { label: 'Upgrade', text: `${v.modalidadeName}, ${v.shortText}` };
  return { label: 'Visitante', text: v.shortText };
}
