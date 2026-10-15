// Render das peças da tela Gerencial, sem jsdom (renderToString), no molde do
// crm.components.test.js. Um bloco por componente, na ordem em que a tela
// empilha: o herói e a curva, a faixa dos quatro números, a venda, o que vence
// e o que sai, e planos e origem.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { SoldHero, GerencialTape, CASH_WARNING } from '../../views/dashboard/GerencialKpis.jsx';
import { SalesCurve } from '../../views/dashboard/SalesCurve.jsx';
import { SalesTypeCard, RankCard } from '../../views/dashboard/GerencialPies.jsx';
import { SellersCard, ExpiryExitsCard } from '../../views/dashboard/GerencialRows.jsx';
import { GerencialEmpty } from '../../views/dashboard/GerencialParts.jsx';
import { BreakdownCard } from '../../views/dashboard/DashPrimitives.jsx';
import { fmtMoneyShort } from '../../views/dashboard/dashTokens.js';
import { GerencialDashboard } from '../../views/dashboard/GerencialDashboard.jsx';
import { GerencialToolbar, NO_COMPARE_LABEL } from '../../views/dashboard/GerencialToolbar.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

// Setembro na Unidade Centro (README §8): 42 contratos somando R$ 78.400.
const MIX = [
  { type: 'nova', count: 21, value: 34700, delta: { up: true, tone: 'good', text: '10%', baseline: 'R$ 31.600 nos mesmos dias de agosto' } },
  { type: 'renovacao', count: 14, value: 29800 },
  { type: 'upgrade', count: 5, value: 10400 },
  { type: 'retorno', count: 2, value: 3500 }
];
const SOLD = { mix: MIX, discount: { pct: 8, abs: 6800 }, clawback: { count: 2, value: 3100 } };
const PERIOD = { monthName: 'setembro', running: true, day: 17 };
const CURVE = {
  days: 30,
  cutDay: 17,
  cur: Array.from({ length: 30 }, (_, i) => (i < 17 ? Math.round(((i + 1) / 17) * 78400) : null)),
  prev: Array.from({ length: 30 }, (_, i) => Math.round(((i + 1) / 30) * 128400)),
  prevName: 'agosto'
};
const WALLET = { count: 628, monthly: 134200, ticket: 214, lockedCount: 19 };
const HORIZON = [
  { days: 30, label: 'Em 30 dias', count: 63, v: 13100, blind: 0 },
  { days: 60, label: 'Em 60 dias', count: 48, v: 9800, blind: 0 },
  { days: 90, label: 'Em 90 dias', count: 57, v: 11400, blind: 0 }
];
const RISK = { horizon: HORIZON, walletMonthly: 134200, lapsedCount: 29 };
const EXITS = [
  { kind: 'cancelamento', label: 'Cancelamentos', count: 7, v: 1480, delta: { up: true, tone: 'bad', text: '75%', baseline: '4 contratos nos mesmos dias de agosto' } },
  { kind: 'trancamento', label: 'Trancamentos', count: 4, v: 820 }
];
const CHURN = { pct: 3.2, exits: 18, base: 560, delta: null };
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

describe('SoldHero', () => {
  const hero = (over) => render(createElement(SoldHero, { sold: { mix: MIX, delta: null }, period: PERIOD, curve: CURVE, ...over }));

  it('o vendido e a contagem saem do mix, e o título diz o mês e o dia', () => {
    const html = hero();
    expect(html).toContain('R$ 78.400');
    expect(html).toContain('42 contratos');
    expect(html).toContain('Vendido em setembro, até o dia 17');
  });

  it('mês fechado não fala de dia', () => {
    const closedCurve = { ...CURVE, cutDay: 30, cur: CURVE.prev, prev: null };
    const html = hero({ period: { monthName: 'agosto', running: false, day: 30 }, curve: closedCurve });
    expect(html).toContain('Vendido em agosto');
    expect(html).not.toContain('até o dia');
  });

  it('a nota diz que é valor de contrato, não caixa', () => {
    const html = hero();
    expect(html).toContain('não dinheiro que já entrou no caixa');
    expect(html).toContain(`title="${CASH_WARNING}"`);
  });

  it('com comparação, a pílula diz a variação sobre o mês e a dica diz a base', () => {
    const html = hero({ sold: { mix: MIX, delta: { up: true, text: '9%', name: 'agosto', baseline: 'R$ 71.900 em 39 contratos nos mesmos dias de agosto' } } });
    expect(html).toContain('▲ 9% sobre agosto');
    expect(html).toContain('R$ 71.900 em 39 contratos nos mesmos dias de agosto');
  });

  it('queda sai em vermelho e mês comparado sem venda sai neutro', () => {
    const down = hero({ sold: { mix: MIX, delta: { up: false, text: '12%', name: 'agosto', baseline: 'x' } } });
    expect(down).toContain('▼ 12% sobre agosto');
    expect(down).toContain('text-rose-300');
    const none = hero({ sold: { mix: MIX, delta: { none: true, text: 'sem base', name: 'agosto', baseline: 'R$ 0 em 0 contratos' } } });
    expect(none).toContain('sem base');
    expect(none).not.toContain('▲');
  });

  it('sem comparação, a pílula some', () => {
    const html = hero();
    expect(html).not.toContain('▲');
    expect(html).not.toContain('▼');
    expect(html).not.toContain('sobre agosto');
  });

  it('a curva acompanha o herói, com os dois meses na legenda', () => {
    const html = hero();
    expect(html).toContain('Venda acumulada em setembro: R$ 78.400 até o dia 17.');
    expect(html).toContain('agosto');
  });
});

