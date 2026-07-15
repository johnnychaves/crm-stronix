import { describe, it, expect } from 'vitest';
import { canMarkPresenceNow, PRESENCE_MARK_WINDOW_MS } from '../presenceWindow.js';

const at = (base, deltaMin) => base + deltaMin * 60 * 1000;

describe('canMarkPresenceNow', () => {
  const sched = new Date('2026-07-15T14:00:00');
  const t0 = sched.getTime();

  it('permite exatamente no horário agendado', () => {
    expect(canMarkPresenceNow(sched, t0)).toBe(true);
  });

  it('permite nas bordas: 15 min antes e 15 min depois (inclusivas)', () => {
    expect(canMarkPresenceNow(sched, at(t0, -15))).toBe(true);
    expect(canMarkPresenceNow(sched, at(t0, 15))).toBe(true);
  });

  it('bloqueia mais de 15 min antes', () => {
    expect(canMarkPresenceNow(sched, at(t0, -16))).toBe(false);
  });

  it('bloqueia mais de 15 min depois', () => {
    expect(canMarkPresenceNow(sched, at(t0, 16))).toBe(false);
  });

  it('bloqueia sem data agendada', () => {
    expect(canMarkPresenceNow(null, t0)).toBe(false);
    expect(canMarkPresenceNow(undefined, t0)).toBe(false);
  });

  it('aceita a data como string ISO', () => {
    expect(canMarkPresenceNow(sched.toISOString(), t0)).toBe(true);
    expect(canMarkPresenceNow(sched.toISOString(), at(t0, 30))).toBe(false);
  });

  it('bloqueia com "agora" inválido (NaN)', () => {
    expect(canMarkPresenceNow(sched, NaN)).toBe(false);
  });

  it('a janela é de 15 minutos', () => {
    expect(PRESENCE_MARK_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
