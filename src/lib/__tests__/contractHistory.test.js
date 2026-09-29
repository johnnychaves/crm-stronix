// Origem de cada contrato de uma pessoa, na aba Contratos da ficha. A ordem é
// a do Gerencial (saleTypeOf): renovação, upgrade, retorno e primeira. O último
// bloco compara as duas, para a ficha e o Gerencial não se separarem.

import { describe, it, expect } from 'vitest';
import { CONTRACT_ORIGIN, contractEndOf, contractOriginOf } from '../contractHistory.js';
import { normalizeContracts, indexContracts } from '../operacional/base.js';
import { saleTypeOf, SALE_TYPES } from '../gerencial/scope.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const ts = (date) => ({ toDate: () => date });
const L = 'lead-1';
const K = (id, extra) => ({ id, leadId: L, planName: `Plano ${id}`, value: 100, durationMonths: 1, ...extra });

const a = K('a', { startsAt: D(2025, 1, 10), endsAt: D(2025, 2, 10), createdAt: D(2025, 1, 10) });
const b = K('b', { renewedFromId: 'a', startsAt: D(2025, 2, 11), endsAt: D(2025, 5, 11), createdAt: D(2025, 2, 5) });
const c = K('c', { renewedFromId: 'b', startsAt: D(2025, 5, 12), endsAt: D(2026, 5, 12), createdAt: D(2025, 5, 1) });
const d = K('d', { startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1), createdAt: D(2026, 9, 1) });
const e = K('e', { renewedFromId: 'd', startsAt: D(2027, 9, 2), endsAt: D(2028, 9, 2), createdAt: D(2027, 8, 1) });
const todos = [a, b, c, d, e];

describe('contractOriginOf', () => {
  it('primeiro contrato da pessoa', () => {
    expect(contractOriginOf(a, todos)).toEqual({ kind: CONTRACT_ORIGIN.PRIMEIRA, previous: null, ordinal: 0, gapDays: null, coverageEnd: null });
  });

  it('renovação conta só a sequência ligada', () => {
    const o = contractOriginOf(c, todos);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RENOVACAO);
    expect(o.previous).toBe(b);
    expect(o.ordinal).toBe(2);
    expect(o.gapDays).toBeNull();
  });

  it('contrato sem ligação depois de um tempo sem contrato é retorno', () => {
    const o = contractOriginOf(d, todos);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.previous).toBe(c);
    expect(o.gapDays).toBe(111);
  });

  it('a contagem de renovações recomeça depois de um retorno', () => {
    expect(contractOriginOf(e, todos).ordinal).toBe(1);
  });

  it('retorno depois de cancelamento conta o intervalo desde o cancelamento', () => {
    const cancelado = { ...c, status: 'cancelado', cancelledAt: D(2025, 8, 1) };
    const o = contractOriginOf(d, [a, b, cancelado, d]);
    expect(o.gapDays).toBe(395);
  });

  it('contrato fechado pelo funil Upgrade, sem ligação, é upgrade', () => {
    const up = K('up', { closedFromUpgrade: true, startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1), createdAt: D(2026, 9, 1) });
    expect(contractOriginOf(up, [a, b, c, up]).kind).toBe(CONTRACT_ORIGIN.UPGRADE);
  });

  it('contrato sem ligação que encosta no anterior é retorno sem intervalo', () => {
    const colado = K('colado', { startsAt: D(2026, 5, 13), endsAt: D(2027, 5, 13), createdAt: D(2026, 5, 10) });
    const o = contractOriginOf(colado, [a, b, c, colado]);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.gapDays).toBeNull();
  });

  it('renovação cujo contrato ligado não está na lista continua renovação', () => {
    const solta = K('solta', { renewedFromId: 'sumiu', startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), createdAt: D(2026, 1, 1) });
    expect(contractOriginOf(solta, [solta])).toEqual({ kind: CONTRACT_ORIGIN.RENOVACAO, previous: null, ordinal: 1, gapDays: null, coverageEnd: null });
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    const t1 = K('t1', { startsAt: ts(D(2025, 1, 1)), endsAt: ts(D(2025, 2, 1)), createdAt: ts(D(2025, 1, 1)) });
    const t2 = K('t2', { startsAt: ts(D(2025, 6, 1)), endsAt: ts(D(2025, 7, 1)), createdAt: ts(D(2025, 6, 1)) });
    const o = contractOriginOf(t2, [t1, t2]);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.gapDays).toBe(119);
  });

  it('contrato paralelo: o intervalo conta da cobertura, não da venda mais recente', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 31), createdAt: D(2026, 1, 1) });
    const p = K('p', { startsAt: D(2026, 3, 1), endsAt: D(2026, 4, 1), createdAt: D(2026, 3, 1) });
    const z = K('z', { startsAt: D(2026, 6, 1), endsAt: D(2027, 6, 1), createdAt: D(2026, 6, 1) });
    const o = contractOriginOf(z, [x, p, z]);
    expect(o.previous).toBe(p);
    expect(o.gapDays).toBeNull();
    expect(o.coverageEnd).toEqual(D(2026, 12, 31));
  });

  it('renovação cancelada antes de começar não conta como cobertura', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 31), createdAt: D(2026, 1, 1) });
    const y = K('y', { renewedFromId: 'x', status: 'cancelado', startsAt: D(2027, 1, 1), endsAt: D(2028, 1, 1), cancelledAt: D(2026, 11, 15), createdAt: D(2026, 10, 1) });
    const z = K('z', { startsAt: D(2027, 1, 1), endsAt: D(2028, 1, 1), createdAt: D(2026, 12, 1) });
    expect(contractOriginOf(z, [x, y, z]).gapDays).toBeNull();
  });

  it('cancelamento antes do início, mesmo depois do fim do anterior, não estende a cobertura', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 31), createdAt: D(2026, 1, 1) });
    const y = K('y', { renewedFromId: 'x', status: 'cancelado', startsAt: D(2027, 1, 10), endsAt: D(2028, 1, 10), cancelledAt: D(2027, 1, 5), createdAt: D(2026, 12, 1) });
    const z = K('z', { startsAt: D(2027, 1, 10), endsAt: D(2028, 1, 10), createdAt: D(2027, 1, 6) });
    expect(contractOriginOf(z, [x, y, z]).gapDays).toBe(9);
  });

  it('horários diferentes no fim e no início não mudam o intervalo', () => {
    const x = K('x', { startsAt: D(2026, 1, 10), endsAt: new Date(2026, 1, 10, 14, 0), createdAt: D(2026, 1, 10) });
    const z = K('z', { startsAt: D(2026, 2, 12), endsAt: D(2027, 2, 12), createdAt: D(2026, 2, 12) });
    expect(contractOriginOf(z, [x, z]).gapDays).toBe(1);
  });

  it('cancelado ainda trancado termina no cancelamento', () => {
    const x = K('x', { status: 'cancelado', startsAt: D(2025, 2, 1), endsAt: D(2026, 2, 1), pausedAt: D(2026, 1, 20), cancelledAt: D(2026, 3, 15), createdAt: D(2025, 2, 1) });
    const z = K('z', { startsAt: D(2026, 3, 20), endsAt: D(2027, 3, 20), createdAt: D(2026, 3, 20) });
    expect(contractOriginOf(z, [x, z]).gapDays).toBe(4);
  });

  it('renovação com intervalo conta os dias sem contrato', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 6, 1), createdAt: D(2026, 1, 1) });
    const r = K('r', { renewedFromId: 'x', startsAt: D(2026, 6, 11), endsAt: D(2027, 6, 11), createdAt: D(2026, 6, 1) });
    expect(contractOriginOf(r, [x, r]).gapDays).toBe(9);
  });
});

