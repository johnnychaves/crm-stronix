// @vitest-environment jsdom
// Configurações → Plano de carreira (plano 2026-11-26-plano-de-carreira-02,
// tarefa 8): a lista das trilhas, a trilha aberta pelo endereço, a trilha nova,
// arquivar e desarquivar, e o que vai para o salvarTrilha.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const s = vi.hoisted(() => ({ trilhas: null, salvar: null }));
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));
vi.mock('../../hooks/useCarreira.js', () => ({
  useCarreira: () => ({ carreira: { doc: null, erro: null }, trilhas: s.trilhas }),
}));
vi.mock('../carreiraWrites.js', () => ({ salvarTrilha: (...args) => s.salvar(...args) }));

const { hrefFor, parseAppPath } = await import('../routes.js');
const { trilhasDe } = await import('../carreira/trilhas.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');
const { CarreiraSettingsSection } = await import('../../views/settings/carreira/CarreiraSettingsSection.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const PROFESSORES = [
  { id: 'p1', nome: 'Ana', nivel: 'junior' },
  { id: 'p2', nome: 'Bruno', nivel: 'junior' },
  { id: 'p3', nome: 'Carla', nivel: 'pleno' },
  { id: 'p4', nome: 'Davi', ativo: false, nivel: 'senior' },
  { id: 'p5', nome: 'Eva', trilhaId: 'estagiario', nivel: 'estagiario1' },
];
const USUARIOS = [{ id: 'g1', name: 'Gestor', role: 'admin' }, { id: 'c1', name: 'Caio', role: 'consultant' }];
const APP_USER = { id: 'g1', role: 'admin' };
const ARQUIVADA = { nome: 'Pilates teste', base: 'professor', niveis: [{ id: 'n1', nome: 'Único', mesesMinimos: null }], arquivada: true, ordem: 5 };