describe('SalesCurve', () => {
  const curve = (over) => render(createElement(SalesCurve, { ...CURVE, curName: 'setembro', ...over }));

  it('escreve o resumo para quem não vê o gráfico, com os dois meses no mesmo dia', () => {
    const html = curve();
    expect(html).toContain('Venda acumulada em setembro: R$ 78.400 até o dia 17.');
    expect(html).toContain('agosto: R$ 72.760 no mesmo dia.'); // 17/30 de 128.400
  });

  it('sem mês comparado, não há linha pontilhada nem marcador dele', () => {
    const html = curve({ prev: null });
    expect(html).not.toContain('stroke-dasharray="5 5"');
    expect(html).not.toContain('no mesmo dia');
  });

  it('mês fechado não desenha a linha do "hoje"', () => {
    const closed = { days: 30, cutDay: 30, cur: Array.from({ length: 30 }, (_, i) => (i + 1) * 100), prev: null, curName: 'agosto', prevName: 'julho' };
    expect(curve(closed)).not.toContain('rgba(255,255,255,0.25)');
  });
});

describe('GerencialTape', () => {
  const tape = (over) => render(createElement(GerencialTape, { wallet: WALLET, risk: RISK, churn: CHURN, ...over }));

  it('a carteira usa dinheiro curto e o /mês é um elemento à parte', () => {
    const html = tape();
    expect(html).toContain('R$ 134,2 mil');
    expect(html).toContain('628 contratos · 19 trancados');
    expect(html).toContain('>/mês</span>');
  });

  it('o ticket médio mensal sai da carteira, sem falar de contrato sem valor', () => {
    const html = tape();
    expect(html).toContain('Ticket médio mensal');
    expect(html).toContain('R$ 214');
    expect(html).toContain('média por contrato');
    expect(html).not.toContain('sem valor');
  });

  it('o churn mostra a taxa e quantos saíram de quantos', () => {
    const html = tape();
    expect(html).toContain('Churn');
    expect(html).toContain('3,2%');
    expect(html).toContain('18 de 560 clientes saíram');
  });

  it('churn sem clientes no início fica sem taxa, e a variação sobe em vermelho', () => {
    const none = tape({ churn: { pct: null, exits: 0, base: 0, delta: null } });
    expect(none).toContain('—');
    expect(none).toContain('sem clientes ativos no início');
    const up = tape({ churn: { ...CHURN, delta: { up: true, tone: 'bad', text: '1 p.p.', baseline: '2,2% em agosto' } } });
    expect(up).toContain('▲ 1 p.p.');
    expect(up).toContain('text-rose-700');
    expect(up).toContain('2,2% em agosto');
  });

  it('os vencidos em vermelho, e o risco dos 90 dias não é um dos números', () => {
    const html = tape();
    expect(html).toContain('Vencidos sem renovar');
    expect(html).toContain('>29</span>');
    expect(html).toContain('contratos para recuperar');
    expect(html).not.toContain('Em risco');
  });

  it('carteira vazia não quebra a conta', () => {
    const html = tape({ wallet: { count: 0, monthly: 0, ticket: 0, lockedCount: 0 } });
    expect(html).toContain('R$ 0');
  });
});

