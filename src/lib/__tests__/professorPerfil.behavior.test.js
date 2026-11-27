// @vitest-environment jsdom
// O perfil do professor pela trilha (plano 2026-11-27, PR 3): só o gestor vê
// a câmera e o "Trilha e nível", a aba mora no endereço, as pílulas recortam a
// carteira, o aviso de CPF conta quem não tem CPF, salvar grava a trilha, o
// nível e a data, e o professor que não existe mostra o aviso. As contas são
// as de src/lib/professor/ (testadas à parte); aqui elas vêm prontas.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const s = vi.hoisted(() => ({ carreiraErro: null, argsDados: null, dados: null, carteira: [], nps: null, npsArgs: null, respostas: [], conversao: null }));
vi.mock('../../hooks/useNpsDados.js', () => ({
  useNpsDados: (args) => { s.npsArgs = args; return s.nps; },
  useNpsRespostas: () => ({ carregando: false, erro: null, respostas: s.respostas }),
}));
vi.mock('../npsWrites.js', () => ({ gerarNovoLink: vi.fn(async () => 'novo') }));
vi.mock('../../hooks/useProfessoresDados.js', () => ({ useProfessoresDados: (args) => { s.argsDados = args; return s.dados; } }));
vi.mock('../../hooks/useCarreira.js', async () => {
  const { trilhasDe } = await import('../carreira/trilhas.js');
  return { useCarreira: () => ({ carreira: { doc: null, erro: s.carreiraErro }, trilhas: trilhasDe(null) }) };
});
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
  conversaoDoCiclo: () => s.conversao ?? ({
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
const { gerarNovoLink } = await import('../npsWrites.js');
const { somarResposta } = await import('../professor/nps.js');
const { hrefFor } = await import('../routes.js');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');
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
  const tab = ['aulas', 'nps', 'aderencia'].includes(seg) ? seg : 'carteira';
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
    presencas: [],
  };
  s.nps = { carregando: false, erro: null, pesquisas: [], totais: [] };
  s.respostas = [];
  s.carreiraErro = null;
  s.argsDados = null;
  s.conversao = null;
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
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(GeneralConfigContext.Provider, { value: { professores: s.dados.professores, modalities: [] } }, h(Screen, { appUser })))));
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
  it('o gestor vê o Voltar, a câmera e o Trilha e nível', async () => {
    await render('/acad/carreira/professor/p2');
    expect(document.querySelector('h1').textContent).toBe('Bruno Carvalho');
    expect(document.body.textContent).toContain('Júnior desde 01/12/2026');
    expect(byLabel('Voltar para Carreira').getAttribute('href')).toBe('/acad/carreira');
    expect(byLabel('Trocar a foto do professor')).toBeTruthy();
    expect(button('Trilha e nível')).toBeTruthy();
    expect(document.body.textContent).toContain('Trilha Professor');
    expect(document.body.textContent).not.toContain('Você está vendo o seu perfil');
    expect(document.body.textContent).toContain('Onde Bruno está no plano de carreira');
  });

  it('o professor vê a faixa de leitura, sem Voltar, câmera nem Trilha e nível', async () => {
    await render('/acad/carreira/professor/p2', PROFESSOR);
    expect(document.body.textContent).toContain('Só leitura. Quem troca trilha, nível e metas é o gestor.');
    expect(byLabel('Voltar para Carreira')).toBeNull();
    expect(byLabel('Trocar a foto do professor')).toBeNull();
    expect(button('Trilha e nível')).toBeUndefined();
    expect(document.body.textContent).toContain('Onde você está no plano de carreira');
  });

  it('o placar mostra a trilha, o nível e a linha do próximo nível', async () => {
    await render('/acad/carreira/professor/p2');
    const placar = byLabel('Números do plano de carreira');
    expect(placar.textContent).toContain('Trilha Professor, Júnior');
    expect(placar.textContent).toMatch(/Para Pleno: /);
  });

  it('o placar mostra a renovação e a conversão, e NPS e aderência sem dados', async () => {
    await render('/acad/carreira/professor/p2');
    const placar = byLabel('Números do plano de carreira');
    expect(placar.textContent).toContain('6 de 9 contratos renovaram');
    // Júnior com 67% contra a meta de 45%, e conversão de 53% contra a
    // academia (45%): os dois na meta.
    expect(placar.textContent).toContain('Na meta do Júnior');
    expect(placar.textContent).toContain('8 de 15 pessoas se matricularam');
    expect(placar.textContent).not.toContain('Abaixo da meta');
    expect(placar.textContent).toContain('Sem pesquisa ainda');
    expect(placar.textContent).toContain('Sem dados ainda');
  });
});

