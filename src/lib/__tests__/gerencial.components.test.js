// Render das peças da tela Gerencial, sem jsdom (renderToString), no molde do
// crm.components.test.js. Um bloco por componente, na ordem em que a tela
// empilha: venda do mês, carteira, risco, saídas e ranking.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { SoldHeroCard } from '../../views/dashboard/SoldHeroCard.jsx';
import { WalletBand } from '../../views/dashboard/WalletBand.jsx';
import { BlindValueNote, GerencialEmpty, LapsedCard } from '../../views/dashboard/GerencialParts.jsx';
import { ExpiryRunway } from '../../views/dashboard/ExpiryRunway.jsx';
import { ExitsCard } from '../../views/dashboard/ExitsCard.jsx';
import { SellerRankTable } from '../../views/dashboard/SellerRankTable.jsx';
import { BreakdownCard } from '../../views/dashboard/DashPrimitives.jsx';
import { fmtMoneyShort } from '../../views/dashboard/dashTokens.js';
import { GerencialDashboard } from '../../views/dashboard/GerencialDashboard.jsx';
import { GerencialToolbar, CASH_WARNING, NO_COMPARE } from '../../views/dashboard/GerencialToolbar.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

// Setembro na Unidade Centro (README §9): 42 contratos somando R$ 78.400.
const MIX = [
  { type: 'nova', count: 21, value: 34700 },
  { type: 'renovacao', count: 14, value: 29800 },
  { type: 'upgrade', count: 5, value: 10400 },
  { type: 'retorno', count: 2, value: 3500 }
];
const SOLD = { mix: MIX, ticket: 214, discount: { pct: 8, abs: 6800 } };

describe('SoldHeroCard', () => {
  it('o vendido e a contagem saem do mix, e a participação sai do valor de cada tipo', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html).toContain('R$ 78.400');
    expect(html).toContain('42 contratos');
    expect(html).toContain('44%'); // 34.700 de 78.400
    expect(html).toContain('38%'); // 29.800 de 78.400
  });

  it('o sufixo /mês do ticket é um elemento à parte, no mesmo baseline', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html).toContain('R$ 214</span>');
    expect(html).toContain('>/mês</span>');
    expect(html).not.toContain('R$ 214/mês');
  });

  it('cada tipo aparece escrito na legenda, com rótulo, contagem e valor', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    ['Matrícula nova', 'Renovação', 'Upgrade', 'Retorno de ex-cliente'].forEach((label) => {
      expect(html).toContain(label);
    });
    expect(html).toContain('21 vendas');
    expect(html).toContain('2 vendas');
    expect(html).toContain('R$ 34,7 mil');
    expect(html).toContain('R$ 3.500');
  });

  it('cada segmento da cápsula é focável e tem dica com o número', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html.match(/tabindex="0"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Matrícula nova: 21 contratos · R$ 34.700 · 44% do vendido"');
  });

  it('sem comparação, somem a pílula e a linha de base', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html).not.toContain('▲');
    expect(html).not.toContain('nos mesmos dias de agosto');
  });

  it('com comparação, a pílula e a linha de base voltam juntas', () => {
    const html = render(createElement(SoldHeroCard, {
      ...SOLD,
      delta: { up: true, text: '9%', baseline: 'R$ 71.900 em 39 contratos nos mesmos dias de agosto' }
    }));
    expect(html).toContain('▲ 9%');
    expect(html).toContain('R$ 71.900 em 39 contratos nos mesmos dias de agosto');
  });

  it('desconto alto fica em âmbar, desconto normal fica neutro', () => {
    const calm = render(createElement(SoldHeroCard, SOLD));
    const loud = render(createElement(SoldHeroCard, { ...SOLD, discount: { pct: 14, abs: 12700 } }));
    expect(calm).toContain('R$ 6.800 abaixo da tabela');
    expect(calm).not.toContain('text-amber-700');
    expect(loud).toContain('text-amber-700');
  });

  it('a nota de venda cancelada só aparece quando há uma', () => {
    const none = render(createElement(SoldHeroCard, SOLD));
    expect(none).not.toContain('já foram canceladas');
    const some = render(createElement(SoldHeroCard, {
      ...SOLD,
      clawback: '2 vendas deste mês já foram canceladas, somando R$ 3.100. O valor continua no total do mês, porque o contrato foi fechado aqui.'
    }));
    expect(some).toContain('já foram canceladas, somando R$ 3.100');
  });

  it('mês sem venda nenhuma não quebra a conta', () => {
    const html = render(createElement(SoldHeroCard, { mix: [], ticket: 0, discount: { pct: 0, abs: 0 } }));
    expect(html).toContain('R$ 0');
    expect(html).toContain('0 contratos');
  });
});

