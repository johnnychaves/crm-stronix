// @vitest-environment jsdom
// A tela Rotinas do gestor montada de verdade, com o roteador em memória: o
// clique duplo no Duplicar, o Voltar do modelo, a espera do modelo recém-
// criado, a escolha do modelo para copiar, a tarefa que outra aba apagou e o
// que a tela mostra enquanto os modelos não chegam.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ models: [], loading: false, error: false }));
vi.mock('../../hooks/useRoutineModels.js', () => ({
  useRoutineModels: () => ({ models: s.models, loading: s.loading, error: s.error }),
}));
vi.mock('../firebase.js', () => ({
  appId: 'acad',
  ROUTINE_MODELS_PATH: 'stronix_rotina_modelos',
  ROUTINE_VERSIONS_PATH: 'stronix_rotina_versoes',
  ROUTINE_MARKS_PATH: 'stronix_rotina_marcas',
  db: {},
  auth: {},
}));
// As gravações são falsas, mas os códigos de erro e as fábricas são os de
// verdade: o edit da tarefa lança o erro que a tela lê.
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

const { createModel, duplicateModel, updateModel } = await import('../rotinasWrites.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { RotinasView } = await import('../../views/RotinasView.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'g1', authUid: 'g1', name: 'Bruno Gestor', role: 'admin' };
const EQUIPE = [
  GESTOR,
  { id: 'carla', authUid: 'carla', name: 'Carla Souza', role: 'consultant' },
  { id: 'diego', authUid: 'diego', name: 'Diego Lima', role: 'consultant' },
];
const TASK = { id: 't1', title: 'Conferir a agenda', how: '', days: 'all', time: '08:00', active: true };
const M1 = { id: 'm1', name: 'Manhã', followerIds: ['carla'], tasks: [TASK] };
const M2 = { id: 'm2', name: 'Cópia de Manhã', followerIds: [], tasks: [{ ...TASK, id: 't2' }] };
const M9 = { id: 'm9', name: 'Noite', followerIds: [], tasks: [] };
const LIST = '/acad/rotinas';
const FRESH_MS = 15_000;

// O que a tela mostra e como chegou ali (PUSH, POP ou REPLACE).
const nav = { location: null, type: null };
function Screen() {
  const location = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const modelId = location.pathname.match(/\/rotinas\/modelos\/([^/]+)$/)?.[1];
  // A key imita o screenKey do App: cada modelo aberto remonta a tela.
  return h(RotinasView, {
    key: modelId ?? 'lista', db: {}, appUser: GESTOR, usersList: EQUIPE, modelId, tenantId: 'acad', listenersActive: true,
  });
}

