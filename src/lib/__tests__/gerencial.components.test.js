// Render das peças da tela Gerencial, sem jsdom (renderToString), no molde do
// crm.components.test.js. Um bloco por componente, na ordem em que a tela
// empilha: os quatro números, a venda, o risco, as saídas e os gráficos.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { GerencialKpis, CASH_WARNING } from '../../views/dashboard/GerencialKpis.jsx';
import { SalesTypeCard, PieCard } from '../../views/dashboard/GerencialPies.jsx';
import { SellersCard, ExpiryCard, ExitsCard } from '../../views/dashboard/GerencialRows.jsx';
import { GerencialEmpty } from '../../views/dashboard/GerencialParts.jsx';
import { BreakdownCard } from '../../views/dashboard/DashPrimitives.jsx';
import { fmtMoneyShort } from '../../views/dashboard/dashTokens.js';
import { GerencialDashboard } from '../../views/dashboard/GerencialDashboard.jsx';
import { GerencialToolbar, NO_COMPARE_LABEL } from '../../views/dashboard/GerencialToolbar.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

// Setembro na Unidade Centro (README §8): 42 contratos somando R$ 78.400.
const MIX = [
  { type: 'nova', count: 21, value: 34700 },
  { type: 'renovacao', count: 14, value: 29800 },
  { type: 'upgrade', count: 5, value: 10400 },
  { type: 'retorno', count: 2, value: 3500 }
];
const SOLD = { mix: MIX, discount: { pct: 8, abs: 6800 }, clawback: { count: 2, value: 3100 } };
const WALLET = { count: 628, monthly: 134200, ticket: 214, lockedCount: 19 };
const HORIZON = [
  { days: 30, label: 'Em 30 dias', count: 63, v: 13100, blind: 0 },
  { days: 60, label: 'Em 60 dias', count: 48, v: 9800, blind: 0 },
  { days: 90, label: 'Em 90 dias', count: 57, v: 11400, blind: 0 }
];
const RISK = { horizon: HORIZON, walletMonthly: 134200, lapsedCount: 29 };
const EXITS = [
  { kind: 'cancelamento', label: 'Cancelamentos', count: 7, v: 1480 },
  { kind: 'trancamento', label: 'Trancamentos', count: 4, v: 820 }
];
const SELLERS = [
  { id: 'u1', name: 'Ana Ribeiro', role: 'Consultora', count: 16, value: 31200, monthly: 232 },
  { id: 'u2', name: 'Diego Santos', role: 'Consultor', count: 13, value: 24800, monthly: 241 },
  { id: 'u4', name: 'Marcos Lima', role: 'Gestor · também vende', count: 4, value: 6000, monthly: 125 }
];
const PLANS = {
  items: [{ name: 'Anual Musculação', count: 26400, times: 11 }, { name: 'Mensal', count: 7500, times: 8 }],
  total: 78400
};
const SOURCES = {
  items: [{ name: 'Instagram', count: 29600, times: 14 }, { name: 'Indicação', count: 21300, times: 10 }],
  total: 78400
};

