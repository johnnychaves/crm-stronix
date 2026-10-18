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
  // O pop-up de desfecho existe para toda categoria, menos o Novo lead.
  handlers = {
    onOutcome: vi.fn(), onReschedule: vi.fn(), onPostpone: vi.fn(),
    onOutcomePopup: vi.fn((_lead, slug) => slug !== 'novo_24h'), onConclude: vi.fn(() => Promise.resolve()),
    onWhatsapp: vi.fn(), onCall: vi.fn(),
  };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'dailyGoal' };

// A tela com o foco em estado, como o endereço faria.
function Harness({ leads, now, totalSlots = 10, doneSlots = 2, startFoco = 'all', onFocoSpy, live = true }) {
  const [foco, setFoco] = useState(startFoco);
  return h(MetaFocoScreen, {
    strip: { greeting: 'Boa tarde', firstName: 'Júlia', todayLabel: 'sexta-feira, 16 de outubro', live, now, frozenDay: '', totalSlots, doneSlots, progress: 20, volume: { count: 0, target: 0 }, streak: 0 },
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
// O texto do botão sem a tecla do atalho (o <kbd>).
const label = (b) => [...b.childNodes].filter((n) => n.nodeName !== 'KBD').map((n) => n.textContent).join('').trim();
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
    const acoes = [...agora().querySelectorAll('button')].map(label);
    expect(acoes.indexOf('Ligar')).toBeLessThan(acoes.indexOf('WhatsApp'));
    click(button('Concluir', agora()));
    expect(handlers.onOutcomePopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 'contato_hoje');
    // O contato conclui pelo pop-up: nada é gravado e nada fica para desfazer.
    expect(handlers.onConclude).not.toHaveBeenCalled();
    expect(button('Desfazer')).toBeUndefined();
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

// A faixa de urgência, os atalhos, a pergunta de volta e o Concluir com
// Desfazer (PR 4 do plano da Meta).
const faixa = () => button('Ir agora')?.closest('div.rounded-2xl') || null;
const tecla = (key, extra = {}) => act(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
});
const NOVO = lead('n', 'Nina Nova', 'novo_24h', { createdAt: at(15, 20, -1) });

describe('Meta nova: a faixa de urgência', () => {
  it('avisa quando algo fica mais urgente que o Agora, sem trocar o Agora', () => {
    render({ leads: LEADS, now: NOW });
    expect(faixa()).toBeNull();
    // Às 15:45 a visita das 17h vence em 75 minutos e o Agora é um atrasado.
    render({ leads: LEADS, now: at(15, 45) });
    expect(agoraName()).toBe('Ana Critica');
    expect(faixa().textContent).toContain('Bruno chega em 1h15');
    // A região viva diz quem e o quê, sem os minutos que mudam.
    expect(host.textContent).toContain('Mais urgente que o Agora: Bruno Visita, Visita');
  });

  it('"Ir agora" leva a tarefa para o Agora e o foco junto, e a faixa some', () => {
    render({ leads: LEADS, now: NOW });
    render({ leads: LEADS, now: at(15, 45) });
    const ir = button('Ir agora');
    act(() => ir.focus());
    click(ir);
    expect(agoraName()).toBe('Bruno Visita');
    expect(faixa()).toBeNull();
    expect(document.activeElement).toBe(agora());
  });

  it('"Agora não" esconde a faixa até a tarefa mudar de urgência', () => {
    render({ leads: LEADS, now: NOW });
    render({ leads: LEADS, now: at(15, 45) });
    click(button('Agora não'));
    expect(faixa()).toBeNull();
    render({ leads: LEADS, now: at(16, 0) });
    expect(faixa()).toBeNull();
    // Às 16:30 o contato das 18h entra nos 90 minutos: é outra tarefa, e a faixa
    // avisa dela.
    render({ leads: LEADS, now: at(16, 30) });
    expect(faixa().textContent).toContain('Ligação para Carla em 1h30');
    click(button('Agora não'));
    // Às 17:20 a visita passou da hora sem desfecho: a faixa volta, vermelha.
    render({ leads: LEADS, now: at(17, 20) });
    expect(faixa().textContent).toContain('Bruno passou do horário há 20 min, sem desfecho');
    expect(faixa().className).toContain('bg-rose-50');
  });

  it('não avisa quando o Agora já é tão urgente quanto', () => {
    const outra = lead('b2', 'Beto Visita', 'visita_hoje', { appointmentType: 'visita', appointmentScheduledFor: at(16, 0) });
    render({ leads: [VISITA, outra], now: at(15, 45) });
    expect(agoraName()).toBe('Beto Visita');
    expect(faixa()).toBeNull();
  });

  it('na volta da pausa por inatividade, espera 3 segundos antes de avisar', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render({ leads: LEADS, now: NOW, live: false });
      render({ leads: LEADS, now: at(15, 45), live: true });
      expect(faixa()).toBeNull();
      act(() => { vi.advanceTimersByTime(2900); });
      expect(faixa()).toBeNull();
      act(() => { vi.advanceTimersByTime(100); });
      expect(faixa()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Meta nova: os atalhos do Agora', () => {
  it('no contato: W abre o WhatsApp, L liga, C conclui e S pula', () => {
    render({ leads: [CONTATO, ATRASO], now: NOW });
    tecla('w');
    expect(handlers.onWhatsapp).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
    tecla('L');
    expect(handlers.onCall).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
    tecla('c');
    expect(handlers.onOutcomePopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 'contato_hoje');
    tecla('n');
    expect(handlers.onOutcome).not.toHaveBeenCalled();
    tecla('s');
    expect(agoraName()).toBe('Davi Atraso');
  });

  it('na visita: C marca Compareceu e N, Não compareceu; L e W não fazem nada antes da hora', () => {
    render({ leads: [VISITA], now: NOW });
    tecla('l');
    tecla('w');
    expect(handlers.onCall).not.toHaveBeenCalled();
    expect(handlers.onWhatsapp).not.toHaveBeenCalled();
    tecla('c');
    expect(handlers.onOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), 'attended', 'visita_hoje');
    tecla('n');
    expect(handlers.onOutcome).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'b' }), 'no_show', 'visita_hoje');
  });

  it('a visita que passou da hora aceita o W', () => {
    render({ leads: [VISITA], now: at(17, 20) });
    tecla('w');
    expect(handlers.onWhatsapp).toHaveBeenCalledTimes(1);
  });

  it('ficam calados com janela aberta, num campo de texto, com Ctrl ou Cmd e com a tecla segurada', () => {
    render({ leads: [CONTATO], now: NOW });
    const janela = document.createElement('div');
    janela.setAttribute('role', 'dialog');
    document.body.appendChild(janela);
    tecla('w');
    janela.remove();
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    act(() => { campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })); });
    campo.remove();
    tecla('w', { ctrlKey: true });
    tecla('w', { metaKey: true });
    tecla('w', { repeat: true });
    expect(handlers.onWhatsapp).not.toHaveBeenCalled();
    tecla('w');
    expect(handlers.onWhatsapp).toHaveBeenCalledTimes(1);
  });

  it('os botões dizem a tecla para o leitor de tela', () => {
    render({ leads: [CONTATO], now: NOW });
    expect(button('Ligar', agora()).getAttribute('aria-keyshortcuts')).toBe('L');
    expect(button('Concluir', agora()).getAttribute('aria-keyshortcuts')).toBe('C');
    expect(button('Pular por agora', agora()).getAttribute('aria-keyshortcuts')).toBe('S');
  });
});

