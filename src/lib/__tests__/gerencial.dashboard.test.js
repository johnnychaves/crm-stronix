// A ligação inteira da tela Gerencial, de contratos crus até o HTML: os
// contratos passam pelo normalizeContracts, pelo metricsOf e pelo
// dashboardProps, e o corpo da tela é renderizado sem jsdom. É este teste que
// pega campo com nome trocado entre a conta e o componente, que não quebra
// nada e só apaga uma linha da tela.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { normalizeContracts } from '../operacional/base.js';
import { metricsOf } from '../gerencial/metrics.js';
import { dashboardProps, ppDelta } from '../gerencial/viewModel.js';
import { GerencialDashboard } from '../../views/dashboard/GerencialDashboard.jsx';

const NOW = new Date(2026, 8, 17, 12, 0);
const D = (y, m, d) => new Date(y, m - 1, d);

// Uma academia pequena, com um caso de cada coisa que a tela precisa contar.
const RAW = [
  // Contrato antigo da pessoa l3, que vence dia 30 mas JÁ foi renovado (c3).
  { id: 'c0', leadId: 'l3', value: 1200, listValue: 1200, durationMonths: 12, createdAt: D(2025, 9, 1), startsAt: D(2025, 9, 1), endsAt: D(2026, 9, 30), status: 'ativo', consultantId: 'u1', consultantName: 'Ana Ribeiro', planId: 'anual', planName: 'Anual Musculação' },
  // Matrícula nova de setembro.
  { id: 'c1', leadId: 'l1', value: 1200, listValue: 1300, durationMonths: 12, createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5), endsAt: D(2027, 9, 5), status: 'ativo', consultantId: 'u1', consultantName: 'Ana Ribeiro', planId: 'anual', planName: 'Anual Musculação' },
  // Outra matrícula nova, de outro consultor.
  { id: 'c2', leadId: 'l2', value: 600, listValue: 600, durationMonths: 6, createdAt: D(2026, 9, 10), startsAt: D(2026, 9, 10), endsAt: D(2027, 3, 10), status: 'ativo', consultantId: 'u2', consultantName: 'Diego Santos', planId: 'sem', planName: 'Semestral Musculação' },
  // Renovação assinada em setembro para valer em outubro.
  { id: 'c3', leadId: 'l3', renewedFromId: 'c0', value: 2400, listValue: 2400, durationMonths: 12, createdAt: D(2026, 9, 12), startsAt: D(2026, 10, 1), endsAt: D(2027, 10, 1), status: 'ativo', consultantId: 'u1', consultantName: 'Ana Ribeiro', planId: 'anual', planName: 'Anual Musculação' },
  // Vence em 30 dias e ninguém renovou: é risco de verdade.
  { id: 'c4', leadId: 'l4', value: 900, listValue: 900, durationMonths: 9, createdAt: D(2025, 12, 20), startsAt: D(2025, 12, 20), endsAt: D(2026, 10, 5), status: 'ativo', consultantId: 'u2', consultantName: 'Diego Santos', planId: 'sem', planName: 'Semestral Musculação' },
  // Importado sem valor, vencendo dentro de 90 dias.
  { id: 'c5', leadId: 'l5', value: 0, durationMonths: 0, importBatchId: 'lote-1', importSource: 'nextfit', startsAt: D(2026, 1, 1), endsAt: D(2026, 11, 20), status: 'ativo' },
  // Cancelado dentro de setembro.
  { id: 'c6', leadId: 'l6', value: 1200, listValue: 1200, durationMonths: 12, createdAt: D(2026, 2, 1), startsAt: D(2026, 2, 1), endsAt: D(2027, 2, 1), status: 'cancelado', cancelledAt: D(2026, 9, 8), consultantId: 'u2', consultantName: 'Diego Santos', planId: 'anual', planName: 'Anual Musculação' },
  // Venceu em julho e ninguém renovou.
  { id: 'c7', leadId: 'l7', value: 600, listValue: 600, durationMonths: 6, createdAt: D(2026, 1, 1), startsAt: D(2026, 1, 1), endsAt: D(2026, 7, 1), status: 'ativo', consultantId: 'u2', consultantName: 'Diego Santos', planId: 'sem', planName: 'Semestral Musculação' }
];

const LEADS = new Map([
  ['l1', { id: 'l1', source: 'Instagram' }],
  ['l2', { id: 'l2', source: 'Indicação' }],
  ['l3', { id: 'l3', source: 'Instagram' }]
]);

