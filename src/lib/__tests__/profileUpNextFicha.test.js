// @vitest-environment jsdom
// O "A seguir" e o "Ver no histórico" ligados à ficha: o Remarcar abre o
// Agendar no tipo do item, o desfecho grava pelo gravador da Meta Diária com a
// regra da Agenda de hoje, o Não compareceu abre o Agendar e o "Ver no
// histórico" leva até o evento. O foco nunca cai no body.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  db: {}, auth: {}, storage: {},
}));
let timeline = [];
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => timeline }));
// A ficha de cliente conta as indicações no Firestore.
vi.mock('../../hooks/useReferrals.js', () => ({ useReferrals: () => ({ count: 0, items: [], loading: false, reload: () => {} }) }));
const writeAppointmentOutcome = vi.fn(async () => ({ promoted: false, negStatusName: null }));
vi.mock('../appointmentOutcome.js', () => ({ writeAppointmentOutcome: (...args) => writeAppointmentOutcome(...args) }));
const logInteraction = vi.fn(async () => {});
vi.mock('../interactions.js', () => ({ logInteraction: (...args) => logInteraction(...args) }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O balão do desfecho é um Popover do Radix, que mede o gatilho; o jsdom não tem isso.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const D = (m, d, hh = 0, mi = 0) => new Date(2026, m - 1, d, hh, mi);
const LEAD = {
  id: 'l1', name: 'Lucas Prado', whatsapp: '11988887777', status: 'Novo', createdAt: D(9, 1),
  tags: [], consultantId: 'u2', consultantName: 'Ana Consultora',
  appointmentType: 'visita', appointmentScheduledFor: D(10, 16, 19), appointmentUnit: 'Centro',
  nextFollowUp: D(10, 16, 19), nextFollowUpType: 'Visita',
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: []
};

let root = null;
const ficha = (lead) => h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
  h(ToastContext.Provider, { value: toast },
    h(LeadProfileContext.Provider, { value: profile },
      h(GeneralConfigContext.Provider, { value: CONFIG },
        h(LeadProfileView, {
          lead, tab: 'timeline', onTab: () => {}, onBack: () => {}, appUser: CONSULTOR,
          statuses: [], tags: [], lossReasons: [], usersList: [CONSULTOR], db: {}, funnels: [],
        })))));
async function montar(lead = LEAD) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(ficha(lead)); });
}
// O lead chega ao vivo: depois da gravação, a ficha recebe o lead com o desfecho.
const atualizar = async (lead) => { await act(async () => { root.render(ficha(lead)); }); };
const quadro = () => new Promise((r) => requestAnimationFrame(() => r()));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(D(10, 16, 10));
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  timeline = [];
  writeAppointmentOutcome.mockClear();
  toast.success.mockClear();
  vi.useRealTimers();
});

const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const passos = () => [...document.querySelectorAll('ol[aria-label="Passos do agendamento"] > li')];
const agendarAberto = () => botao('Agendar')?.getAttribute('aria-pressed') === 'true';
const gatilho = () => document.querySelector('[aria-label="Marcar desfecho: Visita"]');
async function escolher(id) {
  await clicar(gatilho());
  await clicar(document.querySelector(`[data-outcome-item="${id}"]`));
}

