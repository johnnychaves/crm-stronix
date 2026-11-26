import { describe, it, expect } from 'vitest';
import {
  chaveDaPesquisa, janelaDaRenovacao, mesesDaAvaliacao, pecasDaAderencia,
  periodoAnterior, periodoDe, periodoPorChave, periodoSeguinte,
} from '../carreira/periodo.js';

const ANUAL_DEZ = { frequencia: 'anual', mes: 12 };
const ANUAL_MAR = { frequencia: 'anual', mes: 3 };
const SEM_JUN = { frequencia: 'semestral', mes: 6 };
const SEM_JAN = { frequencia: 'semestral', mes: 1 };
const d = (dia) => new Date(`${dia}T00:00:00`);
const chave = (trilha, data) => periodoDe(trilha, new Date(data)).chave;

describe('mesesDaAvaliacao', () => {
  it('anual tem um mês e semestral tem dois, a 6 meses de distância', () => {
    expect(mesesDaAvaliacao(ANUAL_DEZ)).toEqual([12]);
    expect(mesesDaAvaliacao(ANUAL_MAR)).toEqual([3]);
    expect(mesesDaAvaliacao(SEM_JUN)).toEqual([6, 12]);
    expect(mesesDaAvaliacao(SEM_JAN)).toEqual([1, 7]);
  });

  it('mês fora da regra cai no padrão', () => {
    expect(mesesDaAvaliacao({})).toEqual([12]);
    expect(mesesDaAvaliacao(undefined)).toEqual([12]);
    expect(mesesDaAvaliacao({ frequencia: 'anual', mes: 0 })).toEqual([12]);
    expect(mesesDaAvaliacao({ frequencia: 'semestral', mes: 9 })).toEqual([6, 12]);
  });
});

describe('periodoPorChave', () => {
  it('anual em dezembro vai de 1º de dezembro a 1º de dezembro, fora', () => {
    expect(periodoPorChave(ANUAL_DEZ, '2027')).toEqual({ chave: '2027', inicio: d('2026-12-01'), fim: d('2027-12-01') });
  });

  it('anual em março, com o ano bissexto', () => {
    expect(periodoPorChave(ANUAL_MAR, '2027')).toEqual({ chave: '2027', inicio: d('2026-03-01'), fim: d('2027-03-01') });
    expect(periodoPorChave(ANUAL_MAR, '2028').fim).toEqual(d('2028-03-01'));
  });

  it('semestral em junho e dezembro, e em janeiro e julho', () => {
    expect(periodoPorChave(SEM_JUN, '2027-1')).toEqual({ chave: '2027-1', inicio: d('2026-12-01'), fim: d('2027-06-01') });
    expect(periodoPorChave(SEM_JUN, '2027-2')).toEqual({ chave: '2027-2', inicio: d('2027-06-01'), fim: d('2027-12-01') });
    expect(periodoPorChave(SEM_JAN, '2027-1')).toEqual({ chave: '2027-1', inicio: d('2026-07-01'), fim: d('2027-01-01') });
  });

  it('recusa a chave que não serve para a trilha', () => {
    expect(periodoPorChave(ANUAL_DEZ, '2027-1')).toBeNull();
    expect(periodoPorChave(SEM_JUN, '2027')).toBeNull();
    expect(periodoPorChave(SEM_JUN, '2027-3')).toBeNull();
    expect(periodoPorChave(ANUAL_DEZ, 'abc')).toBeNull();
    expect(periodoPorChave(ANUAL_DEZ, null)).toBeNull();
  });
});

describe('periodoDe', () => {
  it('anual em dezembro: dezembro já é do ano seguinte', () => {
    expect(chave(ANUAL_DEZ, '2026-12-01T00:00:00')).toBe('2027');
    expect(chave(ANUAL_DEZ, '2027-11-30T23:59:00')).toBe('2027');
  });

  it('anual em março: março já é do ano seguinte, e 29 de fevereiro fica no ano', () => {
    expect(chave(ANUAL_MAR, '2027-02-28T12:00:00')).toBe('2027');
    expect(chave(ANUAL_MAR, '2027-03-01T00:00:00')).toBe('2028');
    expect(chave(ANUAL_MAR, '2028-02-29T12:00:00')).toBe('2028');
  });

  it('semestral em junho e dezembro', () => {
    expect(chave(SEM_JUN, '2027-03-10T12:00:00')).toBe('2027-1');
    expect(chave(SEM_JUN, '2027-06-01T00:00:00')).toBe('2027-2');
    expect(chave(SEM_JUN, '2027-12-05T12:00:00')).toBe('2028-1');
  });

  it('semestral em janeiro e julho', () => {
    expect(chave(SEM_JAN, '2027-03-10T12:00:00')).toBe('2027-2');
    expect(chave(SEM_JAN, '2027-08-01T12:00:00')).toBe('2028-1');
  });

  it('aceita Timestamp e devolve null com data inválida', () => {
    expect(periodoDe(ANUAL_DEZ, { toDate: () => new Date('2027-06-15T12:00:00') }).chave).toBe('2027');
    expect(periodoDe(ANUAL_DEZ, null)).toBeNull();
    expect(periodoDe(ANUAL_DEZ, 'não é data')).toBeNull();
  });
});