describe('as abas', () => {
  it('trocar de aba troca o endereço com replace e leva o ciclo', async () => {
    await render('/acad/carreira/professor/p2?ciclo=2026');
    expect(aba('Carteira').getAttribute('aria-selected')).toBe('true');
    await mousedown(aba('Aulas experimentais'));
    expect(nav.location.pathname).toBe('/acad/carreira/professor/p2/aulas');
    expect(nav.location.search).toBe('?ciclo=2026');
    expect(nav.type).toBe('REPLACE');
    expect(aba('Aulas experimentais').getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).toContain('Nos últimos 30 dias');
    expect(document.body.textContent).toContain('ainda não conta na conversão');
    await mousedown(aba('Carteira'));
    expect(nav.location.pathname).toBe('/acad/carreira/professor/p2');
  });
});

describe('a carteira', () => {
  it('as pílulas recortam a lista e contam cada situação', async () => {
    await render('/acad/carreira/professor/p2');
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

  it('conversão igual à da academia não passa', async () => {
    s.conversao = { professor: { vieram: 7, matricularam: 2, taxa: 29 }, academia: { vieram: 21, matricularam: 6, taxa: 29 }, passa: false, incompleto: false };
    await render('/acad/carreira/professor/p2');
    const placar = byLabel('Números do plano de carreira');
    expect(placar.textContent).toContain('7 pessoas');
    expect(placar.textContent).toContain('Abaixo da meta do Júnior');
  });

  it('o trancado mostra Trancado, e não um vencimento que já passou', async () => {
    s.carteira = [{ ...linha('t1', 'Tânia Lopes', 'vencer'), estado: 'trancado', vence: new Date(2026, 10, 10) }];
    await render('/acad/carreira/professor/p2');
    const li = document.body.querySelector('[aria-label="Carteira do professor"] li');
    expect(li.textContent).toContain('Trancado');
    expect(li.textContent).toContain('O fim previsto, 10/11/2026, anda com o trancamento');
    expect(li.textContent).not.toContain('A vencer');
    expect(li.textContent).not.toContain('vence hoje');
  });

  it('o aviso conta quem não tem CPF e mostra só essas pessoas', async () => {
    await render('/acad/carreira/professor/p2');
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
    await render('/acad/carreira/professor/p2');
    expect(document.body.textContent).not.toContain('não têm CPF');
    expect(button('Ver quem são')).toBeUndefined();
  });
});

describe('a trilha e o nível', () => {
  const radio = (t) => [...document.body.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes(t));
  const pressionar = async (el) => {
    expect(el).toBeTruthy();
    await act(async () => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  it('salvar grava a trilha, o nível e a data no professor', async () => {
    await render('/acad/carreira/professor/p2');
    await click(button('Trilha e nível'));
    await pressionar([...document.body.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'Pleno'));
    const data = document.body.querySelector('input[type="date"]');
    expect(data.value).toBe('2027-02-10');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      set.call(data, '2027-01-15');
      data.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(button('Salvar'));
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [ref, patch] = updateDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/acad/public/data/stronix_professores/p2');
    expect(Object.keys(patch).sort()).toEqual(['nivel', 'nivelDesde', 'trilhaId']);
    expect(patch.trilhaId).toBe('professor');
    expect(patch.nivel).toBe('pleno');
    expect(patch.nivelDesde.toDate()).toEqual(new Date(2027, 0, 15));
    expect(toast.success).toHaveBeenCalledWith('Trilha e nível salvos.');
  });

  it('o gestor salva outra trilha e o nível dela', async () => {
    await render('/acad/carreira/professor/p2');
    await click(button('Trilha e nível'));
    await pressionar(radio('Estagiário'));
    await pressionar(radio('Estagiário II'));
    await act(async () => { document.querySelector('form').requestSubmit(); });
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ trilhaId: 'estagiario', nivel: 'estagiario2' }));
  });
});

describe('professor que não existe', () => {
  it('mostra o aviso e, para o gestor, o link para Carreira', async () => {
    await render('/acad/carreira/professor/zz');
    expect(document.body.textContent).toContain('Não achamos esse professor.');
    expect([...document.body.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/acad/carreira' && a.textContent === 'Ver a lista da equipe')).toBe(true);
    expect(byLabel('Números do plano de carreira')).toBeNull();
    // Com os professores carregados, a janela existe e a leitura termina.
    expect(s.argsDados.inicioMs).not.toBeNull();
  });

  it('sem os professores carregados, não lê nada', async () => {
    s.dados.professores = [];
    s.dados.carregando = true;
    await render('/acad/carreira/professor/p2');
    expect(s.argsDados.inicioMs).toBeNull();
    expect(s.argsDados.fimMs).toBeNull();
    expect(document.body.textContent).toContain('Carregando o perfil');
  });
});

describe('a leitura das trilhas', () => {
  it('a falha aparece no perfil', async () => {
    s.carreiraErro = new Error('negado');
    await render('/acad/carreira/professor/p2');
    expect([...document.body.querySelectorAll('[role="alert"]')].some((el) => el.textContent.includes('Não deu para carregar tudo'))).toBe(true);
  });
});

describe('a pesquisa dos alunos no perfil', () => {
  const PERGS = [{ id: 'p1', texto: 'Recomendaria o professor?', principal: true }, { id: 'p2', texto: 'As aulas ajudam?', principal: false }];
  const comPesquisa = () => {
    let t = { pesquisaId: 'jun', professorId: 'p2' };
    [10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 8, 8].forEach((n) => { t = somarResposta(t, { p1: n, p2: 9 }); });
    s.nps = {
      carregando: false,
      erro: null,
      pesquisas: [{ id: 'jun', nome: 'Junho de 2027', inicio: '2027-06-01', fim: '2027-06-20', ciclo: 2027, situacao: 'encerrada', perguntas: PERGS, turmas: { p2: 20 } }],
      totais: [t],
    };
    s.respostas = [{ id: 'jun_l9', pesquisaId: 'jun', professorId: 'p2', leadId: 'l9', nome: 'Ana Lima', notas: { p1: 10, p2: 9 }, comentario: 'Aula ótima.' }];
  };

  it('o gestor lê todos os totais; o professor, só os dele', async () => {
    await render('/acad/carreira/professor/p2');
    expect(s.npsArgs.professorId).toBeNull();
    await render('/acad/carreira/professor/p2', PROFESSOR);
    expect(s.npsArgs.professorId).toBe('p2');
  });

  it('o placar mostra a nota do ano e os promotores', async () => {
    comPesquisa();
    await render('/acad/carreira/professor/p2');
    const placar = byLabel('Números do plano de carreira');
    expect(placar.textContent).toContain('9,33');
    expect(placar.textContent).toContain('83% deram 9 ou 10');
    expect(placar.textContent).toContain('Na meta do Júnior');
  });

  it('a aba NPS: o gestor vê quem respondeu; o professor, só os totais', async () => {
    comPesquisa();
    await render('/acad/carreira/professor/p2/nps');
    expect(document.body.textContent).toContain('Quem respondeu');
    expect(document.body.textContent).toContain('Ana Lima');
    expect(document.body.textContent).toContain('Aula ótima.');
    expect(byLabel('Pergunta principal').textContent).toContain('9,33');
    await render('/acad/carreira/professor/p2/nps', PROFESSOR);
    expect(document.body.textContent).not.toContain('Quem respondeu');
    expect(document.body.textContent).not.toContain('Aula ótima.');
    expect(byLabel('Pergunta principal').textContent).toContain('9,33');
  });

  it('o link: copiar, e só o gestor gera', async () => {
    s.dados.professores[0].npsCode = 'k7q2mx9pla';
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await render('/acad/carreira/professor/p2');
    expect(document.body.textContent).toContain('/avaliar/acad/k7q2mx9pla');
    await click(button('Copiar link'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/avaliar/acad/k7q2mx9pla'));
    expect(button('Gerar novo link')).toBeTruthy();
    await render('/acad/carreira/professor/p2', PROFESSOR);
    expect(button('Copiar link')).toBeTruthy();
    expect(button('Gerar novo link')).toBeUndefined();
  });

  it('sem link, o gestor gera e o professor lê o aviso', async () => {
    await render('/acad/carreira/professor/p2');
    await click(button('Gerar link'));
    expect(gerarNovoLink).toHaveBeenCalledWith({}, 'p2');
    await render('/acad/carreira/professor/p2', PROFESSOR);
    expect(document.body.textContent).toContain('O gestor ainda não gerou o link.');
  });
});

describe('a aderência no perfil', () => {
  it('o placar mostra o semestre em andamento e a aba, as semanas com quem chamar', async () => {
    const { normalizeContracts } = await import('../operacional/base.js');
    s.dados.clientes = [{ id: 'l9', name: 'Rita Souza', professorId: 'p2' }, { id: 'l8', name: 'Duda Lima', professorId: 'p2' }];
    const c = (leadId) => ({ id: `c-${leadId}`, leadId, planId: 'move', status: 'ativo', value: 2388, startsAt: new Date(2026, 11, 1), endsAt: new Date(2027, 11, 1), createdAt: new Date(2026, 11, 1) });
    s.dados.contratos = normalizeContracts([c('l9'), c('l8')]);
    s.dados.presencas = [
      { leadId: 'l9', semana: '2027-01-11', presencas: 2 }, { leadId: 'l8', semana: '2027-01-11', presencas: 3 },
      { leadId: 'l9', semana: '2027-01-18', presencas: 1 }, { leadId: 'l8', semana: '2027-01-18', presencas: 2 },
      { leadId: 'l8', semana: '2027-01-25', presencas: 2 },
    ];
    await render('/acad/carreira/professor/p2/aderencia');
    const placar = byLabel('Números do plano de carreira');
    expect(placar.textContent).toContain('67%');
    expect(placar.textContent).toContain('Período em andamento');
    expect(document.body.textContent).toContain('25/01 a 29/01');
    expect(document.body.textContent).toContain('1º semestre, janeiro a junho');
    await click(button('Ver quem chamar'));
    expect(document.body.textContent).toContain('Não vieram');
    expect(document.body.textContent).toContain('Rita Souza');
  });

  it('antes da primeira importação, sem dados', async () => {
    await render('/acad/carreira/professor/p2/aderencia');
    expect(document.body.textContent).toContain('Sem dados ainda.');
  });
});
