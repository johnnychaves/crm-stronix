// Base de clientes a partir de stronix_contratos (coleção inteira, já em
// memória). Vigência por pessoa num instante, ponte do mês por transição de
// estado (fecha por construção), churn por saída definitiva, cancelamentos por
// motivo, matrículas e upgrades por vendedor. Importado de planilha entra na
// base, mas nunca conta como matrícula, retorno, cancelamento ou trancamento.

import { addDays, getSafeDateOrNull } from '../dates.js';
import { isImportedContract } from '../contracts.js';

const DAY_MS = 86400000;

// Pausas como intervalos [from, to), to = null na pausa em curso. Fontes, na
// ordem: o histórico gravado na reativação (pauseHistory); sem ele, a última
// reativação vira UM intervalo de pausedDaysTotal dias terminando em resumedAt
// (várias pausas antigas se juntam numa só, aproximação conhecida); e a pausa
// aberta de quem está trancado (ou foi cancelado trancado). A pausa gravada
// pela importação não tem data real e começa em startsAt, para não inventar
// trancamento no mês da importação; o trancamento pela ficha sempre tem motivo.
function pausesOf(c, { startsAt, pausedAt, resumedAt, imported }) {
  const fromImport = imported && !c.pauseReason;
  const out = [];
  if (Array.isArray(c.pauseHistory) && c.pauseHistory.length) {
    c.pauseHistory.forEach((p) => {
      const from = p?.fromImport ? startsAt : getSafeDateOrNull(p?.pausedAt);
      const to = getSafeDateOrNull(p?.resumedAt);
      if (from && to) out.push({ from, to });
    });
  } else if (resumedAt && Number(c.pausedDaysTotal) > 0) {
    out.push({ from: fromImport ? startsAt : addDays(resumedAt, -Number(c.pausedDaysTotal)), to: resumedAt });
  }
  if (c.status === 'trancado' || (c.status === 'cancelado' && pausedAt)) {
    const from = fromImport ? startsAt : (pausedAt || startsAt);
    if (from) out.push({ from, to: null });
  }
  return out;
}

export function normalizeContract(c) {
  const d = (v) => getSafeDateOrNull(v);
  const createdAt = d(c.createdAt);
  // Importado pode vir sem início: vale a criação.
  const startsAt = d(c.startsAt) || createdAt;
  const endsAt = d(c.endsAt);
  const pausedAt = d(c.pausedAt);
  const resumedAt = d(c.resumedAt);
  const imported = isImportedContract(c);
  return {
    ...c,
    startsAt,
    endsAt,
    createdAt,
    // Cancelado sem data (legado): trata como encerrado no fim, sem efeito na ponte.
    cancelledAt: d(c.cancelledAt) || (c.status === 'cancelado' ? endsAt : null),
    pausedAt,
    resumedAt,
    imported,
    pauses: pausesOf(c, { startsAt, pausedAt, resumedAt, imported }),
    personKey: c.leadId || `contrato:${c.id}`
  };
}

export const hasOpenPause = (c) => (c.pauses || []).some((p) => p.to == null);

// 'vigente' | 'trancado' | null no instante t. Trancado não vence: na pausa em
// curso vale 'trancado' mesmo depois de endsAt, que anda quando reativar.
export function contractStateAt(c, t) {
  if (!c.startsAt || t < c.startsAt) return null;
  if (c.cancelledAt && c.cancelledAt <= t) return null;
  const pauses = c.pauses || [];
  if (pauses.some((p) => p.to == null && p.from <= t)) return 'trancado';
  if (!c.endsAt || t >= c.endsAt) return null;
  return pauses.some((p) => p.to != null && p.from <= t && t < p.to) ? 'trancado' : 'vigente';
}

// Estado de cada pessoa no instante t: vigente vence trancado.
export function personStatesAt(contracts, t) {
  const map = new Map();
  (contracts || []).forEach((c) => {
    const s = contractStateAt(c, t);
    if (!s) return;
    if (s === 'vigente' || !map.has(c.personKey)) map.set(c.personKey, s);
  });
  return map;
}

const vigentSet = (states) => new Set([...states].filter(([, s]) => s === 'vigente').map(([k]) => k));

export const countActiveAt = (contracts, t) => vigentSet(personStatesAt(contracts, t)).size;

export const countLockedAt = (contracts, t) =>
  [...personStatesAt(contracts, t).values()].filter((s) => s === 'trancado').length;

const firstMoment = (c) => c.createdAt || c.startsAt;

const NO_CONTRACTS = Object.freeze([]);
const indexCache = new WeakMap();

// Contratos por pessoa (em ordem de início) e renovações por contrato de
// origem, montados uma vez por array. A lista vem do estado do React e é
// tratada como imutável: array novo, índice novo.
export function indexContracts(contracts) {
  const list = contracts || NO_CONTRACTS;
  const cached = indexCache.get(list);
  if (cached) return cached;
  const byPerson = new Map();
  const byRenewedFrom = new Map();
  const push = (m, k, c) => {
    const arr = m.get(k);
    if (arr) arr.push(c); else m.set(k, [c]);
  };
  list.forEach((c) => {
    push(byPerson, c.personKey, c);
    if (c.renewedFromId) push(byRenewedFrom, c.renewedFromId, c);
  });
  byPerson.forEach((arr) => arr.sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)));
  const index = { byPerson, byRenewedFrom };
  indexCache.set(list, index);
  return index;
}