const roleOf = (id) => (id === 'u1' ? 'Gestor · também vende' : 'Consultor');

const screenOf = (contracts, monthKey = '2026-09') => {
  const ctx = { now: NOW, contracts: normalizeContracts(contracts), leadsById: LEADS };
  const cur = metricsOf(ctx, { monthKey });
  const props = dashboardProps({ cur, cmp: null, comparing: false, roleOf });
  return {
    cur,
    html: renderToString(createElement(TooltipProvider, null, createElement(GerencialDashboard, { ...props, onGoToPipeline: () => {} })))
  };
};

describe('tela Gerencial, de ponta a ponta', () => {
  it('a venda do mês soma só o que foi fechado no mês, incluindo a renovação que começa depois', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.sold.sold).toBe(4200); // 1200 + 600 + 2400
    expect(cur.sold.count).toBe(3);
    expect(html).toContain('R$ 4.200');
    expect(html).toContain('3 contratos');
  });

  it('cada venda aparece em um tipo só, escrito na legenda', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.sold.mix.map((m) => [m.type, m.count])).toEqual([['nova', 2], ['renovacao', 1]]);
    expect(html).toContain('Matrícula nova');
    expect(html).toContain('Renovação');
  });

  it('a carteira conta contrato, inclui o importado sem valor e o deixa fora do dinheiro', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.wallet.count).toBe(5); // c0, c1, c2, c4 e o importado c5
    expect(cur.wallet.blind).toBe(1);
    expect(cur.wallet.monthly).toBe(400); // quatro contratos de R$ 100 por mês
    expect(cur.wallet.ticket).toBe(100); // 400 ÷ 4 com valor, nunca ÷ 5
    expect(html).toContain('Carteira mensal');
    expect(html).toContain('5 contratos');
    expect(html).toContain('R$ 400');
  });

  it('o contrato já renovado sai do risco, e o importado sem valor não aparece na tela', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.risk.horizon[0]).toMatchObject({ days: 30, count: 1, v: 100 }); // só o c4
    expect(cur.risk.horizon[2].blind).toBe(1); // o importado c5
    expect(cur.risk.expired.count).toBe(1); // o c7
    expect(html).not.toContain('sem valor');
    expect(html).toContain('Vencidos sem renovar');
  });

  it('as saídas do mês trazem o cancelamento com o valor por mês', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.exits.items[0]).toMatchObject({ kind: 'cancelamento', count: 1, v: 100 });
    expect(html).toContain('Cancelamentos');
  });

  it('quem vendeu, por plano e por origem do lead', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.sellers[0]).toMatchObject({ name: 'Ana Ribeiro', count: 2, value: 3600, monthly: 150 });
    expect(cur.sources.map((s) => [s.name, s.value])).toEqual([['Instagram', 3600], ['Indicação', 600]]);
    expect(html).toContain('Ana Ribeiro');
    expect(html).toContain('Gestor · também vende');
    expect(html).toContain('Instagram');
    expect(html).toContain('Anual Musculação');
  });

  it('academia sem contrato nenhum troca o corpo inteiro pelo painel único', () => {
    const { html } = screenOf([]);
    expect(html).toContain('Ainda não há contratos');
    expect(html).not.toContain('Carteira mensal');
    expect(html).not.toContain('Consultores');
  });

  it('mês sem venda esvazia só a venda e os gráficos, e a carteira segue inteira', () => {
    const { html } = screenOf(RAW, '2026-05');
    expect(html).toContain('Nenhum contrato fechado neste mês');
    expect(html).not.toContain('Consultores');
    expect(html).toContain('Carteira mensal');
    expect(html).toContain('Vencidos sem renovar');
  });
});

