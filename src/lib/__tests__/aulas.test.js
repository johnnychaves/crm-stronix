import { describe, it, expect } from 'vitest';
import { AULA_STATUS, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from '../aulas.js';

describe('outcomeToAulaStatus', () => {
  it('mapeia os desfechos que resolvem a aula', () => {
    expect(outcomeToAulaStatus('attended')).toBe('attended');
    expect(outcomeToAulaStatus('no_show')).toBe('no_show');
    expect(outcomeToAulaStatus('cancelled')).toBe('cancelled');
  });
  it('rescheduled/desconhecido não vira status de aula', () => {
    expect(outcomeToAulaStatus('rescheduled')).toBeNull();
    expect(outcomeToAulaStatus(undefined)).toBeNull();
  });
});

describe('pickConvertingAula', () => {
  const d = (s) => new Date(s);
  it('escolhe a atendida de maior scheduledFor', () => {
    const aulas = [
      { id: 'a', status: 'attended', scheduledFor: d('2026-07-01') },
      { id: 'b', status: 'attended', scheduledFor: d('2026-07-10') },
      { id: 'c', status: 'no_show',  scheduledFor: d('2026-07-20') },
    ];
    expect(pickConvertingAula(aulas).id).toBe('b');
  });
  it('ignora não-atendidas e retorna null se nenhuma foi atendida', () => {
    expect(pickConvertingAula([{ id: 'x', status: 'agendada', scheduledFor: d('2026-07-01') }])).toBeNull();
    expect(pickConvertingAula([])).toBeNull();
    expect(pickConvertingAula(null)).toBeNull();
  });
  it('uma única atendida é a escolhida', () => {
    expect(pickConvertingAula([{ id: 'u', status: 'attended', scheduledFor: d('2026-07-05') }]).id).toBe('u');
  });
});

describe('aulaRecordFields', () => {
  it('preenche defaults e normaliza flags', () => {
    const r = aulaRecordFields({ leadId: 'L1', professorId: 'P1', professorName: 'Ana', modality: 'Musculação', scheduledFor: 'X', status: 'agendada' });
    expect(r).toMatchObject({
      leadId: 'L1', professorId: 'P1', professorName: 'Ana', soloTraining: false,
      modality: 'Musculação', scheduledFor: 'X', status: 'agendada',
      converted: false, convertedAt: null, outcomeAt: null,
    });
  });
  it('sem professor + solo', () => {
    const r = aulaRecordFields({ leadId: 'L1', soloTraining: true, scheduledFor: 'X' });
    expect(r.professorId).toBeNull();
    expect(r.soloTraining).toBe(true);
    expect(r.status).toBe('agendada'); // default
  });
});
