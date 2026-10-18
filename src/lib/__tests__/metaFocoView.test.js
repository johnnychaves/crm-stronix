// @vitest-environment jsdom
// A tela nova da Meta (Foco agora, mockup B), atrás do ?meta=nova. O que ela
// promete: o Agora fica parado quando o relógio anda, uma linha da fila traz a
// tarefa para o Agora, pular manda para o fim, a barra "Foco em" recorta a
// fila, e os estados do dia aparecem no lugar do Agora. O cenário é sexta,
// 16/10/2026, 14:32, com o prazo de atraso crítico em 3 dias.
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

// Atrasado crítico (classe 2), visita às 17h (classe 3 agora, 1 às 15:45),
// contato às 18h e um atrasado de 1 dia.
const CRITICO = lead('a', 'Ana Critica', 'atrasado', { nextFollowUp: at(9, 0, -5), consultantId: 'eu' });
const VISITA = lead('b', 'Bruno Visita', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(17, 0), appointmentUnit: 'Moinhos' });
const CONTATO = lead('c', 'Carla Contato', 'contato_hoje', { nextFollowUp: at(18, 0), nextFollowUpType: 'Ligação' });
const ATRASO = lead('d', 'Davi Atraso', 'atrasado', { nextFollowUp: at(9, 0, -1), hasOtherActivityToday: true });
const LEADS = [CRITICO, VISITA, CONTATO, ATRASO];

let root, host, handlers;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  handlers = { onOutcome: vi.fn(), onReschedule: vi.fn(), onPostpone: vi.fn(), onGoalDone: vi.fn(), onWhatsapp: vi.fn(), onCall: vi.fn() };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'dailyGoal' };

// A tela com o foco em estado, como o endereço faria.
function Harness({ leads, now, totalSlots = 10, doneSlots = 2, startFoco = 'all', onFocoSpy }) {
  const [foco, setFoco] = useState(startFoco);
  return h(MetaFocoScreen, {
    strip: { greeting: 'Boa tarde', firstName: 'Júlia', todayLabel: 'sexta-feira, 16 de outubro', live: true, now, frozenDay: '', totalSlots, doneSlots, progress: 20, volume: { count: 0, target: 0 }, streak: 0 },
    processedLeads: leads, now, sla: 3, renewalCheckpoints: [90, 60, 30], meId: 'eu',
    foco, onFoco: (v) => { onFocoSpy?.(v); setFoco(v); },
    totalSlots, doneSlots, volume: { count: 0, target: 0 }, perfectDay: false, tomorrow: null, aside: null,
    ...handlers,
  });
}

function render(props) {
  act(() => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/meta-diaria?meta=nova'] },
      h(LeadProfileContext.Provider, { value: profile }, h(Harness, props))));
  });
}

const agora = () => host.querySelector('article[aria-label^="Agora"]');
const agoraName = () => agora()?.querySelector('h2')?.textContent;
const filaNames = () => [...host.querySelectorAll('section[aria-labelledby="meta-fila-titulo"] li button')]
  .map((b) => b.querySelector('.truncate')?.textContent.replace('Fazer agora: ', ''));