// Carteira de setembro na Unidade Centro: 628 contratos, R$ 134.200/mês.
const CELLS = [
  { key: 'count', label: 'Contratos vigentes', value: 628, sub: 'inclui os 19 trancados', help: 'Contratos com vigência em curso hoje.' },
  { key: 'monthly', label: 'Valor por mês', value: 134200, money: true, unit: '/mês', sub: 'soma dos tickets mensais vigentes', help: 'Soma do ticket mensal de cada contrato vigente.' },
  { key: 'ticket', label: 'Ticket mensal médio', value: 214, money: true, unit: '/mês', sub: 'valor por mês ÷ contratos com valor' },
  { key: 'locked', label: 'Trancados', value: 19, tone: 'amber', sub: 'R$ 4.100/mês · contam na carteira', help: 'Contrato trancado segue vigente.' }
];

describe('WalletBand', () => {
  it('as quatro células trazem rótulo, número e linha de apoio', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('Contratos vigentes');
    expect(html).toContain('>628<');
    expect(html).toContain('R$ 134.200');
    expect(html).toContain('R$ 214');
    expect(html).toContain('valor por mês ÷ contratos com valor');
    expect(html).toContain('R$ 4.100/mês · contam na carteira');
  });

  it('o sufixo /mês é elemento à parte, e a célula de contagem não ganha sufixo', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('R$ 134.200</span>');
    expect(html).toContain('>/mês</span>');
    expect(html).not.toContain('628</span><span class="num text-[13px]');
  });

  it('a dica só existe na célula que tem texto de ajuda, com o rótulo no aria-label', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('aria-label="O que é &quot;Contratos vigentes&quot;?"');
    expect(html).toContain('aria-label="O que é &quot;Trancados&quot;?"');
    expect(html).not.toContain('aria-label="O que é &quot;Ticket mensal médio&quot;?"');
  });

  it('trancado fica em âmbar, o resto fica neutro', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('text-amber-700');
    expect(html.match(/text-amber-700/g)).toHaveLength(1);
  });

  it('as notas viram cartões tracejados, e sem nota nenhuma o bloco some', () => {
    const withNotes = render(createElement(WalletBand, {
      items: CELLS,
      notes: ['A carteira soma contrato, não pessoa: 6 pessoas têm dois contratos vigentes ao mesmo tempo, então o número de contratos é maior que o de gente.']
    }));
    expect(withNotes).toContain('6 pessoas têm dois contratos vigentes');
    expect(withNotes).toContain('border-dashed');
    const bare = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(bare).not.toContain('border-dashed');
  });
});

describe('BlindValueNote', () => {
  it('conta as pessoas sem valor e se distingue pela forma, não pelo tom', () => {
    const html = render(createElement(BlindValueNote, { count: 114, context: 'vencem no período e não entram na conta acima' }));
    expect(html).toContain('114');
    expect(html).toContain('pessoas sem valor');
    expect(html).toContain('vencem no período e não entram na conta acima');
    expect(html).toContain('border-dashed');
    expect(html).not.toContain('amber');
    expect(html).not.toContain('rose');
  });
});

describe('GerencialEmpty', () => {
  it('um painel só, com as frases do handoff e o caminho para o pipeline', () => {
    const html = render(createElement(GerencialEmpty, { onGoToPipeline: () => {} }));
    expect(html).toContain('Ainda não há contratos');
    expect(html).toContain('Esta tela ganha vida na primeira matrícula registrada. Enquanto isso, o funil de leads continua no painel CRM.');
    expect(html).toContain('Ir para o pipeline');
    expect(html).toContain('<button type="button"');
  });
});

