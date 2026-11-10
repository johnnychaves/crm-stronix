// O card "Tempo até a primeira resposta" da aba CRM: aparece com ao menos uma
// conversa medida no mês e some sem nenhuma, em vez de mostrar zero. Sem linha
// zap_signal (academia sem o Stronizap), o painel é o de hoje.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { metricsOf, seriesOf } from '../crm/metrics.js';
import { FirstReplyCard } from '../../views/dashboard/SpeedCards.jsx';
import { CrmDashboard } from '../../views/dashboard/CrmDashboard.jsx';

const NOW = new Date(2026, 8, 14, 12, 0);
const D = (m, d, h = 10, min = 0) => new Date(2026, m - 1, d, h, min);
const USERS = [{ id: 'ana', name: 'Ana Ribeiro' }];
const lead = (id, over) => ({ id, consultantId: 'ana', funnelId: 'ven', source: 'Instagram', status: 'Novo lead', createdAt: D(9, 2), ...over });
const LEADS = [lead('a'), lead('b')];
const LINHAS = [
  { id: 'zap-a-2026-09-03-lead', leadId: 'a', type: 'zap_signal', signal: 'lead_escreveu', answering: false, createdAt: D(9, 3, 10) },
  { id: 'zap-a-2026-09-03-equipe', leadId: 'a', type: 'zap_signal', signal: 'pessoa_enviou', answering: true, actorId: 'ana', consultantName: 'Ana', createdAt: D(9, 3, 10, 15) },
];
const ctxCom = (interactions) => ({
  now: NOW,
  users: USERS,
  funnels: [{ id: 'ven', name: 'Vendas', isDefault: true, order: 0 }],
  statuses: [{ name: 'Novo lead', funnelId: 'ven', order: 0 }],
  liveLeads: LEADS,
  leadsById: new Map(LEADS.map((l) => [l.id, l])),
  months: {
    '2026-09': { leadsCreated: LEADS, converted: [], lost: [], aulas: [], interactions },
    '2026-08': { leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] },
  },
});
const render = (el) => renderToString(createElement(TooltipProvider, null, el));
const noSeries = { leads: [], appts: [], attend: [], enroll: [], conv: [] };
// Como o crm.dashboard.test.js monta o painel.
const props = (ctx) => ({
  cur: metricsOf(ctx, { monthKey: '2026-09' }),
  cmp: null,
  cmpName: 'agosto',
  series: { ...noSeries, leads: seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.leads }) },
  team: { rows: [{ user: USERS[0], m: metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' }) }], others: null },
  compareOn: false, shownName: 'setembro', person: null, personName: '', funnelId: null, funnelName: '',
  onPick: () => {}, onClear: () => {},
});

describe('tempo até a primeira resposta', () => {
  it('o metricsOf traz a conta com as linhas do mês', () => {
    expect(metricsOf(ctxCom(LINHAS), { monthKey: '2026-09' }).firstReply).toEqual({
      pairs: 1, median: 15, people: [{ id: 'ana', name: 'Ana Ribeiro', pairs: 1, median: 15 }],
    });
    expect(metricsOf(ctxCom(LINHAS), { monthKey: '2026-09', userId: 'outra' }).firstReply).toBeNull();
  });

  it('sem linha de sinal, null', () => {
    expect(metricsOf(ctxCom([]), { monthKey: '2026-09' }).firstReply).toBeNull();
  });

  it('o card mostra a mediana, as conversas e cada pessoa', () => {
    const html = render(createElement(FirstReplyCard, { fr: { pairs: 3, median: 20, people: [{ id: 'ana', name: 'Ana Ribeiro', pairs: 3, median: 20 }] } }));
    expect(html).toContain('Tempo até a primeira resposta');
    expect(html).toContain('20 min');
    expect(html).toContain('3 conversas medidas');
    expect(html).toContain('Ana Ribeiro');
    expect(html).not.toMatch(/[—–]/);
  });

  it('com um funil escolhido, diz que vale para todos os funis', () => {
    const html = render(createElement(FirstReplyCard, { fr: { pairs: 1, median: 15, people: [] }, allFunnels: true }));
    expect(html).toContain('Vale para todos os funis.');
  });

  it('sem conta, o card não existe', () => {
    expect(render(createElement(FirstReplyCard, { fr: null }))).toBe('');
  });

  it('o painel desenha o card com par e some com ele sem par', () => {
    expect(render(createElement(CrmDashboard, props(ctxCom(LINHAS))))).toContain('Tempo até a primeira resposta');
    expect(render(createElement(CrmDashboard, props(ctxCom([]))))).not.toContain('Tempo até a primeira resposta');
  });
});
