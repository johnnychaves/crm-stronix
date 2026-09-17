import { describe, it, expect } from 'vitest';
import { expiryHorizons, expiredWithoutSuccessor, exitsInWindow } from '../gerencial/risk.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const now = D(2026, 9, 17);
const c = (over) => ({ id: 'c', personKey: 'p', value: 1200, durationMonths: 12, startsAt: D(2025, 10, 1), endsAt: D(2026, 10, 1), pauses: [], ...over });

describe('expiryHorizons', () => {
  it('separa 30, 60 e 90 dias e soma o valor por mês', () => {
    const list = [
      c({ id: 'a', endsAt: D(2026, 10, 1) }),
      c({ id: 'b', personKey: 'p2', endsAt: D(2026, 11, 1) }),
      c({ id: 'd', personKey: 'p3', endsAt: D(2026, 12, 10) })
    ];
    const h = expiryHorizons(list, now);
    expect(h.map((x) => x.count)).toEqual([1, 1, 1]);
    expect(h[0].v).toBe(100);
  });

  it('contrato sem valor entra em blind, nunca no valor', () => {
    const h = expiryHorizons([c({ value: 0, durationMonths: 0 })], now);
    expect(h[0].blind).toBe(1);
    expect(h[0].count).toBe(0);
    expect(h[0].v).toBe(0);
  });

  it('trancado não vence', () => {
    const h = expiryHorizons([c({ pauses: [{ from: D(2026, 8, 1), to: null }] })], now);
    expect(h[0].count).toBe(0);
  });

  it('o que vence depois de 90 dias fica fora', () => {
    expect(expiryHorizons([c({ endsAt: D(2027, 3, 1) })], now).every((h) => h.count === 0)).toBe(true);
  });
});

describe('expiredWithoutSuccessor', () => {
  it('conta quem passou do fim sem contrato seguinte', () => {
    const r = expiredWithoutSuccessor([c({ endsAt: D(2026, 7, 1) })], now);
    expect(r.count).toBe(1);
  });

  it('com renovação ligada, não conta', () => {
    const list = [c({ id: 'a', endsAt: D(2026, 7, 1) }), c({ id: 'b', renewedFromId: 'a', startsAt: D(2026, 7, 1), endsAt: D(2027, 7, 1) })];
    expect(expiredWithoutSuccessor(list, now).count).toBe(0);
  });

  it('com outro contrato da pessoa começando depois, não conta', () => {
    const list = [c({ id: 'a', endsAt: D(2026, 7, 1) }), c({ id: 'b', startsAt: D(2026, 8, 1), endsAt: D(2027, 8, 1) })];
    expect(expiredWithoutSuccessor(list, now).count).toBe(0);
  });
});

describe('exitsInWindow', () => {
  const start = D(2026, 9, 1);
  const end = D(2026, 10, 1);

  it('cancelamento do mês, com o valor mensal', () => {
    const r = exitsInWindow([c({ cancelledAt: D(2026, 9, 5) })], { start, end });
    expect(r.items[0]).toMatchObject({ kind: 'cancelamento', count: 1, v: 100 });
  });

  it('trancamento do mês entra como parada', () => {
    const r = exitsInWindow([c({ pauses: [{ from: D(2026, 9, 3), to: null }] })], { start, end });
    expect(r.items[1]).toMatchObject({ kind: 'trancamento', count: 1, v: 100 });
  });

  it('cancelamento e pausa vindos da importação não contam', () => {
    const r = exitsInWindow([
      c({ cancelledAt: D(2026, 9, 5), cancelFromImport: true }),
      c({ id: 'b', personKey: 'p2', pauses: [{ from: D(2026, 9, 3), to: null, fromImport: true }] })
    ], { start, end });
    expect(r.total).toBe(0);
  });
});
