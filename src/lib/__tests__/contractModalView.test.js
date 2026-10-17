import { describe, it, expect } from 'vitest';
import { computeSeam } from '../renewal.js';
import { startStatusOf, confirmBlockOf, reasonHintOf } from '../contractModalView.js';

const D = (y, m, d) => new Date(y, m - 1, d);

describe('startStatusOf', () => {
  it('a regra dos dois dias ganha de tudo e vem em vermelho', () => {
    const s = startStatusOf({ problem: 'A renovação precisa começar a partir de 14/09/2026.', warning: 'outro aviso', startsAt: D(2026, 9, 13) });
    expect(s).toEqual({ tone: 'bad', text: 'A renovação precisa começar a partir de 14/09/2026.' });
  });

  it('sobreposição vem em vermelho, lacuna e matrícula retroativa em âmbar', () => {
    expect(startStatusOf({ warning: 'aviso', severe: true, startsAt: D(2026, 10, 16) }).tone).toBe('bad');
    expect(startStatusOf({ warning: 'aviso', severe: false, startsAt: D(2026, 10, 16) }).tone).toBe('warn');
  });

  it('sem data de início pede a data, em âmbar', () => {
    expect(startStatusOf({})).toEqual({ tone: 'warn', text: 'Escolha a data de início.' });
  });

  it('emenda perfeita diz isso, em verde', () => {
    const seam = computeSeam(D(2026, 12, 12), D(2026, 12, 13));
    const s = startStatusOf({ startsAt: D(2026, 12, 13), endsAt: D(2027, 3, 13), seam, planMonths: 3 });
    expect(s).toEqual({ tone: 'ok', text: 'Emenda perfeita, nenhum dia sem contrato.' });
  });

  it('com a data mas sem plano, pede o plano em vez de mostrar uma vigência vazia', () => {
    expect(startStatusOf({ startsAt: D(2026, 10, 16), planMonths: 0 }))
      .toEqual({ tone: 'warn', text: 'Escolha um plano para ver a vigência.' });
  });

  it('o aviso de encaixe ganha da falta da data e da emenda', () => {
    expect(startStatusOf({ warning: 'aviso' })).toEqual({ tone: 'warn', text: 'aviso' });
    const seam = computeSeam(D(2026, 12, 12), D(2026, 12, 13));
    expect(startStatusOf({ warning: 'aviso', startsAt: D(2026, 12, 13), endsAt: D(2027, 3, 13), seam, planMonths: 3 }))
      .toEqual({ tone: 'warn', text: 'aviso' });
  });

  it('sem aviso nem emenda, diz a vigência e quantos meses', () => {
    const s = startStatusOf({ startsAt: D(2026, 10, 16), endsAt: D(2027, 1, 16), planMonths: 3 });
    expect(s).toEqual({ tone: 'ok', text: 'Vigência de 16/10/2026 a 16/01/2027, 3 meses.' });
    expect(startStatusOf({ startsAt: D(2026, 10, 16), endsAt: D(2026, 11, 16), planMonths: 1 }).text)
      .toBe('Vigência de 16/10/2026 a 16/11/2026, 1 mês.');
  });
});

describe('confirmBlockOf', () => {
  const plan = { id: 'p1' };
  const pronto = { plan, startsAt: D(2026, 10, 16), startProblem: null, hasDiscount: false, reason: null };

  it('devolve vazio quando dá para confirmar', () => {
    expect(confirmBlockOf(pronto)).toBe('');
    expect(confirmBlockOf({ ...pronto, hasDiscount: true, reason: 'Campanha' })).toBe('');
  });

  it('diz o primeiro que falta, na ordem plano, data, regra do início, motivo', () => {
    expect(confirmBlockOf({ ...pronto, plan: null })).toBe('Escolha um plano.');
    expect(confirmBlockOf({ ...pronto, startsAt: null })).toBe('Escolha a data de início.');
    expect(confirmBlockOf({ ...pronto, startProblem: 'x' })).toBe('Veja o aviso da vigência.');
    expect(confirmBlockOf({ ...pronto, hasDiscount: true })).toBe('Escolha o motivo do desconto.');
  });

  it('com várias faltando, vale a ordem da lista', () => {
    expect(confirmBlockOf({ plan: null, startsAt: null, startProblem: 'x', hasDiscount: true })).toBe('Escolha um plano.');
    expect(confirmBlockOf({ plan, startsAt: null, startProblem: 'x', hasDiscount: true })).toBe('Escolha a data de início.');
    expect(confirmBlockOf({ plan, startsAt: D(2026, 10, 16), startProblem: 'x', hasDiscount: true, reason: null }))
      .toBe('Veja o aviso da vigência.');
  });
});

describe('reasonHintOf', () => {
  it('explica o motivo em cada estado do desconto', () => {
    expect(reasonHintOf({ hasDiscount: false, reason: null })).toBe('escolha quando houver desconto');
    expect(reasonHintOf({ hasDiscount: true, reason: null })).toBe('obrigatório');
    expect(reasonHintOf({ hasDiscount: true, reason: 'Campanha' })).toBe('');
  });
});