describe('GerencialKpis', () => {
  const kpis = (over) => render(createElement(GerencialKpis, { sold: SOLD, wallet: WALLET, risk: RISK, churn: { pct: 3.2, exits: 18, base: 560, delta: null }, ...over }));

  it('o vendido e a contagem saem do mix, e o ticket das vendas não está no card', () => {
    const html = kpis();
    expect(html).toContain('R$ 78.400');
    expect(html).toContain('>42 contratos</div>');
    expect(html).not.toContain('ticket R$');
  });

  it('o "não é caixa" é uma etiqueta com a explicação na dica', () => {
    const html = kpis();
    expect(html).toContain('não é caixa');
    expect(html).toContain(`title="${CASH_WARNING}"`);
  });

  it('com comparação, a pílula mostra a variação e a dica diz a base', () => {
    const html = kpis({ sold: { ...SOLD, delta: { up: true, text: '9%', baseline: 'R$ 71.900 em 39 contratos nos mesmos dias de agosto' } } });
    expect(html).toContain('▲ 9%');
    expect(html).toContain('R$ 71.900 em 39 contratos nos mesmos dias de agosto');
  });

  it('queda sai em vermelho e mês comparado sem venda sai neutro', () => {
    const down = kpis({ sold: { ...SOLD, delta: { up: false, text: '12%', baseline: 'x' } } });
    expect(down).toContain('▼ 12%');
    expect(down).toContain('text-rose-700');
    const none = kpis({ sold: { ...SOLD, delta: { none: true, text: 'sem base', baseline: 'R$ 0 em 0 contratos' } } });
    expect(none).toContain('sem base');
    expect(none).not.toContain('▲');
  });

  it('sem comparação, a pílula some', () => {
    const html = kpis();
    expect(html).not.toContain('▲');
    expect(html).not.toContain('▼');
  });

  it('a carteira usa dinheiro curto, e o /mês é um elemento à parte', () => {
    const html = kpis();
    expect(html).toContain('R$ 134,2 mil');
    expect(html).toContain('628 contratos · 19 trancados');
    expect(html).toContain('>/mês</span>');
  });

  it('o ticket médio mensal sai da carteira e não fala de contrato sem valor', () => {
    const html = kpis({ wallet: { ...WALLET, count: 1122, blind: 494 } });
    expect(html).toContain('Ticket médio mensal');
    expect(html).toContain('R$ 214');
    expect(html).toContain('média por contrato');
    expect(html).not.toContain('sem valor');
  });

  it('o risco dos 90 dias não é mais um dos quatro números', () => {
    const html = kpis();
    expect(html).not.toContain('Em risco');
    expect(html).not.toContain('da carteira');
  });

  it('a fila de recuperação vem do que já venceu e ninguém renovou', () => {
    const html = kpis();
    expect(html).toContain('Vencidos sem renovar');
    expect(html).toContain('>29</span>');
    expect(html).toContain('contratos para recuperar');
  });

  it('o churn é um dos números do topo, com a taxa e quantos saíram de quantos', () => {
    const html = kpis();
    expect(html).toContain('Churn');
    expect(html).toContain('3,2%');
    expect(html).toContain('18 de 560 clientes saíram');
  });

  it('churn sem clientes no início fica sem taxa, e a variação sobe em vermelho', () => {
    const none = kpis({ churn: { pct: null, exits: 0, base: 0, delta: null } });
    expect(none).toContain('—');
    expect(none).toContain('sem clientes ativos no início');
    const up = kpis({ churn: { pct: 3.2, exits: 18, base: 560, delta: { up: true, tone: 'bad', text: '1 p.p.', baseline: '2,2% em agosto' } } });
    expect(up).toContain('▲ 1 p.p.');
    expect(up).toContain('text-rose-700');
    expect(up).toContain('2,2% em agosto');
  });

  it('carteira vazia não quebra a conta', () => {
    const html = kpis({ wallet: { count: 0, monthly: 0, ticket: 0, lockedCount: 0 } });
    expect(html).toContain('R$ 0');
  });
});

describe('SalesTypeCard', () => {
  const card = (over) => render(createElement(SalesTypeCard, { mix: MIX, discount: SOLD.discount, clawback: SOLD.clawback, ...over }));

  it('a rosca não repete o total de contratos, que já está no card de cima', () => {
    const html = card();
    expect(html).toContain('Vendas por tipo');
    expect(html).not.toContain('>42</span>');
    expect(html).not.toContain('>contratos</span>');
  });

  it('a legenda escreve cada tipo, com participação e valor', () => {
    const html = card();
    ['Matrícula nova', 'Renovação', 'Upgrade', 'Retorno de ex-cliente'].forEach((t) => expect(html).toContain(t));
    expect(html).toContain('R$ 34,7 mil');
    expect(html).toContain('44%'); // 34.700 de 78.400
  });

  it('cada fatia é focável e tem dica com o número', () => {
    const html = card();
    expect(html).toContain('Matrícula nova: 21 contratos · R$ 34.700 · 44% do vendido');
    expect(html).toContain('tabindex="0"');
  });

  it('desconto a partir de 12% fica em âmbar, abaixo disso fica neutro', () => {
    expect(card({ discount: { pct: 8, abs: 1 } })).not.toContain('text-amber-700');
    expect(card({ discount: { pct: 12, abs: 1 } })).toContain('text-amber-700');
  });

  it('a linha de venda cancelada só aparece quando há uma', () => {
    expect(card()).toContain('2 vendas já canceladas · R$ 3.100');
    expect(card({ clawback: { count: 1, value: 1200 } })).toContain('1 venda já cancelada · R$ 1.200');
    expect(card({ clawback: { count: 0, value: 0 } })).not.toContain('já cancelada');
  });

  it('mix vazio não quebra a conta', () => {
    const html = card({ mix: [] });
    expect(html).toContain('Vendas por tipo');
  });
});

