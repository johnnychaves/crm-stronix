// A aba Contratos da ficha: quem é o destaque, o próximo e o Histórico, o
// encaixe entre os dois, a contagem e os botões do card, os fatos de cada
// contrato e a geometria da linha do tempo, já em porcentagem. Puro: sem React
// e sem SDK, e recebe os docs como chegam do Firestore (Timestamp ou Date).
// Spec: docs/superpowers/specs/2026-09-30-contrato-em-uso-e-historico-design.md

import { CONTRACT_STATUS, closedPausesOf, contractDiscountOf, isImportPause, neverTookEffect } from './contracts.js';
import {
  CONTRACT_ORIGIN, closedPauseOf, contractEndOf, contractOriginOf, historyStatusOf, isInUseAt, runningPredecessorOf
} from './contractHistory.js';
import { addDays, addMonths, calendarDaysBetween, daysBetween, getSafeDateOrNull, startOfLocalDay } from './dates.js';
import { SEAM_KIND, computeSeam, contractVigencia, vigenciaRefDate } from './renewal.js';
import { DEFAULT_RENEWAL_CHECKPOINTS } from './renewalGoal.js';

const DAY_MS = 86400000;
const fmtDia = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : '—';
};
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const round1 = (n) => Math.round(n * 10) / 10;

// Início do contrato: o gravado, ou a criação no importado sem início, como
// no Operacional.
export const contractStartOf = (c) => getSafeDateOrNull(c?.startsAt) || getSafeDateOrNull(c?.createdAt);

// Número curto do contrato, o mesmo em toda a aba.
export const shortContractId = (id) => String(id || '').slice(0, 8).toUpperCase();

const byStartDesc = (a, b) => (contractStartOf(b)?.getTime() || 0) - (contractStartOf(a)?.getTime() || 0);

// O último contrato quando o documento dele não está na lista: o resumo do
// lead vira um contrato, para a aba não dizer "Ainda não é cliente" com um
// contrato gravado. Leva a marca `fromSummary`.
export const summaryContractOf = (lead) => (lead?.currentContractId ? {
  id: lead.currentContractId,
  leadId: lead.id ?? null,
  planName: lead.currentPlanName ?? null,
  value: lead.currentContractValue ?? null,
  startsAt: lead.currentContractStartsAt ?? null,
  endsAt: lead.currentContractEndsAt ?? null,
  status: lead.currentContractStatus ?? CONTRACT_STATUS.ATIVO,
  seamless: Boolean(lead.currentContractSeamless),
  fromSummary: true
} : null);

// Quem é o destaque (hero), o próximo e o Histórico. O último contrato é o de
// lead.currentContractId. Se ele já começou, é o destaque e não há próximo. Se
// ainda não começou, o destaque é o contrato em uso: o que ele renova
// (runningPredecessorOf) ou, sem ligação, outro contrato do lead em uso
// (isInUseAt), o de início mais recente; aí o último contrato é o próximo. Sem
// contrato em uso, o último é o destaque, como agendado. O Histórico é o resto,
// do início mais recente ao mais antigo, com as renovações desfeitas dentro.
// `join`: o encaixe do próximo com o em uso (computeSeam), ou null.
export function contractsTabModel({ lead, contracts, now = new Date() } = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const list = (Array.isArray(contracts) ? contracts : []).filter(Boolean);
  const latest = list.find((c) => c.id === lead?.currentContractId) || summaryContractOf(lead);
  const latestStart = contractStartOf(latest);
  const notStarted = Boolean(latest && latestStart && latestStart.getTime() > ref.getTime());
  let hero = latest;
  let next = null;
  if (notStarted) {
    // O contrato em uso: o que o último renova (runningPredecessorOf) ou, só
    // quando o último não é renovação, outro contrato do lead em uso, o de
    // início mais recente. Um paralelo nunca vira o destaque de uma renovação,
    // e o trancado que um sucessor já alcançou não está em uso (isInUseAt).
    const inUse = runningPredecessorOf(latest, list, ref)
      || (latest.renewedFromId ? null : inUseReplacementOf({ contracts: list, excludeId: latest.id, now: ref }))
      || null;
    if (inUse) {
      hero = inUse;
      // O último contrato cancelado nunca é o próximo: vai para o Histórico.
      next = latest.status === CONTRACT_STATUS.CANCELADO ? null : latest;
    }
  }
  const history = list.filter((c) => c.id !== hero?.id && c.id !== next?.id).sort(byStartDesc);
  // O encaixe do próximo com o em uso (computeSeam). Com o em uso trancado, o
  // fim dele ainda anda: os dias que sobram correm junto com o próximo.
  const join = !next ? null
    : hero?.status === CONTRACT_STATUS.TRANCADO ? { kind: JOIN_LOCKED, gapDays: 0, overlapDays: 0 }
      : computeSeam(contractEndOf(hero), contractStartOf(next));
  return { latest, hero, next, history, join };
}