describe('SalesTypeCard', () => {
  const card = (over) => render(createElement(SalesTypeCard, { mix: MIX, discount: SOLD.discount, clawback: SOLD.clawback, ...over }));

  it('a barra e a legenda escrevem cada tipo, com contagem, participação e valor', () => {
    const html = card();
    expect(html).toContain('De onde veio a venda');
    ['Matrícula nova', 'Renovação', 'Upgrade', 'Retorno de ex-cliente'].forEach((t) => expect(html).toContain(t));
    expect(html).toContain('R$ 34,7 mil');
    expect(html).toContain('21 contratos · 44%');
  });

  it('cada segmento é focável e tem dica com o número', () => {
    const html = card();
    expect(html).toContain('Matrícula nova: 21 contratos · R$ 34.700 · 44% do vendido');
    expect(html).toContain('tabindex="0"');
  });

  it('a variação do tipo aparece ao lado, com a base na dica', () => {
    const html = card();
    expect(html).toContain('▲ 10%');
    expect(html).toContain('R$ 31.600 nos mesmos dias de agosto');
  });

  it('desconto a partir de 12% fica em âmbar, abaixo disso fica neutro', () => {
    expect(card({ discount: { pct: 8, abs: 1 } })).not.toContain('text-amber-700');
    expect(card({ discount: { pct: 12, abs: 1 } })).toContain('text-amber-700');
  });

  it('a linha de venda cancelada só aparece quando há uma', () => {
    expect(card()).toContain('2 vendas deste mês já foram canceladas, somando R$ 3.100.');
    expect(card({ clawback: { count: 1, value: 1200 } })).toContain('1 venda deste mês já foi cancelada, somando R$ 1.200.');
    expect(card({ clawback: { count: 0, value: 0 } })).not.toContain('cancelada');
  });

  it('mix vazio não quebra a conta', () => {
    expect(card({ mix: [] })).toContain('De onde veio a venda');
  });
});

describe('RankCard', () => {
  const rank = (over) => render(createElement(RankCard, { title: 'Planos', question: 'Valor vendido no mês, por plano.', ...PLANS, ...over }));

  it('escreve nome, valor curto e participação, o líder primeiro', () => {
    const html = rank();
    expect(html).toContain('Planos');
    expect(html).toContain('Anual Musculação');
    expect(html).toContain('R$ 26,4 mil');
    expect(html).toContain('34%'); // 26.400 de 78.400
    expect(html.indexOf('Anual Musculação')).toBeLessThan(html.indexOf('Mensal'));
  });

  it('a barra tem dica com o valor, as vendas e a participação', () => {
    expect(rank()).toContain('Anual Musculação: R$ 26.400 em 11 vendas · 34% do vendido');
  });

  it('só o líder leva a barra cheia', () => {
    expect(rank().match(/bg-brand-600/g)).toHaveLength(1);
  });

  it('a variação de cada linha aparece quando há comparação', () => {
    const html = rank({ items: [{ ...PLANS.items[0], delta: { up: true, tone: 'good', text: '10%', baseline: 'R$ 24.000 em agosto' } }, PLANS.items[1]] });
    expect(html).toContain('▲ 10%');
    expect(html).toContain('R$ 24.000 em agosto');
  });

  it('sem itens, diz que não há venda e não desenha barra', () => {
    const html = rank({ items: [], total: 0 });
    expect(html).toContain('Nenhuma venda no mês.');
    expect(html).not.toContain('tabindex="0"');
  });
});