describe('Meta nova: a pergunta na volta do contato', () => {
  let estado = 'visible';
  beforeEach(() => {
    estado = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  });
  afterEach(() => { delete document.visibilityState; });
  const mudarAba = (v) => act(() => { estado = v; document.dispatchEvent(new Event('visibilitychange')); });
  const pergunta = () => agora()?.querySelector('[role="group"][aria-label="Confirmar contato"]') || null;

  it('depois do WhatsApp, pergunta quando a aba volta', () => {
    render({ leads: [NOVO], now: NOW });
    click(button('WhatsApp', agora()));
    expect(pergunta()).toBeNull();
    mudarAba('hidden');
    expect(pergunta()).toBeNull();
    mudarAba('visible');
    expect(pergunta().textContent).toContain('Conversou com Nina?');
    // As ações saem, e o foco vai para o "Sim".
    expect(button('Reagendar', agora())).toBeUndefined();
    expect(document.activeElement).toBe(button('Sim, concluir', agora()));
  });

  it('depois do WhatsApp, a janela voltando a ter o foco também conta', () => {
    render({ leads: [NOVO], now: NOW });
    click(button('WhatsApp', agora()));
    act(() => { window.dispatchEvent(new Event('blur')); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(pergunta()).not.toBeNull();
  });

  it('depois da ligação, pergunta 1,5 segundo depois do clique', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render({ leads: [CONTATO], now: NOW });
      click(button('Ligar', agora()));
      act(() => { vi.advanceTimersByTime(1400); });
      expect(pergunta()).toBeNull();
      act(() => { vi.advanceTimersByTime(100); });
      expect(pergunta().textContent).toContain('Conversou com Carla?');
    } finally {
      vi.useRealTimers();
    }
  });

  it('"Sim" conclui pelo caminho de sempre, e C também', () => {
    render({ leads: [CONTATO], now: NOW });
    click(button('WhatsApp', agora()));
    mudarAba('hidden');
    mudarAba('visible');
    tecla('c');
    expect(handlers.onOutcomePopup).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 'contato_hoje');
    expect(pergunta()).toBeNull();
  });

  it('"Ainda não" devolve as ações, com o foco no Agora', () => {
    render({ leads: [CONTATO], now: NOW });
    click(button('WhatsApp', agora()));
    mudarAba('hidden');
    mudarAba('visible');
    const nao = button('Ainda não', agora());
    act(() => nao.focus());
    click(nao);
    expect(pergunta()).toBeNull();
    expect(button('Concluir', agora())).toBeDefined();
    expect(document.activeElement).toBe(agora());
  });

  it('a visita que passou da hora não pergunta: o próximo passo é o desfecho', () => {
    render({ leads: [VISITA], now: at(17, 20) });
    click(button('WhatsApp', agora()));
    mudarAba('hidden');
    mudarAba('visible');
    expect(pergunta()).toBeNull();
  });

  it('a pergunta não passa para outra tarefa', () => {
    render({ leads: [CONTATO, ATRASO], now: NOW });
    click(button('WhatsApp', agora()));
    click(button('Pular por agora'));
    mudarAba('hidden');
    mudarAba('visible');
    expect(agoraName()).toBe('Davi Atraso');
    expect(pergunta()).toBeNull();
  });
});