// Esteira de vencimento da Unidade Moinhos: 168 contratos com valor e 114
// importados sem valor, contra uma carteira de R$ 134.200 por mês.
const HORIZON = [
  { days: 30, label: 'Em 30 dias', count: 63, v: 13100, blind: 41 },
  { days: 60, label: 'Em 60 dias', count: 48, v: 9800, blind: 35 },
  { days: 90, label: 'Em 90 dias', count: 57, v: 11400, blind: 38 }
];
const CLEAN = HORIZON.map((h) => ({ ...h, blind: 0 }));

describe('ExpiryRunway', () => {
  it('o total, a contagem e a fatia da carteira saem da própria esteira', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    expect(html).toContain('R$ 34.300');
    expect(html).toContain('em 168 contratos');
    expect(html).toContain('26% da carteira'); // 34.300 de 134.200
  });

  it('sem carteira não inventa fatia: a linha some em vez de mostrar 0%', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON }));
    expect(html).not.toContain('da carteira');
  });

  it('cada barra e cada trilha tracejada é focável, com a dica do handoff', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(6);
    expect(html).toContain('aria-label="Em 30 dias: 63 contratos valendo R$ 13.100 por mês"');
    expect(html).toContain('aria-label="Em 30 dias: mais 41 contratos importados sem valor. Contam como pessoas que vencem, não entram no valor por mês."');
  });

  it('a trilha tracejada tem eixo próprio: a largura segue a contagem, não o dinheiro', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    // Barra sólida: 13.100 é o teto e ocupa 74%; 9.800 fica em 55%.
    expect(html).toContain('width:74%');
    expect(html).toContain('width:55%');
    // Trilha: 41 é o teto e ocupa 16%; 35 fica em 14%.
    expect(html).toContain('width:16%');
    expect(html).toContain('width:14%');
  });

  it('a contagem sem valor aparece escrita ao lado da trilha e no cartão do topo', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    expect(html).toContain('+41 sem valor');
    expect(html).toContain('114');
    expect(html).toContain('vencem no período e não entram na conta acima');
  });

  it('sem contrato sem valor, somem a trilha, o cartão e o item de legenda', () => {
    const html = render(createElement(ExpiryRunway, { horizon: CLEAN, walletMonthly: 134200 }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(3);
    expect(html).not.toContain('sem valor');
    expect(html).not.toContain('contrato importado');
    expect(html).toContain('valor por mês em risco');
  });
});

const EXITS = [
  { kind: 'cancelamento', label: 'Cancelamentos', count: 7, v: 1480 },
  { kind: 'trancamento', label: 'Trancamentos', count: 4, v: 820 }
];

describe('ExitsCard', () => {
  it('o total sai da soma das duas saídas', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html).toContain('R$ 2.300/mês');
  });

  it('cada saída traz rótulo, contagem e valor escritos, além da cor', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html).toContain('Cancelamentos');
    expect(html).toContain('7 contratos');
    expect(html).toContain('R$ 1.480');
    expect(html).toContain('Trancamentos');
    expect(html).toContain('4 contratos');
    expect(html).toContain('R$ 820');
  });

  it('cancelamento em vermelho, trancamento em âmbar, cada barra focável e com dica', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Cancelamentos: 7 contratos, R$ 1.480 por mês"');
    expect(html).toContain('text-rose-700');
    expect(html).toContain('text-amber-700');
    expect(html).toContain('bg-amber-500');
  });

  it('a barra maior enche a trilha e a menor fica na proporção do valor', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html).toContain('width:100%');
    expect(html).toContain('width:55%'); // 820 de 1.480
  });

  it('diz que trancamento continua na carteira e cancelamento sai', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html).toContain('Trancamento é reversível e continua contando na carteira. Cancelamento sai.');
  });

  it('mês sem saída nenhuma mostra os zeros, sem quebrar a largura', () => {
    const html = render(createElement(ExitsCard, { items: EXITS.map((e) => ({ ...e, count: 0, v: 0 })) }));
    expect(html).toContain('R$ 0/mês');
    expect(html).toContain('0 contratos');
    expect(html).not.toContain('NaN');
  });
});