const button = (text, scope = host) => [...scope.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('Meta nova: o Agora e a fila', () => {
  it('o Agora é o primeiro da ordem, e a fila vem depois, na ordem', () => {
    render({ leads: LEADS, now: NOW });
    expect(agoraName()).toBe('Ana Critica');
    expect(filaNames()).toEqual(['Bruno Visita', 'Carla Contato', 'Davi Atraso']);
  });

  it('o relógio andando não troca o Agora, mesmo quando outra tarefa passa a vir antes', () => {
    render({ leads: LEADS, now: NOW });
    render({ leads: LEADS, now: at(15, 45) });
    // Às 15:45 a visita das 17h vence em 75 minutos e passa à frente na ordem.
    expect(agoraName()).toBe('Ana Critica');
    expect(filaNames()[0]).toBe('Bruno Visita');
    render({ leads: LEADS, now: at(16, 32) });
    expect(agoraName()).toBe('Ana Critica');
  });

  it('a linha da fila traz a tarefa para o Agora, e "Voltar à ordem sugerida" desfaz', () => {
    render({ leads: LEADS, now: NOW });
    click(button('Carla Contato'));
    expect(agoraName()).toBe('Carla Contato');
    expect(agora().textContent).toContain('Você escolheu esta tarefa.');
    expect(document.activeElement).toBe(agora());
    // Como no teclado: o foco está no botão quando ele é acionado.
    const voltar = button('Voltar à ordem sugerida');
    act(() => voltar.focus());
    click(voltar);
    expect(agoraName()).toBe('Ana Critica');
    expect(agora().textContent).not.toContain('Você escolheu esta tarefa.');
    // O botão some com o clique: o foco vai para o Agora, e não para o body.
    expect(document.activeElement).toBe(agora());
  });

  it('pular manda a tarefa para o fim e traz a seguinte', () => {
    render({ leads: LEADS, now: NOW });
    click(button('Pular por agora'));
    expect(agoraName()).toBe('Bruno Visita');
    expect(filaNames()).toEqual(['Carla Contato', 'Davi Atraso', 'Ana Critica']);
  });

  it('pular vale só no dia: no dia seguinte a tarefa volta ao lugar dela na fila', () => {
    render({ leads: LEADS, now: NOW });
    click(button('Pular por agora'));
    expect(filaNames().at(-1)).toBe('Ana Critica');
    // O Agora continua parado na virada do dia; quem muda é a fila.
    render({ leads: LEADS, now: at(9, 0, 1) });
    expect(agoraName()).toBe('Bruno Visita');
    expect(filaNames().at(-1)).not.toBe('Ana Critica');
  });

  it('o menu Mais fecha quando o Agora troca de lead, e não age no lead seguinte', () => {
    const passou = lead('v1', 'Vera Passou', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(13, 30) });
    render({ leads: [passou, VISITA], now: NOW });
    expect(agoraName()).toBe('Vera Passou');
    const mais = button('Mais', agora());
    act(() => { mais.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    // O desfecho da Vera chega por outra tela, com o menu aberto.
    render({ leads: [{ ...passou, categoryStatus: { visita_hoje: true } }, VISITA], now: NOW });
    expect(agoraName()).toBe('Bruno Visita');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('o painel da aba não é uma parada do Tab sem anel', () => {
    render({ leads: LEADS, now: NOW });
    expect(host.querySelector('[role="tabpanel"]').getAttribute('tabindex')).toBe('-1');
  });

  it('o anel de foco das abas é o sólido, e não o de 50% do primitivo', () => {
    render({ leads: LEADS, now: NOW });
    const cls = host.querySelector('[role="tab"]').className.split(/\s+/);
    expect(cls).toContain('focus-visible:ring-ring');
    expect(cls).toContain('focus-visible:ring-2');
    expect(cls).not.toContain('focus-visible:ring-ring/50');
    expect(cls).not.toContain('focus-visible:ring-[3px]');
  });

  it('o número da aba não perde contraste com opacidade fora da aba escolhida', () => {
    render({ leads: LEADS, now: NOW });
    const inativa = [...host.querySelectorAll('[role="tab"]')].find((t) => t.getAttribute('data-state') === 'inactive');
    const numero = inativa.querySelector('.num');
    expect(numero.className.split(/\s+/).filter((c) => c.startsWith('opacity-'))).toEqual([]);
  });

  it('quando a tarefa do Agora sai da lista, o primeiro da ordem assume', () => {
    render({ leads: LEADS, now: NOW });
    click(button('Carla Contato'));
    const feita = { ...CONTATO, categoryStatus: { contato_hoje: true } };
    render({ leads: [CRITICO, VISITA, feita, ATRASO], now: NOW });
    expect(agoraName()).toBe('Ana Critica');
  });

  it('o nome e o "Abrir ficha" levam à ficha, sem arrastar', () => {
    render({ leads: LEADS, now: NOW });
    const links = [...agora().querySelectorAll('a')];
    expect(links.length).toBe(2);
    for (const a of links) {
      expect(a.getAttribute('href')).toBe('/acad/ficha/a');
      expect(a.getAttribute('draggable')).toBe('false');
    }
    // A linha da fila é botão, nunca link.
    expect(host.querySelector('section[aria-labelledby="meta-fila-titulo"] a')).toBeNull();
  });

  it('a fila mostra a marca de quem já foi contatado hoje', () => {
    render({ leads: LEADS, now: NOW });
    expect(button('Davi Atraso').textContent).toContain('Já interagido. Feche pela Meta');
  });
});

describe('Meta nova: as ações do Agora', () => {
  it('a visita tem Compareceu e Não compareceu antes da hora, sem WhatsApp', () => {
    render({ leads: [VISITA], now: NOW });
    expect(button('WhatsApp', agora())).toBeUndefined();
    click(button('Compareceu', agora()));
    expect(handlers.onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), 'attended', 'visita_hoje');
    click(button('Não compareceu', agora()));
    expect(handlers.onOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), 'no_show', 'visita_hoje');
  });

  it('a visita que passou da hora mantém o WhatsApp', () => {
    render({ leads: [VISITA], now: at(17, 20) });
    expect(button('WhatsApp', agora())).toBeDefined();
  });

  it('o contato por ligação tem Ligar como ação principal e Concluir', () => {
    render({ leads: [CONTATO], now: NOW });
    const acoes = [...agora().querySelectorAll('button')].map((b) => b.textContent.trim());
    expect(acoes.indexOf('Ligar')).toBeLessThan(acoes.indexOf('WhatsApp'));
    click(button('Concluir', agora()));
    expect(handlers.onGoalDone).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 'contato_hoje', '');
  });

  it('as tarefas que não são visita nem aula têm o Reagendar do card de hoje', () => {
    const novo = lead('n', 'Nina Nova', 'novo_24h', { createdAt: at(15, 20, -1) });
    render({ leads: [novo], now: NOW });
    click(button('Reagendar', agora()));
    expect(handlers.onPostpone).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }), 'novo_24h');
    render({ leads: [VISITA], now: NOW });
    expect(button('Reagendar', agora())).toBeUndefined();
  });
});

