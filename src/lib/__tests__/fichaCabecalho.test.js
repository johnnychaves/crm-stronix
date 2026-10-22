// @vitest-environment jsdom
// O cabeçalho da ficha montada (desenho A2, PR 7): o Próximo passo leva ao
// "A seguir" sem perder o que estava aberto, e os menus Indicações e Mais
// ações abrem pelo teclado, chamam a ação certa e devolvem o foco ao botão.
// A marcação de cada peça tem o próprio teste (profileHeaderBand,
// referralsMenu, moreActionsMenu, stickyMini).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
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
const timeline = vi.hoisted(() => ({ list: [] }));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => timeline.list }));
vi.mock('../../hooks/useDuplicateLead.js', () => ({
  useDuplicateLead: () => ({ duplicate: null }),
  findDuplicateLeadRemote: vi.fn(async () => null),
}));
vi.mock('../../hooks/useGuardianMatches.js', () => ({
  useGuardianMatches: () => ({ owner: null, wards: [], pending: false }),
}));
// A contagem de indicados vem do Firestore; aqui, um número fixo.
vi.mock('../../hooks/useReferrals.js', () => ({
  useReferrals: () => ({ count: 2, items: [], loading: false, reload: () => {} }),
}));
vi.mock('../cadastroWrites.js', () => ({ saveCadastroSection: vi.fn(async () => ({})) }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'u1', name: 'Bruno Prado', role: 'admin', tenantId: 'acad', authUid: 'auth-1' };
const CONSULTOR = { id: 'u2', name: 'Ana Lima', role: 'consultant', tenantId: 'acad', authUid: 'auth-2' };
const daqui = (dias, hora = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
};
const LEAD = {
  id: 'l1', name: 'Marina Alves', whatsapp: '(51) 99530-4633', status: 'Novo', createdAt: new Date(2026, 8, 1),
  consultantId: 'u1', consultantName: 'Bruno Prado', tags: [], source: 'Instagram',
  address: { street: 'Rua Ramiro Barcelos', number: '1200', city: 'Porto Alegre' },
  appointmentType: 'visita', appointmentScheduledFor: daqui(3), appointmentUnit: 'Centro',
  nextFollowUp: daqui(3), nextFollowUpType: 'Visita',
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };
const CONFIG = {
  modalities: [], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5], slaOverdueDays: 3,
  dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [], dores: [],
};

let root = null;
let abaAtual = null;
function Ficha({ lead, appUser, aba }) {
  const [tab, setTab] = useState(aba);
  abaAtual = tab;
  return h(LeadProfileView, {
    lead, tab, onTab: setTab, onBack: () => {}, appUser,
    statuses: [], tags: [], lossReasons: [{ id: 'r1', name: 'Preço' }], usersList: [GESTOR, CONSULTOR], db: {}, funnels: [],
  });
}
async function montar({ lead = LEAD, appUser = GESTOR, aba = 'timeline' } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [`/acad/ficha/${lead.id}`] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG }, h(Ficha, { lead, appUser, aba }))))));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  timeline.list = [];
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const porLabel = (texto) => document.body.querySelector(`[aria-label="${texto}"]`);
const porLabelInicio = (texto) => document.body.querySelector(`[aria-label^="${texto}"]`);
const campo = (nome) => document.body.querySelector(`[name="${nome}"]`);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const esperar = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
};
const itens = () => [...document.body.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent.trim());
const item = (texto) => [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === texto);
async function digitar(el, valor) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const proximoPasso = () => porLabelInicio('Ver o próximo passo no A seguir');

describe('cabeçalho da ficha: Próximo passo', () => {
  it('de outra aba, volta à Linha do tempo e põe o foco no item do A seguir', async () => {
    await montar({ aba: 'contratos' });
    await clicar(proximoPasso());
    await esperar();
    expect(abaAtual).toBe('timeline');
    expect(document.activeElement?.id).toBe('next-appointment');
  });

  it('com o registro filtrado e uma busca, volta para Tudo, limpa a busca e acha o item', async () => {
    timeline.list = [{ id: 'i1', type: 'note', text: 'Pediu os horários', createdAt: daqui(-2, 10), consultantName: 'Bruno Prado' }];
    await montar();
    await clicar(porLabelInicio('Anotações,'));
    await digitar(document.body.querySelector('input[placeholder="Buscar no histórico"]'), 'horários');
    expect(porLabel('A seguir')).toBeNull();
    await clicar(proximoPasso());
    await esperar();
    expect(porLabelInicio('Tudo,').getAttribute('aria-pressed')).toBe('true');
    expect(document.body.querySelector('input[placeholder="Buscar no histórico"]').value).toBe('');
    expect(document.activeElement?.id).toBe('next-appointment');
  });

  it('a partir do Cadastro, a seção aberta e o que foi digitado continuam lá', async () => {
    await montar({ aba: 'cadastro' });
    await clicar(porLabel('Editar endereço'));
    await digitar(campo('city'), 'Canoas');
    await clicar(proximoPasso());
    await esperar();
    expect(abaAtual).toBe('timeline');
    expect(campo('city').value).toBe('Canoas');
  });
});

describe('cabeçalho da ficha: Mais ações', () => {
  it('lead: Marcar perda abre o motivo, e o foco volta ao botão do menu, nunca ao body', async () => {
    await montar({ appUser: CONSULTOR });
    const gatilho = porLabel('Mais ações');
    gatilho.focus();
    await tecla(gatilho, 'Enter');
    expect(itens()).toEqual(['Marcar perda']);
    await clicar(item('Marcar perda'));
    await esperar();
    expect(document.body.textContent).toContain('Diga por que esse lead foi perdido.');
    expect(document.activeElement).toBe(gatilho);
  });

  it('o gestor também tem Excluir lead no menu', async () => {
    await montar();
    await tecla(porLabel('Mais ações'), 'Enter');
    expect(itens()).toEqual(['Marcar perda', 'Excluir lead']);
  });

  it('lead em Perda: o Reativar lead fica à vista, e o menu não oferece Marcar perda', async () => {
    const perdido = { ...LEAD, id: 'l9', status: 'Perda', lossReason: 'Preço', lostAt: new Date(2026, 9, 1) };
    await montar({ lead: perdido });
    expect([...document.body.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Reativar lead')).toBe(true);
    await tecla(porLabel('Mais ações'), 'Enter');
    expect(itens()).toEqual(['Excluir lead']);
  });
});

describe('cabeçalho da ficha: Indicações', () => {
  const CLIENTE = {
    ...LEAD, id: 'c1', status: 'Venda', lifecycleStage: 'cliente', isConverted: true, clienteSince: new Date(2026, 0, 10),
    appointmentType: null, appointmentScheduledFor: null, nextFollowUp: null, nextFollowUpType: null,
  };

  it('abre pelo teclado com o contador, copia o link e devolve o foco ao botão', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await montar({ lead: CLIENTE });
    const gatilho = porLabel('Indicações, 2');
    expect(gatilho).toBeTruthy();
    gatilho.focus();
    await tecla(gatilho, 'Enter');
    expect(itens()).toEqual(['Copiar link de indicação', 'Enviar link pelo WhatsApp']);
    await clicar(item('Copiar link de indicação'));
    await esperar();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Link de indicação copiado.');
    expect(document.activeElement).toBe(gatilho);
  });

  it('o lead não tem o botão Indicações', async () => {
    await montar();
    expect(porLabelInicio('Indicações,')).toBeNull();
  });
});