// As quatro pessoas de setembro: somam os R$ 78.400 e os 42 contratos do mês.
const SELLERS = [
  { id: 'ana', name: 'Ana Ribeiro', role: 'Consultora', count: 16, value: 31200, perSale: 1950, monthly: 232 },
  { id: 'diego', name: 'Diego Santos', role: 'Consultor', count: 13, value: 24800, perSale: 1908, monthly: 241 },
  { id: 'larissa', name: 'Larissa Moura', role: 'Consultora', count: 9, value: 16400, perSale: 1822, monthly: 257 },
  { id: 'marcos', name: 'Marcos Lima', role: 'Gestor · também vende', count: 4, value: 6000, perSale: 1500, monthly: 125 }
];
const READ = 'O total premia quem atende mais. No ticket mensal, Larissa fecha a R$ 257 por mês de contrato e Marcos a R$ 125.';

describe('SellerRankTable', () => {
  it('a participação de cada pessoa sai do vendido das linhas, sem vir pronta', () => {
    const html = render(createElement(SellerRankTable, { rows: SELLERS, read: READ }));
    expect(html).toContain('40%'); // 31.200 de 78.400
    expect(html).toContain('8%'); //   6.000 de 78.400
  });

  it('as duas colunas de ticket existem e trazem o número de cada pessoa', () => {
    const html = render(createElement(SellerRankTable, { rows: SELLERS, read: READ }));
    expect(html).toContain('Ticket da venda');
    expect(html).toContain('Ticket mensal');
    expect(html).toContain('R$ 1.950');
    expect(html).toContain('R$ 232');
    expect(html).toContain('R$ 125');
  });

  it('nome, posto e monograma de cada pessoa, na ordem recebida', () => {
    const html = render(createElement(SellerRankTable, { rows: SELLERS, read: READ }));
    expect(html).toContain('Ana Ribeiro');
    expect(html).toContain('Gestor · também vende');
    expect(html).toContain('>AR<');
    expect(html.indexOf('Ana Ribeiro')).toBeLessThan(html.indexOf('Marcos Lima'));
  });

  it('uma barra focável por pessoa, com a dica do vendido', () => {
    const html = render(createElement(SellerRankTable, { rows: SELLERS, read: READ }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Ana Ribeiro: R$ 31.200 em 16 vendas · 40% do vendido no mês"');
  });

  it('no celular o ticket mensal desce para a linha de apoio, e ela não corta', () => {
    const html = render(createElement(SellerRankTable, { rows: SELLERS, read: READ }));
    expect(html).toContain('16 vendas · R$ 1.950 por venda · R$ 232/mês');
    expect(html).toContain('md:hidden');
    // Truncar essa linha esconderia o ticket mensal, que é o número que desce
    // para cá: ela quebra em duas linhas em vez de cortar.
    expect(html).not.toContain('num truncate text-[10.5px]');
  });

  it('a leitura do rodapé aponta a diferença em texto', () => {
    const html = render(createElement(SellerRankTable, { rows: SELLERS, read: READ }));
    expect(html).toContain('No ticket mensal, Larissa fecha a R$ 257 por mês de contrato');
  });

  it('sem linha nenhuma, não divide por zero', () => {
    const html = render(createElement(SellerRankTable, { rows: [], read: '' }));
    expect(html).not.toContain('NaN');
    expect(html).toContain('Quem vendeu');
  });
});

describe('barra do Gerencial', () => {
  const noop = () => {};
  const bar = (over) => render(createElement(GerencialToolbar, {
    monthKey: '2026-09',
    monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }, { key: '2026-08', label: 'Agosto 2026' }],
    onMonth: noop,
    canPrev: true,
    canNext: false,
    onPrev: noop,
    onNext: noop,
    compareOn: true,
    onCompareOn: noop,
    compareKey: '2026-08',
    compareOptions: [{ key: '2026-08', label: 'Agosto 2026' }],
    onCompare: noop,
    ...over
  }));

  it('o aviso de que não é caixa fica na barra, sem botão de fechar', () => {
    const html = bar();
    expect(html).toContain(CASH_WARNING);
    expect(html).toContain('text-amber-700');
    expect(html).not.toContain('Fechar aviso');
  });

  it('mês e comparação aparecem quando há com o que comparar', () => {
    const html = bar();
    expect(html).toContain('Comparar');
    expect(html).toContain('aria-label="Mês de competência"');
    expect(html).not.toContain(NO_COMPARE);
  });

  it('sem mês anterior com venda, o controle sai e a frase toma o lugar', () => {
    const html = bar({ canCompare: false });
    expect(html).toContain(NO_COMPARE);
    expect(html).not.toContain('Comparar');
  });
});

