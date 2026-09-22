// As linhas de Todos os leads, Clientes, Aulas e Visitas viraram link de
// verdade. As telas inteiras são renderizadas em node: o Firestore entra
// mockado, e o que se confere é o <a href> da linha.
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

const { LeadsView } = await import('../../views/LeadsView.jsx');
const { ClientsView } = await import('../../views/ClientsView.jsx');
const { AppointmentTrackingView } = await import('../../views/AppointmentTrackingView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'leads',
};
const appUser = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad' };

function lead(extra = {}) {
  return {
    id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
    consultantName: 'Bruno Souza', createdAt: new Date('2026-09-01'), ...extra,
  };
}

function render(element) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/leads'] },
      createElement(LeadProfileContext.Provider, { value: profile }, element)));
}

const listaProps = {
  interactions: [], appUser, statuses: [], usersList: [], funnels: [],
  selectedFunnelId: null, setSelectedFunnelId: () => {}, db: {},
};

describe('linhas das listas', () => {
  it('Todos os leads: a linha é um link para a ficha', () => {
    h.items = [lead()];
    const html = render(createElement(LeadsView, listaProps));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
  });

  it('Todos os leads: a linha mantém a grade e o fundo de hover', () => {
    h.items = [lead()];
    const html = render(createElement(LeadsView, listaProps));
    const i = html.indexOf('href="/acad/ficha/abc123"');
    const linha = html.slice(html.lastIndexOf('<a ', i), i + 400);
    expect(linha).toContain('grid grid-cols-1');
    expect(linha).toContain('hover:bg-slate-50');
  });

  it('Clientes: a linha é um link para a ficha', () => {
    h.items = [lead({ lifecycleStage: 'cliente' })];
    const html = render(createElement(ClientsView, listaProps));
    expect(html).toContain('href="/acad/ficha/abc123"');
    expect(html).toContain('Ana Lima');
  });

  it('Aulas: a linha é um link para a ficha', () => {
    h.items = [lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date() })];
    const html = render(createElement(AppointmentTrackingView, {
      appUser, usersList: [], db: {}, appointmentType: 'aula_experimental',
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
  });

  it('Visitas: a linha é um link para a ficha', () => {
    h.items = [lead({ appointmentType: 'visita', appointmentScheduledFor: new Date() })];
    const html = render(createElement(AppointmentTrackingView, {
      appUser, usersList: [], db: {}, appointmentType: 'visita',
    }));
    expect(html).toContain('href="/acad/ficha/abc123"');
  });
});
