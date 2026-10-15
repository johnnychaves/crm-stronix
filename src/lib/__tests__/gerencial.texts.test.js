import { describe, it, expect } from 'vitest';
import { monthSubline, emptyGym, emptyMonth, HELP } from '../gerencial/texts.js';

describe('monthSubline', () => {
  it('mês em andamento, comparando: pró-rata, com os mesmos dias do outro mês', () => {
    expect(monthSubline({ running: true, elapsed: 17, monthKey: '2026-09', compareOn: true, cmpKey: '2026-08' }))
      .toBe('1 a 17 de setembro · vs. mesmos dias de agosto');
  });

  it('mês em andamento, sem comparar', () => {
    expect(monthSubline({ running: true, elapsed: 17, monthKey: '2026-09', compareOn: false, cmpKey: '2026-08' }))
      .toBe('1 a 17 de setembro · em andamento');
  });

  it('mês fechado, comparando: o mês inteiro contra o anterior', () => {
    expect(monthSubline({ running: false, elapsed: 31, monthKey: '2026-08', compareOn: true, cmpKey: '2026-07' }))
      .toBe('agosto inteiro · vs. julho');
  });

  it('mês fechado, sem comparar', () => {
    expect(monthSubline({ running: false, elapsed: 31, monthKey: '2026-08', compareOn: false, cmpKey: '2026-07' }))
      .toBe('agosto inteiro');
  });

  it('sem mês anterior com venda, a frase é a de sem comparar', () => {
    expect(monthSubline({ running: true, elapsed: 17, monthKey: '2026-09', compareOn: true, cmpKey: null }))
      .toBe('1 a 17 de setembro · em andamento');
    expect(monthSubline({ running: false, elapsed: 31, monthKey: '2026-08', compareOn: true, cmpKey: null }))
      .toBe('agosto inteiro');
  });
});

describe('vazios', () => {
  it('emptyGym literal do README', () => {
    expect(emptyGym()).toEqual({
      title: 'Ainda não há contratos',
      body: 'Esta tela ganha vida na primeira matrícula registrada. Enquanto isso, o funil de leads continua no painel CRM.',
      cta: 'Ir para o pipeline'
    });
  });

  it('emptyMonth literal do README', () => {
    expect(emptyMonth()).toEqual({
      title: 'Nenhum contrato fechado neste mês',
      body: 'Os contratos existem no sistema desde junho de 2026, então este mês não tem venda registrada. A carteira e o risco abaixo continuam valendo: eles olham os contratos vigentes, não as vendas do mês.'
    });
  });
});

describe('dicas do "?"', () => {
  it('cada card tem uma explicação escrita, sem travessão no meio da frase', () => {
    const keys = ['sold', 'wallet', 'ticket', 'lapsed', 'mix', 'sellers', 'expiry', 'exits', 'plans', 'sources'];
    expect(Object.keys(HELP).sort()).toEqual([...keys].sort());
    keys.forEach((k) => {
      expect(HELP[k].length, k).toBeGreaterThan(40);
      expect(HELP[k], k).not.toMatch(/ — | – /);
    });
  });

  it('nenhuma explicação fala de contrato sem valor', () => {
    Object.values(HELP).forEach((t) => expect(t).not.toMatch(/sem valor|importado/));
  });
});
