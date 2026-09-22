// Rolagem por tela em node, sem jsdom. As peças puras (memória e restauração)
// rodam contra um div falso que imita o scrollTop do navegador: ele não passa
// do tamanho do conteúdo. O hook roda com os hooks do React e do React Router
// simulados: cada "render" lê a location e roda o layout effect como o React
// faria depois do commit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScrollMemory, restoreWhenTall, useRouteScroll } from '../../hooks/useRouteScroll.js';

const m = vi.hoisted(() => ({
  location: { pathname: '/', key: 'default' },
  navigationType: 'POP',
  prevRef: null,
  layoutEffect: null,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRef: (initial) => {
      if (!m.prevRef) m.prevRef = { current: initial };
      return m.prevRef;
    },
    useCallback: (fn) => fn,
    useLayoutEffect: (effect) => {
      m.layoutEffect = effect;
    },
  };
});

vi.mock('react-router', () => ({
  useLocation: () => m.location,
  useNavigationType: () => m.navigationType,
}));

// Div que rola: scrollTop fica entre 0 e (conteúdo - janela), como no navegador.
function fakeScroller({ contentHeight = 5000, viewport = 600 } = {}) {
  const listeners = new Map();
  return {
    contentHeight,
    viewport,
    top: 0,
    get scrollTop() { return this.top; },
    set scrollTop(value) { this.top = Math.max(0, Math.min(value, Math.max(0, this.contentHeight - this.viewport))); },
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) || []), fn]); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter((f) => f !== fn)); },
    fire(type) { for (const fn of listeners.get(type) || []) fn(); },
    listenerCount() { return [...listeners.values()].reduce((n, list) => n + list.length, 0); },
  };
}

// Fila de quadros controlada pelo teste, no lugar do requestAnimationFrame.
function fakeFrames() {
  let nextId = 1;
  const queue = new Map();
  return {
    request: (fn) => {
      const id = nextId++;
      queue.set(id, fn);
      return id;
    },
    cancel: (id) => { queue.delete(id); },
    pending: () => queue.size,
    runNext() {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const fn of callbacks) fn();
    },
  };
}

let frames;

beforeEach(() => {
  frames = fakeFrames();
  vi.stubGlobal('requestAnimationFrame', frames.request);
  vi.stubGlobal('cancelAnimationFrame', frames.cancel);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createScrollMemory', () => {
  it('lembra a posição de cada entrada e devolve 0 para a desconhecida', () => {
    const memory = createScrollMemory();
    memory.remember('k1', 700);
    expect(memory.recall('k1')).toBe(700);
    expect(memory.recall('k2')).toBe(0);
  });

  it('passando do teto, esquece a entrada lembrada há mais tempo', () => {
    const memory = createScrollMemory(2);
    memory.remember('a', 1);
    memory.remember('b', 2);
    memory.remember('a', 3);
    memory.remember('c', 4);
    expect(memory.recall('b')).toBe(0);
    expect(memory.recall('a')).toBe(3);
    expect(memory.recall('c')).toBe(4);
  });
});

describe('restoreWhenTall', () => {
  it('com o conteúdo já alto, volta de uma vez e não pede quadro nenhum', () => {
    const el = fakeScroller();
    restoreWhenTall(el, 900);
    expect(el.scrollTop).toBe(900);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
  });

  it('com o conteúdo ainda baixo, tenta de novo a cada quadro e para ao chegar', () => {
    const el = fakeScroller({ contentHeight: 800 });
    restoreWhenTall(el, 900);
    expect(el.scrollTop).toBe(200);
    frames.runNext();
    expect(el.scrollTop).toBe(200);
    expect(frames.pending()).toBe(1);
    el.contentHeight = 5000;
    frames.runNext();
    expect(el.scrollTop).toBe(900);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
  });

  it('desiste depois do tempo máximo', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const el = fakeScroller({ contentHeight: 800 });
    restoreWhenTall(el, 900, 1500);
    vi.advanceTimersByTime(1500);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
    el.contentHeight = 5000;
    frames.runNext();
    expect(el.scrollTop).toBe(200);
  });

  it('desiste quando a pessoa rola por conta própria', () => {
    const el = fakeScroller({ contentHeight: 800 });
    restoreWhenTall(el, 900);
    el.fire('wheel');
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
  });

  it('sem requestAnimationFrame, volta o quanto dá e não quebra', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const el = fakeScroller({ contentHeight: 800 });
    const stop = restoreWhenTall(el, 900);
    expect(el.scrollTop).toBe(200);
    expect(() => stop()).not.toThrow();
  });
});

