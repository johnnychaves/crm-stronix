// @vitest-environment jsdom
// O perfil do professor (plano 2026-11-25, Tarefa 11): só o gestor vê a
// câmera e o "Trocar nível", a aba mora no endereço, as pílulas recortam a
// carteira, o aviso de CPF conta quem não tem CPF, salvar o nível grava o
// nível e a data, e o professor que não existe mostra o aviso. As contas são
// as de src/lib/professor/ (testadas à parte); aqui elas vêm prontas.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const s = vi.hoisted(() => ({ dados: null, carteira: [] }));
vi.mock('../../hooks/useProfessoresDados.js', () => ({ useProfessoresDados: () => s.dados }));
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {}, storage: {}, PROFESSORS_PATH: 'stronix_professores' }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: vi.fn((_db, ...segs) => ({ path: segs.join('/') })),
  updateDoc: vi.fn(async () => {}),
}));
vi.mock('../professor/renovacao.js', () => ({
  renovacaoDoCiclo: () => ({ venceram: 9, renovados: 6, taxa: 67, linhas: [] }),
  carteiraDoCiclo: () => s.carteira,
}));
vi.mock('../professor/conversao.js', () => ({
  conversaoDoCiclo: () => ({
    professor: { vieram: 15, matricularam: 8, taxa: 53 },
    academia: { vieram: 140, matricularam: 63, taxa: 45 },
    passa: true,
    incompleto: false,
  }),
  pessoasDasAulas: () => [
    { leadId: 'a1', nome: 'Isabela Paiva', ultima: new Date(2027, 1, 1), modalidade: 'Funcional', matriculou: false, naJanela: true },
    { leadId: 'a2', nome: 'Larissa Tavares', ultima: new Date(2026, 11, 14), modalidade: 'Funcional', matriculou: true, naJanela: false },
  ],
}));

const { updateDoc } = await import('firebase/firestore');
const { hrefFor } = await import('../routes.js');
const { METAS_PADRAO } = await import('../professor/metas.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { ProfessorPerfilView } = await import('../../views/professores/ProfessorPerfilView.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'g1', role: 'admin' };
const PROFESSOR = { id: 'u9', role: 'professor', professorId: 'p2' };
const linha = (id, name, situacao, semCpf = false) => ({
  lead: { id, name },
  contrato: { planId: 'move' },
  situacao,
  vence: situacao === 'vencer' ? new Date(2027, 5, 1) : new Date(2027, 0, 10),
  semCpf,
});

const nav = { location: null, type: null };
function Screen({ appUser }) {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const [, , , , profId, seg] = location.pathname.split('/');
  const tab = seg === 'aulas-experimentais' ? 'aulas' : 'carteira';
  // O mesmo que o goToSub do App faz com a tela já aberta, levando o ciclo.
  const onTab = (subId) => navigate(hrefFor('acad', 'professorPerfil', { sub: subId, profId }) + location.search, { replace: true, state: location.state });
  return h(ProfessorPerfilView, { db: {}, appUser, tenantId: 'acad', profId, tab, onTab, listenersActive: true });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date(2027, 1, 10, 10, 0), toFake: ['Date'] });
  s.dados = {
    carregando: false,
    erro: null,
    professores: [{ id: 'p2', nome: 'Bruno Carvalho', nivel: 'junior', nivelDesde: new Date(2026, 11, 1), modalidadeIds: ['func'] }],
    planos: [{ id: 'move', name: 'Clube+ Move', modalityIds: ['func'] }],
    contratos: [],
    clientes: [],
    aulas: [],
    metas: METAS_PADRAO,
    salvarMetas: vi.fn(),
  };
  s.carteira = [
    linha('l1', 'Gustavo Rangel', 'vencer', true),
    linha('l2', 'Pedro Sales', 'vencer'),
    linha('l3', 'Sabrina Rocha', 'vencer', true),
    linha('l4', 'Camila Duarte', 'renovou'),
    linha('l5', 'Bianca Teles', 'nao'),
  ];
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

const render = async (entry, appUser = GESTOR) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(Screen, { appUser }))));
  });
};
const byLabel = (label) => document.body.querySelector(`[aria-label="${label}"]`);
const button = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
// O Radix troca de aba no mousedown do botão esquerdo, e não no click.
const mousedown = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const aba = (comeco) => [...document.body.querySelectorAll('[role="tab"]')].find((t) => t.textContent.startsWith(comeco));
const pilula = (comeco) => [...document.body.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.startsWith(comeco));
const alunos = () => [...document.body.querySelectorAll('[aria-label="Carteira do professor"] li')].map((li) => li.querySelector('.truncate').textContent);

