// @vitest-environment jsdom
// A trava do desfecho no gravador da ficha, e não só no botão: um item sem
// canOutcome (a visita de dias atrás) nunca grava, mesmo que o pedido chegue.
// O UpNextList falso manda o desfecho de qualquer item, para testar o gravador.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
const writeAppointmentOutcome = vi.fn(async () => ({ promoted: false, negStatusName: null }));
vi.mock('../appointmentOutcome.js', () => ({ writeAppointmentOutcome: (...args) => writeAppointmentOutcome(...args) }));
vi.mock('../../components/profile/UpNextList.jsx', () => ({
  UpNextList: ({ items, onOutcome }) => h('div', null, items.map((item) =>
    h('button', { key: item.id, type: 'button', onClick: () => onOutcome(item, 'attended') }, `forçar ${item.id}`))),
}));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

let root = null;
async function montar(lead) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG },
            h(LeadProfileView, {
              lead, tab: 'timeline', onTab: () => {}, onBack: () => {}, appUser: CONSULTOR,
              statuses: [], tags: [], lossReasons: [], usersList: [CONSULTOR], db: {}, funnels: [],
            }))))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  writeAppointmentOutcome.mockClear();
});

describe('a trava do desfecho no gravador da ficha', () => {
  it('visita de anteontem sem desfecho não grava, mesmo que o pedido chegue', async () => {
    const hoje = new Date();
    const anteontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 2, 19);
    await montar({
      id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 0, 1),
      tags: [], consultantId: 'u2', consultantName: 'Ana Consultora',
      appointmentType: 'visita', appointmentScheduledFor: anteontem, nextFollowUp: anteontem, nextFollowUpType: 'Visita',
    });
    const forcar = [...document.querySelectorAll('button')].find((b) => b.textContent === 'forçar appointment');
    expect(forcar).toBeTruthy();
    await act(async () => { forcar.click(); });
    expect(writeAppointmentOutcome).not.toHaveBeenCalled();
  });
});
