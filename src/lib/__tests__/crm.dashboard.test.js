// Textos que dependem dos números e render da tela do CRM com métricas de
// verdade (metricsOf num cenário pequeno), sem jsdom.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { metricsOf, seriesOf } from '../crm/metrics.js';
import { regimeTexts, channelRead, summaryItems, scopeNote } from '../crm/texts.js';
import { CrmDashboard } from '../../views/dashboard/CrmDashboard.jsx';

const NOW = new Date(2026, 8, 14, 12, 0);
const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const USERS = [{ id: 'ana', name: 'Ana Ribeiro' }];
const lead = (id, over) => ({ id, consultantId: 'ana', funnelId: 'ven', source: 'Instagram', status: 'Novo lead', createdAt: D(9, 2), ...over });
const LEADS = [
  lead('a', { status: 'Venda', isConverted: true, convertedAt: D(9, 5) }),
  lead('b', { status: 'Perda', lostAt: D(9, 6), lossReason: 'Preço' }),
  lead('c', { nextFollowUp: null })
];
const ctx = {
  now: NOW,
  users: USERS,
  funnels: [{ id: 'ven', name: 'Vendas', isDefault: true, order: 0 }],
  statuses: [{ name: 'Novo lead', funnelId: 'ven', order: 0 }],
  liveLeads: [LEADS[2]],
  leadsById: new Map(LEADS.map((l) => [l.id, l])),
  months: {
    '2026-09': { leadsCreated: LEADS, converted: [LEADS[0]], lost: [LEADS[1]], aulas: [], interactions: [] },
    '2026-08': { leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] }
  }
};
const render = (el) => renderToString(createElement(TooltipProvider, null, el));
const noSeries = { leads: [], appts: [], attend: [], enroll: [], conv: [] };

describe('textos do regime', () => {
  it('mês em andamento comparando, sem comparar, fechado e com agendamento incompleto', () => {
    expect(regimeTexts({ running: true, compareOn: true, dayN: 14, shownName: 'setembro', cmpName: 'agosto', apptsPartial: false })).toEqual({
      range: '1 a 14 de setembro',
      subline: '1 a 14 de setembro comparado com os 14 primeiros dias de agosto. O mês está em andamento, então a comparação é pró-rata e a conversão da safra ainda vai subir.',
      note: 'Pró-rata: mesmos 14 primeiros dias de agosto'
    });
    expect(regimeTexts({ running: true, compareOn: false, dayN: 14, shownName: 'setembro', cmpName: 'agosto' }).subline)
      .toBe('1 a 14 de setembro. O mês está em andamento: a conversão da safra de setembro ainda vai subir.');
    expect(regimeTexts({ running: false, compareOn: true, dayN: 14, shownName: 'agosto', cmpName: 'julho' }))
      .toMatchObject({ subline: 'agosto inteiro comparado com julho. Mês fechado.', note: 'Mês fechado contra mês fechado' });
    expect(regimeTexts({ running: false, compareOn: false, dayN: 14, shownName: 'julho', cmpName: 'junho', apptsPartial: true }))
      .toMatchObject({ subline: 'julho inteiro. Mês fechado. Os agendamentos de julho estão incompletos no histórico.', note: 'Sem comparativo · julho inteiro' });
    expect(scopeNote(null, null)).toBe('Equipe toda · Todos os funis');
    expect(scopeNote('Ana Ribeiro', 'Vendas')).toBe('Ana Ribeiro · Vendas');
  });
});

describe('leitura dos canais', () => {
  it('volume e resultado no mesmo canal, em canais diferentes e com pouco lead', () => {
    expect(channelRead({ channels: [{ name: 'Instagram', leads: 20, enrolled: 8 }, { name: 'Site', leads: 6, enrolled: 1 }] }))
      .toBe('Instagram é ao mesmo tempo o canal de maior volume e o de melhor conversão.');
    expect(channelRead({ channels: [{ name: 'Instagram', leads: 22, enrolled: 3 }, { name: 'Indicação', leads: 9, enrolled: 4 }] }))
      .toBe('Instagram traz o volume e Indicação traz o resultado: a conversão de Indicação é 3,1 vezes a de Instagram.');
    expect(channelRead({ channels: [{ name: 'Site', leads: 3, enrolled: 1 }] })).toBe('Poucos leads no período para comparar canais.');
  });
});

