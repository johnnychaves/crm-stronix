// @vitest-environment jsdom
// A apresentação das Rotinas abre sozinha quando o gestor entra na tela, na
// lista ou na aba Hoje, e nunca no modelo aberto (pedido do Johnny em
// 08/10/2026). Abre no máximo uma vez por sessão do navegador (a marca fica no
// sessionStorage, com a memória do módulo como reserva) e nunca mais depois do
// "Não mostrar novamente", que grava introsDismissed.rotinas no cadastro da
// própria pessoa (stronix_users/{id}). O Entendi, o X e o Esc só fecham.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ models: [], appUser: null, usersList: [] }));
vi.mock('../../hooks/useRoutineModels.js', () => ({
  useRoutineModels: () => ({ models: s.models, loading: false, error: false }),
}));
vi.mock('../../hooks/useTeamRoutineMarks.js', () => ({
  useTeamRoutineMarks: () => ({ marks: new Map(), loading: false, error: false }),
}));
vi.mock('../firebase.js', () => ({
  appId: 'acad',
  USERS_PATH: 'stronix_users',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
  db: {},
  auth: {},
}));
// A gravação de verdade (rotinasWrites.js) roda até o SDK: só o doc e o setDoc
// são falsos, para conferir o caminho e o campo.
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: vi.fn((_db, ...path) => ({ path: path.join('/') })),
  setDoc: vi.fn(),
}));
// O MemoryRouter não grava o idx no window.history: quem diz se dá para voltar
// dentro do app é o teste.
vi.mock('../routes.js', async (importOriginal) => ({
  ...(await importOriginal()),
  canGoBackInApp: vi.fn(() => true),
}));

const { setDoc } = await import('firebase/firestore');
const { hrefFor } = await import('../routes.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { RotinasView } = await import('../../views/RotinasView.jsx');
const {
  markRotinasIntroSeen, rotinasIntroDismissed, rotinasIntroSeen, shouldAutoOpenRotinasIntro,
} = await import('../rotinasIntro.js');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'g1', authUid: 'g1', name: 'Bruno Gestor', role: 'admin', tenantId: 'acad' };
const CARLA = { id: 'carla', authUid: 'carla', name: 'Carla Souza', role: 'consultant' };
const M1 = {
  id: 'm1',
  name: 'Manhã',
  followerIds: ['carla'],
  tasks: [{ id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true }],
};
const LIST = '/acad/rotinas';
const HOJE = '/acad/rotinas/hoje';
const MODELO = '/acad/rotinas/modelos/m1';
const FALHOU = 'Não deu para salvar. A apresentação pode aparecer de novo.';

const nav = { location: null };
function Screen() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { nav.location = location; });
  const modelId = location.pathname.match(/\/rotinas\/modelos\/([^/]+)$/)?.[1];
  const tab = location.pathname.endsWith('/rotinas/hoje') ? 'hoje' : 'modelos';
  const onTab = (subId) => navigate(hrefFor('acad', 'rotinas', { sub: subId }), { replace: true, state: location.state });
  // A key imita o screenKey do App: cada modelo aberto remonta a tela.
  return h(RotinasView, {
    key: modelId ?? 'lista', db: {}, appUser: s.appUser, usersList: s.usersList, modelId, tab, onTab, tenantId: 'acad', listenersActive: true,
  });
}

let container;
let root;
const novaRaiz = () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
};
beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  setDoc.mockResolvedValue(undefined);
  s.models = [M1];
  s.appUser = GESTOR;
  s.usersList = [GESTOR, CARLA];
  nav.location = null;
  novaRaiz();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// Montar de novo, do zero, é o que o F5 e a volta de outra tela fazem: a marca
// da sessão é a única coisa que sobra.
const render = async (entry) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(Screen))));
  });
};
const remontar = async (entry) => {
  act(() => root.unmount());
  container.remove();
  novaRaiz();
  await render(entry);
};
const dialogo = () => document.body.querySelector('[role="dialog"]');
const titulo = () => dialogo()?.querySelector('h2')?.textContent;
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const ateOUltimo = async () => {
  await clicar(botao('Ver como configurar'));
  for (let i = 0; i < 4; i += 1) await clicar(botao('Próximo'));
};
const card = (name) => [...document.body.querySelectorAll('a')].find((a) => a.textContent.startsWith(name) && a.textContent.includes('Abrir'));
const esperar = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