// Faz as vezes do componente que usa o hook: o React chamaria esta função a
// cada render.
function ScrollProbe({ el }) {
  return useRouteScroll({ current: el });
}

// A memória de posições é do módulo do hook e passa de um teste para outro.
// Por isso cada teste usa chaves de entrada só dele (m1, p1, r1...).
describe('useRouteScroll', () => {
  let cleanup;

  // Um render seguido do commit: roda a limpeza do effect anterior e o effect
  // novo, e devolve o onScroll da vez.
  function renderAt(pathname, key, navigationType, el) {
    m.location = { pathname, key };
    m.navigationType = navigationType;
    const onScroll = ScrollProbe({ el });
    cleanup?.();
    cleanup = m.layoutEffect();
    return onScroll;
  }

  function scrollBy(onScroll, el, top) {
    el.scrollTop = top;
    onScroll({ currentTarget: el });
  }

  beforeEach(() => {
    m.prevRef = null;
    cleanup = undefined;
  });

  it('a primeira montagem não mexe na rolagem', () => {
    const el = fakeScroller();
    el.scrollTop = 300;
    renderAt('/acad/pipeline', 'm1', 'POP', el);
    expect(el.scrollTop).toBe(300);
  });

  it('ir para outra tela vai ao topo, e voltar devolve a posição daquela entrada', () => {
    const el = fakeScroller();
    const onPipeline = renderAt('/acad/pipeline', 'p1', 'POP', el);
    scrollBy(onPipeline, el, 700);
    const onClientes = renderAt('/acad/clientes', 'p2', 'PUSH', el);
    expect(el.scrollTop).toBe(0);
    scrollBy(onClientes, el, 250);
    renderAt('/acad/pipeline', 'p1', 'POP', el);
    expect(el.scrollTop).toBe(700);
    renderAt('/acad/clientes', 'p2', 'POP', el);
    expect(el.scrollTop).toBe(250);
  });

  it('na mesma tela não mexe, mesmo com endereço diferente', () => {
    const el = fakeScroller();
    const onHome = renderAt('/acad', 's1', 'POP', el);
    scrollBy(onHome, el, 400);
    renderAt('/acad/visao-geral/operacional', 's2', 'REPLACE', el);
    expect(el.scrollTop).toBe(400);
  });

  it('cada ficha é uma tela: ir de uma ficha a outra vai ao topo', () => {
    const el = fakeScroller();
    const onFichaA = renderAt('/acad/ficha/A', 'f1', 'POP', el);
    scrollBy(onFichaA, el, 500);
    renderAt('/acad/ficha/B', 'f2', 'PUSH', el);
    expect(el.scrollTop).toBe(0);
  });

  it('clicar de novo na tela troca a entrada e a posição vai junto', () => {
    const el = fakeScroller();
    const onClientes = renderAt('/acad/clientes', 'r1', 'POP', el);
    scrollBy(onClientes, el, 700);
    renderAt('/acad/clientes', 'r2', 'REPLACE', el);
    renderAt('/acad/ficha/A', 'r3', 'PUSH', el);
    expect(el.scrollTop).toBe(0);
    renderAt('/acad/clientes', 'r2', 'POP', el);
    expect(el.scrollTop).toBe(700);
  });

  it('ir para outra tela no meio de uma restauração para as tentativas', () => {
    const el = fakeScroller();
    const onClientes = renderAt('/acad/clientes', 'c1', 'POP', el);
    scrollBy(onClientes, el, 2000);
    renderAt('/acad/ficha/A', 'c2', 'PUSH', el);
    el.contentHeight = 800;
    renderAt('/acad/clientes', 'c1', 'POP', el);
    expect(el.scrollTop).toBe(200);
    expect(frames.pending()).toBe(1);
    renderAt('/acad/pipeline', 'c3', 'PUSH', el);
    expect(frames.pending()).toBe(0);
    expect(el.listenerCount()).toBe(0);
    expect(el.scrollTop).toBe(0);
  });

  it('sem o div montado (tela de login), não faz nada', () => {
    renderAt('/acad/pipeline', 'l1', 'POP', null);
    expect(() => renderAt('/acad/clientes', 'l2', 'PUSH', null)).not.toThrow();
  });
});
