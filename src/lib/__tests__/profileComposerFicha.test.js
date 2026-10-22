// @vitest-environment jsdom
// O compositor ligado à ficha: o rascunho mora na ficha e sobrevive à troca de
// aba (a aba Linha do tempo desmonta o compositor), e cada modo de texto cai no
// seu gravador com o texto digitado. Perder anotação é o pior defeito da tela.
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
const logInteraction = vi.fn(async () => {});
vi.mock('../interactions.js', () => ({ logInteraction: (...args) => logInteraction(...args) }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const LEAD = {
  id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1),
  tags: [], consultantId: 'u2', consultantName: 'Ana Consultora'
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

let root = null;
const ficha = (tab, extra = {}) => h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
  h(ToastContext.Provider, { value: toast },
    h(LeadProfileContext.Provider, { value: profile },
      h(GeneralConfigContext.Provider, { value: CONFIG },
        h(LeadProfileView, {
          lead: LEAD, tab, onTab: () => {}, onBack: () => {}, appUser: CONSULTOR,
          statuses: [], tags: [], lossReasons: [], usersList: [CONSULTOR], db: {}, funnels: [], ...extra,
        })))));
async function montar(tab = 'timeline', extra = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(ficha(tab, extra)); });
}
const trocarAba = async (tab) => { await act(async () => { root.render(ficha(tab)); }); };
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  logInteraction.mockClear();
  toast.success.mockClear();
});

const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const caixa = () => document.querySelector('#composer-text');
async function digitar(valor) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => { set.call(caixa(), valor); caixa().dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('o compositor na ficha', () => {
  it('abre fechado, numa linha, e a linha abre a Anotação', async () => {
    await montar();
    expect(caixa()).toBeNull();
    await clicar(botao('Registrar o que aconteceu com Lucas'));
    expect(caixa()).not.toBeNull();
  });

  it('o texto digitado sobrevive à ida a Contratos e à volta', async () => {
    await montar();
    await clicar(botao('Registrar o que aconteceu com Lucas'));
    await digitar('Pediu para ligar sexta');
    await trocarAba('contratos');
    expect(caixa()).toBeNull();
    await trocarAba('timeline');
    expect(caixa().value).toBe('Pediu para ligar sexta');
  });

  it('a Ligação grava pelo gravador dela, com o texto, e fecha o compositor vazio', async () => {
    await montar();
    await clicar(botao('Ligação'));
    await digitar('Não atendeu');
    await clicar(botao('Registrar ligação'));
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(logInteraction.mock.calls[0][3]).toMatchObject({ text: '📞 Ligação: Não atendeu', type: 'note' });
    expect(caixa()).toBeNull();
    await clicar(botao('Ligação'));
    expect(caixa().value).toBe('');
  });

  it('se a gravação falha, o texto fica na caixa', async () => {
    logInteraction.mockRejectedValueOnce(new Error('sem rede'));
    await montar();
    await clicar(botao('Registrar o que aconteceu com Lucas'));
    await digitar('Vai pensar');
    await clicar(botao('Registrar anotação'));
    expect(toast.error).toHaveBeenCalled();
    expect(caixa().value).toBe('Vai pensar');
  });

  // O Reativar lead do cabeçalho passa pelo handlePhaseConfirm, que agora fecha
  // o compositor no lugar de trocar a aba dele. O contrato (devolve true quando
  // gravou) continua, e a janela fecha.
  it('o Reativar lead ainda grava pela mudança de fase e fecha a janela', async () => {
    const perdido = { ...LEAD, status: 'Perda', funnelId: 'f1', lossReason: 'Preço', lostAt: new Date(2026, 9, 1) };
    await montar('timeline', {
      lead: perdido,
      funnels: [{ id: 'f1', name: 'Comercial', isDefault: true }],
      statuses: [{ id: 's1', funnelId: 'f1', name: 'Novo', order: 0 }, { id: 's2', funnelId: 'f1', name: 'Contato', order: 1 }],
    });
    await clicar(botao('Reativar lead'));
    await clicar(botao('Contato'));
    const reativar = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Reativar lead');
    await clicar(reativar);
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(logInteraction.mock.calls[0][3].text).toContain('[Contato]');
    expect(toast.success).toHaveBeenCalledWith('Lucas Prado reativado em Contato.');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
