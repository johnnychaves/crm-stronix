// @vitest-environment jsdom
// A prova do Stronizap no bloco Agora (Parte B, PR 3, desenho A). Com a linha
// de uma pessoa da equipe hoje (zapProofToday, de computeDailyGoalSlots), a
// faixa verde troca a pergunta "Conversou com…?" e o Concluir (C) vira a ação
// principal. Sem prova, o Agora é o de hoje. O cenário é sexta, 16/10/2026,
// 14:32, como no metaFocoView.test.js.
import { act, createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O menu "Mais" (Radix) mede o gatilho, e o jsdom não tem ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
}));

const { MetaFocoScreen } = await import('../../components/dailygoal/foco/MetaFocoScreen.jsx');

const at = (h_, m = 0, dias = 0) => new Date(2026, 9, 16 + dias, h_, m);
const NOW = at(14, 32);
const lead = (id, name, slug, extra = {}) => ({ id, name, whatsapp: '51999990000', categorySlugs: [slug], categoryStatus: {}, ...extra });
const linhaEquipe = (extra = {}) => ({
  id: 'zap-c-2026-10-16-equipe', leadId: 'c', type: 'zap_signal', signal: 'pessoa_enviou', answering: true,
  actorId: 'eu', actorAuthUid: 'auth-eu', consultantName: 'Júlia Lima', via: 'stronizap', createdAt: at(14, 10), ...extra,
});
const CONTATO = lead('c', 'Carla Contato', 'contato_hoje', { nextFollowUp: at(18, 0), nextFollowUpType: 'Mensagem' });
const VISITA = lead('b', 'Bruno Visita', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(17, 0), appointmentUnit: 'Moinhos' });
const NOVO = lead('n', 'Nina Nova', 'novo_24h', { createdAt: at(15, 20, -1) });
const comProva = (l, extra) => ({ ...l, zapProofToday: linhaEquipe({ leadId: l.id, ...extra }) });

let root, host, handlers;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  handlers = {
    onOutcome: vi.fn(), onReschedule: vi.fn(), onPostpone: vi.fn(),
    onOutcomePopup: vi.fn((_lead, slug) => slug !== 'novo_24h'), onConclude: vi.fn(() => Promise.resolve()),
    onWhatsapp: vi.fn(() => true), onCall: vi.fn(() => true),
  };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'dailyGoal' };

function Harness({ leads, now }) {
  const [foco, setFoco] = useState('all');
  return h(MetaFocoScreen, {
    strip: { greeting: 'Boa tarde', firstName: 'Júlia', todayLabel: 'sexta-feira, 16 de outubro', live: true, now, frozenDay: '', totalSlots: 10, doneSlots: 2, progress: 20, volume: { count: 0, target: 0 }, streak: 0 },
    processedLeads: leads, now, sla: 3, renewalCheckpoints: [90, 60, 30], meId: 'eu',
    foco, onFoco: setFoco,
    totalSlots: 10, doneSlots: 2, volume: { count: 0, target: 0 }, perfectDay: false, tomorrow: null, aside: null,
    ...handlers,
  });
}

function render(props) {
  act(() => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/meta-diaria'] },
      h(LeadProfileContext.Provider, { value: profile }, h(Harness, props))));
  });
}

const agora = () => host.querySelector('article[aria-label^="Agora"]');
const button = (text, scope = host) => [...scope.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const tecla = (key) => act(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
});
const faixa = () => agora()?.querySelector('[role="group"][aria-label="Contato pelo Stronizap"]') || null;
const pergunta = () => agora()?.querySelector('[role="group"][aria-label="Confirmar contato"]') || null;

let estado = 'visible';
beforeEach(() => {
  estado = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
});
afterEach(() => { delete document.visibilityState; });
const mudarAba = (v) => act(() => { estado = v; document.dispatchEvent(new Event('visibilitychange')); });

