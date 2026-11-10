// @vitest-environment jsdom
// A espera ("Respondeu, aguardando você") na tela da Meta (PR 4 da Parte B):
// a linha na fila "Depois", a aba e a regra que só aparecem com espera, a Meta
// vazia que não esconde a espera, o Agora sem Concluir nem Reagendar, e a
// faixa de urgência laranja. Sem marca, a tela é a de hoje. O cenário é o do
// metaFocoView.test.js: sexta, 16/10/2026, 14:32, com o atraso crítico em 3
// dias. As esperas têm 42 minutos, dentro da faixa das 8h às 21h de Brasília
// em qualquer fuso brasileiro e em UTC.
import { act, createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';
import { awaitingEntriesOf } from '../metaEspera.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', DAILY_GOAL_HISTORY_PATH: 'hist', db: {}, auth: {}, storage: {},
}));

const { MetaFocoScreen } = await import('../../components/dailygoal/foco/MetaFocoScreen.jsx');

const at = (h_, m = 0, dias = 0) => new Date(2026, 9, 16 + dias, h_, m);
const NOW = at(14, 32);
const MIN = 60 * 1000;
const lead = (id, name, slug, extra = {}) => ({ id, name, whatsapp: '51999990000', categorySlugs: [slug], categoryStatus: {}, ...extra });

const CRITICO = lead('a', 'Ana Critica', 'atrasado', { nextFollowUp: at(9, 0, -5), consultantId: 'eu' });
const VISITA = lead('b', 'Bruno Visita', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(17, 0), appointmentUnit: 'Moinhos' });
const CONTATO = lead('c', 'Carla Contato', 'contato_hoje', { nextFollowUp: at(18, 0), nextFollowUpType: 'Ligação' });
const ATRASO = lead('d', 'Davi Atraso', 'atrasado', { nextFollowUp: at(9, 0, -1), hasOtherActivityToday: true });
const LEADS = [CRITICO, VISITA, CONTATO, ATRASO];
// Quem escreveu: lead sem tarefa da meta, dono 'eu'.
const BRUNA = { id: 'e', name: 'Bruna Espera', whatsapp: '51999990001', consultantId: 'eu', source: 'Instagram',
  awaitingReplySince: new Date(NOW.getTime() - 42 * MIN), awaitingReplyPreview: 'Oi, ainda tem vaga às 19h?' };
const esperasDe = (leads, now = NOW) => awaitingEntriesOf(leads, 'eu', now);

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

function Harness({ leads, esperas, now, totalSlots = 10, doneSlots = 2, startFoco = 'all' }) {
  const [foco, setFoco] = useState(startFoco);
  return h(MetaFocoScreen, {
    strip: { greeting: 'Boa tarde', firstName: 'Júlia', todayLabel: 'sexta-feira, 16 de outubro', live: true, now, frozenDay: '', totalSlots, doneSlots, progress: 20, volume: { count: 0, target: 0 }, streak: 0 },
    processedLeads: leads, esperas, now, sla: 3, renewalCheckpoints: [90, 60, 30], meId: 'eu',
    foco, onFoco: setFoco,
    totalSlots, doneSlots, volume: { count: 0, target: 0 }, perfectDay: false, tomorrow: null, aside: null,
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
const agoraName = () => agora()?.querySelector('h2')?.textContent;
const fila = () => host.querySelector('section[aria-labelledby="meta-fila-titulo"]');
const filaNames = () => [...fila().querySelectorAll('li button')]
  .map((b) => b.querySelector('.truncate')?.textContent.replace('Fazer agora: ', ''));
const button = (text, scope = host) => [...scope.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const tabLabels = () => [...host.querySelectorAll('[role="tab"]')].map((t) => t.getAttribute('aria-label'));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const faixa = () => button('Ir agora')?.closest('div.rounded-2xl') || null;
const tecla = (key) => act(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
});

describe('sem marca, a tela é a de hoje', () => {
  it('nenhuma aba, regra, linha ou faixa nova', () => {
    const esperas = esperasDe(LEADS);
    expect(esperas).toEqual([]);
    render({ leads: LEADS, esperas, now: NOW });
    expect(agoraName()).toBe('Ana Critica');
    expect(filaNames()).toEqual(['Bruno Visita', 'Carla Contato', 'Davi Atraso']);
    expect(tabLabels()).toHaveLength(7);
    expect(host.textContent).not.toContain('Aguardando você');
    expect(host.textContent).not.toContain('espera resposta');
    expect(faixa()).toBeNull();
  });

  it('sem a prop esperas, também', () => {
    render({ leads: LEADS, now: NOW });
    expect(filaNames()).toEqual(['Bruno Visita', 'Carla Contato', 'Davi Atraso']);
  });
});

describe('a espera na fila', () => {
  it('entra depois dos atrasados, com o tempo e o trecho', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    expect(filaNames()).toEqual(['Bruno Visita', 'Carla Contato', 'Davi Atraso', 'Bruna Espera']);
    const linha = button('Bruna Espera', fila());
    expect(linha.textContent).toContain('Esperando há 42 min');
    expect(linha.textContent).toContain('Respondeu, aguardando você · “Oi, ainda tem vaga às 19h?”');
  });

  it('a aba e a regra aparecem só com espera', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    expect(tabLabels()).toHaveLength(8);
    expect(tabLabels()).toContain('Aguardando você: 1 pendentes. Esperando há 42 min');
    expect(fila().textContent).toContain('Quem escreveu e espera resposta, do mais antigo');
  });

  it('a Meta vazia não esconde a espera', () => {
    render({ leads: [], esperas: esperasDe([BRUNA]), now: NOW, totalSlots: 0, doneSlots: 0 });
    expect(host.textContent).not.toContain('Sua meta está vazia hoje');
    expect(agoraName()).toBe('Bruna Espera');
  });

  it('a linha da manhã conta só as tarefas da meta', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW, doneSlots: 0 });
    expect(host.textContent).toContain('Você começa o dia com 4 tarefas, 2 com horário.');
  });
});

