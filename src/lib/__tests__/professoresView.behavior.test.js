// @vitest-environment jsdom
// A lista Carreira do gestor (plano 2026-11-27, PR 3): só os ativos, cada
// linha leva ao perfil, e a trilha e o período moram no endereço. A busca pelo
// nome fica fora dele.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ dados: null, args: null, carreiraErro: null, users: [] }));
// Os consultores (PR 4): o hook e as contas vêm prontos.
vi.mock('../../hooks/useConsultoresDados.js', () => ({
  useConsultoresDados: () => ({ carregando: false, erro: null, crm: {}, contratos: [], clientesPorId: new Map(), history: [], metaWeekdays: [1, 2, 3, 4, 5], graceDays: 15 }),
}));
vi.mock('../carreiraConsultor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  contasDoConsultor: () => ({ resultados: { consultorConversao: { valor: 25, academia: 30 }, vendas: { valor: 1309 }, consultorRenovacao: { valor: null }, metaDiaria: { valor: 100 } } }),
}));
vi.mock('../../hooks/useProfessoresDados.js', () => ({
  useProfessoresDados: (args) => {
    s.args = args;
    return s.dados;
  },
}));
vi.mock('../../hooks/useCarreira.js', async () => {
  const { trilhasDe } = await import('../carreira/trilhas.js');
  return { useCarreira: () => ({ carreira: { doc: null, erro: s.carreiraErro }, trilhas: trilhasDe(null) }) };
});
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));
vi.mock('../../hooks/useNpsDados.js', () => ({
  useNpsDados: () => ({ carregando: false, erro: null, pesquisas: [], totais: [] }),
  useNpsRespostas: () => ({ carregando: false, erro: null, respostas: [] }),
}));

const { hrefFor } = await import('../routes.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { ProfessoresView } = await import('../../views/professores/ProfessoresView.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const PROFESSORES = [
  { id: 'p2', nome: 'Bruno Carvalho', nivel: 'junior', modalidadeIds: ['func'] },
  { id: 'p3', nome: 'Zeca Inativo', ativo: false, nivel: 'pleno', modalidadeIds: ['func'] },
  { id: 'p1', nome: 'Ana Lima', ativo: true, trilhaId: 'estagiario', nivel: 'estagiario1', modalidadeIds: ['func'] },
  { id: 'p4', nome: 'Carla Dias', modalidadeIds: ['func'] },
];

const nav = { location: null, type: null };
function Screen() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const tab = location.pathname.endsWith('/carreira/pesquisas') ? 'pesquisas' : 'lista';
  // O mesmo que o goToSub do App faz com a tela já aberta.
  const onTab = (subId) => navigate(hrefFor('acad', 'professores', { sub: subId }), { replace: true, state: location.state });
  return h(ProfessoresView, { db: {}, appUser: { id: 'g1', role: 'admin' }, tenantId: 'acad', tab, onTab, usersList: s.users, funnels: [], listenersActive: true });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  // Fevereiro de 2027: o ciclo atual é o de 2027, e o de 2026 é o anterior.
  vi.useFakeTimers({ now: new Date(2027, 1, 10, 10, 0), toFake: ['Date'] });
  s.dados = {
    carregando: false,
    erro: null,
    professores: PROFESSORES,
    planos: [],
    contratos: [],
    clientes: [],
    aulas: [],
    presencas: [],
  };
  s.args = null;
  s.carreiraErro = null;
  s.users = [];
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
const button = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const linhas = () => [...document.body.querySelectorAll('li a')];

describe('a lista Carreira', () => {
  it('mostra os ativos em ordem de nome, e o inativo fica de fora', async () => {
    await render('/acad/carreira');
    const nomes = linhas().map((a) => a.querySelector('b').textContent);
    expect(nomes).toEqual(['Ana Lima', 'Bruno Carvalho', 'Carla Dias']);
    expect(document.body.textContent).not.toContain('Zeca Inativo');
    expect(document.body.querySelector('[role="tab"]').textContent).toBe('Pessoas3');
  });

  it('cada linha leva ao perfil do professor', async () => {
    await render('/acad/carreira');
    expect(linhas().map((a) => a.getAttribute('href'))).toEqual([
      '/acad/carreira/professor/p1',
      '/acad/carreira/professor/p2',
      '/acad/carreira/professor/p4',
    ]);
  });

  it('mostra a trilha, o nível e o resumo das metas de cada pessoa', async () => {
    await render('/acad/carreira');
    const texto = document.body.textContent;
    expect(texto).toContain('Carreira');
    expect(texto).toContain('Estagiário I');
    expect(texto).toContain('Júnior');
    expect(texto).toMatch(/\d de \d na meta do Júnior/);
    const [, bruno, carla] = linhas();
    expect(bruno.getAttribute('aria-label')).toMatch(/^Bruno Carvalho\. trilha Professor\. Júnior\./);
    expect(carla.textContent).toContain('Sem nível');
    expect(carla.getAttribute('aria-label')).toMatch(/^Carla Dias\. trilha Professor\. sem nível\. Sem nível\./);
    expect(carla.getAttribute('aria-label')).toMatch(/Abrir perfil$/);
  });

  it('a pílula Trilha filtra e grava no endereço', async () => {
    await render('/acad/carreira');
    const pilula = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('Trilha'));
    await click(pilula);
    const opcao = [...document.body.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent.includes('Estagiário'));
    await click(opcao);
    expect(nav.location.search).toBe('?trilha=estagiario');
    expect(nav.type).toBe('REPLACE');
    expect(linhas().map((a) => a.querySelector('b').textContent)).toEqual(['Ana Lima']);
  });

  it('a busca pelo nome fica fora do endereço', async () => {
    await render('/acad/carreira');
    const busca = document.body.querySelector('input[type="search"]');
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(busca, 'zzz');
      busca.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Ninguém com esse nome.');
    expect(nav.location.search).toBe('');
  });

  it('com uma trilha escolhida, trocar o período troca o endereço, com replace', async () => {
    await render('/acad/carreira?trilha=professor');
    expect(document.body.textContent).toContain('dez/2026 a nov/2027');
    expect(button('Próximo período').disabled).toBe(true);
    await click(button('Período anterior'));
    expect(nav.location.search).toBe('?trilha=professor&ciclo=2026');
    expect(nav.type).toBe('REPLACE');
    expect(document.body.textContent).toContain('dez/2025 a nov/2026');
    expect(s.args.inicioMs).toBe(new Date(2025, 11, 1).getTime());
    // O período de 2026 é o primeiro: não há anterior.
    expect(button('Período anterior').disabled).toBe(true);
    await click(button('Próximo período'));
    expect(nav.location.search).toBe('?trilha=professor');
  });

  it('a falha na leitura das trilhas aparece', async () => {
    s.carreiraErro = new Error('negado');
    await render('/acad/carreira');
    expect(document.body.querySelector('[role="alert"]').textContent).toContain('Não deu para carregar tudo');
  });

  it('sem trilha escolhida, não há seletor de período', async () => {
    await render('/acad/carreira?ciclo=2026');
    expect(button('Período anterior')).toBeUndefined();
  });
});

