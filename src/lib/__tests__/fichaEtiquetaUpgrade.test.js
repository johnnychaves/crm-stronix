// @vitest-environment jsdom
// A etiqueta do freepass no cabeçalho da ficha (entrega 2 do Visitante, Tarefa
// 8): o aluno com contrato valendo que faz freepass de outra modalidade aparece
// como "Upgrade" em violeta; o resto continua "Visitante" em verde-água. Sem o
// módulo Stronix 2.0, nenhuma das duas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const m = vi.hoisted(() => ({ freepasses: [] }));
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  AULAS_PATH: 'stronix_aulas', FREEPASS_PATH: 'stronix_freepass', db: {}, auth: {}, storage: {},
}));
// O cliente lê as indicações: aqui não há nenhuma.
vi.mock('../../hooks/useReferrals.js', () => ({ useReferrals: () => ({ count: 0, items: [], loading: false, reload: () => {} }) }));
vi.mock('../../hooks/useLeadFreepasses.js', () => ({ useLeadFreepasses: () => m.freepasses }));
vi.mock('../../hooks/useLeadAulas.js', () => ({ useLeadAulas: () => [] }));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2', tenantModules: ['faltosos'] };
const LEAD = {
  id: 'l1', name: 'Marcos Lima', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1),
  tags: [], consultantId: 'u2', consultantName: 'Ana Consultora',
};
const ALUNO = {
  ...LEAD, status: 'Venda', lifecycleStage: 'cliente', clienteSince: new Date(2026, 0, 10),
  currentContractId: 'c1', currentContractStatus: 'ativo', currentPlanName: 'Start',
  currentContractStartsAt: new Date(2026, 0, 10), currentContractEndsAt: new Date(2027, 0, 10),
};
const fpDoc = (contractAtStart) => ({
  id: 'f1', leadId: 'l1', kind: 'dias', total: 7, aulas: 0, typeName: 'Pilates 7 dias', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 9, 13), endsAt: new Date(2026, 9, 19), contractAtStart,
});
const CONFIG = {
  modalities: [{ id: 'm1', name: 'Pilates' }], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5],
  slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: [], freepassTypes: [],
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

let root = null;
async function montar(lead, appUser = CONSULTOR, extra = {}) {
  const c = document.createElement('div');
  document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG },
            h(LeadProfileView, {
              lead, tab: 'timeline', onTab: () => {}, onBack: () => {}, appUser,
              statuses: [], tags: [], lossReasons: [], usersList: [appUser], db: {}, funnels: [], ...extra,
            }))))));
  });
}
beforeEach(() => {
  // Sexta, 16/10/2026, 10h: o freepass de 7 dias vai até 19/10.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
  m.freepasses = [];
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const etiqueta = (rotulo) => [...document.querySelectorAll('span')].find((s) => s.textContent.startsWith(`${rotulo} · `)) || null;

describe('etiqueta do freepass no cabeçalho da ficha', () => {
  it('aluno com contrato ativo e freepass de outra modalidade: Upgrade em violeta, com a modalidade', async () => {
    m.freepasses = [fpDoc('c1')];
    await montar(ALUNO);
    const tag = etiqueta('Upgrade');
    expect(tag?.textContent).toBe('Upgrade · Pilates, faltam 3 dias');
    expect(tag.className).toContain('violet');
    expect(tag.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(etiqueta('Visitante')).toBeNull();
  });

  it('aluno trancado também é Upgrade', async () => {
    m.freepasses = [fpDoc('c1')];
    await montar({ ...ALUNO, currentContractStatus: 'trancado' });
    expect(etiqueta('Upgrade')?.textContent).toBe('Upgrade · Pilates, faltam 3 dias');
  });

  it('lead sem contrato é Visitante em verde-água', async () => {
    m.freepasses = [fpDoc(null)];
    await montar(LEAD);
    const tag = etiqueta('Visitante');
    expect(tag?.textContent).toBe('Visitante · faltam 3 dias');
    expect(tag.className).toContain('teal');
    expect(etiqueta('Upgrade')).toBeNull();
  });

  it('ex-aluno com contrato vencido é Visitante', async () => {
    m.freepasses = [fpDoc('c1')];
    await montar({ ...ALUNO, currentContractStatus: 'ativo', currentContractStartsAt: new Date(2025, 0, 10), currentContractEndsAt: new Date(2026, 0, 10) });
    expect(etiqueta('Visitante')?.textContent).toBe('Visitante · faltam 3 dias');
    expect(etiqueta('Upgrade')).toBeNull();
  });

  it('aluno no funil Upgrade com freepass: uma pílula de Upgrade só, a do freepass', async () => {
    m.freepasses = [fpDoc('c1')];
    const extra = {
      funnels: [{ id: 'up', name: 'Upgrade', systemKind: 'upgrade' }],
      statuses: [{ id: 's1', name: 'Interesse', funnelId: 'up', isEntry: true, order: 0 }],
    };
    await montar({ ...ALUNO, upgradeStageId: 's1' }, CONSULTOR, extra);
    const pilulas = [...document.querySelectorAll('span')].filter((s) => s.textContent.trim().startsWith('Upgrade · '));
    expect(pilulas.map((s) => s.textContent.trim())).toEqual(['Upgrade · Pilates, faltam 3 dias']);
  });

  it('sem freepass, a pílula do funil Upgrade continua', async () => {
    const extra = {
      funnels: [{ id: 'up', name: 'Upgrade', systemKind: 'upgrade' }],
      statuses: [{ id: 's1', name: 'Interesse', funnelId: 'up', isEntry: true, order: 0 }],
    };
    await montar({ ...ALUNO, upgradeStageId: 's1' }, CONSULTOR, extra);
    const pilulas = [...document.querySelectorAll('span')].filter((s) => s.textContent.trim().startsWith('Upgrade · '));
    expect(pilulas.map((s) => s.textContent.trim())).toEqual(['Upgrade · Interesse']);
  });

  it('sem o módulo, nenhuma etiqueta de freepass', async () => {
    m.freepasses = [fpDoc('c1')];
    await montar({ ...ALUNO, freepassId: 'f1', freepassStatus: 'correndo', freepassKind: 'dias', freepassTotal: 7, freepassEndsAt: new Date(2026, 9, 19), freepassModalidadeName: 'Pilates', freepassContractAtStart: 'c1' }, { ...CONSULTOR, tenantModules: [] });
    expect(etiqueta('Upgrade')).toBeNull();
    expect(etiqueta('Visitante')).toBeNull();
  });
});
