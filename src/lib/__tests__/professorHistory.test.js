import { describe, it, expect } from 'vitest';
import { professorChangePatch, professorAt } from '../professorHistory.js';

const t = (iso) => new Date(iso);
// O Firestore devolve Timestamp, com toDate(). O teste usa um igual.
const ts = (iso) => ({ toDate: () => new Date(iso) });

describe('professorChangePatch', () => {
  it('não grava nada quando o professor é o mesmo', () => {
    expect(professorChangePatch({ professorId: 'p1' }, 'p1', 'Bruno')).toBeNull();
    expect(professorChangePatch({ professorId: null }, '', null)).toBeNull();
    expect(professorChangePatch({}, null, null)).toBeNull();
  });

  it('o primeiro professor de um lead sem professor e sem histórico não grava histórico', () => {
    expect(professorChangePatch({}, 'p1', 'Bruno', t('2026-12-01T12:00:00Z')))
      .toEqual({ professorId: 'p1', professorName: 'Bruno' });
  });

  it('a primeira troca grava quem era antes, desde sempre, e o novo com a data', () => {
    const at = t('2026-12-01T12:00:00Z');
    expect(professorChangePatch({ professorId: 'p1', professorName: 'Bruno' }, 'p2', 'Heloísa', at)).toEqual({
      professorId: 'p2',
      professorName: 'Heloísa',
      professorHistory: [{ professorId: 'p1', since: null }, { professorId: 'p2', since: at }],
    });
  });

  it('a troca seguinte só acrescenta', () => {
    const a = ts('2026-12-01T12:00:00Z');
    const b = t('2027-02-10T12:00:00Z');
    const lead = { professorId: 'p2', professorHistory: [{ professorId: 'p1', since: null }, { professorId: 'p2', since: a }] };
    expect(professorChangePatch(lead, 'p3', 'Carla', b).professorHistory).toEqual([
      { professorId: 'p1', since: null },
      { professorId: 'p2', since: a },
      { professorId: 'p3', since: b },
    ]);
  });

  it('tirar o professor grava null no histórico e limpa o nome', () => {
    const at = t('2026-12-01T12:00:00Z');
    expect(professorChangePatch({ professorId: 'p1', professorName: 'Bruno' }, null, 'Bruno', at)).toEqual({
      professorId: null,
      professorName: null,
      professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: at }],
    });
  });

  it('o lead que perdeu o professor e ganha outro acrescenta, porque já tem histórico', () => {
    const a = ts('2026-12-01T12:00:00Z');
    const b = t('2027-01-05T12:00:00Z');
    const lead = { professorId: null, professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: a }] };
    expect(professorChangePatch(lead, 'p2', 'Heloísa', b)).toEqual({
      professorId: 'p2',
      professorName: 'Heloísa',
      professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: a }, { professorId: 'p2', since: b }],
    });
  });

  it('sem nome, grava o nome como null', () => {
    expect(professorChangePatch({}, 'p1')).toEqual({ professorId: 'p1', professorName: null });
  });
});

describe('professorAt', () => {
  it('lead sem histórico vale o professor atual em qualquer data', () => {
    expect(professorAt({ professorId: 'p1' }, t('2020-01-01T00:00:00Z'))).toBe('p1');
    expect(professorAt({}, t('2026-01-01T00:00:00Z'))).toBeNull();
  });

  const lead = {
    professorId: 'p3',
    professorHistory: [
      { professorId: 'p1', since: null },
      { professorId: 'p2', since: ts('2026-12-01T12:00:00Z') },
      { professorId: 'p3', since: ts('2027-02-10T12:00:00Z') },
    ],
  };

  it('lê o professor da data pelo histórico', () => {
    expect(professorAt(lead, t('2026-06-01T00:00:00Z'))).toBe('p1');
    expect(professorAt(lead, t('2027-01-15T00:00:00Z'))).toBe('p2');
    expect(professorAt(lead, t('2027-05-01T00:00:00Z'))).toBe('p3');
  });

  it('no instante da troca já vale o novo professor', () => {
    expect(professorAt(lead, t('2026-12-01T12:00:00Z'))).toBe('p2');
  });

  it('o período sem professor devolve null', () => {
    const semProf = { professorId: null, professorHistory: [{ professorId: 'p1', since: null }, { professorId: null, since: ts('2026-12-01T12:00:00Z') }] };
    expect(professorAt(semProf, t('2027-01-01T00:00:00Z'))).toBeNull();
    expect(professorAt(semProf, t('2026-11-01T00:00:00Z'))).toBe('p1');
  });

  it('data inválida devolve o professor atual', () => {
    expect(professorAt(lead, 'não é data')).toBe('p3');
    expect(professorAt(lead, null)).toBe('p3');
  });
});