describe('contractEndOf', () => {
  it('é o fim, ou o cancelamento quando ele veio antes', () => {
    expect(contractEndOf(a)).toEqual(D(2025, 2, 10));
    expect(contractEndOf({ ...a, cancelledAt: D(2025, 1, 20) })).toEqual(D(2025, 1, 20));
    expect(contractEndOf({ ...a, status: 'cancelado', pausedAt: D(2025, 1, 20), cancelledAt: D(2025, 3, 15) })).toEqual(D(2025, 3, 15));
    expect(contractEndOf(null)).toBeNull();
  });
});

describe('contractOriginOf dá o mesmo tipo que o Gerencial', () => {
  it('em todos os casos da lista', () => {
    const up = K('up', { renewedFromId: 'd', closedFromUpgrade: true, startsAt: D(2027, 9, 2), endsAt: D(2028, 9, 2), createdAt: D(2027, 8, 2) });
    const up2 = K('up2', { closedFromUpgrade: true, startsAt: D(2029, 1, 1), endsAt: D(2030, 1, 1), createdAt: D(2029, 1, 1) });
    const raw = [...todos, up, up2];
    const norm = normalizeContracts(raw);
    const { byPerson } = indexContracts(norm);
    const TO_SALE = {
      [CONTRACT_ORIGIN.RENOVACAO]: SALE_TYPES.RENOVACAO,
      [CONTRACT_ORIGIN.UPGRADE]: SALE_TYPES.UPGRADE,
      [CONTRACT_ORIGIN.RETORNO]: SALE_TYPES.RETORNO,
      [CONTRACT_ORIGIN.PRIMEIRA]: SALE_TYPES.NOVA
    };
    norm.forEach((n, i) => {
      expect(TO_SALE[contractOriginOf(raw[i], raw).kind], raw[i].id).toBe(saleTypeOf(n, byPerson));
    });
  });
});
