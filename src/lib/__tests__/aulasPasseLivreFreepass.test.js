// Aulas: a coluna "Passe livre" mostra o freepass quando o lead tem o resumo
// dele (entrega 2 do Visitante) e a conta antiga do trialClassesPlanned quando
// não tem. A tela inteira é renderizada em node, com o Firestore mockado.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const h = vi.hoisted(() => ({ items: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: h.items, loading: false, hasMore: false, loadMore: () => {} }),
}));

const { AppointmentTrackingView } = await import('../../views/AppointmentTrackingView.jsx');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'aulas' };
const appUser = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad' };

const lead = (extra = {}) => ({
  id: 'abc123', name: 'Rafaela Souza', whatsapp: '11999990000', consultantName: 'Bruno Souza',
  createdAt: new Date('2026-08-01'), status: 'Agendado',
  appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(), appointmentModality: 'Pilates',
  ...extra,
});

const render = () => renderToString(
  createElement(MemoryRouter, { initialEntries: ['/acad/aulas'] },
    createElement(GeneralConfigContext.Provider, { value: { professores: [], contratos: [] } },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(AppointmentTrackingView, { appUser, usersList: [], db: {}, appointmentType: 'aula_experimental' })))));

describe('Aulas: coluna Passe livre', () => {
  it('com o resumo do freepass, mostra o andamento dele', () => {
    h.items = [lead({
      trialClassesPlanned: 9, freepassId: 'f1', freepassStatus: 'correndo', freepassKind: 'aulas',
      freepassTotal: 2, freepassAulas: 1, freepassModalidadeName: 'Pilates', freepassContractAtStart: null,
    })];
    const html = render();
    expect(html).toContain('freepass · 1 de 2 aulas');
    expect(html).not.toContain('faltam 8 dias');
  });

  it('sem o resumo, vale a conta antiga', () => {
    h.items = [lead({ trialClassesPlanned: 3 })];
    const html = render();
    expect(html).toContain('faltam 2 dias');
    expect(html).not.toContain('freepass ·');
  });
});