// Outro contrato da pessoa em uso agora (isInUseAt), fora o de `excludeId`,
// o de início mais recente, ou null. É a escolha do destaque para o em uso
// sem ligação e, pela decisão do Johnny de 01/10/2026 (com dois contratos
// ativos, cancelar um deixa o cliente ativo pelo outro), o contrato que
// continua quando o último é cancelado: o ContractOutcomeModal passa o
// resultado ao buildContractCancel (`replacement`), que mora em contracts.js
// e não pode importar contractHistory.js. Cancelado e agendado nunca contam;
// o trancado conta enquanto nenhum sucessor começou.
export function inUseReplacementOf({ contracts, excludeId = null, now = new Date() } = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const list = (Array.isArray(contracts) ? contracts : []).filter(Boolean);
  return list.filter((c) => c.id !== excludeId && isInUseAt(c, ref, list)).sort(byStartDesc)[0] || null;
}

// O encaixe quando o contrato em uso está trancado: o fim dele ainda anda, e
// os dias que sobram correm junto com o próximo (decisão do Johnny,
// 30/09/2026). A faixa e a linha do tempo dizem a mesma coisa.
const JOIN_LOCKED = 'trancado';

// O encaixe do próximo com o contrato em uso, na faixa do próximo.
export function joinTextOf(join) {
  if (!join) return null;
  if (join.kind === JOIN_LOCKED) return 'O contrato em uso está trancado. Quando este começar, os dias que sobram dele correm junto.';
  if (join.kind === SEAM_KIND.EMENDA) return 'sem intervalo';
  if (join.kind === SEAM_KIND.LACUNA) return `${dias(join.gapDays)} sem contrato antes`;
  return `${dias(join.overlapDays)} junto com o atual`;
}

// O bloco de contagem do card: o rótulo, o número e a linha de baixo. Agendado
// conta até começar; trancado conta os dias parados até o início de hoje, a
// conta da reativação (buildContractResume), senão à tarde o card dizia um dia
// a mais que o modal; em uso conta até vencer, e com próximo o rótulo diz que
// está em uso, porque o selo do plano também diz.
export function heroCountdownOf({ contract, status, hasNext = false, now = new Date() } = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const start = contractStartOf(contract);
  const end = getSafeDateOrNull(contract?.endsAt);
  if (status === CONTRACT_STATUS.AGENDADO) {
    const days = start ? Math.max(0, Math.ceil((start.getTime() - ref.getTime()) / DAY_MS)) : 0;
    return { label: 'Começa em', days, note: `início ${fmtDia(start)}` };
  }
  if (status === CONTRACT_STATUS.TRANCADO) {
    const pausedAt = getSafeDateOrNull(contract?.pausedAt);
    const days = pausedAt ? Math.max(0, daysBetween(pausedAt, startOfLocalDay(ref)) || 0) : 0;
    return { label: 'Trancado há', days, note: `desde ${fmtDia(pausedAt)}` };
  }
  const days = end ? Math.max(0, Math.ceil((end.getTime() - ref.getTime()) / DAY_MS)) : 0;
  // No último dia (o fim gravado à meia-noite já passou por instante), a
  // linha de baixo diz que vence hoje.
  const hoje = Boolean(end && calendarDaysBetween(ref, end) === 0);
  return { label: hasNext ? 'Em uso · restam' : 'Restam', days, note: hoje ? 'vence hoje' : `vence ${fmtDia(end)}` };
}

