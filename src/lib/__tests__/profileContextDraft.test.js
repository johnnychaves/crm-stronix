// @vitest-environment jsdom
// O rascunho do Contexto comercial sobrevive à troca de aba da ficha: o card
// sai da tela com a aba Contratos, e o editor aberto mora na LeadProfileView,
// como o `note` do compositor (revisão do PR 3, 18/10/2026).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'u1', name: 'Bruno', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const LEAD = { id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1), tags: [], observation: 'Treina de manhã.' };
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

let root = null;
const ficha = (tab) => h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
  h(ToastContext.Provider, { value: toast },
    h(LeadProfileContext.Provider, { value: profile },
      h(LeadProfileView, {
        lead: LEAD, tab, onTab: () => {}, onBack: () => {}, appUser: GESTOR,
        statuses: [], tags: [], lossReasons: [], usersList: [GESTOR], db: {}, funnels: [],
      }))));
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

describe('rascunho do Contexto comercial na troca de aba', () => {
  it('a observação digitada continua lá na volta da aba Contratos', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(ficha('timeline')); });
    const editar = [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g, ' ').trim().startsWith('Editar Observação'));
    await act(async () => { editar.click(); });
    const caixa = document.querySelector('textarea[aria-label="Observação"]');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { set.call(caixa, 'Treina de manhã. Alergia a amendoim.'); caixa.dispatchEvent(new Event('input', { bubbles: true })); });

    await act(async () => { root.render(ficha('contratos')); });
    expect(document.querySelector('textarea[aria-label="Observação"]')).toBeNull();
    await act(async () => { root.render(ficha('timeline')); });
    expect(document.querySelector('textarea[aria-label="Observação"]').value).toBe('Treina de manhã. Alergia a amendoim.');
  });
});