describe('SellersCard', () => {
  const card = () => render(createElement(SellersCard, { rows: SELLERS }));

  it('uma linha por consultor, com vendas e ticket mensal', () => {
    const html = card();
    expect(html).toContain('Quem vendeu');
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

describe('ExpiryExitsCard', () => {
  const card = (over) => render(createElement(ExpiryExitsCard, { horizon: HORIZON, exits: EXITS, ...over }));

  it('três faixas de vencimento com o valor por mês e o total de contratos', () => {
    const html = card();
    expect(html).toContain('O que vence e o que sai');
    expect(html).toContain('Vence nos próximos 90 dias');
    expect(html).toContain('168 contratos');
    ['Em 30 dias', 'Em 60 dias', 'Em 90 dias'].forEach((l) => expect(html).toContain(l));
    expect(html).toContain('R$ 13.100');
    expect(html).toContain('Em 30 dias: 63 contratos valendo R$ 13.100 por mês');
  });

  it('as saídas somam o valor e cada linha mostra a contagem', () => {
    const html = card();
    expect(html).toContain('Saiu neste mês');
    expect(html).toContain('R$ 2.300/mês'); // 1.480 + 820
    expect(html).toContain('Cancelamentos');
    expect(html).toContain('Trancamentos');
    expect(html).toContain('7 contratos');
    expect(html).toContain('4 contratos');
  });

  it('a variação da saída aparece, e cancelamento é vermelho enquanto trancamento é amarelo', () => {
    const html = card();
    expect(html).toContain('▲ 75%');
    expect(html).toContain('bg-danger');
    expect(html).toContain('bg-yellow-500');
  });

  it('contrato importado sem valor não aparece, nem como trilha nem como legenda', () => {
    const withBlind = HORIZON.map((h, i) => ({ ...h, blind: [41, 35, 38][i] }));
    const html = card({ horizon: withBlind });
    expect(html).not.toContain('sem valor');
    expect(html).not.toContain('border-dashed');
    expect(html).toContain('168 contratos');
  });

  it('sem saída nenhuma, o total é zero e nada quebra', () => {
    expect(card({ exits: [] })).toContain('R$ 0/mês');
  });
});

describe('barra do Gerencial', () => {
  const noop = () => {};
  const bar = (over) => render(createElement(GerencialToolbar, {
    title: 'Gerencial',
    subline: '1 a 17 de setembro · vs. mesmos dias de agosto',
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

  it('o título e a linha de apoio moram no mesmo cartão da barra, com a borda das faixas', () => {
    const html = bar();
    expect(html).toContain('>Gerencial</h2>');
    expect(html).toContain('1 a 17 de setembro · vs. mesmos dias de agosto');
    expect(html).toContain('rounded-[18px] border border-border bg-card');
  });

  it('o aviso de caixa e o filtro de unidade não moram na barra', () => {
    const html = bar();
    expect(html).not.toContain(CASH_WARNING);
    expect(html).not.toContain('Unidade');
  });

  it('sem comparação ligada, o chip diz "Sem comparação"', () => {
    expect(bar({ compareOn: false })).toContain(NO_COMPARE_LABEL);
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
  period: PERIOD,
  curve: CURVE,
  sold: SOLD,
  wallet: WALLET,
  risk: RISK,
  exits: { items: EXITS },
  churn: CHURN,
  sellers: { rows: SELLERS },
  plans: PLANS,
  sources: SOURCES,
  flags: { gymEmpty: false, monthNoSales: false },
  texts: { emptyMonth: { title: 'Nenhum contrato fechado neste mês', text: 'A carteira e o risco abaixo continuam valendo.' } },
  onGoToPipeline: () => {}
};

describe('GerencialDashboard', () => {
  it('na ordem do mockup: herói, quatro números, tipos, consultores, vence e sai, planos e origem', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    const order = ['Vendido em setembro', 'Carteira mensal', 'De onde veio a venda', 'Quem vendeu', 'O que vence e o que sai', 'Planos', 'Origem das vendas'];
    const at = order.map((t) => html.indexOf(t));
    at.forEach((i, n) => expect(i, order[n]).toBeGreaterThan(-1));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('planos e origem saem em dinheiro, com a participação do líder', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    expect(html).toContain('R$ 26,4 mil');
    expect(html).toContain('34%');
    expect(html).toContain('38%');
  });

  it('academia sem contrato troca o corpo inteiro: nem herói, nem card de zeros', () => {
    const html = render(createElement(GerencialDashboard, { ...BODY, flags: { gymEmpty: true, monthNoSales: false } }));
    expect(html).toContain('Ainda não há contratos');
    expect(html).toContain('Ir para o pipeline');
    expect(html).not.toContain('Vendido em');
    expect(html).not.toContain('O que vence');
  });

  it('mês sem venda esvazia a venda; os quatro números e o que vence e sai ficam', () => {
    const html = render(createElement(GerencialDashboard, { ...BODY, flags: { gymEmpty: false, monthNoSales: true } }));
    expect(html).toContain('Nenhum contrato fechado neste mês');
    expect(html).not.toContain('Vendido em setembro');
    expect(html).not.toContain('De onde veio a venda');
    expect(html).not.toContain('Quem vendeu');
    expect(html).not.toContain('Origem das vendas');
    expect(html).toContain('Carteira mensal');
    expect(html).toContain('Ticket médio mensal');
    expect(html).toContain('O que vence e o que sai');
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
  });
});

describe('dicas "?" da tela', () => {
  it('cada bloco tem o seu "?", com o nome no rótulo', () => {
    const html = render(createElement(GerencialDashboard, BODY));
    ['Vendido no mês', 'Carteira mensal', 'Ticket médio mensal', 'Vencidos sem renovar', 'Churn', 'De onde veio a venda', 'Quem vendeu', 'O que vence e o que sai', 'Planos', 'Origem das vendas']
      .forEach((t) => expect(html, t).toContain(`aria-label="O que é &quot;${t}&quot;?"`));
  });
});