describe('a ligação na DailyGoalView', () => {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const VIEW = readFileSync(join(aqui, '../../views/DailyGoalView.jsx'), 'utf8');

  it('calcula as esperas só para quem vende e passa à tela', () => {
    expect(VIEW).toContain('isSeller(appUser) ? awaitingEntriesOf(leads, appUser.id, now) : NO_ESPERAS');
    expect(VIEW).toContain('esperas={esperas}');
  });
});

describe('a espera no Agora', () => {
  const trazerBruna = () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    click(button('Bruna Espera', fila()));
    expect(agoraName()).toBe('Bruna Espera');
  };

  it('mostra o motivo, o trecho e o que fazer, sem Concluir, Reagendar, WhatsApp nem Ligar', () => {
    trazerBruna();
    const card = agora();
    expect(card.textContent).toContain('Esperando há 42 min');
    expect(card.textContent).toContain('Respondeu, aguardando você');
    expect(card.textContent).toContain('“Oi, ainda tem vaga às 19h?”');
    expect(card.textContent).toContain('Responda pelo Stronizap. A tarefa sai daqui quando a resposta chega.');
    ['Concluir', 'Reagendar', 'WhatsApp', 'Ligar'].forEach((b) => expect(button(b, card), b).toBeUndefined());
    expect(button('Pular por agora', card)).toBeTruthy();
    expect(card.textContent).toContain('Abrir ficha');
  });

  it('os atalhos W, L, C e N ficam mudos, e S pula', () => {
    trazerBruna();
    tecla('w');
    tecla('l');
    tecla('c');
    tecla('n');
    expect(handlers.onWhatsapp).not.toHaveBeenCalled();
    expect(handlers.onCall).not.toHaveBeenCalled();
    expect(handlers.onOutcomePopup).not.toHaveBeenCalled();
    expect(handlers.onConclude).not.toHaveBeenCalled();
    expect(handlers.onOutcome).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Conversou com');
    tecla('s');
    expect(agoraName()).not.toBe('Bruna Espera');
  });
});

describe('a faixa da espera', () => {
  it('com 42 minutos avisa em laranja, sem trocar o Agora', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    expect(agoraName()).toBe('Ana Critica');
    expect(faixa().textContent).toContain('Bruna escreveu há 42 min e ninguém respondeu');
    expect(faixa().className).toContain('bg-accent-50');
    expect(faixa().className).not.toContain('bg-rose-50');
    expect(host.textContent).toContain('Mais urgente que o Agora: Bruna Espera, Respondeu, aguardando você');
  });

  it('com 29 minutos ainda não', () => {
    const cedo = { ...BRUNA, awaitingReplySince: new Date(NOW.getTime() - 29 * MIN) };
    render({ leads: LEADS, esperas: esperasDe([cedo]), now: NOW });
    expect(faixa()).toBeNull();
  });

  it('"Ir agora" traz a espera para o Agora', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    click(button('Ir agora'));
    expect(agoraName()).toBe('Bruna Espera');
    expect(faixa()).toBeNull();
  });

  it('"Agora não" esconde, e a espera nova do mesmo lead volta a avisar', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    click(button('Agora não'));
    expect(faixa()).toBeNull();
    render({ leads: LEADS, esperas: esperasDe([BRUNA], at(14, 40)), now: at(14, 40) });
    expect(faixa()).toBeNull();
    // A Bruna foi respondida e escreveu de novo às 14:00: marca nova.
    const deNovo = { ...BRUNA, awaitingReplySince: at(14, 0) };
    render({ leads: LEADS, esperas: esperasDe([deNovo], at(14, 40)), now: at(14, 40) });
    expect(faixa().textContent).toContain('Bruna escreveu há 40 min e ninguém respondeu');
  });

  it('com o "Foco em" em Atrasados, não avisa', () => {
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW, startFoco: 'atrasado' });
    expect(faixa()).toBeNull();
  });

  it('a faixa de sempre vem antes da da espera', () => {
    // O Agora é a Ana desde as 14:32, com a faixa da espera. Às 15:45 a visita
    // das 17h vence em 75 minutos e a faixa de sempre toma o lugar. Montar
    // direto às 15:45 poria a visita no Agora, e aí não haveria faixa.
    render({ leads: LEADS, esperas: esperasDe([BRUNA]), now: NOW });
    expect(faixa().textContent).toContain('Bruna escreveu');
    render({ leads: LEADS, esperas: esperasDe([BRUNA], at(15, 45)), now: at(15, 45) });
    expect(agoraName()).toBe('Ana Critica');
    expect(faixa().textContent).toContain('Bruno chega em 1h15');
  });
});