const nav = { location: null, type: null };
function Tela() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const r = parseAppPath(location.pathname);
  // O mesmo que o goToSub do App faz com a tela já aberta.
  const onAba = (id, aba) => navigate(hrefFor('acad', 'settings', { sub: 'carreira', trilhaId: id, trilhaAba: aba }), { replace: true, state: location.state });
  return h(CarreiraSettingsSection, {
    db: {}, appUser: APP_USER, usersList: USUARIOS, listenersActive: true, tenantSlug: 'acad',
    trilhaId: r.trilhaId ?? null, trilhaAba: r.trilhaAba ?? null, onAba,
  });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  s.trilhas = trilhasDe({ trilhas: { 'trilha-arq': ARQUIVADA } });
  s.salvar = vi.fn(async () => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async (entry) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] },
      h(ToastContext.Provider, { value: toast },
        h(GeneralConfigContext.Provider, { value: { professores: PROFESSORES, modalities: [{ id: 'func', name: 'Funcional' }] } },
          h(Tela)))));
  });
};
const cartoes = () => [...document.body.querySelectorAll('ul a')];
const campo = (rotulo) => document.body.querySelector(`input[aria-label="${rotulo}"]`);
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === rotulo || b.textContent.trim() === rotulo);
const aba = (texto) => [...document.body.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === texto);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const mousedown = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const digitar = async (el, v) => {
  expect(el).toBeTruthy();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('a lista das trilhas', () => {
  it('um cartão por trilha, com o link, para quem e as pessoas, e as arquivadas recolhidas', async () => {
    await render('/acad/configuracoes/carreira');
    expect(cartoes().map((a) => a.getAttribute('href'))).toEqual([
      '/acad/configuracoes/carreira/professor',
      '/acad/configuracoes/carreira/estagiario',
      '/acad/configuracoes/carreira/consultor',
    ]);
    const [professor, estagiario, consultor] = cartoes();
    expect(professor.textContent).toContain('Para professores formados, 3 pessoas');
    expect(professor.textContent).toContain('Avaliação em dezembro');
    expect(professor.textContent).toContain('4 números contam');
    expect(estagiario.textContent).toContain('Para estagiários, 1 pessoa');
    expect(estagiario.textContent).toContain('Avaliação em junho e dezembro');
    expect(consultor.textContent).toContain('Para consultores, ninguém');
    expect(document.body.querySelector('summary').textContent).toBe('Arquivadas (1)');
    expect(document.body.textContent).toContain('Pilates teste');
  });

  it('o id que não existe e a trilha arquivada caem na lista', async () => {
    await render('/acad/configuracoes/carreira/xyz');
    expect(cartoes()).toHaveLength(3);
    act(() => root.unmount());
    root = createRoot(container);
    await render('/acad/configuracoes/carreira/trilha-arq');
    expect(cartoes()).toHaveLength(3);
    expect(campo('Nome da trilha')).toBeNull();
  });

  it('Desarquivar grava a trilha sem o arquivada', async () => {
    await render('/acad/configuracoes/carreira');
    await clicar(botao('Desarquivar'));
    const [, args] = s.salvar.mock.calls[0];
    expect(args.trilha).toMatchObject({ id: 'trilha-arq', arquivada: false });
    expect(args.gravada).toMatchObject({ id: 'trilha-arq', arquivada: true });
    expect(toast.success).toHaveBeenCalledWith('Trilha desarquivada.');
  });
});

describe('a trilha aberta', () => {
  it('o endereço abre a trilha, com as pessoas dela', async () => {
    await render('/acad/configuracoes/carreira/professor');
    expect(campo('Nome da trilha').value).toBe('Professor');
    expect(document.body.textContent).toContain('3 pessoas nesta trilha');
    expect(document.body.textContent).toContain('Para professores formados');
  });

  it('trocar de aba troca o endereço com replace', async () => {
    await render('/acad/configuracoes/carreira/professor');
    await mousedown(aba('Regras da trilha'));
    expect(nav.location.pathname).toBe('/acad/configuracoes/carreira/professor/regras');
    expect(nav.type).toBe('REPLACE');
    expect(document.body.textContent).toContain('Como cada número conta');
  });

  it('Salvar passa a gravada, as outras trilhas, as pessoas e quem salvou', async () => {
    await render('/acad/configuracoes/carreira/professor');
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await clicar(botao('Salvar trilha'));
    const [db, args] = s.salvar.mock.calls[0];
    expect(db).toEqual({});
    expect(args.trilha.numeros.renovacao.metas.junior).toBe(50);
    expect(args.gravada).toMatchObject({ id: 'professor', padrao: true });
    expect(args.outras.map((t) => t.id)).toEqual(['estagiario', 'consultor', 'trilha-arq']);
    expect(args.pessoasPorNivel).toEqual({ junior: 2, pleno: 1, senior: 0, _semNivel: 0 });
    expect(args.appUser).toBe(APP_USER);
  });

  it('Arquivar sem gente grava arquivada e volta à lista com replace', async () => {
    await render('/acad/configuracoes/carreira/consultor');
    await clicar(botao('Arquivar trilha'));
    const [, args] = s.salvar.mock.calls[0];
    expect(args.trilha).toMatchObject({ id: 'consultor', arquivada: true });
    expect(args.gravada).toMatchObject({ id: 'consultor', arquivada: false });
    expect(toast.success).toHaveBeenCalledWith('Trilha arquivada.');
    expect(nav.location.pathname).toBe('/acad/configuracoes/carreira');
    expect(nav.type).toBe('REPLACE');
  });
});

describe('a trilha nova', () => {
  it('abre em branco no endereço dela e salva sem gravada', async () => {
    await render('/acad/configuracoes/carreira');
    await clicar(botao('Nova trilha'));
    await clicar(botao('Para consultores'));
    expect(nav.location.pathname).toMatch(/^\/acad\/configuracoes\/carreira\/trilha-[0-9a-z]{6}$/);
    expect(nav.type).toBe('PUSH');
    expect(campo('Nome da trilha').value).toBe('');
    expect(document.body.textContent).toContain('Para consultores');
    expect(document.body.querySelector('[role="status"]').textContent).toBe('Dê um nome à trilha.');
    await digitar(campo('Nome da trilha'), 'Consultor sênior');
    await clicar(botao('Salvar trilha'));
    const [, args] = s.salvar.mock.calls[0];
    expect(args.gravada).toBeNull();
    expect(args.trilha).toMatchObject({ nome: 'Consultor sênior', base: 'consultor', ordem: 6 });
    expect(nav.location.pathname.endsWith(args.trilha.id)).toBe(true);
  });

  it('Descartar volta à lista com replace', async () => {
    await render('/acad/configuracoes/carreira');
    await clicar(botao('Nova trilha'));
    await clicar(botao('Para professores'));
    await clicar(botao('Descartar'));
    expect(nav.location.pathname).toBe('/acad/configuracoes/carreira');
    expect(nav.type).toBe('REPLACE');
    expect(cartoes()).toHaveLength(3);
  });
});