describe('faixa de resumo', () => {
  it('cinco células com sub-linha e sem diferença quando o comparativo está desligado', () => {
    const cur = metricsOf(ctx, { monthKey: '2026-09' });
    const items = summaryItems({ cur, cmp: null, series: noSeries, compareOn: false, shownName: 'setembro' });
    expect(items.map((i) => i.label)).toEqual(['Leads novos', 'Agendamentos', 'Comparecimento', 'Matrículas', 'Conversão da safra']);
    expect(items[0]).toMatchObject({ value: '3', sub: 'Instagram lidera com 3', delta: null });
    expect(items[3].sub).toBe('1 da safra de setembro · 0 de safras anteriores');
    expect(items[4]).toMatchObject({ value: '33%', sub: '1 de 3 · 1 ainda em jogo' });
    expect(items[1].flag).toBeNull();
  });

  it('agendamento antes de agosto de 2026: etiqueta e diferença sem base', () => {
    const jul = { ...metricsOf(ctx, { monthKey: '2026-09' }), apptsBase: false, running: false };
    const items = summaryItems({ cur: jul, cmp: jul, series: noSeries, compareOn: true, shownName: 'julho' });
    expect(items[1]).toMatchObject({ flag: 'incompleto', delta: { none: true, text: 'sem base' } });
    expect(items[2]).toMatchObject({ flag: 'incompleto', delta: { none: true, text: 'sem base' } });
  });

  it('mês que falhou: traço no valor e "não carregou" na sub-linha', () => {
    const failedCtx = { ...ctx, months: { ...ctx.months, '2026-08': { failed: true } } };
    const cur = metricsOf(failedCtx, { monthKey: '2026-08' });
    const items = summaryItems({ cur, cmp: null, series: noSeries, compareOn: false, shownName: 'agosto' });
    expect(items.map((i) => i.value)).toEqual(['—', '—', '—', '—', '—']);
    expect(items[0].sub).toBe('não carregou');
    expect(items[1].sub).toBe('não carregou');
    expect(items[3].sub).toBe('não carregou');
    expect(items[4].sub).toBe('não carregou');
  });

  it('mês sem fonte ainda: "carregando" nas cinco sub-linhas; mês carregado sem lead diz que não houve lead', () => {
    const cur = metricsOf(ctx, { monthKey: '2026-07' });
    const items = summaryItems({ cur, cmp: null, series: noSeries, compareOn: false, shownName: 'julho' });
    expect(items.map((i) => i.value)).toEqual(['—', '—', '—', '—', '—']);
    expect(items.map((i) => i.sub)).toEqual(['carregando', 'carregando', 'carregando', 'carregando', 'carregando']);
    const empty = summaryItems({ cur: metricsOf(ctx, { monthKey: '2026-08' }), cmp: null, series: noSeries, compareOn: false, shownName: 'agosto' });
    expect(empty[0]).toMatchObject({ value: '0', sub: 'nenhum lead no período' });
  });
});

describe('tela do CRM (render)', () => {
  const props = (monthKey, shownName) => ({
    cur: metricsOf(ctx, { monthKey }),
    cmp: null,
    highlights: [],
    series: { ...noSeries, leads: seriesOf(ctx, { monthKey, pick: (m) => m.leads }) },
    team: { rows: [{ user: USERS[0], m: metricsOf(ctx, { monthKey, userId: 'ana' }) }], others: null },
    compareOn: false,
    shownName,
    person: null,
    personName: '',
    funnelId: null,
    funnelName: '',
    onPick: () => {},
    onClear: () => {}
  });

  it('mês em andamento: as cinco seções, a carteira de agora e a passagem pedindo um funil', () => {
    const html = render(createElement(CrmDashboard, props('2026-09', 'setembro')));
    ['>Origem</h3>', '>Funil</h3>', '>Pessoas</h3>', '>Velocidade</h3>', '>Carteira agora</h3>'].forEach((s) => expect(html).toContain(s));
    expect(html).toContain('Safra de setembro');
    expect(html).toContain('Escolha um funil para ver a passagem entre etapas');
    expect(html).toContain('Em jogo por funil');
    expect(html).toContain('Sem próximo contato');
    expect(html).toContain('Equipe toda · Todos os funis');
  });

  it('mês fechado: o cartão tracejado no lugar da carteira de agora', () => {
    const html = render(createElement(CrmDashboard, props('2026-08', 'agosto')));
    expect(html).toContain('A carteira agora só existe no mês em andamento');
    expect(html).not.toContain('Sem próximo contato');
  });

  it('mês que falhou: a tela desenha sem quebrar', () => {
    const failedCtx = { ...ctx, months: { ...ctx.months, '2026-08': { failed: true } } };
    const cur = metricsOf(failedCtx, { monthKey: '2026-08' });
    const html = render(createElement(CrmDashboard, { ...props('2026-08', 'agosto'), cur, team: { rows: [], others: null } }));
    expect(html).toContain('Os números de agosto não carregaram');
    expect(html).toContain('Origem, funil, pessoas e velocidade voltam quando o mês carregar.');
    expect(html).toContain('A carteira agora só existe no mês em andamento');
    expect(html).not.toContain('>Origem</h3>');
    expect(html).not.toContain('Nenhum lead cadastrado neste mês.');
  });

  it('mês sem fonte ainda: cartão de carregando no lugar das quatro seções', () => {
    const html = render(createElement(CrmDashboard, props('2026-07', 'julho')));
    expect(html).toContain('Carregando os números de julho');
    expect(html).toContain('Os cards aparecem assim que os dados chegarem.');
    expect(html).not.toContain('>Origem</h3>');
    expect(html).not.toContain('>Funil</h3>');
    expect(html).not.toContain('>Pessoas</h3>');
    expect(html).not.toContain('>Velocidade</h3>');
  });
});