// Comparativo por linha: cada tipo de venda, consultor, plano, origem e saída
// leva a variação contra a mesma linha do mês comparado. Carteira e risco são
// retrato de hoje e não têm base para comparar.
describe('comparativo por linha', () => {
  const stub = (over) => ({
    monthKey: '2026-09',
    running: true,
    sold: { sold: 78400, count: 42, ticket: 214, discPct: 8, discAbs: 6800, clawCount: 0, clawValue: 0, mix: [], ...over.sold },
    wallet: { count: 628, monthly: 134200, lockedCount: 19 },
    risk: { horizon: [], expired: { count: 0 } },
    exits: { items: [], ...over.exits },
    churn: { exits: 7, base: 200, pct: 3.5, ...over.churn },
    sellers: [],
    plans: [],
    sources: [],
    flags: { gymEmpty: false, monthNoSales: false },
    ...over.rest
  });
  const cur = stub({
    churn: { exits: 7, base: 200, pct: 3.5 },
    sold: { mix: [{ type: 'nova', count: 21, value: 34700 }, { type: 'upgrade', count: 5, value: 10400 }] },
    exits: { items: [{ kind: 'cancelamento', label: 'Cancelamentos', count: 7, v: 1480 }] },
    rest: {
      sellers: [{ id: 'u1', name: 'Ana', count: 16, value: 31200, monthly: 232 }, { id: 'u9', name: 'Bia', count: 2, value: 3000, monthly: 100 }],
      plans: [{ name: 'Anual', count: 11, value: 26400 }],
      sources: [{ name: 'Instagram', count: 14, value: 29600 }]
    }
  });
  const cmp = {
    ...stub({
      sold: { sold: 71900, count: 39, mix: [{ type: 'nova', count: 18, value: 31600 }, { type: 'upgrade', count: 4, value: 10400 }] },
      exits: { items: [{ kind: 'cancelamento', label: 'Cancelamentos', count: 4, v: 900 }] },
      churn: { exits: 4, base: 190, pct: 2.1 },
      rest: {
        monthKey: '2026-08',
        sellers: [{ id: 'u1', name: 'Ana', count: 20, value: 36000, monthly: 230 }],
        plans: [{ name: 'Anual', count: 9, value: 26400 }],
        sources: []
      }
    })
  };

  it('sem comparação, nenhuma linha leva variação', () => {
    const p = dashboardProps({ cur, cmp: null, comparing: false });
    expect(p.sold.mix.every((m) => m.delta === null)).toBe(true);
    expect(p.sellers.rows[0].delta).toBeNull();
    expect(p.plans.items[0].delta).toBeNull();
    expect(p.exits.items[0].delta).toBeNull();
  });

  it('tipo de venda: porcentagem sobre o mesmo tipo e base com os mesmos dias', () => {
    const p = dashboardProps({ cur, cmp, comparing: true });
    expect(p.sold.mix[0].delta).toMatchObject({ up: true, tone: 'good', text: '10%', baseline: 'R$ 31.600 nos mesmos dias de agosto' });
    expect(p.sold.mix[1].delta).toMatchObject({ tone: 'quiet', text: 'igual' }); // upgrade: 10.400 nos dois meses
  });

  it('consultor que caiu fica em vermelho, e quem não vendeu no mês comparado é "novo"', () => {
    const p = dashboardProps({ cur, cmp, comparing: true });
    expect(p.sellers.rows[0].delta).toMatchObject({ up: false, tone: 'bad', text: '13%' }); // 31.200 contra 36.000
    expect(p.sellers.rows[1].delta).toMatchObject({ tone: 'quiet', text: 'novo' });
  });

  it('plano igual, origem sem base e saída que cresce, que é ruim', () => {
    const p = dashboardProps({ cur, cmp, comparing: true });
    expect(p.plans.items[0].delta).toMatchObject({ tone: 'quiet', text: 'igual' });
    expect(p.sources.items[0].delta).toMatchObject({ tone: 'quiet', text: 'novo' });
    expect(p.exits.items[0].delta).toMatchObject({ up: true, tone: 'bad', text: '75%', baseline: '4 contratos nos mesmos dias de agosto' });
  });

  it('mês fechado diz "em agosto" na base', () => {
    const closed = { ...cur, running: false };
    const p = dashboardProps({ cur: closed, cmp, comparing: true });
    expect(p.sold.mix[0].delta.baseline).toBe('R$ 31.600 em agosto');
  });

  it('o desconto do mês comparado vai junto, para a dica', () => {
    expect(dashboardProps({ cur, cmp, comparing: true }).sold.discount.prevPct).toBe(8);
    expect(dashboardProps({ cur, cmp: null, comparing: false }).sold.discount.prevPct).toBeNull();
  });

  it('a variação aparece escrita na tela, com seta e porcentagem', () => {
    const p = dashboardProps({ cur, cmp, comparing: true });
    const html = renderToString(createElement(TooltipProvider, null, createElement(GerencialDashboard, { ...p, onGoToPipeline: () => {} })));
    expect(html).toContain('▲ 10%');
    expect(html).toContain('▼ 13%');
    expect(html).toContain('R$ 31.600 nos mesmos dias de agosto');
  });
});

