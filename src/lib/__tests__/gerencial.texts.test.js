import { describe, it, expect } from 'vitest';
import {
  monthSubline, clawbackNote, overlapNote, blindNote, expiredNote, exitsNote,
  plansNote, sourcesNote, emptyGym, emptyMonth, emptyRanking
} from '../gerencial/texts.js';

describe('monthSubline', () => {
  it('mês em andamento, comparando', () => {
    expect(monthSubline({ running: true, elapsed: 17, monthKey: '2026-09', compareOn: true, cmpKey: '2026-08' }))
      .toBe('1 a 17 de setembro comparado com os 17 primeiros dias de agosto. O mês está em andamento, então a comparação é pró-rata.');
  });

  it('mês em andamento, sem comparar', () => {
    expect(monthSubline({ running: true, elapsed: 17, monthKey: '2026-09', compareOn: false, cmpKey: '2026-08' }))
      .toBe('1 a 17 de setembro. O mês está em andamento e ainda vai receber vendas.');
  });

  it('mês fechado, comparando', () => {
    expect(monthSubline({ running: false, elapsed: 31, monthKey: '2026-08', compareOn: true, cmpKey: '2026-07' }))
      .toBe('agosto inteiro comparado com julho. Mês fechado.');
  });

  it('mês fechado, sem comparar', () => {
    expect(monthSubline({ running: false, elapsed: 31, monthKey: '2026-08', compareOn: false, cmpKey: '2026-07' }))
      .toBe('agosto inteiro. Mês fechado.');
  });

  it('sem mês anterior com venda, nem pró-rata nem mês fechado', () => {
    expect(monthSubline({ running: true, elapsed: 17, monthKey: '2026-09', compareOn: true, cmpKey: null }))
      .toBe('Não há mês anterior com venda para comparar');
  });
});

describe('clawbackNote', () => {
  it('literal do README, com o valor sem centavos', () => {
    expect(clawbackNote({ count: 2, value: 3100 }))
      .toBe('2 vendas deste mês já foram canceladas, somando R$ 3.100. O valor continua no total do mês, porque o contrato foi fechado aqui.');
  });
  it('no singular', () => {
    expect(clawbackNote({ count: 1, value: 1200 }))
      .toBe('1 venda deste mês já foi cancelada, somando R$ 1.200. O valor continua no total do mês, porque o contrato foi fechado aqui.');
  });
  it('sem cancelamento, sem nota', () => {
    expect(clawbackNote({ count: 0, value: 0 })).toBeNull();
  });
});

describe('overlapNote', () => {
  it('literal do README', () => {
    expect(overlapNote({ count: 6 }))
      .toBe('A carteira soma contrato, não pessoa: 6 pessoas têm dois contratos vigentes ao mesmo tempo, então o número de contratos é maior que o de gente.');
  });
  it('sem sobreposição, sem nota', () => {
    expect(overlapNote({ count: 0 })).toBeNull();
  });
});

describe('blindNote', () => {
  it('literal do README', () => {
    expect(blindNote({ count: 494 }))
      .toBe('494 contratos vieram de um sistema antigo sem o valor. Entram na contagem de contratos e no risco, e nunca somam no valor por mês. Preencher o valor deles em Contratos corrige a carteira.');
  });
  it('sem importado, sem nota', () => {
    expect(blindNote({ count: 0 })).toBeNull();
  });
});

describe('expiredNote', () => {
  it('literal do README quando há gente vencida', () => {
    expect(expiredNote({ count: 29 }))
      .toBe('Já saíram da carteira, então o valor por mês deles não aparece aqui. É a fila de recuperação.');
  });
  it('sem ninguém vencido, sem nota', () => {
    expect(expiredNote({ count: 0 })).toBeNull();
  });
});

describe('exitsNote', () => {
  it('literal do README', () => {
    expect(exitsNote()).toBe('Trancamento é reversível e continua contando na carteira. Cancelamento sai.');
  });
});

describe('plansNote', () => {
  it('literal do README', () => {
    expect(plansNote()).toBe("Combinação de modalidades é um grupo próprio, não a soma das partes: 'Musculação + Pilates' não entra em nenhum dos dois isolados.");
  });
});

describe('sourcesNote', () => {
  it('literal do README', () => {
    expect(sourcesNote()).toBe('É a origem do lead que virou contrato, não o volume de leads do canal. Quanto cada canal gera em leads fica no painel CRM.');
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

  it('emptyRanking literal do README', () => {
    expect(emptyRanking()).toEqual({
      title: 'Sem vendas no mês, não há ranking',
      body: 'Consultor, plano e origem descrevem as vendas do mês escolhido. Troque o mês para ver o ranking.'
    });
  });
});