let container;
let root;
let entry;
beforeEach(() => {
  vi.clearAllMocks();
  s.models = [M1];
  s.loading = false;
  s.error = false;
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

// Um elemento novo a cada chamada, para a tela reler o hook falso. O
// MemoryRouter só lê as entradas na montagem, então o endereço continua.
const render = async (start = entry) => {
  entry = start;
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(Screen))));
  });
};
const text = () => document.body.textContent;
const button = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const labelled = (label) => document.body.querySelector(`[aria-label="${label}"]`);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const type = async (el, value) => {
  expect(el).toBeTruthy();
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
// O Radix devolve o foco num setTimeout(0) depois de o painel sair da tela.
const settleFocus = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
// O cartão do modelo e o "Abrir modelo" da lista de consultores são links.
const card = (name) => [...document.body.querySelectorAll('a')].find((a) => a.textContent.startsWith(name) && a.textContent.includes('Abrir'));
const link = (label) => [...document.body.querySelectorAll('a')].find((a) => a.textContent.trim() === label);
const TASK_TITLE = 'input[placeholder="Ex.: Conferir a agenda do dia na recepção"]';
const MODEL_NAME = 'input[placeholder="Ex.: Consultor do fim de semana"]';

describe('abrir o modelo por link', () => {
  // O jsdom não navega: quem cancela o clique que o Link deixou passar é este
  // ouvinte, depois de anotar se o app tinha cancelado antes (clique tratado
  // pelo roteador) ou não (clique que fica com o navegador, como o Ctrl+clique).
  let cancelledByApp;
  const record = (event) => {
    cancelledByApp = event.defaultPrevented;
    event.preventDefault();
  };
  beforeEach(() => {
    cancelledByApp = null;
    document.addEventListener('click', record);
  });
  afterEach(() => document.removeEventListener('click', record));

  it('o cartão e o "Abrir modelo" são links para o endereço do modelo', async () => {
    await render(LIST);
    expect(card('Manhã').tagName).toBe('A');
    expect(card('Manhã').getAttribute('href')).toBe('/acad/rotinas/modelos/m1');
    expect(link('Abrir modelo').getAttribute('href')).toBe('/acad/rotinas/modelos/m1');
    expect(card('Manhã').querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
  });

  it('o clique comum no "Abrir modelo" empilha o modelo com a marca da lista', async () => {
    await render(LIST);
    await click(link('Abrir modelo'));
    expect(cancelledByApp).toBe(true);
    expect(nav.type).toBe('PUSH');
    expect(nav.location.pathname).toBe('/acad/rotinas/modelos/m1');
    expect(nav.location.state).toEqual({ fromList: true });
    await click(button('Voltar'));
    expect(nav.type).toBe('POP');
    expect(nav.location.pathname).toBe(LIST);
  });

  it.each([['Ctrl', { ctrlKey: true }], ['Cmd', { metaKey: true }], ['Shift', { shiftKey: true }]])(
    '%s+clique fica com o navegador, que abre o modelo em outra aba ou janela',
    async (_tecla, teclas) => {
      await render(LIST);
      for (const el of [card('Manhã'), link('Abrir modelo')]) {
        await act(async () => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...teclas }));
        });
        expect(cancelledByApp).toBe(false);
        expect(nav.location.pathname).toBe(LIST);
      }
    },
  );
});

describe('Duplicar modelo', () => {
  it('o clique duplo duplica uma vez só e desliga o botão enquanto grava', async () => {
    duplicateModel.mockImplementation(() => new Promise(() => {}));
    await render('/acad/rotinas/modelos/m1');
    const dup = button('Duplicar modelo');
    await act(async () => { dup.click(); dup.click(); });
    expect(duplicateModel).toHaveBeenCalledTimes(1);
    expect(dup.disabled).toBe(true);
    expect(button('Excluir modelo').disabled).toBe(true);
  });
});

describe('o Voltar do modelo', () => {
  it('com o modelo aberto pela lista, volta uma entrada do histórico', async () => {
    await render(LIST);
    await click(card('Manhã'));
    expect(nav.location.pathname).toBe('/acad/rotinas/modelos/m1');
    expect(nav.location.state).toEqual({ fromList: true });
    await click(button('Voltar'));
    expect(nav.type).toBe('POP');
    expect(nav.location.pathname).toBe(LIST);
  });

  it('com o modelo aberto por link direto, troca o endereço pela lista', async () => {
    await render('/acad/rotinas/modelos/m1');
    await click(button('Voltar'));
    expect(nav.type).toBe('REPLACE');
    expect(nav.location.pathname).toBe(LIST);
  });

  it('depois de duplicar, vai para a lista e não para o modelo de origem', async () => {
    s.models = [M1, M2];
    duplicateModel.mockResolvedValue('m2');
    await render(LIST);
    await click(card('Manhã'));
    await click(button('Duplicar modelo'));
    expect(nav.location.pathname).toBe('/acad/rotinas/modelos/m2');
    expect(nav.type).toBe('PUSH');
    expect(nav.location.state.fromList).toBe(false);
    await click(button('Voltar'));
    expect(nav.type).toBe('REPLACE');
    expect(nav.location.pathname).toBe(LIST);
  });
});