describe('periodoAnterior e periodoSeguinte', () => {
  it('andam de um período para o vizinho', () => {
    const p = periodoPorChave(SEM_JUN, '2027-1');
    expect(periodoAnterior(SEM_JUN, p).chave).toBe('2026-2');
    expect(periodoSeguinte(SEM_JUN, p).chave).toBe('2027-2');
    expect(periodoAnterior(ANUAL_DEZ, periodoPorChave(ANUAL_DEZ, '2027')).chave).toBe('2026');
  });
});

describe('janelaDaRenovacao', () => {
  it('no anual é o período', () => {
    expect(janelaDaRenovacao(ANUAL_DEZ, periodoPorChave(ANUAL_DEZ, '2027'))).toEqual({ inicio: d('2026-12-01'), fim: d('2027-12-01') });
  });

  it('no semestral, 12 meses até o fim do período por padrão, ou só o período', () => {
    const p = periodoPorChave(SEM_JUN, '2027-1');
    expect(janelaDaRenovacao(SEM_JUN, p)).toEqual({ inicio: d('2026-06-01'), fim: d('2027-06-01') });
    expect(janelaDaRenovacao({ ...SEM_JUN, janelaRenovacao: 'periodo' }, p)).toEqual({ inicio: d('2026-12-01'), fim: d('2027-06-01') });
  });
});

describe('pecasDaAderencia', () => {
  it('anual em dezembro: janeiro a junho e julho a novembro, como hoje', () => {
    expect(pecasDaAderencia(periodoPorChave(ANUAL_DEZ, '2027'))).toEqual([
      { inicio: d('2027-01-01'), fim: d('2027-07-01') },
      { inicio: d('2027-07-01'), fim: d('2027-12-01') },
    ]);
  });

  it('semestral: o período sem dezembro, em pedaços do calendário', () => {
    expect(pecasDaAderencia(periodoPorChave(SEM_JUN, '2027-1'))).toEqual([
      { inicio: d('2027-01-01'), fim: d('2027-06-01') },
    ]);
    expect(pecasDaAderencia(periodoPorChave(SEM_JUN, '2027-2'))).toEqual([
      { inicio: d('2027-06-01'), fim: d('2027-07-01') },
      { inicio: d('2027-07-01'), fim: d('2027-12-01') },
    ]);
  });

  it('anual em março pega três pedaços', () => {
    expect(pecasDaAderencia(periodoPorChave(ANUAL_MAR, '2028'))).toEqual([
      { inicio: d('2027-03-01'), fim: d('2027-07-01') },
      { inicio: d('2027-07-01'), fim: d('2027-12-01') },
      { inicio: d('2028-01-01'), fim: d('2028-03-01') },
    ]);
  });
});

describe('chaveDaPesquisa', () => {
  it('anual em dezembro: a pesquisa conta no ano em que abre', () => {
    expect(chaveDaPesquisa(ANUAL_DEZ, '2027-06-10')).toBe('2027');
    expect(chaveDaPesquisa(ANUAL_DEZ, '2027-12-01')).toBe('2027');
    expect(chaveDaPesquisa(ANUAL_DEZ, '2027-01-15')).toBe('2027');
  });

  it('semestral: a de junho conta em junho e a de dezembro, em dezembro', () => {
    expect(chaveDaPesquisa(SEM_JUN, '2027-06-10')).toBe('2027-1');
    expect(chaveDaPesquisa(SEM_JUN, '2027-07-01')).toBe('2027-2');
    expect(chaveDaPesquisa(SEM_JUN, '2027-12-01')).toBe('2027-2');
    expect(chaveDaPesquisa(SEM_JUN, '2028-01-05')).toBe('2028-1');
  });

  it('sem dia válido, null', () => {
    expect(chaveDaPesquisa(ANUAL_DEZ, '')).toBeNull();
    expect(chaveDaPesquisa(ANUAL_DEZ, undefined)).toBeNull();
  });
});