describe('PieCard', () => {
  it('a pizza dos planos escreve nome, participação e valor curto', () => {
    const html = render(createElement(PieCard, { title: 'Planos', variant: 'pie', ...PLANS }));
    expect(html).toContain('Planos');
    expect(html).toContain('Anual Musculação');
    expect(html).toContain('34%'); // 26.400 de 78.400
    expect(html).toContain('R$ 26,4 mil');
    expect(html).toContain('Anual Musculação: R$ 26.400 em 11 vendas · 34% do vendido');
  });

  it('a meia-rosca da origem põe a participação e o nome do líder no centro', () => {
    const html = render(createElement(PieCard, { title: 'Origem das vendas', variant: 'half', ...SOURCES }));
    expect(html).toContain('38%'); // 29.600 de 78.400
    expect(html).toContain('>Instagram</div>');
    expect(html).toContain('height="90"');
  });

  it('sem itens, diz que não há venda e não desenha fatia', () => {
    const html = render(createElement(PieCard, { title: 'Planos', items: [], total: 0 }));
    expect(html).toContain('Nenhuma venda no mês.');
    expect(html).not.toContain('tabindex="0"');
  });
});

describe('SellersCard', () => {
  const card = () => render(createElement(SellersCard, { rows: SELLERS }));

  it('uma linha por consultor, com vendas e ticket mensal', () => {
    const html = card();
    expect(html).toContain('Consultores');
    expect(html).toContain('Ticket/mês');
    ['Ana Ribeiro', 'Diego Santos', 'Marcos Lima'].forEach((n) => expect(html).toContain(n));
    expect(html).toContain('R$ 31,2 mil');
    expect(html).toContain('R$ 232');
    expect(html).toContain('>16</span>');
  });

  it('só o líder leva a barra cheia, e o papel vai na dica', () => {
    const html = card();
    expect(html.match(/bg-brand-600/g)).toHaveLength(1);
    expect(html).toContain('Marcos Lima (Gestor · também vende): R$ 6.000 em 4 vendas · 10% do vendido no mês');
  });
});

describe('ExpiryCard', () => {
  it('três faixas com valor por mês e o total de contratos no topo', () => {
    const html = render(createElement(ExpiryCard, { horizon: HORIZON }));
    expect(html).toContain('Vencimentos');
    expect(html).toContain('168 contratos');
    ['Em 30 dias', 'Em 60 dias', 'Em 90 dias'].forEach((l) => expect(html).toContain(l));
    expect(html).toContain('R$ 13.100');
    expect(html).toContain('Em 30 dias: 63 contratos valendo R$ 13.100 por mês');
  });

  it('contrato importado sem valor não aparece no card, nem como trilha nem como legenda', () => {
    const withBlind = HORIZON.map((h, i) => ({ ...h, blind: [41, 35, 38][i] }));
    const html = render(createElement(ExpiryCard, { horizon: withBlind }));
    expect(html).not.toContain('border-dashed');
    expect(html).not.toContain('sem valor');
    expect(html).toContain('168 contratos');
  });
});

describe('ExitsCard', () => {
  it('o total sai da soma das saídas e cada linha mostra a contagem', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html).toContain('Saídas do mês');
    expect(html).toContain('R$ 2.300/mês'); // 1.480 + 820
    expect(html).toContain('Cancelamentos');
    expect(html).toContain('Trancamentos');
    expect(html).toContain('>7</span>');
    expect(html).toContain('>4</span>');
  });

  it('cancelamento é vermelho e trancamento é amarelo, como no resto do app', () => {
    const html = render(createElement(ExitsCard, { items: EXITS }));
    expect(html).toContain('bg-danger');
    expect(html).toContain('bg-yellow-500');
  });

  it('sem saída nenhuma, o total é zero e nada quebra', () => {
    const html = render(createElement(ExitsCard, { items: [] }));
    expect(html).toContain('R$ 0/mês');
  });
});

