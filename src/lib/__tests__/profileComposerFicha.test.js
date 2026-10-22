// @vitest-environment jsdom
// O compositor ligado à ficha: o rascunho mora na ficha e sobrevive à troca de
// aba (a aba Linha do tempo desmonta o compositor), e cada modo de texto cai no
// seu gravador com o texto digitado. Perder anotação é o pior defeito da tela.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('com a gravação lenta, o Ctrl e Enter de novo não grava duas vezes, e a caixa fica só de leitura', async () => {
    let terminar;
    logInteraction.mockImplementationOnce(() => new Promise((r) => { terminar = r; }));
    await montar();
    await clicar(botao('Registrar o que aconteceu com Lucas'));
    await digitar('Vai pensar');
    const ctrlEnter = async () => {
      await act(async () => { caixa().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
    };
    await ctrlEnter();
    await ctrlEnter();
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(caixa().readOnly).toBe(true);
    expect(botao('Ligação').disabled).toBe(true);
    await act(async () => { terminar(); });
    expect(caixa()).toBeNull();
  });

  it('o Reativar lead com o compositor aberto na Ligação não fecha nem troca o modo', async () => {
    const perdido = { ...LEAD, status: 'Perda', funnelId: 'f1', lossReason: 'Preço', lostAt: new Date(2026, 9, 1) };
    await montar('timeline', {
      lead: perdido,
      funnels: [{ id: 'f1', name: 'Comercial', isDefault: true }],
      statuses: [{ id: 's1', funnelId: 'f1', name: 'Novo', order: 0 }, { id: 's2', funnelId: 'f1', name: 'Contato', order: 1 }],
    });
    await clicar(botao('Ligação'));
    await digitar('Resumo pela metade');
    await clicar(botao('Reativar lead'));
    await clicar(botao('Contato'));
    const reativar = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Reativar lead');
    await clicar(reativar);
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(caixa().value).toBe('Resumo pela metade');
    expect(botao('Ligação').getAttribute('aria-pressed')).toBe('true');
  });

  it('o foco segue o compositor: Agendar e Mudar fase pela linha fechada, e a volta à linha depois de registrar', async () => {
    await montar('timeline', {
      funnels: [{ id: 'f1', name: 'Comercial', isDefault: true }],
      statuses: [{ id: 's1', funnelId: 'f1', name: 'Novo', order: 0 }, { id: 's2', funnelId: 'f1', name: 'Contato', order: 1 }],
    });
    await clicar(botao('Agendar'));
    expect(document.activeElement.textContent).toBe('O que você quer agendar?');
    await clicar(botao('Cancelar'));
    expect(document.activeElement).toBe(botao('Registrar o que aconteceu com Lucas'));

    await clicar(botao('Mudar fase'));
    expect(document.activeElement.textContent).toBe('Nova fase');
    await clicar(botao('Cancelar'));

    await clicar(botao('Registrar o que aconteceu com Lucas'));
    await digitar('Vai pensar');
    await act(async () => { caixa().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
    expect(caixa()).toBeNull();
    expect(document.activeElement).toBe(botao('Registrar o que aconteceu com Lucas'));
  });
});

// Cada modo do compositor grava pelo gravador da ficha, com o que a pessoa
// escolheu ou escreveu, e o compositor fecha depois de gravar.
describe('o compositor grava pela ficha', () => {
  const comeca = (prefixo) => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.replace(/^\d+/, '').trim().startsWith(prefixo)) || null;
  const linhaFechada = () => botao('Registrar o que aconteceu com Lucas');
  // O cabeçalho da ficha também tem um botão WhatsApp: o do compositor mora na seção dele.
  const modo = (texto) => [...document.querySelectorAll('section[aria-label="Registrar"] button')].find((b) => b.textContent.trim() === texto);
  let abrirJanela;
  beforeEach(() => {
    abrirJanela = vi.spyOn(window, 'open').mockImplementation(() => null);
    // Quarta, 10h: o primeiro dia do Agendar é "Hoje", às 18h.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 10, 0));
  });
  afterEach(() => {
    abrirJanela.mockRestore();
    vi.useRealTimers();
  });

  it('Anotação: grava "Obs: texto." e fecha', async () => {
    await montar();
    await clicar(linhaFechada());
    await digitar('Vai pensar');
    await clicar(botao('Registrar anotação'));
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(logInteraction.mock.calls[0][3]).toEqual({ text: 'Obs: Vai pensar.', type: 'note' });
    expect(caixa()).toBeNull();
    expect(linhaFechada()).not.toBeNull();
  });

  it('WhatsApp: abre o WhatsApp do lead com o texto e registra o envio', async () => {
    await montar();
    await clicar(modo('WhatsApp'));
    await digitar('Oi, Lucas');
    await clicar(botao('Enviar pelo WhatsApp'));
    expect(abrirJanela).toHaveBeenCalledWith('https://wa.me/5511988887777?text=Oi%2C%20Lucas', '_blank', 'noopener,noreferrer');
    expect(logInteraction.mock.calls[0][3]).toEqual({ text: '📲 Mensagem WhatsApp enviada: Oi, Lucas', type: 'note' });
    expect(caixa()).toBeNull();
  });

  it('WhatsApp de um menor: a mensagem vai para o responsável', async () => {
    const menor = { ...LEAD, isMinor: true, guardian: { name: 'Marina Prado', phone: '11977776666', relationship: 'Mãe' } };
    await montar('timeline', { lead: menor });
    await clicar(modo('WhatsApp'));
    expect(caixa().getAttribute('placeholder')).toBe('Mensagem para Marina');
    await digitar('Oi, Marina');
    await clicar(botao('Enviar pelo WhatsApp'));
    expect(abrirJanela).toHaveBeenCalledWith('https://wa.me/5511977776666?text=Oi%2C%20Marina', '_blank', 'noopener,noreferrer');
    expect(logInteraction.mock.calls[0][3].text).toBe('📲 Mensagem WhatsApp enviada: Oi, Marina');
  });

  it('Agendar: do tipo até o Confirmar, grava o agendamento e fecha', async () => {
    await montar();
    await clicar(botao('Agendar'));
    await clicar(comeca('Mensagem'));
    await clicar(comeca('Hoje'));
    await clicar(botao('Confirmar agendamento'));
    expect(logInteraction).toHaveBeenCalledTimes(1);
    const [, , , payload, patch] = logInteraction.mock.calls[0];
    expect(payload.text).toMatch(/^🔔 Mensagem agendada p\/ 21\/10\/2026.*18:00\.$/);
    expect(payload).toMatchObject({ type: 'note', volumeKind: 'mensagem' });
    expect(patch.nextFollowUp.getHours()).toBe(18);
    expect(document.body.textContent).not.toContain('Passos do agendamento');
    expect(linhaFechada()).not.toBeNull();
  });

  it('Mudar fase: da fase até o Mover, grava a mudança e fecha', async () => {
    await montar('timeline', {
      funnels: [{ id: 'f1', name: 'Comercial', isDefault: true }],
      statuses: [{ id: 's1', funnelId: 'f1', name: 'Novo', order: 0 }, { id: 's2', funnelId: 'f1', name: 'Contato', order: 1 }],
    });
    await clicar(botao('Mudar fase'));
    await clicar(comeca('Contato'));
    await clicar(botao('Mover para Contato'));
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(logInteraction.mock.calls[0][3]).toMatchObject({ text: 'Fase alterada para [Contato].', type: 'status_change' });
    expect(logInteraction.mock.calls[0][4]).toMatchObject({ status: 'Contato' });
    expect(linhaFechada()).not.toBeNull();
  });
});
