// A linha do tempo da ficha diz o dia e a hora de cada registro. Antes, os
// blocos eram Hoje, Ontem, Esta semana e Este mês e a linha mostrava só a
// hora, então uma nota sozinha em "Esta semana" ficava sem o dia.
// O LeadProfileView lê window.location.origin no render (link de indicação),
// por isso o window falso, como em profileLinks.test.js.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// Mais recente primeiro, como o useLeadTimeline entrega.
const { REGISTROS } = vi.hoisted(() => ({
  REGISTROS: [
    { id: 'n1', type: 'note', text: 'Pediu horário da aula de sábado', consultantName: 'Johnny', createdAt: new Date(2026, 8, 25, 14, 32) },
    { id: 'n2', type: 'note', text: 'Vai conversar com o marido', consultantName: 'Ana', createdAt: new Date(2026, 8, 22, 11, 2) },
    { id: 'c1', type: 'status_change', text: 'Matrícula fechada · Plano anual', consultantName: 'Ana', createdAt: new Date(2026, 8, 3, 18, 45) },
    { id: 'n3', type: 'note', text: 'Chegou pelo Instagram', consultantName: 'Ana', createdAt: new Date(2026, 7, 30, 16, 20) },
  ],
}));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => REGISTROS }));
vi.stubGlobal('window', { location: { origin: 'https://stronilead.com.br' } });

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: null,
};

const LEAD = {
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
  createdAt: new Date(2026, 7, 20, 10, 0),
};

const ficha = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/ficha/abc123'] },
    createElement(LeadProfileContext.Provider, { value: profile },
      createElement(LeadProfileView, {
        lead: LEAD, onTab: () => {}, onBack: () => {},
        appUser: { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' },
        statuses: [], tags: [], lossReasons: [], usersList: [], db: {}, funnels: [],
      }))));

describe('linha do tempo da ficha: dia e hora em cada registro', () => {
  // Sexta, 25/09/2026 às 15h: com os blocos antigos, n1 caía em Hoje, n2 em
  // Esta semana e c1 em Este mês.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 25, 15, 0)); });
  afterAll(() => { vi.useRealTimers(); });

  it('cada linha mostra o dia e a hora em que foi registrada', () => {
    const html = ficha();
    expect(html).toContain('>25/09 14:32<');
    expect(html).toContain('>22/09 11:02<');
    expect(html).toContain('>30/08 16:20<');
  });

  it('a faixa da matrícula também mostra o dia e a hora', () => {
    expect(ficha()).toContain('>03/09 18:45<');
  });

  it('os blocos são o mês com o ano, sem Hoje, Ontem, Esta semana ou Este mês', () => {
    const html = ficha();
    expect(html).toContain('>Setembro de 2026<');
    expect(html).toContain('>Agosto de 2026<');
    expect(html).not.toMatch(/>(Hoje|Ontem|Esta semana|Este mês)</);
  });
});