describe('o modelo recém-criado', () => {
  const freshEntry = (at, extra = {}) => ({
    pathname: '/acad/rotinas/modelos/m9',
    state: { rotinaNova: 'm9', at, renomear: true, fromList: true, ...extra },
  });

  it('que nunca chega mostra o aviso de modelo excluído quando o prazo acaba', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 6, 11, 5) });
    await render(freshEntry(Date.now()));
    expect(text()).not.toContain('Esse modelo não existe mais.');
    await act(async () => { vi.advanceTimersByTime(FRESH_MS - 1); });
    expect(text()).not.toContain('Esse modelo não existe mais.');
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(text()).toContain('Esse modelo não existe mais.');
  });

  it('com o prazo já vencido (F5 depois), mostra o aviso na hora', async () => {
    await render(freshEntry(Date.now() - FRESH_MS - 1));
    expect(text()).toContain('Esse modelo não existe mais.');
  });

  it('que apareceu e depois foi excluído mostra o aviso, mesmo dentro do prazo', async () => {
    s.models = [M1, M9];
    await render(freshEntry(Date.now()));
    // Recém-duplicado, o modelo abre com o nome em edição: o nome está no campo.
    expect(document.querySelector('input[aria-label="Nome do modelo"]')?.value).toBe('Noite');
    s.models = [M1];
    await render();
    expect(text()).toContain('Esse modelo não existe mais.');
  });

  it('abre com o nome em edição dentro do prazo', async () => {
    s.models = [M1, M9];
    await render(freshEntry(Date.now()));
    expect(labelled('Nome do modelo')).not.toBeNull();
  });

  it('ignora o renomear depois do prazo', async () => {
    s.models = [M1, M9];
    await render(freshEntry(Date.now() - FRESH_MS - 1));
    expect(labelled('Nome do modelo')).toBeNull();
    expect(text()).toContain('Noite');
  });
});

describe('Renomear', () => {
  it('reabre com o nome gravado, sem o rascunho e o erro de antes, e tem Cancelar', async () => {
    s.models = [M1, M2];
    await render('/acad/rotinas/modelos/m1');
    await click(button('Renomear'));
    const input = labelled('Nome do modelo');
    await type(input, 'Cópia de Manhã');
    await click(button('Salvar nome'));
    expect(text()).toContain('Já existe um modelo com esse nome.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby');
    expect(document.getElementById(errorId).textContent).toBe('Já existe um modelo com esse nome.');
    expect(updateModel).not.toHaveBeenCalled();
    await click(button('Cancelar'));
    expect(labelled('Nome do modelo')).toBeNull();
    await click(button('Renomear'));
    expect(labelled('Nome do modelo').value).toBe('Manhã');
    expect(text()).not.toContain('Já existe um modelo com esse nome.');
  });
});

describe('Novo modelo', () => {
  it('cópia sem modelo escolhido pede a escolha e não cria nada', async () => {
    s.models = [];
    s.loading = true;
    await render(LIST);
    await click(button('Novo modelo'));
    // Os modelos chegam com o painel já aberto: a cópia nasce sem escolha.
    s.models = [M1];
    s.loading = false;
    await render();
    await type(document.body.querySelector(MODEL_NAME), 'Noite');
    await click(button('Cópia de um modelo'));
    expect(button('Cópia de um modelo').getAttribute('aria-pressed')).toBe('true');
    expect(text()).toContain('Escolha o modelo');
    await click(button('Criar modelo'));
    expect(text()).toContain('Escolha o modelo para copiar.');
    expect(createModel).not.toHaveBeenCalled();
  });

  it('sem modelo nenhum, não oferece a cópia', async () => {
    s.models = [];
    await render(LIST);
    await click(button('Novo modelo'));
    expect(button('Cópia de um modelo')).toBeUndefined();
  });

  it('o clique duplo no Criar cria um modelo só', async () => {
    createModel.mockImplementation(() => new Promise(() => {}));
    await render(LIST);
    await click(button('Novo modelo'));
    await type(document.body.querySelector(MODEL_NAME), 'Noite');
    const criar = button('Criar modelo');
    await act(async () => { criar.click(); criar.click(); });
    expect(createModel).toHaveBeenCalledTimes(1);
  });

  it('fechar sem criar devolve o foco ao Novo modelo', async () => {
    await render(LIST);
    const novo = button('Novo modelo');
    await click(novo);
    await click(button('Cancelar'));
    await settleFocus();
    expect(document.activeElement).toBe(novo);
  });
});