describe('BreakdownCard servindo dinheiro', () => {
  const MONEY = {
    title: 'Planos mais vendidos',
    sub: 'por valor vendido no mês',
    eyebrow: 'Plano que mais trouxe',
    items: [
      { name: 'Anual Musculação', count: 26400, times: 11 },
      { name: 'Semestral Musculação', count: 17100, times: 9 }
    ],
    total: 78400,
    format: fmtMoneyShort,
    leaderSub: '11 vendas · 34% do vendido'
  };

  it('formata a grandeza, escreve a contagem em "11x" e troca a linha do herói', () => {
    const html = render(createElement(BreakdownCard, MONEY));
    expect(html).toContain('R$ 26,4 mil');
    expect(html).toContain('R$ 17,1 mil');
    expect(html).toContain('11x');
    expect(html).toContain('9x');
    expect(html).toContain('11 vendas · 34% do vendido');
    expect(html).not.toContain('26.400 de 78.400');
  });

  it('a porcentagem continua saindo de count ÷ total, que aqui é valor ÷ valor', () => {
    const html = render(createElement(BreakdownCard, MONEY));
    expect(html).toContain('34%'); // 26.400 de 78.400
    expect(html).toContain('22%'); // 17.100 de 78.400
  });

  it('chamada antiga, sem as props novas, renderiza como antes', () => {
    const html = render(createElement(BreakdownCard, {
      title: 'Motivos de perda',
      sub: '32 perdas',
      eyebrow: 'Motivo mais comum',
      items: [{ name: 'Preço', count: 11 }, { name: 'Sumiu', count: 9 }],
      total: 32,
      emptyText: 'vazio'
    }));
    // A linha do herói segue montada em nós separados, e o <!-- --> é a marca
    // que o SSR deixa entre eles: se a estrutura mudar, isto quebra.
    expect(html).toContain('11<!-- --> de <!-- -->32<!-- --> · <!-- -->34<!-- -->%');
    expect(html).toContain('>11</span>');
    expect(html).toContain('>9</span>');
    expect(html).not.toContain('x</span>');
  });
});

describe('LapsedCard', () => {
  it('a fila de recuperação em vermelho, com a dica de que é retrato de agora', () => {
    const html = render(createElement(LapsedCard, { count: 29 }));
    expect(html).toContain('Já venceu e ninguém renovou');
    expect(html).toContain('>29<');
    expect(html).toContain('contratos em aberto');
    expect(html).toContain('text-rose-700');
    expect(html).toContain('dark:text-rose-400');
    expect(html).toContain('aria-label="O que é &quot;Já venceu e ninguém renovou&quot;?"');
    expect(html).toContain('Já saíram da carteira, então o valor por mês deles não aparece aqui. É a fila de recuperação.');
  });

  it('um contrato só não vira "1 contratos"', () => {
    const html = render(createElement(LapsedCard, { count: 1 }));
    expect(html).toContain('contrato em aberto');
    expect(html).not.toContain('contratos em aberto');
  });
});

