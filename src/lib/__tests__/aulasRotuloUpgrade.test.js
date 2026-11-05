// Aulas: o cliente que já era cliente quando a aula foi marcada aparece como
// "Upgrade" (e "Upgrade feito" depois da venda), nunca como "Matriculado". A
// tela inteira é renderizada em node, com o Firestore mockado.
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

const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }),
  from: 'aulas',
};
const appUser = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad' };

const AULA = new Date();
const DEPOIS = new Date(AULA.getTime() + 60 * 60 * 1000);

const cliente = (extra = {}) => ({
  id: 'abc123', name: 'Ana Lima', whatsapp: '11999990000', consultantName: 'Bruno Souza',
  createdAt: new Date('2026-08-01'),
  status: 'Venda', isConverted: true, lifecycleStage: 'cliente',
  clienteSince: new Date('2026-09-01'), convertedAt: new Date('2026-09-01'),
  appointmentType: 'aula_experimental', appointmentScheduledFor: AULA,
  ...extra,
});

function render(contratos = []) {
  const config = { professores: [], contratos };
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/aulas'] },
      createElement(GeneralConfigContext.Provider, { value: config },
        createElement(LeadProfileContext.Provider, { value: profile },
          createElement(AppointmentTrackingView, {
            appUser, usersList: [], db: {}, appointmentType: 'aula_experimental',
          })))));
}

describe('Aulas: rótulo de quem já era cliente', () => {
  it('cliente ativo com aula marcada aparece como Upgrade, sem Matriculado nem Compareceu', () => {
    h.items = [cliente()];
    const html = render();
    expect(html).toContain('Ana Lima');
    expect(html).toContain('Upgrade');
    expect(html).not.toContain('Matriculado');
    expect(html).not.toContain('title="Compareceu"');
  });

  it('depois de fechar contrato novo, mostra Upgrade feito', () => {
    h.items = [cliente()];
    const html = render([{ id: 'c1', leadId: 'abc123', createdAt: DEPOIS, startsAt: DEPOIS }]);
    expect(html).toContain('Upgrade feito');
    expect(html).not.toContain('Matriculado');
  });

  it('contrato de antes da aula não conta como upgrade fechado', () => {
    h.items = [cliente()];
    const html = render([{ id: 'c0', leadId: 'abc123', createdAt: new Date('2026-09-01'), startsAt: new Date('2026-09-01') }]);
    expect(html).not.toContain('Upgrade feito');
    expect(html).toContain('Upgrade');
  });

  it('lead que matriculou depois da aula continua Matriculado', () => {
    h.items = [cliente({ clienteSince: DEPOIS, convertedAt: DEPOIS })];
    const html = render();
    expect(html).toContain('Matriculado');
    expect(html).not.toContain('Upgrade');
  });
});