describe('Tarefas', () => {
  it('salvar a edição de uma tarefa que outra aba apagou avisa e fecha o painel', async () => {
    updateModel.mockImplementation(async ({ edit }) => { edit({ ...M1, tasks: [] }); });
    await render('/acad/rotinas/modelos/m1');
    await click(labelled('Editar Conferir a agenda'));
    expect(text()).toContain('Editar tarefa');
    await click(button('Salvar alterações'));
    expect(toast.error).toHaveBeenCalledWith('Essa tarefa foi excluída.');
    expect(text()).not.toContain('Editar tarefa');
  });

  it('pausar grava o que foi digitado junto, pela mesma conferência do Salvar', async () => {
    let written = null;
    updateModel.mockImplementation(async ({ edit }) => { written = edit(M1); });
    await render('/acad/rotinas/modelos/m1');
    await click(labelled('Editar Conferir a agenda'));
    await type(document.body.querySelector(TASK_TITLE), '');
    await click(button('Pausar tarefa'));
    expect(text()).toContain('Escreva o nome da tarefa.');
    expect(updateModel).not.toHaveBeenCalled();
    await type(document.body.querySelector(TASK_TITLE), 'Conferir a agenda da recepção');
    await click(button('Pausar tarefa'));
    expect(written.tasks).toEqual([expect.objectContaining({ id: 't1', title: 'Conferir a agenda da recepção', active: false })]);
    expect(toast.success).toHaveBeenCalledWith('Tarefa pausada.');
  });

  it('a tarefa nova confere o máximo no modelo lido na gravação', async () => {
    const full = { ...M1, tasks: Array.from({ length: 30 }, (_, i) => ({ ...TASK, id: `t${i}` })) };
    updateModel.mockImplementation(async ({ edit }) => { edit(full); });
    await render('/acad/rotinas/modelos/m1');
    await click(button('Nova tarefa'));
    await type(document.body.querySelector(TASK_TITLE), 'Organizar o mural');
    await click(button('Criar tarefa'));
    expect(toast.error).toHaveBeenCalledWith('O modelo já tem 30 tarefas, o máximo.');
    expect(text()).toContain('Nova tarefa');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('fechar o painel devolve o foco ao Editar que o abriu', async () => {
    await render('/acad/rotinas/modelos/m1');
    const editar = labelled('Editar Conferir a agenda');
    await click(editar);
    await click(button('Cancelar'));
    await settleFocus();
    expect(document.activeElement).toBe(editar);
  });

  it('depois de excluir a tarefa, o foco vai para o Nova tarefa', async () => {
    updateModel.mockResolvedValue(undefined);
    await render('/acad/rotinas/modelos/m1');
    await click(labelled('Editar Conferir a agenda'));
    await click(button('Excluir tarefa'));
    await settleFocus();
    expect(document.activeElement).toBe(button('Nova tarefa'));
  });
});

describe('enquanto os modelos não chegam', () => {
  it('não diz que alguém está sem rotina', async () => {
    s.models = [];
    s.loading = true;
    await render(LIST);
    expect(text()).toContain('Carregando as rotinas…');
    expect(text()).toContain('Carregando os modelos de cada consultor…');
    expect(text()).not.toContain('sem rotina');
    expect(text()).not.toContain('Sem rotina na Meta diária');
  });

  it('com os modelos, a frase e a lista voltam', async () => {
    await render(LIST);
    expect(text()).toContain('1 de 2');
    expect(text()).toContain('Diego');
    expect(text()).toContain('Sem rotina na Meta diária');
  });
});

describe('acessibilidade', () => {
  it('a escolha segmentada é um grupo de botões de alternar, e o Tirar diz quem sai', async () => {
    await render('/acad/rotinas/modelos/m1');
    expect(labelled('Tirar Carla Souza do modelo')).not.toBeNull();
    await click(button('Nova tarefa'));
    const group = labelled('Horário');
    expect(group.getAttribute('role')).toBe('group');
    expect(document.body.querySelector('[role="radiogroup"], [role="radio"]')).toBeNull();
    expect(button('Com horário').getAttribute('aria-pressed')).toBe('true');
    expect(button('Sem horário').getAttribute('aria-pressed')).toBe('false');
  });

  it('o erro do nome da tarefa fica ligado ao campo', async () => {
    await render('/acad/rotinas/modelos/m1');
    await click(button('Nova tarefa'));
    const input = document.body.querySelector(TASK_TITLE);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBeNull();
    await click(button('Criar tarefa'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const erro = document.getElementById(input.getAttribute('aria-describedby'));
    expect(erro).not.toBeNull();
    expect(erro.textContent.trim()).not.toBe('');
    expect(updateModel).not.toHaveBeenCalled();
  });

  it('o cartão do modelo é um link só, sem título, div ou outro elemento clicável dentro', async () => {
    await render(LIST);
    expect(card('Manhã').querySelector('div, p, h1, h2, h3, h4')).toBeNull();
    expect(card('Manhã').querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
  });
});

// O balão "Novo" saiu da tela e foi para o item Rotinas do menu (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C). O conteúdo dele é testado no
// rotinasIntro.test.js, e o item do menu no sidebarNovo.test.js.
describe('o balão "Novo"', () => {
  // Só o Date é falso: a tela não tem timer de pop-up para atrasar.
  const hoje = (date) => vi.useFakeTimers({ now: date, toFake: ['Date'] });

  it('não fica mais na tela, nem na lista nem no modelo aberto', async () => {
    hoje(new Date(2026, 9, 8, 9, 0));
    await render(LIST);
    expect(button('Novo modelo')).toBeTruthy();
    expect(labelled('Novo: o que é esta tela')).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await render('/acad/rotinas/modelos/m1');
    expect(text()).toContain('Manhã');
    expect(labelled('Novo: o que é esta tela')).toBeNull();
  });

  it('as abas ficam embaixo do sobretítulo, e a linha do título tem o título à esquerda e o Novo modelo à direita', async () => {
    await render(LIST);
    const novo = button('Novo modelo');
    const linha = novo.parentElement;
    expect(linha.querySelector('h1')).not.toBeNull();
    expect(linha.lastElementChild).toBe(novo);
    const abas = document.body.querySelector('[role="tablist"]');
    expect([...abas.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Modelos', 'Hoje 1 sem modelo']);
    expect(abas.parentElement.previousElementSibling.textContent.trim()).toBe('Rotinas');
    expect(abas.compareDocumentPosition(novo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Página B: a lista', () => {
  const hoje = () => vi.useFakeTimers({ now: new Date(2026, 9, 6, 10, 47), toFake: ['Date'] });
  const M3 = {
    id: 'm3',
    name: 'Tarde',
    followerIds: ['diego'],
    tasks: [{ ...TASK, id: 'a', time: '13:00' }, { ...TASK, id: 'b', time: '17:30' }, { ...TASK, id: 'c', time: null }],
  };

  it('o cartão tem o resumo, a linha do dia com os rótulos e quem segue com o rosto', async () => {
    hoje();
    s.models = [M1, M2, M3];
    await render(LIST);
    const manha = card('Manhã');
    expect(manha.textContent).toContain('1 tarefa · às 08:00');
    expect(manha.textContent).toContain('Carla');
    expect([...manha.querySelectorAll('span[aria-hidden="true"]')].some((el) => el.textContent === 'CS')).toBe(true);
    const tarde = card('Tarde');
    expect(tarde.textContent).toContain('2 tarefas · das 13:00 às 17:30 · 1 a qualquer hora');
    expect(tarde.textContent).toContain('13h');
    expect(tarde.textContent).toContain('17h30');
    expect(card('Cópia de Manhã').textContent).toContain('Ninguém segue ainda');
  });

  it('a grade dos cartões é larga, mas não passa da tela no celular', async () => {
    await render(LIST);
    expect(card('Manhã').parentElement.className).toContain('[grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]');
  });

  it('na lista de consultores, o rosto, o dia de hoje e o Abrir modelo com a seta', async () => {
    hoje();
    await render(LIST);
    expect(text()).toContain('1 tarefa hoje · às 08:00');
    expect(link('Abrir modelo').querySelector('svg')).not.toBeNull();
    expect(text()).toContain('Sem rotina na Meta diária');
    const linhaDaCarla = [...document.body.querySelectorAll('p')].find((p) => p.textContent === 'Carla Souza').closest('div').parentElement;
    expect(linhaDaCarla.querySelector('span[aria-hidden="true"]').textContent).toBe('CS');
  });
});
