import { describe, it, expect } from 'vitest';
import {
  RENEWAL_FUNNEL_KIND, RENEWAL_FUNNEL_NAME, RENEWAL_MAX_COLUMNS,
  isRenewalFunnel, getRenewalFunnel,
  renewalColumnsFromCheckpoints,
  isRenewalEligible, splitRenewalForBoard, planRenewalSetupOps,
} from '../renewalFunnel.js';
import { activeRenewalCheckpoint } from '../renewalGoal.js';
import { KANBAN_COLUMN_ACCENT } from '../kanban.js';

describe('isRenewalFunnel', () => {
  it('casa pela flag, NUNCA pelo nome', () => {
    expect(isRenewalFunnel({ systemKind: RENEWAL_FUNNEL_KIND })).toBe(true);
    // funil que a academia criou à mão com o mesmo nome NÃO é o do sistema
    expect(isRenewalFunnel({ name: 'Renovações' })).toBe(false);
    expect(isRenewalFunnel({ systemKind: 'expired' })).toBe(false);
    expect(isRenewalFunnel(null)).toBe(false);
  });
});

describe('getRenewalFunnel', () => {
  it('duplicata resolve pelo createdAt mais antigo', () => {
    const novo = { id: 'b', systemKind: RENEWAL_FUNNEL_KIND, createdAt: 2000 };
    const velho = { id: 'a', systemKind: RENEWAL_FUNNEL_KIND, createdAt: 1000 };
    expect(getRenewalFunnel([novo, velho]).id).toBe('a');
  });
  it('sem funil de sistema devolve null', () => {
    expect(getRenewalFunnel([{ id: 'x', name: 'Renovações' }])).toBeNull();
    expect(getRenewalFunnel([])).toBeNull();
  });
});

describe('renewalColumnsFromCheckpoints', () => {
  it('uma coluna por marco, do maior para o menor', () => {
    const cols = renewalColumnsFromCheckpoints([30, 90, 60]);
    expect(cols.map(c => c.days)).toEqual([90, 60, 30]);
    expect(cols.map(c => c.name)).toEqual(['90 dias', '60 dias', '30 dias']);
  });

  it('a faixa de cada coluna encosta na de baixo, sem buraco', () => {
    const cols = renewalColumnsFromCheckpoints([90, 60, 30]);
    // prevDays é o piso EXCLUSIVO da faixa; a menor coluna começa em 0.
    expect(cols.map(c => [c.prevDays, c.days])).toEqual([[60, 90], [30, 60], [0, 30]]);
  });

  it('descarta marco inválido e deduplica', () => {
    const cols = renewalColumnsFromCheckpoints([90, 90, 0, -5, null, 'abc', 30]);
    expect(cols.map(c => c.days)).toEqual([90, 30]);
  });

  it('sem marco algum cai no padrão 90/60/30', () => {
    expect(renewalColumnsFromCheckpoints([]).map(c => c.days)).toEqual([90, 60, 30]);
    expect(renewalColumnsFromCheckpoints(null).map(c => c.days)).toEqual([90, 60, 30]);
  });

  it('marco de 1 dia sai no singular', () => {
    expect(renewalColumnsFromCheckpoints([1]).map(c => c.name)).toEqual(['1 dia']);
  });

  it('corta em 6 colunas mantendo as MAIORES', () => {
    const cols = renewalColumnsFromCheckpoints([120, 90, 60, 45, 30, 15, 7]);
    expect(cols).toHaveLength(RENEWAL_MAX_COLUMNS);
    expect(cols.map(c => c.days)).toEqual([120, 90, 60, 45, 30, 15]);
    // a menor coluna que sobrou absorve TUDO abaixo dela: ninguém fica órfão
    expect(cols[cols.length - 1].prevDays).toBe(0);
  });
});