describe('abre sozinha ao entrar em Rotinas', () => {
  it('na lista, no primeiro passo e com o foco no botão principal', async () => {
    await render(LIST);
    expect(dialogo()).not.toBeNull();
    expect(titulo()).toBe('O que é a rotina');
    expect(document.activeElement).toBe(botao('Ver como configurar'));
    // A tela continua montada por trás.
    expect(document.body.textContent).toContain('Novo modelo');
  });

  it('na aba Hoje também', async () => {
    await render(HOJE);
    expect(titulo()).toBe('O que é a rotina');
  });

  it('no modelo aberto, não', async () => {
    await render(MODELO);
    expect(nav.location.pathname).toBe(MODELO);
    expect(dialogo()).toBeNull();
  });

  it('quem entrou pelo modelo vê a apresentação quando chega à lista', async () => {
    await render(MODELO);
    expect(dialogo()).toBeNull();
    await clicar(botao('Voltar'));
    expect(nav.location.pathname).toBe(LIST);
    expect(titulo()).toBe('O que é a rotina');
  });

  it('não reabre ao abrir um modelo e voltar para a lista', async () => {
    await render(LIST);
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Fechar'));
    expect(dialogo()).toBeNull();
    await clicar(card('Manhã'));
    expect(nav.location.pathname).toBe(MODELO);
    await clicar(botao('Voltar'));
    expect(nav.location.pathname).toBe(LIST);
    expect(dialogo()).toBeNull();
  });

  it('não reabre ao montar a tela de novo na mesma sessão', async () => {
    await render(LIST);
    await clicar(botao('Ver como configurar'));
    await clicar(botao('Próximo'));
    await clicar(botao('Fechar'));
    await remontar(LIST);
    expect(dialogo()).toBeNull();
    await remontar(HOJE);
    expect(dialogo()).toBeNull();
  });

  it('numa sessão nova volta a abrir, porque o Entendi não grava nada', async () => {
    await render(LIST);
    await ateOUltimo();
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
    window.sessionStorage.clear();
    await remontar(LIST);
    expect(titulo()).toBe('O que é a rotina');
  });

  it('o Esc fecha sem gravar', async () => {
    await render(LIST);
    await act(async () => {
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(dialogo()).toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('a marca da sessão é de cada pessoa: quem entra depois na mesma aba também vê', async () => {
    await render(LIST);
    await clicar(botao('Fechar'));
    s.appUser = { ...GESTOR, id: 'g2', authUid: 'g2', name: 'Ana Gestora' };
    s.usersList = [s.appUser, CARLA];
    await remontar(LIST);
    expect(titulo()).toBe('O que é a rotina');
  });

  it('sem o sessionStorage, a memória da página guarda a marca', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    s.appUser = { ...GESTOR, id: 'g-sem-storage', authUid: 'g-sem-storage' };
    s.usersList = [s.appUser, CARLA];
    await render(LIST);
    expect(titulo()).toBe('O que é a rotina');
    await clicar(botao('Fechar'));
    await clicar(card('Manhã'));
    await clicar(botao('Voltar'));
    expect(nav.location.pathname).toBe(LIST);
    expect(dialogo()).toBeNull();
  });
});

describe('quem dispensou para sempre', () => {
  it('não vê a apresentação sozinha, pelo cadastro do login', async () => {
    s.appUser = { ...GESTOR, introsDismissed: { rotinas: true } };
    s.usersList = [s.appUser, CARLA];
    await render(LIST);
    expect(dialogo()).toBeNull();
  });

  it('nem pelo cadastro ao vivo da equipe, quando dispensou em outra aba depois do login', async () => {
    s.usersList = [{ ...GESTOR, introsDismissed: { rotinas: true } }, CARLA];
    await render(LIST);
    expect(dialogo()).toBeNull();
  });

  it('outra apresentação dispensada não conta', async () => {
    s.appUser = { ...GESTOR, introsDismissed: { outra: true } };
    await render(LIST);
    expect(titulo()).toBe('O que é a rotina');
  });
});

describe('"Não mostrar novamente"', () => {
  it('só aparece no último passo, ao lado do Voltar e do Entendi', async () => {
    await render(LIST);
    expect(botao('Não mostrar novamente')).toBeUndefined();
    await clicar(botao('Ver como configurar'));
    for (let i = 0; i < 4; i += 1) {
      expect(botao('Não mostrar novamente')).toBeUndefined();
      await clicar(botao('Próximo'));
    }
    expect(titulo()).toBe('Acompanhe o dia na aba Hoje');
    const dispensar = botao('Não mostrar novamente');
    expect(dispensar).toBeTruthy();
    expect(dispensar.parentElement).toBe(botao('Entendi').parentElement);
    expect(dispensar.parentElement).toBe(botao('Voltar').parentElement);
  });

  it('grava no próprio cadastro, fecha e não abre mais nesta sessão', async () => {
    await render(LIST);
    await ateOUltimo();
    await clicar(botao('Não mostrar novamente'));
    expect(dialogo()).toBeNull();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'artifacts/acad/public/data/stronix_users/g1' },
      { introsDismissed: { rotinas: true } },
      { merge: true },
    );
    await esperar();
    expect(toast.error).not.toHaveBeenCalled();
    // O appUser do login não muda sozinho: quem segura é a marca da sessão.
    await remontar(LIST);
    expect(dialogo()).toBeNull();
    // Na próxima sessão, quem segura é o cadastro, lido de novo no login.
    window.sessionStorage.clear();
    s.appUser = { ...GESTOR, introsDismissed: { rotinas: true } };
    await remontar(LIST);
    expect(dialogo()).toBeNull();
  });

  it('se a gravação falha, avisa e fecha do mesmo jeito', async () => {
    setDoc.mockRejectedValue(new Error('permission-denied'));
    await render(LIST);
    await ateOUltimo();
    await clicar(botao('Não mostrar novamente'));
    expect(dialogo()).toBeNull();
    await esperar();
    expect(toast.error).toHaveBeenCalledWith(FALHOU);
    // Nesta sessão ela não volta.
    await remontar(LIST);
    expect(dialogo()).toBeNull();
  });
});

describe('a regra da apresentação (src/lib/rotinasIntro.js)', () => {
  it('dispensada é só introsDismissed.rotinas igual a true', () => {
    expect(rotinasIntroDismissed({ introsDismissed: { rotinas: true } })).toBe(true);
    expect(rotinasIntroDismissed({ introsDismissed: { rotinas: 'sim' } })).toBe(false);
    expect(rotinasIntroDismissed({ introsDismissed: {} })).toBe(false);
    expect(rotinasIntroDismissed({})).toBe(false);
    expect(rotinasIntroDismissed(null)).toBe(false);
  });

  it('abre para quem tem cadastro, não dispensou e ainda não viu nesta sessão', () => {
    const ana = { id: 'ana-regra', tenantId: 'acad' };
    expect(shouldAutoOpenRotinasIntro(null)).toBe(false);
    expect(shouldAutoOpenRotinasIntro({ name: 'sem id' })).toBe(false);
    expect(shouldAutoOpenRotinasIntro(ana)).toBe(true);
    expect(shouldAutoOpenRotinasIntro(ana, { ...ana, introsDismissed: { rotinas: true } })).toBe(false);
    expect(rotinasIntroSeen(ana)).toBe(false);
    markRotinasIntroSeen(ana);
    expect(rotinasIntroSeen(ana)).toBe(true);
    expect(shouldAutoOpenRotinasIntro(ana)).toBe(false);
    // A mesma pessoa em outra academia é outra marca.
    expect(rotinasIntroSeen({ ...ana, tenantId: 'outra' })).toBe(false);
  });
});