describe('Meta nova: Foco em e os estados do dia', () => {
  it('a aba recorta o Agora e a fila', () => {
    const spy = vi.fn();
    render({ leads: LEADS, now: NOW, onFocoSpy: spy });
    const tab = [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent.startsWith('Atrasados'));
    act(() => { tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
    expect(spy).toHaveBeenCalledWith('atrasado');
    expect(agoraName()).toBe('Ana Critica');
    expect(filaNames()).toEqual(['Davi Atraso']);
  });

  it('trocar de foco põe no Agora o primeiro do foco novo', () => {
    render({ leads: LEADS, now: NOW, startFoco: 'contato_hoje' });
    expect(agoraName()).toBe('Carla Contato');
  });

  it('foco sem nada pendente diz isso e volta para Todos', () => {
    render({ leads: LEADS, now: NOW, startFoco: 'renovacao' });
    expect(host.textContent).toContain('Nada pendente em renovações');
    const todos = button('Ver todos');
    act(() => todos.focus());
    click(todos);
    expect(agoraName()).toBe('Ana Critica');
    expect(document.activeElement).toBe(agora());
  });

  it('meta vazia e dia fechado', () => {
    render({ leads: [], now: NOW, totalSlots: 0, doneSlots: 0 });
    expect(host.textContent).toContain('Sua meta está vazia hoje');
    render({ leads: [{ ...CONTATO, categoryStatus: { contato_hoje: true } }], now: NOW, totalSlots: 1, doneSlots: 1 });
    expect(host.textContent).toContain('Tudo feito por hoje');
    expect(agora()).toBeNull();
  });

  it('de manhã, antes da primeira tarefa feita, diz quantas o dia tem', () => {
    render({ leads: LEADS, now: NOW, doneSlots: 0 });
    expect(host.textContent).toContain('Você começa o dia com 4 tarefas, 2 com horário.');
  });
});
