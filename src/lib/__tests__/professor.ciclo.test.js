import { describe, it, expect } from 'vitest';
import { cicloDe, limitesDoCiclo, semestresDoCiclo } from '../professor/ciclo.js';

describe('cicloDe', () => {
  it('dezembro já é do ciclo do ano seguinte', () => {
    expect(cicloDe(new Date('2026-12-01T00:00:00'))).toBe(2027);
    expect(cicloDe(new Date('2026-12-31T23:59:00'))).toBe(2027);
  });

  it('de janeiro a novembro é o ciclo do próprio ano', () => {
    expect(cicloDe(new Date('2027-01-01T00:00:00'))).toBe(2027);
    expect(cicloDe(new Date('2026-11-30T23:59:59'))).toBe(2026);
  });

  it('aceita Timestamp e devolve null com data inválida', () => {
    expect(cicloDe({ toDate: () => new Date('2027-06-15T12:00:00') })).toBe(2027);
    expect(cicloDe(null)).toBeNull();
    expect(cicloDe('não é data')).toBeNull();
  });
});

describe('limitesDoCiclo', () => {
  it('vai de 1º de dezembro às 00:00 até 1º de dezembro do ano do ciclo, fora', () => {
    expect(limitesDoCiclo(2027)).toEqual({
      inicio: new Date('2026-12-01T00:00:00'),
      fim: new Date('2027-12-01T00:00:00'),
    });
  });
});

describe('semestresDoCiclo', () => {
  it('janeiro a junho e julho a novembro, sem dezembro', () => {
    expect(semestresDoCiclo(2027)).toEqual([
      { inicio: new Date('2027-01-01T00:00:00'), fim: new Date('2027-07-01T00:00:00') },
      { inicio: new Date('2027-07-01T00:00:00'), fim: new Date('2027-12-01T00:00:00') },
    ]);
  });
});