// A PONTE COM A META DIÁRIA. A faixa (prevDays, days] de cada coluna é a
// tradução fiel de activeRenewalCheckpoint — a mesma função que decide o marco
// na Meta. Não existe função de ponte no código de propósito: recalcular a
// coluna com um "agora" diferente do corte da query discordaria na borda. O que
// garante que os dois concordam é ESTE teste. Se ele cair, board e Meta passam
// a colocar o mesmo cliente em marcos diferentes, e ninguém percebe até um
// consultor reclamar.
describe('as faixas das colunas traduzem activeRenewalCheckpoint', () => {
  const marcos = [90, 60, 30];
  const cols = renewalColumnsFromCheckpoints(marcos);

  // Espelha a faixa da query: aberta embaixo, fechada em cima, e a MENOR coluna
  // (prevDays 0) inclui o próprio dia do vencimento.
  const colunaDaFaixa = (dias) =>
    cols.find(c => (c.prevDays === 0 ? dias >= 0 : dias > c.prevDays) && dias <= c.days) || null;

  it('todo prazo de 0 a 90 dias cai na coluna do marco ativo', () => {
    for (let dias = 0; dias <= 90; dias++) {
      expect(colunaDaFaixa(dias)?.days).toBe(activeRenewalCheckpoint(dias, marcos));
    }
  });

  it('prazo maior que o maior marco não cai em coluna nenhuma, e a Meta concorda', () => {
    expect(colunaDaFaixa(91)).toBeNull();
    expect(activeRenewalCheckpoint(91, marcos)).toBeNull();
  });

  it('vale também com o teto de 6 aplicado', () => {
    const muitos = [120, 90, 60, 45, 30, 15, 7];
    const cortadas = renewalColumnsFromCheckpoints(muitos);
    const usados = cortadas.map(c => c.days);
    const faixa = (dias) =>
      cortadas.find(c => (c.prevDays === 0 ? dias >= 0 : dias > c.prevDays) && dias <= c.days) || null;
    for (let dias = 0; dias <= 120; dias++) {
      expect(faixa(dias)?.days).toBe(activeRenewalCheckpoint(dias, usados));
    }
  });
});

describe('cores das colunas', () => {
  // A paleta REAL do board, não uma cópia: nome fora dela cai no fallback cinza
  // em silêncio, e foi assim que 'slate'/'amber'/'rose' passaram batido na
  // primeira versão. Importar amarra o teste na fonte.
  const PALETA = Object.keys(KANBAN_COLUMN_ACCENT);

  it('usa só cores que existem em KANBAN_COLUMN_ACCENT', () => {
    const cols = renewalColumnsFromCheckpoints([120, 90, 60, 45, 30, 15]);
    cols.forEach(c => expect(PALETA).toContain(c.color));
  });

  it('a coluna que vence primeiro é sempre a mais quente, com 3 ou com 6 colunas', () => {
    expect(renewalColumnsFromCheckpoints([90, 60, 30]).map(c => c.color))
      .toEqual(['yellow', 'orange', 'red']);
    expect(renewalColumnsFromCheckpoints([120, 90, 60, 45, 30, 15]).map(c => c.color))
      .toEqual(['gray', 'blue', 'teal', 'yellow', 'orange', 'red']);
    expect(renewalColumnsFromCheckpoints([30]).map(c => c.color)).toEqual(['red']);
  });

  it('a paleta cobre o teto de colunas', () => {
    // Sem isto, subir RENEWAL_MAX_COLUMNS sem crescer COLUMN_COLORS faz as
    // colunas extras saírem CINZA em silêncio, e os dois testes acima seguem
    // verdes — cinza é chave válida da paleta. Conferimos pelo board NO TETO
    // (uma cor distinta por coluna) em vez de exportar COLUMN_COLORS: o
    // acoplamento fica travado sem alargar a interface do módulo por teste.
    const noTeto = renewalColumnsFromCheckpoints(
      Array.from({ length: RENEWAL_MAX_COLUMNS }, (_, i) => i + 1)
    );
    expect(noTeto).toHaveLength(RENEWAL_MAX_COLUMNS);
    expect(new Set(noTeto.map(c => c.color)).size).toBe(RENEWAL_MAX_COLUMNS);
  });
});

describe('isRenewalEligible', () => {
  it('contrato cancelado ou trancado não renova', () => {
    expect(isRenewalEligible({ currentContractStatus: 'cancelado' })).toBe(false);
    expect(isRenewalEligible({ currentContractStatus: 'trancado' })).toBe(false);
  });
  it('contrato ativo renova', () => {
    expect(isRenewalEligible({ currentContractStatus: 'ativo' })).toBe(true);
    expect(isRenewalEligible({})).toBe(true);
  });
});

