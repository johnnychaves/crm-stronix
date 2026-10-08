// @vitest-environment jsdom
// As abas Modelos e Hoje da tela Rotinas moram no endereço (spec 2026-10-06,
// "Menu e endereço"): /<academia>/rotinas é Modelos, /<academia>/rotinas/hoje é
// Hoje, e trocar de aba troca o endereço com replace, como o goToSub do App. A
// aba Hoje só lê os checks com ela aberta, e o link do modelo no cartão da
// pessoa abre o modelo com o Voltar de volta para a Hoje.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ models: [], loading: false, marksArgs: null }));
vi.mock('../../hooks/useRoutineModels.js', () => ({
  useRoutineModels: () => ({ models: s.models, loading: s.loading, error: false }),
}));
vi.mock('../../hooks/useTeamRoutineMarks.js', () => ({
  useTeamRoutineMarks: (args) => {
    s.marksArgs = args;
    return { marks: new Map(), loading: false, error: false };
  },
}));
vi.mock('../firebase.js', () => ({
  appId: 'acad',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
  db: {},
  auth: {},
}));
vi.mock('../rotinasWrites.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createModel: vi.fn(),
  duplicateModel: vi.fn(),
  deleteModel: vi.fn(),
  updateModel: vi.fn(),
  setPersonModel: vi.fn(),
}));
// O MemoryRouter não grava o idx no window.history: quem diz se dá para voltar
// dentro do app é o teste.
vi.mock('../routes.js', async (importOriginal) => ({
  ...(await importOriginal()),
  canGoBackInApp: vi.fn(() => true),
}));

const { hrefFor } = await import('../routes.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { RotinasView } = await import('../../views/RotinasView.jsx');

// No jsdom o new URL relativo não é file:, então o caminho sai do import.meta.url como texto.
const APP = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../App.jsx'), 'utf8');
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'g1', authUid: 'g1', name: 'Bruno Gestor', role: 'admin' };
const EQUIPE = [
  GESTOR,
  { id: 'carla', authUid: 'carla', name: 'Carla Souza', role: 'consultant' },
  { id: 'diego', authUid: 'diego', name: 'Diego Lima', role: 'consultant' },
];
const M1 = {
  id: 'm1',
  name: 'Manhã',
  followerIds: ['carla'],
  tasks: [{ id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true }],
};
const LIST = '/acad/rotinas';
const HOJE = '/acad/rotinas/hoje';

const nav = { location: null, type: null };
function Screen() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const modelId = location.pathname.match(/\/rotinas\/modelos\/([^/]+)$/)?.[1];
  const tab = location.pathname.endsWith('/rotinas/hoje') ? 'hoje' : 'modelos';
  // O mesmo que o goToSub do App faz com a tela já aberta: replace, com o state de agora.
  const onTab = (subId) => navigate(hrefFor('acad', 'rotinas', { sub: subId }), { replace: true, state: location.state });
  return h(RotinasView, {
    key: modelId ?? 'lista', db: {}, appUser: GESTOR, usersList: EQUIPE, modelId, tab, onTab, tenantId: 'acad', listenersActive: true,
  });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date(2026, 9, 6, 10, 47), toFake: ['Date'] });
  s.models = [M1];
  s.loading = false;
  s.marksArgs = null;
  nav.location = null;
  nav.type = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const render = async (entry) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(Screen))));
  });
};
const tabs = () => [...document.body.querySelectorAll('[role="tab"]')];
const tab = (nome) => tabs().find((el) => el.textContent.startsWith(nome));
// O Radix troca de aba no mousedown do botão esquerdo, e não no click.
const pressTab = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const button = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};

describe('as abas no endereço', () => {
  it('/acad/rotinas abre Modelos, e a aba Hoje troca o endereço por /acad/rotinas/hoje, com replace', async () => {
    await render(LIST);
    expect(tabs().map((el) => el.textContent)).toEqual(['Modelos', 'Hoje 1 sem modelo']);
    expect(tab('Modelos').getAttribute('aria-selected')).toBe('true');
    expect(button('Novo modelo')).toBeTruthy();
    await pressTab(tab('Hoje'));
    expect(nav.location.pathname).toBe(HOJE);
    expect(nav.type).toBe('REPLACE');
    expect(tab('Hoje').getAttribute('aria-selected')).toBe('true');
    expect(document.body.querySelector('h1').textContent).toBe('A equipe fez 0 de 1 tarefa da rotina até agora, e 1 está atrasada.');
    expect(button('Novo modelo')).toBeUndefined();
  });

  it('/acad/rotinas/hoje abre a Hoje, e a aba Modelos volta para /acad/rotinas, com replace', async () => {
    await render(HOJE);
    expect(tab('Hoje').getAttribute('aria-selected')).toBe('true');
    await pressTab(tab('Modelos'));
    expect(nav.location.pathname).toBe(LIST);
    expect(nav.type).toBe('REPLACE');
    expect(button('Novo modelo')).toBeTruthy();
  });

  it('a aba Hoje só lê os checks com ela aberta', async () => {
    await render(LIST);
    expect(s.marksArgs).toBeNull();
    await pressTab(tab('Hoje'));
    expect(s.marksArgs).toEqual({ db: {}, enabled: true, tenantId: 'acad', dayKey: '2026-10-06' });
  });

  it('o selo da aba diz quantos estão sem modelo, e some com todos num modelo ou enquanto carrega', async () => {
    await render(LIST);
    expect(tab('Hoje').textContent).toBe('Hoje 1 sem modelo');
    s.models = [{ ...M1, followerIds: ['carla', 'diego'] }];
    await render(LIST);
    expect(tab('Hoje').textContent).toBe('Hoje');
    s.models = [];
    s.loading = true;
    await render(LIST);
    expect(tab('Hoje').textContent).toBe('Hoje');
  });

  it('Escolher modelo, no cartão de quem está sem modelo, leva à aba Modelos com replace', async () => {
    await render(HOJE);
    const diego = document.body.querySelector('section[aria-label="Diego Lima"]');
    await click([...diego.querySelectorAll('button')].find((b) => b.textContent === 'Escolher modelo'));
    expect(nav.location.pathname).toBe(LIST);
    expect(nav.type).toBe('REPLACE');
  });

  it('o modelo no cartão da pessoa abre o modelo, e o Voltar volta para a Hoje', async () => {
    await render(HOJE);
    const link = document.body.querySelector('section[aria-label="Carla Souza"] a');
    expect(link.getAttribute('href')).toBe('/acad/rotinas/modelos/m1');
    await click(link);
    expect(nav.type).toBe('PUSH');
    expect(nav.location.pathname).toBe('/acad/rotinas/modelos/m1');
    expect(nav.location.state).toEqual({ fromList: true });
    await click(button('Voltar'));
    expect(nav.type).toBe('POP');
    expect(nav.location.pathname).toBe(HOJE);
  });
});

describe('a casca liga a aba ao endereço', () => {
  it('o App passa a sub-tela como aba e troca de aba pelo goToSub', () => {
    const inicio = APP.indexOf('<RotinasView');
    const bloco = APP.slice(inicio, APP.indexOf('/>', inicio));
    expect(bloco).toContain('tab={sub}');
    expect(bloco).toContain("onTab={(subId) => goToSub('rotinas', subId)}");
  });
});
