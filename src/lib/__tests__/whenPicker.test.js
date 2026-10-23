// O "Quando" dos pop-ups da Meta Diária: os atalhos de dia, o instante que vai
// para a gravação, a trava de horário futuro e as frases.
import { describe, it, expect } from 'vitest';
import { WHEN_PRESETS, whenFromPreset, whenInstant, whenIsFuture, whenIsFromTomorrow, whenProblem, whenPresetsFor, whenText, dayRefText, dayLabel, hourOf, isoDay } from '../whenPicker.js';

// Sexta, 16/10/2026, 14:00.
const AGORA = new Date(2026, 9, 16, 14, 0);

describe('whenPicker', () => {
  it('os atalhos contam os dias a partir de hoje e guardam o horário', () => {
    expect(WHEN_PRESETS.map((p) => p.label)).toEqual(['Hoje', 'Amanhã', 'Em 3 dias', 'Em 7 dias', 'Outro dia']);
    expect(whenFromPreset('hoje', '18:00', AGORA)).toEqual({ preset: 'hoje', date: '2026-10-16', time: '18:00' });
    expect(whenFromPreset('amanha', '09:00', AGORA)).toEqual({ preset: 'amanha', date: '2026-10-17', time: '09:00' });
    expect(whenFromPreset('3d', '09:00', AGORA).date).toBe('2026-10-19');
    // Virada de mês.
    expect(whenFromPreset('7d', '09:00', new Date(2026, 9, 28, 10, 0)).date).toBe('2026-11-04');
  });

  it('o "Outro dia" mantém o dia escolhido, e sem ele começa amanhã', () => {
    const atual = { preset: '7d', date: '2026-10-23', time: '09:00' };
    expect(whenFromPreset('outro', '10:30', AGORA, atual)).toEqual({ preset: 'outro', date: '2026-10-23', time: '10:30' });
    expect(whenFromPreset('outro', '10:30', AGORA).date).toBe('2026-10-17');
  });

  it('o instante é o dia e o horário locais, e só vale com os dois', () => {
    expect(whenInstant({ date: '2026-10-17', time: '16:30' })).toEqual(new Date(2026, 9, 17, 16, 30));
    expect(whenInstant({ date: '2026-10-17', time: '' })).toBeNull();
    expect(whenInstant({ date: '', time: '16:30' })).toBeNull();
  });

  it('só horário futuro passa', () => {
    expect(whenIsFuture({ date: '2026-10-16', time: '14:01' }, AGORA.getTime())).toBe(true);
    expect(whenIsFuture({ date: '2026-10-16', time: '14:00' }, AGORA.getTime())).toBe(false);
    expect(whenIsFuture({ date: '2026-10-16', time: '09:00' }, AGORA.getTime())).toBe(false);
    expect(whenIsFuture({ date: '', time: '09:00' }, AGORA.getTime())).toBe(false);
  });

  it('as frases', () => {
    expect(whenText({ date: '2026-10-17', time: '16:30' }, AGORA)).toBe('no sábado, 17/10, às 16:30');
    expect(whenText({ date: '2026-10-19', time: '09:00' }, AGORA)).toBe('na segunda, 19/10, às 09:00');
    expect(whenText({ date: '2026-10-16', time: '18:00' }, AGORA)).toBe('hoje, às 18:00');
    expect(dayLabel({ date: '2026-10-17' })).toBe('sábado, 17/10');
    expect(dayRefText(new Date(2026, 9, 16, 16, 30), AGORA)).toBe('hoje às 16:30');
    expect(dayRefText(new Date(2026, 9, 15, 16, 30), AGORA)).toBe('ontem às 16:30');
    expect(dayRefText(new Date(2026, 9, 17, 9, 0), AGORA)).toBe('amanhã às 09:00');
    expect(dayRefText(new Date(2026, 9, 12, 9, 0), AGORA)).toBe('em 12/10 às 09:00');
    expect(hourOf(new Date(2026, 9, 16, 7, 5))).toBe('07:05');
    expect(isoDay(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

// O Reagendar e o "Quando voltar a falar?" valem a partir de amanhã (decisão do
// Johnny, 21/10/2026).
describe('whenPicker a partir de amanhã', () => {
  const AGORA_MS = new Date(2026, 9, 16, 14, 0).getTime();

  it('hoje mais tarde não vale; amanhã cedo vale', () => {
    expect(whenIsFromTomorrow({ date: '2026-10-16', time: '23:00' }, AGORA_MS)).toBe(false);
    expect(whenIsFromTomorrow({ date: '2026-10-17', time: '00:30' }, AGORA_MS)).toBe(true);
  });

  it('whenProblem diz o que falta', () => {
    expect(whenProblem({ date: '', time: '09:00' }, AGORA_MS)).toBe('missing');
    expect(whenProblem({ date: '2026-10-16', time: '09:00' }, AGORA_MS)).toBe('past');
    expect(whenProblem({ date: '2026-10-16', time: '18:00' }, AGORA_MS)).toBeNull();
    expect(whenProblem({ date: '2026-10-16', time: '18:00' }, AGORA_MS, { fromTomorrow: true })).toBe('today');
    expect(whenProblem({ date: '2026-10-17', time: '09:00' }, AGORA_MS, { fromTomorrow: true })).toBeNull();
  });

  it('os atalhos a partir de amanhã não têm o Hoje', () => {
    expect(whenPresetsFor({ fromTomorrow: true }).map((p) => p.id)).not.toContain('hoje');
    expect(whenPresetsFor().map((p) => p.id)).toContain('hoje');
  });
});

