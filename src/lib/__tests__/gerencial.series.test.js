import { describe, it, expect } from 'vitest';
import { cumulativeByDay, daysInMonthOf } from '../gerencial/series.js';
import { metricsOf } from '../gerencial/metrics.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const sale = (id, day, value) => ({ id, value, createdAt: D(2026, 9, day), startsAt: D(2026, 9, day) });

describe('cumulativeByDay', () => {
  const start = D(2026, 9, 1, 0);
  const rows = [sale('a', 3, 1000), sale('b', 3, 500), sale('c', 10, 2000)];

  it('soma o vendido dia a dia, até o último dia coberto', () => {
    const curve = cumulativeByDay(rows, { start, end: D(2026, 9, 17, 12) });
    expect(curve).toHaveLength(30);
    expect(curve[0]).toBe(0);
    expect(curve[2]).toBe(1500); // dia 3
    expect(curve[9]).toBe(3500); // dia 10
    expect(curve[16]).toBe(3500); // dia 17, o último coberto
    expect(curve[17]).toBeNull(); // dia 18 ainda não aconteceu
  });

  it('mês fechado vai até o último dia', () => {
    const curve = cumulativeByDay(rows, { start, end: D(2026, 10, 1, 0) });
    expect(curve[29]).toBe(3500);
    expect(curve.every((v) => v != null)).toBe(true);
  });

  it('quantos dias tem o mês, inclusive fevereiro', () => {
    expect(daysInMonthOf(D(2026, 2, 1, 0))).toBe(28);
    expect(daysInMonthOf(D(2028, 2, 1, 0))).toBe(29);
  });

  it('o último ponto da curva é o vendido do mês no metricsOf', () => {
    const contracts = [sale('a', 3, 1000), sale('c', 10, 2000)].map((c, i) => ({
      ...c, personKey: `p${i}`, durationMonths: 12, endsAt: D(2027, 9, 1), pauses: []
    }));
    const m = metricsOf({ now: D(2026, 9, 17), contracts, leadsById: new Map() }, { monthKey: '2026-09' });
    const lastCovered = m.curve.filter((v) => v != null);
    expect(lastCovered[lastCovered.length - 1]).toBe(m.sold.sold);
    expect(m.sold.sold).toBe(3000);
  });
});