describe('o que cada papel vê', () => {
  it('o gestor vê o Voltar, a câmera e o Trocar nível', async () => {
    await render('/acad/professores/perfil/p2');
    expect(document.querySelector('h1').textContent).toBe('Bruno Carvalho');
    expect(document.body.textContent).toContain('Júnior desde 01/12/2026');
    expect(byLabel('Voltar para Professores').getAttribute('href')).toBe('/acad/professores');
    expect(byLabel('Trocar a foto do professor')).toBeTruthy();
    expect(button('Trocar nível')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Você está vendo o seu perfil');
    expect(document.body.textContent).toContain('Onde Bruno está no plano de carreira');
  });

  it('o professor vê a faixa de leitura, sem Voltar, câmera nem Trocar nível', async () => {
    await render('/acad/professores/perfil/p2', PROFESSOR);
    expect(document.body.textContent).toContain('Você está vendo o seu perfil. Só o gestor muda o nível e a foto.');
    expect(byLabel('Voltar para Professores')).toBeNull();
    expect(byLabel('Trocar a foto do professor')).toBeNull();
    expect(button('Trocar nível')).toBeUndefined();
    expect(document.body.textContent).toContain('Onde você está no plano de carreira');
  });

  it('o placar mostra a renovação e a conversão, e NPS e aderência sem dados', async () => {
    await render('/acad/professores/perfil/p2');
    const placar = byLabel('Critérios do plano de carreira');
    expect(placar.textContent).toContain('6 de 9 contratos renovaram');
    expect(placar.textContent).toContain('8 de 15 pessoas se matricularam');
    expect(placar.textContent).toContain('Acima da academia');
    expect(placar.textContent).toContain('Sem pesquisa ainda');
    expect(placar.textContent).toContain('Sem dados ainda');
  });
});

describe('as abas', () => {
  it('trocar de aba troca o endereço com replace e leva o ciclo', async () => {
    await render('/acad/professores/perfil/p2?ciclo=2026');
    expect(aba('Carteira').getAttribute('aria-selected')).toBe('true');
    await mousedown(aba('Aulas experimentais'));
    expect(nav.location.pathname).toBe('/acad/professores/perfil/p2/aulas-experimentais');
    expect(nav.location.search).toBe('?ciclo=2026');
    expect(nav.type).toBe('REPLACE');
    expect(aba('Aulas experimentais').getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).toContain('Nos últimos 30 dias');
    expect(document.body.textContent).toContain('ainda não conta na conversão');
    await mousedown(aba('Carteira'));
    expect(nav.location.pathname).toBe('/acad/professores/perfil/p2');
  });
});

describe('a carteira', () => {
  it('as pílulas recortam a lista e contam cada situação', async () => {
    await render('/acad/professores/perfil/p2');
    expect(pilula('Todos').textContent).toBe('Todos 5');
    expect(pilula('A vencer').textContent).toBe('A vencer 3');
    expect(alunos()).toHaveLength(5);
    await click(pilula('Renovou'));
    expect(pilula('Renovou').getAttribute('aria-pressed')).toBe('true');
    expect(alunos()).toEqual(['Camila Duarte']);
    await click(pilula('Não renovou'));
    expect(alunos()).toEqual(['Bianca Teles']);
    expect(document.body.textContent).toContain('Clube+ Move');
  });

  it('o aviso conta quem não tem CPF e mostra só essas pessoas', async () => {
    await render('/acad/professores/perfil/p2');
    expect(document.body.textContent).toContain('2 alunos não têm CPF no cadastro e não conseguem responder o NPS.');
    await click(button('Ver quem são'));
    expect(alunos()).toEqual(['Gustavo Rangel', 'Sabrina Rocha']);
    expect(pilula('Todos').textContent).toBe('Todos 2');
    await click(pilula('Renovou'));
    expect(document.body.textContent).toContain('Ninguém nesta situação.');
    await click(button('Mostrar todos'));
    expect(alunos()).toEqual(['Camila Duarte']);
  });

  it('sem ninguém sem CPF, o aviso não aparece', async () => {
    s.carteira = [linha('l4', 'Camila Duarte', 'renovou')];
    await render('/acad/professores/perfil/p2');
    expect(document.body.textContent).not.toContain('não têm CPF');
    expect(button('Ver quem são')).toBeUndefined();
  });
});

describe('o nível', () => {
  it('salvar grava o nível e a data no professor', async () => {
    await render('/acad/professores/perfil/p2');
    await click(button('Trocar nível'));
    const pleno = [...document.body.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'Pleno');
    await click(pleno);
    const data = document.body.querySelector('input[type="date"]');
    expect(data.value).toBe('2027-02-10');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      set.call(data, '2027-01-15');
      data.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(button('Salvar nível'));
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [ref, patch] = updateDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/acad/public/data/stronix_professores/p2');
    expect(Object.keys(patch).sort()).toEqual(['nivel', 'nivelDesde']);
    expect(patch.nivel).toBe('pleno');
    expect(patch.nivelDesde.toDate()).toEqual(new Date(2027, 0, 15));
    expect(toast.success).toHaveBeenCalledWith('Nível salvo.');
  });
});

describe('professor que não existe', () => {
  it('mostra o aviso e, para o gestor, o link para Professores', async () => {
    await render('/acad/professores/perfil/zz');
    expect(document.body.textContent).toContain('Não achamos esse professor.');
    expect([...document.body.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/acad/professores')).toBe(true);
    expect(byLabel('Critérios do plano de carreira')).toBeNull();
  });
});