// Os botões do card em cada situação (tabela "Botões em cada situação" da
// spec). `primary` é o botão grande; `actions` são os pequenos, na ordem.
export function heroActionsOf({ status, hasNext = false } = {}) {
  // Vencido ou cancelado sem próximo: o card fechado só oferece a matrícula
  // nova, nunca renovar, corrigir, trancar ou cancelar (revisão de
  // 30/09/2026). Com próximo, o destaque é o contrato em uso no último dia
  // dele (vencido por instante, em uso por dia do calendário): continua
  // com Trancar e Cancelar, nunca a matrícula nova (revisão final).
  if (!hasNext && (status === CONTRACT_STATUS.VENCIDO || status === CONTRACT_STATUS.CANCELADO)) return { primary: 'matricula', actions: [] };
  const paused = status === CONTRACT_STATUS.TRANCADO;
  if (hasNext) return { primary: null, actions: [paused ? 'reativar' : 'trancar', 'cancelar'] };
  if (status === CONTRACT_STATUS.AGENDADO) return { primary: 'ativar', actions: ['corrigir', 'cancelar'] };
  if (paused) return { primary: 'reativar', actions: ['corrigir', 'cancelar'] };
  return { primary: 'renovar', actions: ['corrigir', 'trancar', 'cancelar'] };
}

// Os períodos de trancamento: os encerrados (pauseHistory, ou um refeito pelo
// total, como o Operacional) e o aberto, do trancado e do cancelado ainda
// trancado. A pausa aberta termina no cancelamento ou, no trancado, no início
// do sucessor que já começou (closedPauseOf, a regra do Operacional): dali em
// diante o contrato volta a correr junto com ele. Sucessor ainda por começar
// não fecha nada: hoje o contrato segue trancado, e a pausa conta até o início
// de hoje. `days` é o total gravado mais a pausa aberta; `openDays`, só ela;
// `run`, a pausa fechada pelo sucessor, com o fim andado, ou null.
function pausesOf(contract, ref, leadContracts = []) {
  const closed = closedPausesOf(contract)
    .map((p) => ({
      from: getSafeDateOrNull(p?.pausedAt), to: getSafeDateOrNull(p?.resumedAt),
      fromImport: Boolean(p?.fromImport), reconstructed: Boolean(p?.reconstructed)
    }))
    .filter((p) => p.from && p.to);
  const status = contract?.status;
  const openAt = status === CONTRACT_STATUS.TRANCADO || (status === CONTRACT_STATUS.CANCELADO && contract?.pausedAt)
    ? getSafeDateOrNull(contract.pausedAt) : null;
  const run = openAt && status === CONTRACT_STATUS.TRANCADO ? closedPauseOf(contract, leadContracts, ref) : null;
  const openTo = openAt && status === CONTRACT_STATUS.CANCELADO ? contractEndOf(contract) : (run ? run.to : null);
  const pauses = openAt
    ? [...closed, { from: openAt, to: openTo, fromImport: isImportPause(contract, openAt), reconstructed: false }]
    : closed;
  const openDays = openAt ? Math.max(0, daysBetween(openAt, openTo || startOfLocalDay(ref)) || 0) : 0;
  return { days: (Number(contract?.pausedDaysTotal) || 0) + openDays, openDays, count: pauses.length, pauses, run };
}

// Por que o fim de fato difere do previsto, nesta ordem: cancelado (com o
// motivo), encerrado antes pela renovação (tem originalEndsAt e terminou antes
// dele), esticado pelo trancamento. `days` conta contra o fim previsto.
function endReasonOf({ contract, actualEnd, plannedEnd }) {
  const diff = actualEnd && plannedEnd ? calendarDaysBetween(actualEnd, plannedEnd) : 0;
  if (contract?.status === CONTRACT_STATUS.CANCELADO) {
    return { kind: 'cancelado', days: diff, text: contract.cancelReason ? `cancelado · ${contract.cancelReason}` : 'cancelado' };
  }
  const original = getSafeDateOrNull(contract?.originalEndsAt);
  if (original && actualEnd && calendarDaysBetween(actualEnd, original) > 0 && diff > 0) {
    return { kind: 'renovacao', days: diff, text: `${dias(diff)} antes, pela renovação` };
  }
  if (diff < 0) return { kind: 'trancamento', days: -diff, text: `${dias(-diff)} depois, pelo trancamento` };
  return { kind: null, days: 0, text: null };
}