describe('as metas', () => {
  it('moram nas Configurações: o link leva ao Plano de carreira', async () => {
    await render('/acad/carreira');
    expect([...document.body.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Pessoas3', 'Pesquisas']);
    const link = [...document.body.querySelectorAll('a')].find((a) => a.textContent === 'Configurar trilhas');
    expect(link.getAttribute('href')).toBe('/acad/configuracoes/carreira');
  });
});

describe('os consultores na lista (PR 4)', () => {
  const comConsultora = () => {
    s.users = [
      { id: 'ana', name: 'Ana Ribeiro', role: 'consultant', trilhaId: 'consultor', nivel: 'junior' },
      { id: 'g1', name: 'Gestora Gomes', role: 'admin' },
    ];
  };

  it('a consultora entra com a trilha Consultor e o link do perfil dela, e a gestora fica de fora', async () => {
    comConsultora();
    await render('/acad/carreira');
    const ana = linhas().find((a) => a.querySelector('b').textContent === 'Ana Ribeiro');
    expect(ana.getAttribute('href')).toBe('/acad/carreira/consultor/ana');
    expect(ana.textContent).toContain('Consultor');
    expect(document.body.textContent).not.toContain('Gestora Gomes');
    expect(document.body.querySelector('[role="tab"]').textContent).toBe('Pessoas4');
  });

  it('a pílula Trilha tem a Consultor, e escolher ela deixa só a consultora', async () => {
    comConsultora();
    await render('/acad/carreira');
    const pilula = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('Trilha'));
    await click(pilula);
    const opcao = [...document.body.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent.startsWith('Consultor'));
    expect(opcao.textContent).toContain('1');
    await click(opcao);
    expect(nav.location.search).toBe('?trilha=consultor');
    expect(linhas().map((a) => a.querySelector('b').textContent)).toEqual(['Ana Ribeiro']);
  });

  it('sem professor e sem consultor, a lista diz que não há ninguém', async () => {
    s.dados = { ...s.dados, professores: [] };
    await render('/acad/carreira');
    expect(document.body.textContent).toContain('Ninguém da equipe no plano de carreira ainda.');
  });
});