// Ponte do mês: A = vigentes no início, B = vigentes no fim efetivo. Quem muda de
// lado ganha um motivo, então início + passos = fim sempre. Quem entra por um
// contrato importado vai para "importados": não é matrícula nem retorno.
export function computeBaseMovement(contracts, { start, end }) {
  const tEnd = new Date(end.getTime() - 1);
  const A = personStatesAt(contracts, start);
  const B = personStatesAt(contracts, tEnd);
  const vA = vigentSet(A);
  const vB = vigentSet(B);
  const people = indexContracts(contracts).byPerson;
  const n = { entraram: 0, voltaram: 0, importados: 0, cancelaram: 0, venceram: 0, trancaram: 0, destrancaram: 0 };

  vB.forEach((key) => {
    if (vA.has(key)) return;
    if (A.get(key) === 'trancado') { n.destrancaram += 1; return; }
    const list = people.get(key) || [];
    const vig = list.filter((c) => contractStateAt(c, tEnd) === 'vigente');
    // Com mais de um vigente, vale o feito no sistema.
    const current = vig.find((c) => !c.imported) || vig[0];
    if (current?.imported) { n.importados += 1; return; }
    const hadBefore = list.some((c) => c !== current && c.startsAt && current?.startsAt && c.startsAt < current.startsAt);
    if (hadBefore) n.voltaram += 1; else n.entraram += 1;
  });

  vA.forEach((key) => {
    if (vB.has(key)) return;
    if (B.get(key) === 'trancado') { n.trancaram += 1; return; }
    const list = people.get(key) || [];
    const cancelledHere = list.some((c) => !c.imported && c.cancelledAt && c.cancelledAt >= start && c.cancelledAt < end);
    if (cancelledHere) n.cancelaram += 1; else n.venceram += 1;
  });

  return {
    startCount: vA.size,
    endCount: vB.size,
    steps: {
      entraram: n.entraram,
      voltaram: n.voltaram,
      importados: n.importados,
      cancelaram: n.cancelaram,
      venceram: n.venceram,
      trancamentos: n.destrancaram - n.trancaram
    },
    trancaram: n.trancaram,
    destrancaram: n.destrancaram
  };
}

// Saída definitiva no mês: cancelamento sem outro contrato valendo logo depois,
// ou fim da tolerância de um contrato vencido sem retorno. Trancado continua
// cliente: não vence, e quem tem outro contrato trancado não saiu.
// ÷ vigentes no início.
export function computeChurn(contracts, { start, end, graceDays }) {
  const graceMs = (Number(graceDays) || 0) * DAY_MS;
  const aliveAt = (list, t) => list.some((c) => contractStateAt(c, t) != null);
  let exits = 0;
  indexContracts(contracts).byPerson.forEach((list) => {
    const hit = list.some((c) => {
      // Cancelado antes do fim, ou cancelado ainda parado: trancado não vence,
      // então a saída é o cancelamento, mesmo depois do fim antigo.
      if (c.cancelledAt && !c.imported && ((c.endsAt && c.cancelledAt < c.endsAt) || hasOpenPause(c))) {
        return c.cancelledAt >= start && c.cancelledAt < end && !aliveAt(list, c.cancelledAt);
      }
      if (!c.endsAt || hasOpenPause(c)) return false;
      const x = new Date(c.endsAt.getTime() + graceMs);
      if (x < start || x >= end) return false;
      const returned = list.some((o) => o !== c && o.startsAt && o.startsAt >= c.endsAt && o.startsAt <= x);
      return !returned && !aliveAt(list, x);
    });
    if (hit) exits += 1;
  });
  const base = countActiveAt(contracts, start);
  return { exits, base, pct: base > 0 ? Math.round((exits / base) * 1000) / 10 : null };
}

const sortItems = (map) => [...map].map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export function cancellationsByReason(contracts, { start, end }) {
  const map = new Map();
  (contracts || []).forEach((c) => {
    if (c.imported || !c.cancelledAt || c.cancelledAt < start || c.cancelledAt >= end) return;
    const name = c.cancelReason || 'Outro';
    map.set(name, (map.get(name) || 0) + 1);
  });
  const items = sortItems(map);
  return { total: items.reduce((s, r) => s + r.count, 0), items };
}

// Matrículas (primeiro contrato da pessoa) e upgrades do mês, por vendedor: o
// consultor gravado no contrato, o mesmo nome da comissão.
export function salesInWindow(contracts, { start, end }) {
  const people = indexContracts(contracts).byPerson;
  const entered = new Map();
  const upgrades = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  (contracts || []).forEach((c) => {
    const t = firstMoment(c);
    if (c.imported || !t || t < start || t >= end) return;
    const seller = c.consultantId || 'sem-consultor';
    if (c.closedFromUpgrade) bump(upgrades, seller);
    if (!c.renewedFromId) {
      const earlier = (people.get(c.personKey) || []).some((o) => o !== c && firstMoment(o) && firstMoment(o) < t);
      if (!earlier) bump(entered, seller);
    }
  });
  return { entered, upgrades };
}
