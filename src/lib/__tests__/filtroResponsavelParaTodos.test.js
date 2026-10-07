// @vitest-environment jsdom
// O filtro de responsável vale para todo mundo, não só para o gestor (decisão
// do Johnny, 07/10/2026): em Todos os leads, Clientes, Aulas, Visitas e no
// relatório de agendamentos, a consultora escolhe de quem quer ver os leads,
// como o gestor. As listas já traziam os leads da academia inteira para ela
// (as regras do Firestore liberam a leitura); faltava o controle. As telas são
// renderizadas como em listRowLinks.test.js, e o modal do relatório, em jsdom.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { hrefFor } from '../routes.js';

const h = vi.hoisted(() => ({ items: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/usePagedLeads.js', () => ({
  usePagedLeads: () => ({ items: h.items, loading: false, hasMore: false, loadMore: () => {} }),
  specToConstraints: () => [],
}));

const { LeadsView } = await import('../../views/LeadsView.jsx');
const { ClientsView } = await import('../../views/ClientsView.jsx');
const { AppointmentTrackingView } = await import('../../views/AppointmentTrackingView.jsx');
const { AppointmentExportModal } = await import('../../modals/AppointmentExportModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GESTOR = { id: 'u1', name: 'Carla Mendes', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTORA = { id: 'u2', name: 'Bruno Souza', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
// Consultor sem lead nenhum: escolhido no filtro, a lista fica vazia, e o
// nome dele só aparece na tela se o filtro tiver valido.
const DIEGO = { id: 'u9', name: 'Diego Prado', role: 'consultant', tenantId: 'acad', authUid: 'auth-9' };
const PROFESSOR = { id: 'u3', name: 'Rafa Lemos', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };
const EQUIPE = [GESTOR, CONSULTORA, DIEGO, PROFESSOR];

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'leads' };

const lead = (extra = {}) => ({
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', status: 'Novo',
  consultantId: 'u2', consultantName: 'Bruno Souza', createdAt: new Date('2026-09-01'), ...extra,
});

const render = (url, element) => renderToString(
  createElement(MemoryRouter, { initialEntries: [url] },
    createElement(LeadProfileContext.Provider, { value: profile }, element)));

const leadsView = (appUser) => createElement(LeadsView, {
  interactions: [], appUser, statuses: [], usersList: EQUIPE, funnels: [],
  selectedFunnelId: null, setSelectedFunnelId: () => {}, db: {},
});
const clientsView = (appUser) => createElement(ClientsView, { appUser, usersList: EQUIPE, db: {} });
const agendaView = (appUser, appointmentType) =>
  createElement(AppointmentTrackingView, { appUser, usersList: EQUIPE, db: {}, appointmentType });

describe('o filtro de responsável vale para a consultora', () => {
  it('Todos os leads: o responsável escolhido no endereço recorta a lista', () => {
    h.items = [lead()];
    const html = render('/acad/leads?resp=u9', leadsView(CONSULTORA));
    expect(html).toContain('Diego Prado');
    expect(html).not.toContain('Ana Lima');
  });

  it('Clientes: o responsável escolhido no endereço recorta a lista', () => {
    h.items = [lead({ lifecycleStage: 'cliente' })];
    const html = render('/acad/clientes?resp=u9', clientsView(CONSULTORA));
    expect(html).toContain('Diego Prado');
    expect(html).not.toContain('Ana Lima');
  });

  it('Aulas: o botão de filtros aparece e o responsável do endereço recorta a lista', () => {
    h.items = [lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date() })];
    expect(render('/acad/leads/aulas', agendaView(CONSULTORA, 'aula_experimental'))).toContain('title="Filtros"');
    const html = render('/acad/leads/aulas?resp=u9', agendaView(CONSULTORA, 'aula_experimental'));
    expect(html).toContain('Diego Prado');
    expect(html).not.toContain('Ana Lima');
  });

  it('Visitas: o botão de filtros aparece e o responsável do endereço recorta a lista', () => {
    h.items = [lead({ appointmentType: 'visita', appointmentScheduledFor: new Date() })];
    expect(render('/acad/leads/visitas', agendaView(CONSULTORA, 'visita'))).toContain('title="Filtros"');
    const html = render('/acad/leads/visitas?resp=u9', agendaView(CONSULTORA, 'visita'));
    expect(html).toContain('Diego Prado');
    expect(html).not.toContain('Ana Lima');
  });

  it('Aulas e Visitas: cada linha mostra de quem é o lead, como para o gestor', () => {
    h.items = [lead({ appointmentType: 'visita', appointmentScheduledFor: new Date() })];
    expect(render('/acad/leads/visitas', agendaView(CONSULTORA, 'visita'))).toMatch(/@(<!-- -->)?Bruno/);
  });
});

describe('o filtro de responsável vale também para o professor, em Clientes', () => {
  it('o responsável escolhido no endereço recorta a lista', () => {
    h.items = [lead({ lifecycleStage: 'cliente' })];
    const html = render('/acad/clientes?resp=u9', clientsView(PROFESSOR));
    expect(html).toContain('Diego Prado');
    expect(html).not.toContain('Ana Lima');
  });
});

describe('relatório de agendamentos', () => {
  const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
  let root = null;
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    document.body.innerHTML = '';
    root = null;
  });

  it('o modal mostra a escolha de responsável para quem abrir', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ToastContext.Provider, { value: toast },
        createElement(AppointmentExportModal, {
          open: true, onClose: () => {}, db: {}, appointmentType: 'visita', isAula: false,
          usersList: [GESTOR, CONSULTORA, DIEGO],
        })));
    });
    expect(document.body.textContent).toContain('Responsável');
    expect(document.body.textContent).toContain('Diego Prado');
  });
});