const BODY = {
  sold: { mix: MIX, ticket: 214, discount: { pct: 8, abs: 6800 } },
  wallet: { items: CELLS, notes: ['A carteira soma contrato, não pessoa: 6 pessoas têm dois contratos vigentes.'] },
  risk: { horizon: HORIZON, walletMonthly: 134200, lapsedCount: 29, blind: { count: 114, context: 'vencem no período e não entram na conta acima' } },
  exits: { items: EXITS },
  sellers: { rows: SELLERS, read: READ },
  plans: {
    items: [{ name: 'Anual Musculação', count: 26400, times: 11 }, { name: 'Mensal', count: 7500, times: 8 }],
    total: 78400,
    eyebrow: 'Plano que mais trouxe',
    sub: 'por valor vendido no mês',
    footText: 'Combinação de modalidades é um grupo próprio, não a soma das partes.'
  },
  sources: {
    items: [{ name: 'Instagram', count: 29600, times: 14 }, { name: 'Indicação', count: 21300, times: 10 }],
    total: 78400,
    eyebrow: 'Canal que mais trouxe',
    sub: 'por valor vendido no mês',
    footText: 'É a origem do lead que virou contrato, não o volume de leads do canal.'
  },
  flags: { gymEmpty: false, monthNoSales: false },
  texts: {
    emptyMonth: { title: 'Nenhum contrato fechado neste mês', text: 'A carteira e o risco abaixo continuam valendo.' },
    emptyRanking: { title: 'Sem vendas no mês, não há ranking', text: 'Troque o mês para ver o ranking.' }
  },
  onGoToPipeline: () => {}
};

const SECTIONS = ['Quanto vendi', 'A carteira hoje', 'Quanto posso perder', 'Quem traz receita'];

describe('GerencialDashboard', () => {
  it('as quatro seções, com a pergunta de cada uma e os cards dentro', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    SECTIONS.forEach((title) => expect(html).toContain(`>${title}</h3>`));
    expect(html).toContain('contratos fechados no mês');
    expect(html).toContain('o que os contratos vigentes geram por mês');
    expect(html).toContain('o que sai da carteira se ninguém renovar');
    expect(html).toContain('as vendas do mês por consultor, plano e origem');
    expect(html).toContain('De onde veio a venda');       // SoldHeroCard
    expect(html).toContain('Contratos vigentes');          // WalletBand
    expect(html).toContain('Vencendo nos próximos 90 dias'); // ExpiryRunway
    expect(html).toContain('Já venceu e ninguém renovou'); // LapsedCard
    expect(html).toContain('Saiu neste mês');              // ExitsCard
    expect(html).toContain('Quem vendeu');                 // SellerRankTable
    expect(html).toContain('Planos mais vendidos');
    expect(html).toContain('Origem do lead que fechou');
  });

  it('a quebra de plano e origem sai em dinheiro, com a contagem e a linha do líder', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    expect(html).toContain('R$ 26,4 mil');
    expect(html).toContain('11x');
    expect(html).toContain('11 vendas · 34% do vendido');
    expect(html).toContain('14 vendas · 38% do vendido');
  });

  it('academia sem contrato troca o corpo inteiro: nem seção, nem card de zeros', () => {
    const html = render(createElement(GerencialDashboard, { ...BODY, flags: { gymEmpty: true, monthNoSales: false } }));
    expect(html).toContain('Ainda não há contratos');
    expect(html).toContain('Ir para o pipeline');
    SECTIONS.forEach((title) => expect(html).not.toContain(`>${title}</h3>`));
    expect(html).not.toContain('Contratos vigentes');
    expect(html).not.toContain('Quem vendeu');
  });

  it('mês sem venda esvazia só o herói e o ranking; carteira e risco ficam inteiros', () => {
    const html = render(createElement(GerencialDashboard, { ...BODY, flags: { gymEmpty: false, monthNoSales: true } }));
    expect(html).toContain('Nenhum contrato fechado neste mês');
    expect(html).toContain('Sem vendas no mês, não há ranking');
    expect(html).not.toContain('De onde veio a venda');
    expect(html).not.toContain('Quem vendeu');
    expect(html).not.toContain('Planos mais vendidos');
    SECTIONS.forEach((title) => expect(html).toContain(`>${title}</h3>`));
    expect(html).toContain('Contratos vigentes');
    expect(html).toContain('Vencendo nos próximos 90 dias');
    expect(html).toContain('26% da carteira');
    expect(html).toContain('Saiu neste mês');
  });
});
