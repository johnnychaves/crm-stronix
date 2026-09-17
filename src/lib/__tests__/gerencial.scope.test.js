import { describe, it, expect } from 'vitest';
import { SALE_TYPES, saleMoment, monthlyTicket, hasValue, saleTypeOf } from '../gerencial/scope.js';
import { indexContracts } from '../operacional/base.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const c = (over) => ({ id: 'c1', personKey: 'p1', value: 1200, durationMonths: 12, startsAt: D(2026, 9, 1), createdAt: D(2026, 9, 1), ...over });

describe('saleMoment', () => {
  it('é a criação do contrato, com o início da vigência de reserva', () => {
    expect(saleMoment(c({ createdAt: D(2026, 8, 20) }))).toEqual(D(2026, 8, 20));
    expect(saleMoment(c({ createdAt: null }))).toEqual(D(2026, 9, 1));
    expect(saleMoment(c({ createdAt: null, startsAt: null }))).toBeNull();
  });
});

describe('monthlyTicket', () => {
  it('divide o valor pela duração', () => {
    expect(monthlyTicket(c({ value: 1200, durationMonths: 12 }))).toBe(100);
    expect(monthlyTicket(c({ value: 249, durationMonths: 1 }))).toBe(249);
  });
  it('sem duração, o valor inteiro vale por um mês', () => {
    expect(monthlyTicket(c({ value: 300, durationMonths: 0 }))).toBe(300);
  });
  it('contrato sem valor não gera ticket', () => {
    expect(monthlyTicket(c({ value: 0, durationMonths: 12 }))).toBe(0);
    expect(hasValue(c({ value: 0 }))).toBe(false);
    expect(hasValue(c({ value: 1200 }))).toBe(true);
  });
});

describe('saleTypeOf', () => {
  const byPerson = (list) => indexContracts(list).byPerson;

  it('contrato ligado a outro é renovação, mesmo vindo do upgrade', () => {
    const list = [c({ id: 'a' }), c({ id: 'b', renewedFromId: 'a', closedFromUpgrade: true, createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5) })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.RENOVACAO);
  });

  it('fechado dentro do funil Upgrade, sem contrato de origem, é upgrade', () => {
    const list = [c({ id: 'a' }), c({ id: 'b', closedFromUpgrade: true, createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5) })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.UPGRADE);
  });

  it('primeiro contrato da pessoa é matrícula nova', () => {
    const list = [c({ id: 'a' })];
    expect(saleTypeOf(list[0], byPerson(list))).toBe(SALE_TYPES.NOVA);
  });

  it('contrato novo de quem já teve outro antes é retorno', () => {
    const list = [c({ id: 'a', createdAt: D(2025, 3, 1), startsAt: D(2025, 3, 1) }), c({ id: 'b' })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.RETORNO);
  });

  it('pessoas diferentes não se misturam', () => {
    const list = [c({ id: 'a', personKey: 'p2', createdAt: D(2025, 3, 1) }), c({ id: 'b' })];
    expect(saleTypeOf(list[1], byPerson(list))).toBe(SALE_TYPES.NOVA);
  });
});