// Intervalo sem contrato, em dias até quatro meses e em meses depois.
export const gapText = (days) => {
  if (days < 120) return dias(days);
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? 'mês' : 'meses'}`;
};

// A origem por extenso, na coluna Contrato do Histórico: renovação com a
// ordem, retorno e upgrade com os dias sem contrato antes, ou primeira
// matrícula.
export function originTextOf(origin) {
  const gap = origin?.gapDays ? `, ${gapText(origin.gapDays)} depois` : '';
  // Sem ordem (a renovação desfeita, que nunca valeu), só "renovação".
  if (origin?.kind === CONTRACT_ORIGIN.RENOVACAO) return origin.ordinal ? `${origin.ordinal}ª renovação` : 'renovação';
  if (origin?.kind === CONTRACT_ORIGIN.UPGRADE) return `upgrade${gap}`;
  if (origin?.kind === CONTRACT_ORIGIN.RETORNO) return `retorno${gap}`;
  return 'primeira matrícula';
}

// Os fatos de um contrato, para a tabela do Histórico, a linha aberta, o card
// e a faixa do próximo (seção "Detalhes de cada contrato" da spec).
export function contractFactsOf(contract, leadContracts, now = new Date(), thresholdDays) {
  const ref = getSafeDateOrNull(now) || new Date();
  const start = contractStartOf(contract);
  const months = Number(contract?.durationMonths) || 0;
  const recordedEnd = getSafeDateOrNull(contract?.endsAt);
  const { days: pausedDays, count: pauseCount, pauses, run } = pausesOf(contract, ref, leadContracts);
  // O contrato que nunca valeu (a renovação desfeita) não tem fim de fato, nem
  // média, nem ordem de renovação.
  const never = neverTookEffect(contract);
  // Fim de fato: o cancelamento ou o fim gravado (contractEndOf); no trancado
  // que um sucessor já alcançou, o fim andado pelos dias parados (closedPauseOf).
  const actualEnd = never ? null : (run?.end || contractEndOf(contract));
  // Fim previsto: início mais a duração vendida. Sem duração gravada, o fim
  // gravado menos os dias trancados, que o esticaram.
  const plannedEnd = start && months > 0
    ? addMonths(start, months)
    : (recordedEnd && pausedDays > 0 ? addDays(recordedEnd, -pausedDays) : recordedEnd);
  const status = historyStatusOf(contract, leadContracts, ref, thresholdDays);
  const value = contract?.value == null ? null : Number(contract.value);
  const origin = contractOriginOf(contract, leadContracts);
  return {
    id: contract?.id ?? null,
    shortId: shortContractId(contract?.id),
    planName: contract?.planName || null,
    months,
    start,
    plannedEnd,
    actualEnd,
    endReason: never ? { kind: 'cancelado', days: 0, text: 'nunca começou' } : endReasonOf({ contract, actualEnd, plannedEnd }),
    pausedDays,
    pauseCount,
    pauses,
    value,
    monthly: !never && value != null && months > 0 ? value / months : null,
    listValue: Number(contract?.listValue) || 0,
    discount: contractDiscountOf(contract),
    discountReason: contract?.discountReason || null,
    closedBy: contract?.consultantName || null,
    closedAt: getSafeDateOrNull(contract?.createdAt),
    cancelledAt: getSafeDateOrNull(contract?.cancelledAt),
    cancelReason: contract?.cancelReason || null,
    cancelNote: contract?.cancelNote || null,
    origin: never ? { ...origin, ordinal: 0 } : origin,
    status,
    neverTookEffect: never,
    // Estava trancado quando o sucessor começou e voltou a correr junto com
    // ele (closedPauseOf).
    lockedAtRenewalStart: Boolean(run)
  };
}

// A linha do tempo de todos os contratos do cliente, num eixo do início mais
// antigo até o fim mais distante ou até hoje. Um segmento por contrato que
// chegou a valer (a renovação desfeita fica de fora): em uso, próximo,
// encerrado ou cancelado (até o cancelamento). O trancado em uso projeta o fim
// pelos dias parados. Contratos que se cruzam vão para a primeira trilha em
// que cabem. Os trancamentos, as marcas de ano, os marcos de renovação do em
// uso (contractVigencia) e o marcador de hoje saem em porcentagem do eixo.
// `joinsPrev`/`joinsNext` dizem se o segmento encosta no vizinho da trilha
// (até um dia do calendário), para o canto não ser arredondado ali. Null sem
// contrato que valeu.
export function contractTimelineOf({
  contracts, heroId = null, nextId = null, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS, handled = []
} = {}) {
  const ref = getSafeDateOrNull(now) || new Date();
  const items = (Array.isArray(contracts) ? contracts : [])
    .filter((c) => c && !neverTookEffect(c))
    .map((c) => {
      const start = contractStartOf(c);
      const recorded = getSafeDateOrNull(c.endsAt);
      // O trancado projeta o fim pelos dias parados: até hoje, ou até o início
      // do sucessor que o alcançou (closedPauseOf), quando ele volta a correr.
      const locked = c.status === CONTRACT_STATUS.TRANCADO && recorded ? pausesOf(c, ref, contracts) : null;
      const end = c.id === nextId ? recorded
        : locked ? (locked.run?.end || addDays(recorded, locked.openDays))
          : contractEndOf(c);
      return { contract: c, start, end };
    })
    .filter((it) => it.start && it.end && it.end.getTime() >= it.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!items.length) return null;

  const t0 = items[0].start.getTime();
  const t1 = Math.max(ref.getTime(), ...items.map((it) => it.end.getTime()));
  const span = Math.max(t1 - t0, 1);
  const pct = (t) => Math.max(0, Math.min(100, ((t - t0) / span) * 100));

  const lanes = [];
  const laneLast = [];
  let heroLane = null;
  items.forEach((it) => {
    const c = it.contract;
    const kind = c.id === heroId ? 'em_uso'
      : c.id === nextId ? 'proximo'
        : c.status === CONTRACT_STATUS.CANCELADO ? 'cancelado' : 'encerrado';
    let lane = laneLast.findIndex((last) => last.end.getTime() < it.start.getTime());
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
      laneLast.push(null);
    }
    const prev = laneLast[lane];
    const joinsPrev = Boolean(prev && calendarDaysBetween(prev.end, it.start) <= 1);
    if (joinsPrev) prev.segment.joinsNext = true;
    const plano = c.planName || 'Contrato';
    const title = kind === 'em_uso' ? `${plano} · em uso até ${fmtDia(it.end)}`
      : kind === 'proximo' ? `${plano} · começa em ${fmtDia(it.start)}`
        : kind === 'cancelado' ? `${plano} · cancelado em ${fmtDia(it.end)}`
          : `${plano} · ${fmtDia(it.start)} a ${fmtDia(it.end)}`;
    const left = pct(it.start.getTime());
    const right = pct(it.end.getTime());
    const pauses = pausesOf(c, ref, contracts).pauses.map((p) => {
      const from = Math.max(p.from.getTime(), it.start.getTime());
      const to = Math.min((p.to || ref).getTime(), it.end.getTime());
      if (to <= from) return null;
      return {
        leftPct: round1(pct(from)),
        widthPct: round1(pct(to) - pct(from)),
        title: p.to ? `Trancado de ${fmtDia(p.from)} a ${fmtDia(p.to)}` : `Trancado desde ${fmtDia(p.from)}`
      };
    }).filter(Boolean);
    const segment = { id: c.id, kind, leftPct: round1(left), widthPct: round1(right - left), title, joinsPrev, joinsNext: false, pauses };
    lanes[lane].push(segment);
    laneLast[lane] = { end: it.end, segment };
    if (kind === 'em_uso') heroLane = lane;
  });

  const years = [];
  for (let y = new Date(t0).getFullYear() + 1; y <= new Date(t1).getFullYear(); y += 1) {
    const jan = new Date(y, 0, 1).getTime();
    if (jan > t0 && jan < t1) years.push({ year: y, pct: round1(pct(jan)) });
  }

  // Os marcos de renovação da academia, só no contrato em uso, com o mesmo
  // title da régua de antes. A régua congela no trancamento (vigenciaRefDate).
  const heroItem = heroId ? items.find((it) => it.contract.id === heroId) : null;
  const vig = heroItem
    ? contractVigencia({ startsAt: heroItem.start, endsAt: heroItem.contract.endsAt, checkpoints, handled, now: vigenciaRefDate(heroItem.contract, ref) })
    : null;
  const marks = (vig?.marks || []).map((m) => ({
    days: m.days,
    pct: round1(pct(m.date.getTime())),
    date: m.date,
    active: m.active,
    passed: m.passed,
    handled: m.handled,
    title: `Marco de ${m.days} dias · ${fmtDia(m.date)}${m.handled ? ' · contato feito' : m.passed ? ' · passou sem contato' : ''}`
  }));

  return { start: new Date(t0), end: new Date(t1), todayPct: round1(pct(ref.getTime())), years, lanes, heroLane, marks };
}
