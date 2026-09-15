import { describe, it, expect } from 'vitest';
import { isContactInteraction, contactTimesByLead, firstContactOf } from '../crm/contact.js';

const T = (d, h = 10, min = 0) => new Date(2026, 8, d, h, min);

describe('interação que conta como contato', () => {
  it('a observação do cadastro, a indicação e a importação não contam', () => {
    expect(isContactInteraction({ type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: veio pelo site' })).toBe(false);
    expect(isContactInteraction({ type: 'referral' })).toBe(false);
    expect(isContactInteraction({ type: 'import' })).toBe(false);
    expect(isContactInteraction({ type: 'note', text: 'Liguei, vai pensar' })).toBe(true);
    expect(isContactInteraction({ type: 'status_change' })).toBe(true);
    expect(isContactInteraction({ type: 'daily_goal_done' })).toBe(true);
  });
});

describe('índice de contatos por lead', () => {
  it('em ordem, sem repetir id e sem data inválida', () => {
    const map = contactTimesByLead([
      { id: '2', leadId: 'a', type: 'note', text: 'b', createdAt: T(3) },
      { id: '1', leadId: 'a', type: 'note', text: 'a', createdAt: T(2) },
      { id: '1', leadId: 'a', type: 'note', text: 'a', createdAt: T(2) },
      { id: '3', leadId: 'a', type: 'referral', createdAt: T(1) },
      { id: '4', leadId: 'b', type: 'note', text: 'x', createdAt: null }
    ]);
    expect(map.get('a')).toEqual([T(2).getTime(), T(3).getTime()]);
    expect(map.has('b')).toBe(false);
  });
});

describe('tempo até o primeiro contato', () => {
  const lead = (id) => ({ id, createdAt: T(1, 10) });
  const contactTimes = contactTimesByLead([
    { id: 'i1', leadId: 'a', type: 'note', text: 'oi', createdAt: T(1, 11) },
    { id: 'i2', leadId: 'b', type: 'note', text: 'oi', createdAt: T(1, 11, 1) },
    { id: 'i3', leadId: 'c', type: 'note', text: 'oi', createdAt: T(2, 10) },
    { id: 'i4', leadId: 'd', type: 'note', text: 'oi', createdAt: T(2, 10, 1) },
    { id: 'i5', leadId: 'e', type: 'note', text: 'OBSERVAÇÃO DO CADASTRO: x', createdAt: T(1, 10, 5) },
    { id: 'i6', leadId: 'f', type: 'note', text: 'depois do prazo', createdAt: T(20, 10) }
  ]);
  const cohort = ['a', 'b', 'c', 'd', 'e', 'f'].map(lead);
  const limit = T(15).getTime();

  it('faixas de até 1 hora, até 24 horas, mais de 24 horas e sem contato', () => {
    expect(firstContactOf(cohort, { contactTimes, limit })).toMatchObject({ total: 6, h1: 1, h24: 2, over: 1, none: 2 });
  });

  it('a mediana põe os sem contato no fim da fila', () => {
    // 60, 61, 1440, 1441, sem, sem: o meio fica entre 1440 e 1441.
    expect(firstContactOf(cohort, { contactTimes, limit }).median).toBe(1440.5);
    // Com mais dois sem contato, o meio cai num sem contato: não há mediana.
    expect(firstContactOf([...cohort, lead('g'), lead('h')], { contactTimes, limit }).median).toBeNull();
  });

  it('com o limite mais longe, a interação passa a contar', () => {
    expect(firstContactOf([lead('f')], { contactTimes, limit: T(30).getTime() })).toMatchObject({ total: 1, over: 1, none: 0 });
  });
});