describe('splitRenewalForBoard', () => {
  const cols = renewalColumnsFromCheckpoints([90, 60, 30]);

  it('projeta o status EXIBIDO no nome da coluna e marca o card', () => {
    const pages = { 90: [{ id: 'a', name: 'Ana', status: 'Venda' }] };
    const { cardsByColumn } = splitRenewalForBoard(pages, cols);
    const card = cardsByColumn.get('90 dias')[0];
    expect(card.status).toBe('90 dias');
    expect(card._renewalCard).toBe(true);
    expect(card._renewalDays).toBe(90);
  });

  it('quem recusou vai para a Perda e sai da coluna', () => {
    const pages = { 60: [
      { id: 'a', name: 'Ana', status: 'Venda' },
      { id: 'b', name: 'Beto', status: 'Venda', renewalDeclined: true },
    ] };
    const { cardsByColumn, declined } = splitRenewalForBoard(pages, cols);
    expect(cardsByColumn.get('60 dias').map(l => l.id)).toEqual(['a']);
    expect(declined.map(l => l.id)).toEqual(['b']);
    // o recusado também é card de renovação — o drop precisa saber disso
    expect(declined[0]._renewalCard).toBe(true);
    expect(declined[0]._renewalDays).toBe(60);
    // e o status EXIBIDO é o nome da coluna onde ele está, como em todo card
    // projetado. Com o 'Venda' do documento, arrastar de volta para a Venda era
    // no-op (handleWinDrop) e o menu Mover nem oferecia a opção.
    expect(declined[0].status).toBe('Perda');
  });

  it('cancelado e trancado somem do board inteiro', () => {
    const pages = { 30: [
      { id: 'a', status: 'Venda', currentContractStatus: 'ativo' },
      { id: 'b', status: 'Venda', currentContractStatus: 'cancelado' },
      { id: 'c', status: 'Venda', currentContractStatus: 'trancado' },
    ] };
    const { cardsByColumn, declined } = splitRenewalForBoard(pages, cols);
    expect(cardsByColumn.get('30 dias').map(l => l.id)).toEqual(['a']);
    expect(declined).toEqual([]);
  });

  it('NÃO altera o documento original (a projeção é em memória)', () => {
    const original = { id: 'a', status: 'Venda' };
    const recusado = { id: 'b', status: 'Venda', renewalDeclined: true };
    splitRenewalForBoard({ 90: [original, recusado] }, cols);
    expect(original.status).toBe('Venda');
    expect(original._renewalCard).toBeUndefined();
    // o ramo da recusa projeta 'Perda' em CÓPIA: gravar esse nome no documento
    // do cliente é exatamente a corrupção que a projeção existe para impedir.
    expect(recusado.status).toBe('Venda');
    expect(recusado._renewalCard).toBeUndefined();
  });

  it('coluna sem página carregada devolve lista vazia, não undefined', () => {
    const { cardsByColumn } = splitRenewalForBoard({}, cols);
    expect(cardsByColumn.get('90 dias')).toEqual([]);
  });
});

describe('planRenewalSetupOps', () => {
  it('academia sem o funil: cria o funil e NENHUMA etapa', () => {
    const plan = planRenewalSetupOps({ funnels: [{ id: 'x', name: 'Vendas' }] });
    expect(plan.createFunnel).toEqual({
      name: RENEWAL_FUNNEL_NAME, systemKind: RENEWAL_FUNNEL_KIND, order: 98,
    });
  });
  it('academia que já tem o funil: não cria nada', () => {
    const plan = planRenewalSetupOps({ funnels: [{ id: 'r', systemKind: RENEWAL_FUNNEL_KIND }] });
    expect(plan.createFunnel).toBeNull();
  });
  it('funil da academia com o mesmo NOME não conta como provisionado', () => {
    const plan = planRenewalSetupOps({ funnels: [{ id: 'r', name: 'Renovações' }] });
    expect(plan.createFunnel).not.toBeNull();
  });
});
