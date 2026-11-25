// @vitest-environment jsdom
// A tela Professores do gestor (plano 2026-11-25, Tarefa 10): a lista mostra
// só os ativos, cada linha leva ao perfil, o ciclo mora no endereço, e as
// metas recusam a faixa invertida e gravam o documento inteiro.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = vi.hoisted(() => ({ dados: null, args: null }));
vi.mock('../../hooks/useProfessoresDados.js', () => ({
  useProfessoresDados: (args) => {
    s.args = args;
    return s.dados;
  },
}));
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));

const { hrefFor } = await import('../routes.js');
const { METAS_PADRAO } = await import('../professor/metas.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { ProfessoresView } = await import('../../views/professores/ProfessoresView.jsx');
const { criterioRenovacao, criterioConversao } = await import('../../views/professores/criterios.js');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const PROFESSORES = [
  { id: 'p2', nome: 'Bruno Carvalho', nivel: 'junior', modalidadeIds: ['func'] },
  { id: 'p3', nome: 'Zeca Inativo', ativo: false, nivel: 'pleno', modalidadeIds: ['func'] },
  { id: 'p1', nome: 'Ana Lima', ativo: true, modalidadeIds: ['func'] },
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
  const tab = location.pathname.endsWith('/professores/metas') ? 'metas' : 'lista';
  // O mesmo que o goToSub do App faz com a tela já aberta.
  const onTab = (subId) => navigate(hrefFor('acad', 'professores', { sub: subId }), { replace: true, state: location.state });
  return h(ProfessoresView, { db: {}, appUser: { id: 'g1', role: 'admin' }, tenantId: 'acad', tab, onTab, listenersActive: true });
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
    metas: METAS_PADRAO,
    salvarMetas: vi.fn(async () => {}),
  };
  s.args = null;
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
const setValue = async (el, v) => {
  expect(el).toBeTruthy();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const linhas = () => [...document.body.querySelectorAll('li a')];

describe('a lista de professores', () => {
  it('mostra os ativos em ordem de nome, e o inativo fica de fora', async () => {
    await render('/acad/professores');
    const nomes = linhas().map((a) => a.querySelector('b').textContent);
    expect(nomes).toEqual(['Ana Lima', 'Bruno Carvalho']);
    expect(document.body.textContent).not.toContain('Zeca Inativo');
    expect(document.body.querySelector('[role="tab"]').textContent).toBe('Professores2');
  });

  it('cada linha leva ao perfil do professor', async () => {
    await render('/acad/professores');
    expect(linhas().map((a) => a.getAttribute('href'))).toEqual([
      '/acad/professores/perfil/p1',
      '/acad/professores/perfil/p2',
    ]);
  });

  it('sem nível, sem pesquisa e sem dados aparecem em texto, também para o leitor de tela', async () => {
    await render('/acad/professores');
    const [ana, bruno] = linhas();
    expect(ana.textContent).toContain('Sem nível');
    expect(ana.textContent).toContain('sem pesquisa ainda');
    expect(ana.textContent).toContain('sem dados ainda');
    expect(ana.getAttribute('aria-label')).toBe(
      'Ana Lima, Sem nível. Renovação, nenhum contrato venceu. Nota dos alunos, sem pesquisa ainda. '
      + 'Conversão, ninguém veio. Aderência, sem dados ainda. Abrir perfil',
    );
    expect(bruno.getAttribute('aria-label')).toMatch(/^Bruno Carvalho, Júnior\./);
  });

  it('trocar o ciclo troca o endereço, com replace', async () => {
    await render('/acad/professores');
    expect(s.args.ciclo).toBe(2027);
    expect(document.body.textContent).toContain('Ciclo dez/2026 a nov/2027');
    expect(button('Próximo ciclo').disabled).toBe(true);
    await click(button('Ciclo anterior'));
    expect(nav.location.search).toBe('?ciclo=2026');
    expect(nav.type).toBe('REPLACE');
    expect(s.args.ciclo).toBe(2026);
    expect(document.body.textContent).toContain('Ciclo dez/2025 a nov/2026');
    // 2026 é o primeiro ciclo: não há anterior.
    expect(button('Ciclo anterior').disabled).toBe(true);
    await click(button('Próximo ciclo'));
    expect(nav.location.search).toBe('');
  });
});

describe('as metas', () => {
  it('faixa invertida mostra o erro no campo e desliga o Salvar', async () => {
    await render('/acad/professores/metas');
    const min = document.getElementById('meta-aderencia-faixaMin');
    await setValue(min, '80');
    const erro = document.getElementById('meta-aderencia-erro');
    expect(erro.textContent).toBe('O começo da faixa precisa ser menor que o fim.');
    expect(min.getAttribute('aria-invalid')).toBe('true');
    expect(min.getAttribute('aria-describedby')).toBe('meta-aderencia-erro');
    expect(button('Salvar metas').disabled).toBe(true);
    await setValue(min, '60');
    expect(erro.textContent).toBe('');
    expect(button('Salvar metas').disabled).toBe(false);
  });

  it('salvar grava o documento inteiro e avisa que salvou', async () => {
    await render('/acad/professores/metas');
    await setValue(document.getElementById('meta-renovacao-junior'), '50');
    await click(button('Salvar metas'));
    expect(s.dados.salvarMetas).toHaveBeenCalledWith({
      renovacao: { junior: 50, pleno: 55, senior: 65 },
      nps: { meta: 9 },
      conversao: { tolerancia: 0, janelaDias: 30 },
      aderencia: { barra: 2, faixaMin: 60, faixaMax: 70 },
    });
    expect(document.body.querySelector('[role="status"]').textContent).toBe('Metas salvas.');
  });

  it('a falha ao salvar vira aviso', async () => {
    s.dados.salvarMetas = vi.fn(async () => { throw new Error('rede'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render('/acad/professores/metas');
    await click(button('Salvar metas'));
    expect(toast.error).toHaveBeenCalledWith('Não deu para salvar as metas. Tente de novo.');
    expect(document.body.querySelector('[role="status"]').textContent).toBe('');
  });
});

describe('o texto de cada critério', () => {
  it('renovação contra a média do nível: chegar nela bate, sem nível não compara', () => {
    expect(criterioRenovacao({ taxa: 45 }, METAS_PADRAO, 'junior')).toEqual({ valor: '45%', ref: 'esperado 45%', estado: 'ok' });
    expect(criterioRenovacao({ taxa: 54 }, METAS_PADRAO, 'pleno')).toEqual({ valor: '54%', ref: 'esperado 55%', estado: 'baixo' });
    expect(criterioRenovacao({ taxa: 67 }, METAS_PADRAO, undefined)).toEqual({ valor: '67%', ref: 'defina o nível', estado: 'sem' });
    expect(criterioRenovacao({ taxa: null }, METAS_PADRAO, 'senior')).toEqual({ valor: null, ref: 'nenhum contrato venceu', estado: 'sem' });
  });
  it('conversão segue o passa da conta e mostra a academia', () => {
    const c = (prof, acad, passa) => ({ professor: { taxa: prof }, academia: { taxa: acad }, passa });
    expect(criterioConversao(c(53, 45, true))).toEqual({ valor: '53%', ref: 'academia 45%', estado: 'ok' });
    expect(criterioConversao(c(45, 45, false))).toEqual({ valor: '45%', ref: 'academia 45%', estado: 'baixo' });
    expect(criterioConversao(c(null, 45, null))).toEqual({ valor: null, ref: 'ninguém veio', estado: 'sem' });
  });
});
