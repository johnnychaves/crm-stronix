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
import { dashboardProps } from '../gerencial/viewModel.js';
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
    expect(html).toContain('Contratos vigentes');
    expect(html).toContain('R$ 400');
  });

  it('o contrato já renovado sai do risco e o importado entra só como contagem', () => {
    const { cur, html } = screenOf(RAW);
    expect(cur.risk.horizon[0]).toMatchObject({ days: 30, count: 1, v: 100 }); // só o c4
    expect(cur.risk.horizon[2].blind).toBe(1); // o importado c5
    expect(cur.risk.expired.count).toBe(1); // o c7
    expect(html).toContain('+1 sem valor');
    expect(html).toContain('Já venceu e ninguém renovou');
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
    expect(html).not.toContain('Contratos vigentes');
    expect(html).not.toContain('Quem vendeu');
  });

  it('mês sem venda esvazia só a venda e o ranking, e a carteira segue inteira', () => {
    const { html } = screenOf(RAW, '2026-05');
    expect(html).toContain('Nenhum contrato fechado neste mês');
    expect(html).toContain('Sem vendas no mês, não há ranking');
    expect(html).toContain('Contratos vigentes');
    expect(html).toContain('Já venceu e ninguém renovou');
  });
});