describe('churn na tela', () => {
  const base = { exits: 7, base: 200, pct: 3.5 };
  const mk = (churn, running = true) => ({
    monthKey: '2026-09', running,
    sold: { sold: 0, count: 0, ticket: 0, discPct: 0, discAbs: 0, clawCount: 0, clawValue: 0, mix: [] },
    wallet: { count: 0, monthly: 0, ticket: 0, lockedCount: 0 },
    risk: { horizon: [], expired: { count: 0 } },
    exits: { items: [] }, churn, sellers: [], plans: [], sources: [],
    flags: { gymEmpty: false, monthNoSales: true }
  });

  it('a taxa vem da conta, sem comparação não há variação', () => {
    const p = dashboardProps({ cur: mk(base), cmp: null, comparing: false });
    expect(p.churn).toEqual({ pct: 3.5, exits: 7, base: 200, delta: null });
  });

  it('subir o churn é ruim: pontos percentuais em vermelho, com a base na dica', () => {
    const cmp = { ...mk({ exits: 4, base: 190, pct: 2.1 }), monthKey: '2026-08' };
    const p = dashboardProps({ cur: mk(base), cmp, comparing: true });
    expect(p.churn.delta).toMatchObject({ up: true, tone: 'bad', text: '1,4 p.p.', baseline: '2,1% nos mesmos dias de agosto' });
  });

  it('cair é bom, e sem taxa de um dos lados não há variação', () => {
    expect(ppDelta(2, 3.5, { lowerBetter: true })).toMatchObject({ up: false, tone: 'good', text: '1,5 p.p.' });
    expect(ppDelta(null, 3.5)).toBeNull();
    expect(ppDelta(3.5, 3.5, { lowerBetter: true })).toMatchObject({ tone: 'quiet', text: 'igual' });
  });

  it('o card aparece na tela com a porcentagem e quantos saíram de quantos', () => {
    const p = dashboardProps({ cur: mk(base), cmp: null, comparing: false });
    const html = renderToString(createElement(TooltipProvider, null, createElement(GerencialDashboard, { ...p, onGoToPipeline: () => {} })));
    expect(html).toContain('Churn');
    expect(html).toContain('3,5%');
    expect(html).toContain('7 de 200 clientes saíram');
  });

  it('sem clientes no início, o churn diz que não há base em vez de 0%', () => {
    const p = dashboardProps({ cur: mk({ exits: 0, base: 0, pct: null }), cmp: null, comparing: false });
    const html = renderToString(createElement(TooltipProvider, null, createElement(GerencialDashboard, { ...p, onGoToPipeline: () => {} })));
    expect(html).toContain('sem clientes ativos no início');
    expect(html).not.toContain('0%');
  });
});

describe('curva do topo', () => {
  const mk = (monthKey, curve, running = true) => ({
    monthKey, running, curve,
    sold: { sold: 0, count: 0, ticket: 0, discPct: 0, discAbs: 0, clawCount: 0, clawValue: 0, mix: [] },
    wallet: { count: 0, monthly: 0, ticket: 0, lockedCount: 0 },
    risk: { horizon: [], expired: { count: 0 } },
    exits: { items: [] }, churn: { exits: 0, base: 0, pct: null }, sellers: [], plans: [], sources: [],
    flags: { gymEmpty: false, monthNoSales: false }
  });

  it('o mês exibido vai até o dia em que está, e o comparado vem inteiro', () => {
    const cur = mk('2026-09', [10, 20, 30, null, null]);
    const full = mk('2026-08', [5, 15, 25, 40, 60], false);
    const cmp = mk('2026-08', [5, 15, 25, null, null], false);
    const p = dashboardProps({ cur, cmp, cmpFull: full, comparing: true });
    expect(p.curve).toMatchObject({ days: 5, cutDay: 3, cur: [10, 20, 30, null, null], prev: [5, 15, 25, 40, 60], prevName: 'agosto' });
    expect(p.period).toEqual({ monthName: 'setembro', running: true, day: 3 });
  });

  it('sem comparação não há linha do mês comparado', () => {
    const p = dashboardProps({ cur: mk('2026-09', [10, 20]), cmp: null, cmpFull: null, comparing: false });
    expect(p.curve.prev).toBeNull();
  });
});
