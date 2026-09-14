import { describe, it, expect } from 'vitest';
import {
  dayKeyOf, monthKeyOf, monthRange, addMonthsToKey, isCurrentMonthKey,
  effectiveEnd, comparisonCut, metaDaysOfMonth, compareOptions, monthLabel
} from '../operacional/month.js';

const NOW = new Date(2026, 8, 11, 14, 0); // 11/09/2026 14:00, sexta
const WEEKDAYS = [1, 2, 3, 4, 5];

describe('month.js', () => {
  it('monta chaves de dia e de mês no horário local', () => {
    expect(dayKeyOf(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
    expect(monthKeyOf(NOW)).toBe('2026-09');
  });

  it('janela do mês é [dia 1, dia 1 do mês seguinte)', () => {
    const { start, end } = monthRange('2026-09');
    expect(start).toEqual(new Date(2026, 8, 1));
    expect(end).toEqual(new Date(2026, 9, 1));
  });

  it('anda meses atravessando o ano', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToKey('2025-12', 1)).toBe('2026-01');
  });

  it('fim efetivo é agora no mês em andamento e o fim do mês nos fechados', () => {
    expect(isCurrentMonthKey('2026-09', NOW)).toBe(true);
    expect(effectiveEnd('2026-09', NOW)).toEqual(NOW);
    expect(effectiveEnd('2026-08', NOW)).toEqual(new Date(2026, 8, 1));
  });

  it('corte pró-rata anda o mesmo tempo no mês comparado', () => {
    expect(comparisonCut('2026-09', '2026-08', NOW)).toEqual(new Date(2026, 7, 11, 14, 0));
  });

  it('corte pró-rata não passa do fim do mês comparado', () => {
    const now = new Date(2026, 2, 31, 12, 0); // 31/03
    expect(comparisonCut('2026-03', '2026-02', now)).toEqual(new Date(2026, 2, 1));
  });

  it('mês exibido fechado compara com o mês inteiro', () => {
    expect(comparisonCut('2026-08', '2026-07', NOW)).toEqual(new Date(2026, 7, 1));
  });

  it('dias de meta de setembro/2026: 22 dias, 8 fechados, hoje é o dia 11', () => {
    const days = metaDaysOfMonth('2026-09', WEEKDAYS, NOW);
    expect(days).toHaveLength(22);
    expect(days.filter((d) => d.state === 'closed').map((d) => d.day)).toEqual([1, 2, 3, 4, 7, 8, 9, 10]);
    expect(days.find((d) => d.state === 'today').day).toBe(11);
    expect(days[0]).toMatchObject({ key: '2026-09-01', weekday: 2 });
  });

  it('opções de comparação: 12 meses para trás, com o mesmo mês do ano anterior', () => {
    const opts = compareOptions('2026-09');
    expect(opts[0]).toBe('2026-08');
    expect(opts).toContain('2025-09');
    expect(opts).toHaveLength(12);
  });

  it('rótulo do mês em português', () => {
    expect(monthLabel('2026-09')).toBe('Setembro 2026');
    expect(monthLabel('2026-08', { capitalized: false, withYear: false })).toBe('agosto');
  });
});