describe('Meta: a prova do Stronizap no bloco Agora', () => {
  it('com prova, a faixa diz quem respondeu e o Concluir é a ação principal', () => {
    render({ leads: [comProva(CONTATO)], now: NOW });
    expect(faixa().textContent).toContain('Você respondeu às 14:10 pelo Stronizap');
    const concluir = button('Concluir', faixa());
    expect(concluir.getAttribute('aria-keyshortcuts')).toBe('C');
    // Um Concluir só: a fileira de baixo fica com WhatsApp, Ligar e Reagendar.
    expect(agora().querySelectorAll('[aria-keyshortcuts="C"]')).toHaveLength(1);
    expect(button('WhatsApp', agora())).toBeDefined();
    expect(button('Ligar', agora())).toBeDefined();
    expect(button('Reagendar', agora())).toBeDefined();
    expect(agora().textContent).not.toContain('Ver conversa');
    expect(faixa().textContent).not.toMatch(/[—–]/);
    click(concluir);
    expect(handlers.onOutcomePopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 'contato_hoje');
  });

  it('a prova de um colega diz o primeiro nome dele', () => {
    render({ leads: [comProva(CONTATO, { actorId: 'ana', actorAuthUid: 'auth-ana', consultantName: 'Ana Souza' })], now: NOW });
    expect(faixa().textContent).toContain('Ana respondeu às 14:10 pelo Stronizap');
  });

  it('C conclui pela faixa', () => {
    render({ leads: [comProva(CONTATO)], now: NOW });
    tecla('c');
    expect(handlers.onOutcomePopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 'contato_hoje');
  });

  it('com prova, a volta do WhatsApp não pergunta', () => {
    render({ leads: [comProva(CONTATO)], now: NOW });
    click(button('WhatsApp', agora()));
    expect(handlers.onWhatsapp).toHaveBeenCalled();
    mudarAba('hidden');
    mudarAba('visible');
    expect(pergunta()).toBeNull();
    expect(faixa()).not.toBeNull();
  });

  it('a prova que chega com a pergunta aberta toma o lugar dela, e o foco vai para o Concluir da faixa', () => {
    render({ leads: [CONTATO], now: NOW });
    click(button('WhatsApp', agora()));
    mudarAba('hidden');
    mudarAba('visible');
    expect(pergunta()).not.toBeNull();
    expect(document.activeElement).toBe(button('Sim, concluir', agora()));
    render({ leads: [comProva(CONTATO)], now: NOW });
    expect(pergunta()).toBeNull();
    expect(document.activeElement).toBe(button('Concluir', faixa()));
  });

  it('a pergunta aberta para um lead não leva o foco ao Concluir de outro lead que chega com prova', () => {
    const DAVI = lead('d', 'Davi Contato', 'contato_hoje', { nextFollowUp: at(18, 30), nextFollowUpType: 'Mensagem' });
    render({ leads: [CONTATO], now: NOW });
    click(button('WhatsApp', agora()));
    mudarAba('hidden');
    mudarAba('visible');
    expect(pergunta()).not.toBeNull();
    // A Carla sai do Agora (concluída em outra aba) e o Davi entra já com prova.
    render({ leads: [comProva(DAVI)], now: NOW });
    expect(agora().querySelector('h2').textContent).toBe('Davi Contato');
    expect(pergunta()).toBeNull();
    expect(document.activeElement).not.toBe(button('Concluir', faixa()));
  });

  describe('o Novo lead com prova conclui pelo caminho de sempre', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
    afterEach(() => { vi.useRealTimers(); });
    const aviso = () => button('Desfazer')?.parentElement || null;
    const nome = () => agora()?.querySelector('h2')?.textContent;

    it('o aviso com Desfazer aparece e a gravação sai depois de 6 segundos', () => {
      render({ leads: [comProva(NOVO), CONTATO], now: NOW });
      click(button('Concluir', faixa()));
      expect(handlers.onOutcomePopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }), 'novo_24h');
      expect(nome()).toBe('Carla Contato');
      expect(aviso().textContent).toContain('Tarefa de Nina Nova concluída.');
      act(() => { vi.advanceTimersByTime(5900); });
      expect(handlers.onConclude).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(100); });
      expect(handlers.onConclude).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }), 'novo_24h', '', { quiet: true });
      expect(aviso()).toBeNull();
    });

    it('Desfazer traz a tarefa de volta ao Agora, sem gravar', () => {
      render({ leads: [comProva(NOVO), CONTATO], now: NOW });
      click(button('Concluir', faixa()));
      click(button('Desfazer'));
      act(() => { vi.advanceTimersByTime(10000); });
      expect(handlers.onConclude).not.toHaveBeenCalled();
      expect(nome()).toBe('Nina Nova');
      expect(aviso()).toBeNull();
    });
  });

  it('visita com linha da equipe continua no desfecho, sem faixa', () => {
    render({ leads: [comProva(VISITA)], now: NOW });
    expect(faixa()).toBeNull();
    expect(button('Compareceu', agora())).toBeDefined();
  });
});

describe('Quem não usa o Stronizap: o Agora fica como hoje', () => {
  it('sem o campo e com o campo null, a tela é a mesma', () => {
    render({ leads: [CONTATO], now: NOW });
    const antes = host.innerHTML;
    render({ leads: [{ ...CONTATO, zapProofToday: null }], now: NOW });
    expect(host.innerHTML).toBe(antes);
    expect(faixa()).toBeNull();
  });

  it('sem prova, a pergunta continua na volta do WhatsApp', () => {
    render({ leads: [{ ...CONTATO, zapProofToday: null }], now: NOW });
    click(button('WhatsApp', agora()));
    mudarAba('hidden');
    mudarAba('visible');
    expect(pergunta().textContent).toContain('Conversou com Carla?');
  });
});
