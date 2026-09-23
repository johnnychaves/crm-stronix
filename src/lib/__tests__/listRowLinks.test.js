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
const HREF = '/acad/ficha/abc123';
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

// A tag de abertura do <a> que leva à ficha, e só ela: quem for conferir
// classe precisa olhar o link, nunca um <div> de dentro da linha.
function tagDoLink(html) {
  const i = html.indexOf(`href="${HREF}"`);
  expect(i).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<a ', i), html.indexOf('>', i));
}

const listaProps = {
  interactions: [], appUser, statuses: [], usersList: [], funnels: [],
  selectedFunnelId: null, setSelectedFunnelId: () => {}, db: {},
};

const GRADE_AULA = 'md:grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]';
const GRADE_VISITA = 'md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]';

describe('linhas das listas', () => {
  it('Todos os leads: a linha é um link para a ficha', () => {
    h.items = [lead()];
    const html = render(createElement(LeadsView, listaProps));
    expect(html).toContain(`href="${HREF}"`);
    expect(html).toContain('Ana Lima');
  });

  it('Todos os leads: a linha inteira é o link, com grade, hover e anel de foco', () => {
    h.items = [lead()];
    const tag = tagDoLink(render(createElement(LeadsView, listaProps)));
    expect(tag).toContain('grid grid-cols-1');
    expect(tag).toContain('md:grid-cols-[1.7fr_1.15fr_1.25fr_0.75fr]');
    expect(tag).toContain('hover:bg-slate-50');
    expect(tag).toContain('focus-visible:ring-inset');
  });

  it('Clientes: a linha inteira é o link, com grade, hover e anel de foco', () => {
    h.items = [lead({ lifecycleStage: 'cliente' })];
    const html = render(createElement(ClientsView, listaProps));
    expect(html).toContain('Ana Lima');
    const tag = tagDoLink(html);
    expect(tag).toContain('grid grid-cols-1');
    expect(tag).toContain('md:grid-cols-[1.8fr_1.2fr_0.9fr_0.9fr]');
    expect(tag).toContain('hover:bg-slate-50');
    expect(tag).toContain('focus-visible:ring-inset');
  });

  it('Aulas: a linha inteira é o link, na grade que tem a coluna do professor', () => {
    h.items = [lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date() })];
    const tag = tagDoLink(render(createElement(AppointmentTrackingView, {
      appUser, usersList: [], db: {}, appointmentType: 'aula_experimental',
    })));
    expect(tag).toContain('grid grid-cols-1');
    expect(tag).toContain(GRADE_AULA);
    expect(tag).not.toContain(GRADE_VISITA);
    expect(tag).toContain('hover:bg-slate-50');
    expect(tag).toContain('focus-visible:ring-inset');
  });

  it('Visitas: a linha inteira é o link, na grade sem a coluna do professor', () => {
    h.items = [lead({ appointmentType: 'visita', appointmentScheduledFor: new Date() })];
    const tag = tagDoLink(render(createElement(AppointmentTrackingView, {
      appUser, usersList: [], db: {}, appointmentType: 'visita',
    })));
    expect(tag).toContain('grid grid-cols-1');
    expect(tag).toContain(GRADE_VISITA);
    expect(tag).not.toContain(GRADE_AULA);
    expect(tag).toContain('hover:bg-slate-50');
    expect(tag).toContain('focus-visible:ring-inset');
  });
});