describe('A seguir na ficha', () => {
  it('Remarcar abre o Agendar já na Visita, com o foco no passo', async () => {
    await montar();
    await clicar(botao('Remarcar'));
    expect(agendarAberto()).toBe(true);
    expect(passos()[0].textContent).toContain('Visita');
    expect(document.activeElement.tagName).toBe('H3');
  });

  it('Remarcar de novo com o Agendar aberto recomeça no tipo do item', async () => {
    const comLigacao = { ...LEAD, appointmentType: null, appointmentScheduledFor: null, nextFollowUp: D(10, 17, 18), nextFollowUpType: 'Ligação' };
    await montar(comLigacao);
    await clicar(botao('Agendar'));
    expect(document.body.textContent).toContain('O que você quer agendar?');
    await clicar(botao('Remarcar'));
    expect(passos()[0].textContent).toContain('Ligação');
    expect(document.activeElement.tagName).toBe('H3');
  });

  it('o Agendar aberto pelo compositor, depois de um Remarcar, nasce sem tipo', async () => {
    await montar();
    await clicar(botao('Remarcar'));
    await clicar(botao('Anotação'));
    await clicar(botao('Agendar'));
    expect(document.body.textContent).toContain('O que você quer agendar?');
  });

  it('Compareceu grava pela regra da Agenda de hoje, e o foco espera no registro', async () => {
    await montar();
    await escolher('attended');
    expect(writeAppointmentOutcome).toHaveBeenCalledTimes(1);
    expect(writeAppointmentOutcome.mock.calls[0][0]).toMatchObject({
      outcome: 'attended', categorySlug: DAILY_GOAL_CATEGORIES.VISITA_HOJE,
      promote: true, writeGoalDone: true, sourceLabel: 'Ficha',
    });
    expect(toast.success).toHaveBeenCalledWith('Presença de Lucas confirmada.');
    expect(document.activeElement.getAttribute('aria-label')).toBe('Histórico');
    // O lead volta com o desfecho e o item sai do A seguir: o foco continua no registro.
    await atualizar({ ...LEAD, appointmentOutcome: 'attended', nextFollowUp: null, nextFollowUpType: null });
    expect(gatilho()).toBeNull();
    expect(document.activeElement.getAttribute('aria-label')).toBe('Histórico');
    expect(agendarAberto()).toBe(false);
  });

  it('não grava a marca do dia de novo quando a visita já tem a de hoje', async () => {
    timeline = [{ id: 'm1', leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: DAILY_GOAL_CATEGORIES.VISITA_HOJE, goalOwnerId: 'u2', appointmentOutcome: 'no_show', text: '❌ Não compareceu', createdAt: D(10, 16, 9) }];
    await montar();
    await escolher('attended');
    expect(writeAppointmentOutcome.mock.calls[0][0]).toMatchObject({ writeGoalDone: false });
  });

  it('cliente não muda de etapa pelo Compareceu', async () => {
    await montar({ ...LEAD, lifecycleStage: 'cliente', status: 'Venda' });
    await escolher('attended');
    expect(writeAppointmentOutcome.mock.calls[0][0]).toMatchObject({ promote: false });
  });

  it('Não compareceu grava e abre o Agendar na Visita, com o foco no passo', async () => {
    await montar();
    await escolher('no_show');
    expect(writeAppointmentOutcome.mock.calls[0][0]).toMatchObject({ outcome: 'no_show' });
    expect(toast.success).toHaveBeenCalledWith('Lucas marcado como não veio.');
    expect(agendarAberto()).toBe(true);
    expect(passos()[0].textContent).toContain('Visita');
    expect(document.activeElement.tagName).toBe('H3');
  });

  it('com o compositor gravando, Remarcar e Marcar desfecho esperam', async () => {
    let terminar;
    logInteraction.mockImplementationOnce(() => new Promise((r) => { terminar = r; }));
    await montar();
    await clicar(botao('Registrar o que aconteceu com Lucas'));
    const caixa = document.querySelector('#composer-text');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { set.call(caixa, 'Vai pensar'); caixa.dispatchEvent(new Event('input', { bubbles: true })); });
    await clicar(botao('Registrar anotação'));
    expect(botao('Remarcar').disabled).toBe(true);
    expect(gatilho().disabled).toBe(true);
    await act(async () => { terminar(); });
    expect(botao('Remarcar').disabled).toBe(false);
    expect(gatilho().disabled).toBe(false);
  });

  it('Não compareceu não tira o foco de quem já foi digitar em outro lugar', async () => {
    let terminar;
    writeAppointmentOutcome.mockImplementationOnce(() => new Promise((r) => { terminar = r; }));
    timeline = [{ id: 'n1', leadId: 'l1', type: 'note', text: 'Obs: Oi.', consultantName: 'Ana Consultora', createdAt: D(10, 14, 10) }];
    await montar();
    await escolher('no_show');
    const busca = document.querySelector('input[type="search"]');
    busca.focus();
    await act(async () => { terminar({ promoted: false, negStatusName: null }); });
    expect(agendarAberto()).toBe(true);
    expect(document.activeElement).toBe(busca);
  });

  it('se a gravação falha, avisa e o Agendar não abre', async () => {
    writeAppointmentOutcome.mockRejectedValueOnce(new Error('sem rede'));
    await montar();
    await escolher('no_show');
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar o desfecho. Tente novamente.');
    expect(agendarAberto()).toBe(false);
    expect(gatilho().disabled).toBe(false);
  });
});

describe('Ver no histórico', () => {
  it('limpa o filtro, leva o foco ao evento e o destaca', async () => {
    timeline = [{ id: 'n1', leadId: 'l1', type: 'note', text: 'Obs: Pediu para ligar depois.', consultantName: 'Ana Consultora', createdAt: D(10, 14, 10) }];
    await montar();
    await clicar(botao('Marcos0'));
    expect(document.getElementById('ev-n1')).toBeNull();
    await clicar(botao('Registrar o que aconteceu com Lucas'));
    await clicar(botao('Ver no histórico'));
    await act(async () => { await quadro(); });
    const ev = document.getElementById('ev-n1');
    expect(ev).not.toBeNull();
    expect(document.activeElement).toBe(ev);
    expect(ev.className).toContain('bg-brand-50');
  });
});