describe('Meta nova: Concluir com Desfazer', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
  afterEach(() => { vi.useRealTimers(); });
  const aviso = () => button('Desfazer')?.parentElement || null;

  it('o Novo lead sai na hora, sem a caixa do navegador, e grava depois de 6 segundos', () => {
    const confirmar = vi.spyOn(window, 'confirm');
    render({ leads: [NOVO, CONTATO], now: NOW });
    expect(agoraName()).toBe('Nina Nova');
    click(button('Concluir', agora()));
    expect(confirmar).not.toHaveBeenCalled();
    expect(agoraName()).toBe('Carla Contato');
    expect(document.activeElement).toBe(agora());
    expect(aviso().textContent).toContain('Tarefa de Nina Nova concluída.');
    act(() => { vi.advanceTimersByTime(5900); });
    expect(handlers.onConclude).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(100); });
    expect(handlers.onConclude).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }), 'novo_24h', '', { quiet: true });
    expect(aviso()).toBeNull();
    confirmar.mockRestore();
  });

  it('Desfazer não grava e devolve a tarefa ao Agora', () => {
    render({ leads: [NOVO, CONTATO], now: NOW });
    click(button('Concluir', agora()));
    click(button('Desfazer'));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(handlers.onConclude).not.toHaveBeenCalled();
    expect(agoraName()).toBe('Nina Nova');
    expect(document.activeElement).toBe(agora());
    expect(aviso()).toBeNull();
  });

  it('fechar a aba dentro do prazo grava na hora', () => {
    render({ leads: [NOVO], now: NOW });
    click(button('Concluir', agora()));
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(handlers.onConclude).toHaveBeenCalledTimes(1);
  });

  it('sair da tela dentro do prazo grava na hora', () => {
    render({ leads: [NOVO], now: NOW });
    click(button('Concluir', agora()));
    act(() => root.unmount());
    expect(handlers.onConclude).toHaveBeenCalledTimes(1);
    root = createRoot(host);
  });

  it('concluir outra tarefa grava a anterior, e fica um aviso só', () => {
    const outro = lead('m', 'Mara Nova', 'novo_24h', { createdAt: at(16, 0, -1) });
    render({ leads: [NOVO, outro], now: NOW });
    click(button('Concluir', agora()));
    click(button('Concluir', agora()));
    expect(handlers.onConclude).toHaveBeenCalledTimes(1);
    expect(handlers.onConclude).toHaveBeenCalledWith(expect.objectContaining({ id: 'n' }), 'novo_24h', '', { quiet: true });
    expect(host.querySelectorAll('button').length).toBeGreaterThan(0);
    expect([...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Desfazer'))).toHaveLength(1);
    expect(aviso().textContent).toContain('Mara Nova');
  });

  it('a tarefa continua fora da fila enquanto a gravação não termina, e volta se ela falhar', async () => {
    let terminar;
    handlers.onConclude = vi.fn(() => new Promise((r) => { terminar = r; }));
    render({ leads: [NOVO, CONTATO], now: NOW });
    click(button('Concluir', agora()));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(handlers.onConclude).toHaveBeenCalledTimes(1);
    expect(filaNames()).not.toContain('Nina Nova');
    // A marca do dia não chegou (a gravação falhou): a tarefa volta para a fila.
    await act(async () => { terminar(); });
    expect(filaNames()).toContain('Nina Nova');
  });
});