describe('barra do Gerencial', () => {
  const noop = () => {};
  const bar = (over) => render(createElement(GerencialToolbar, {
    monthKey: '2026-09',
    monthOptions: [{ key: '2026-09', label: 'Setembro 2026', note: 'em andamento' }, { key: '2026-08', label: 'Agosto 2026' }],
    onMonth: noop,
    canPrev: true,
    canNext: false,
    onPrev: noop,
    onNext: noop,
    compareOn: true,
    compareKey: '2026-08',
    compareOptions: [{ key: '2026-08', label: 'Agosto 2026' }],
    onCompare: noop,
    ...over
  }));

  it('o período mostra o mês e as duas setas, e o chip diz com quem compara', () => {
    const html = bar();
    expect(html).toContain('Setembro 2026');
    expect(html).toContain('aria-label="Mês anterior"');
    expect(html).toContain('aria-label="Próximo mês"');
    expect(html).toContain('Comparar com');
    expect(html).toContain('Agosto 2026');
  });

  it('o aviso de caixa e o filtro de unidade não moram na barra', () => {
    const html = bar();
    expect(html).not.toContain(CASH_WARNING);
    expect(html).not.toContain('Unidade');
  });

  it('sem comparação ligada, o chip diz "Sem comparação"', () => {
    const html = bar({ compareOn: false });
    expect(html).toContain(NO_COMPARE_LABEL);
  });

  it('sem mês anterior com venda, o chip só oferece "Sem comparação"', () => {
    const html = bar({ compareOn: false, compareKey: '', compareOptions: [] });
    expect(html).toContain(NO_COMPARE_LABEL);
    expect(html).not.toContain('Agosto 2026');
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

const BODY = {
  sold: SOLD,
  wallet: WALLET,
  risk: RISK,
  exits: { items: EXITS },
  churn: { pct: 3.5, exits: 7, base: 200, delta: null },
  sellers: { rows: SELLERS },
  plans: PLANS,
  sources: SOURCES,
  flags: { gymEmpty: false, monthNoSales: false },
  texts: { emptyMonth: { title: 'Nenhum contrato fechado neste mês', text: 'A carteira e o risco abaixo continuam valendo.' } },
  onGoToPipeline: () => {}
};

describe('GerencialDashboard', () => {
  it('as quatro linhas, na ordem de importância', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    const order = ['Vendido no mês', 'Vendas por tipo', 'Consultores', 'Vencimentos', 'Saídas do mês', 'Planos', 'Origem das vendas'];
    const at = order.map((t) => html.indexOf(t));
    at.forEach((i, n) => expect(i, order[n]).toBeGreaterThan(-1));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('a quebra de plano e origem sai em dinheiro, com a participação do líder', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    expect(html).toContain('R$ 26,4 mil');
    expect(html).toContain('34%');
    expect(html).toContain('38%');
  });

  it('academia sem contrato troca o corpo inteiro: nem KPI, nem card de zeros', () => {
    const html = render(createElement(GerencialDashboard, { ...BODY, flags: { gymEmpty: true, monthNoSales: false } }));
    expect(html).toContain('Ainda não há contratos');
    expect(html).toContain('Ir para o pipeline');
    expect(html).not.toContain('Vendido no mês');
    expect(html).not.toContain('Vencimentos');
  });

  it('mês sem venda esvazia a venda e os gráficos; KPIs, vencimentos e saídas ficam', () => {
    const html = render(createElement(GerencialDashboard, { ...BODY, flags: { gymEmpty: false, monthNoSales: true } }));
    expect(html).toContain('Nenhum contrato fechado neste mês');
    expect(html).not.toContain('Vendas por tipo');
    expect(html).not.toContain('Consultores');
    expect(html).not.toContain('Origem das vendas');
    expect(html).toContain('Carteira mensal');
    expect(html).toContain('Vencimentos');
    expect(html).toContain('Saídas do mês');
    expect(html).toContain('Ticket médio mensal');
  });
});

describe('contrato sem valor', () => {
  it('a tela inteira não menciona contrato sem valor, mesmo com importados na base', () => {
    const body = {
      ...BODY,
      wallet: { ...WALLET, count: 1122, blind: 494 },
      risk: { ...RISK, horizon: HORIZON.map((h, i) => ({ ...h, blind: [41, 35, 38][i] })) }
    };
    const html = render(createElement(GerencialDashboard, body));
    expect(html).not.toContain('sem valor');
    expect(html).not.toContain('importado');
    expect(html).not.toContain('border-dashed');
  });
});

describe('dicas "?" da tela', () => {
  it('cada card do corpo tem o seu "?", com o nome do card no rótulo', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    ['Vendido no mês', 'Carteira mensal', 'Ticket médio mensal', 'Vencidos sem renovar', 'Churn', 'Vendas por tipo', 'Consultores', 'Vencimentos', 'Saídas do mês', 'Planos', 'Origem das vendas']
      .forEach((t) => expect(html, t).toContain(`aria-label="O que é &quot;${t}&quot;?"`));
  });
});
