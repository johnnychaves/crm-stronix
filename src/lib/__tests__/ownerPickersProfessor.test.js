// @vitest-environment jsdom
// O professor não é dono de lead nem recebe tarefa de contato (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "Professor
// e consultor"). As duas escolhas de pessoa da ficha deixam o professor de
// fora: o "Consultor responsável" do Editar cadastro e o passo "Responsável"
// do Agendar mensagem. As duas só existem com o balão aberto, então a ficha é
// montada em jsdom e clicada, como em contractActivateModal.test.js.
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

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');
const { ClientRegistrationModal } = await import('../../modals/ClientRegistrationModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'u1', name: 'Bruno Gestor', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const PROFESSOR = { id: 'u3', name: 'Rafa Professor', role: 'professor', professorId: 'prof1', tenantId: 'acad', authUid: 'auth-3' };
const EQUIPE = [GESTOR, CONSULTOR, PROFESSOR];
// O lead é do gestor, então o passo Responsável lista as outras pessoas da equipe.
const LEAD = {
  id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1),
  tags: [], consultantId: 'u1', consultantName: 'Bruno Gestor'
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1, 2, 3], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

let root = null;
async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/ficha/l1/crm'] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG }, elemento)))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});
const clicar = async (rotulo) => {
  const alvo = [...document.querySelectorAll('button')].find((el) => el.textContent.trim().startsWith(rotulo));
  expect(alvo, rotulo).toBeTruthy();
  await act(async () => { alvo.click(); });
};

describe('o professor fora das escolhas de pessoa da ficha', () => {
  it('Agendar mensagem: o passo Responsável lista o consultor e não o professor', async () => {
    await montar(h(LeadProfileView, {
      lead: LEAD, tab: 'crm', onTab: () => {}, onBack: () => {}, appUser: GESTOR,
      statuses: [], tags: [], lossReasons: [], usersList: EQUIPE, db: {}, funnels: [],
    }));
    await clicar('Agendar');
    await clicar('Mensagem');
    expect(document.body.textContent).toContain('Responsável pelo lead (Bruno Gestor)');
    expect(document.body.textContent).toContain('Ana Consultora');
    expect(document.body.textContent).not.toContain('Rafa Professor');
  });

  it('Editar cadastro: o Consultor responsável lista o consultor e não o professor', async () => {
    await montar(h(ClientRegistrationModal, {
      open: true, onClose: () => {}, lead: LEAD, appUser: GESTOR, db: null, usersList: EQUIPE, tags: [],
    }));
    await clicar('Relacionamento');
    const opcoes = [...document.querySelectorAll('option')].map((o) => o.textContent);
    expect(opcoes).toContain('Ana Consultora');
    expect(opcoes).not.toContain('Rafa Professor');
  });
});
