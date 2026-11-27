// @vitest-environment jsdom
// O perfil do consultor (plano de carreira, PR 4): o gestor vê o "Trilha e
// nível" e grava no cadastro da pessoa, o consultor logado só lê, as abas
// moram no endereço e cada nome abre a ficha. As contas são as de
// src/lib/carreiraConsultor.js (testadas à parte); aqui elas vêm prontas.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const s = vi.hoisted(() => ({ dados: null }));
vi.mock('../../hooks/useConsultoresDados.js', () => ({ useConsultoresDados: () => s.dados }));
vi.mock('../../hooks/useCarreira.js', async () => {
  const { trilhasDe } = await import('../carreira/trilhas.js');
  return { useCarreira: () => ({ carreira: { doc: null, erro: null }, trilhas: trilhasDe(null) }) };
});
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {}, storage: {}, USERS_PATH: 'stronix_users', PROFESSORS_PATH: 'stronix_professores' }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: vi.fn((_db, ...segs) => ({ path: segs.join('/') })),
  updateDoc: vi.fn(async () => {}),
}));
vi.mock('../carreiraConsultor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  contasDoConsultor: () => ({
    vendasEm: 'reais',
    vendas: {
      linhas: [{ contrato: { id: 'c1', leadId: 'l1', leadName: 'Carla Souza', planName: 'Clube+ Start' }, quando: new Date(2026, 9, 3), tipo: 'renovacao', valor: 1309 }],
      total: 1309, quantidade: 1, renovacoes: 1, matriculas: 0, meses: 1, porMes: { valor: 1309, quantidade: 1 }, valor: 1309,
    },
    conversao: { consultor: { leads: 4, matriculas: 1, taxa: 25 }, academia: { leads: 40, matriculas: 12, taxa: 30 }, linhas: [], incompleto: false },
    renovacao: { linhas: [], taxa: null, renovados: 0, decididos: 0 },
    metaDiaria: { dias: [{ key: '2026-10-02', inicio: new Date(2026, 9, 2), bateu: true }], bateram: 1, total: 1, taxa: 100 },
    resultados: { consultorConversao: { valor: 25, academia: 30 }, vendas: { valor: 1309 }, consultorRenovacao: { valor: null }, metaDiaria: { valor: 100 } },
  }),
}));

const { updateDoc } = await import('firebase/firestore');
const { hrefFor } = await import('../routes.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { LeadProfileContext } = await import('../../contexts/LeadProfileContext.jsx');
const PERFIL = { openProfile: () => {}, leadHref: (id) => `/acad/ficha/${id}`, from: 'consultorPerfil' };
const { ConsultorPerfilView } = await import('../../views/professores/ConsultorPerfilView.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const GESTOR = { id: 'g', role: 'admin', tenantModules: ['faltosos'] };
const ANA = { id: 'ana', role: 'consultant', tenantModules: ['faltosos'] };
const USERS = [{ id: 'ana', name: 'Ana Ribeiro', role: 'consultant', trilhaId: 'consultor', nivel: 'junior', nivelDesde: new Date(2026, 2, 1) }];

const nav = { abas: [] };
function Screen({ appUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [, , , , profId, seg] = location.pathname.split('/');
  const tab = seg === 'meta-diaria' ? 'meta' : (seg || null);
  const onTab = (subId) => {
    nav.abas.push(subId);
    navigate(hrefFor('acad', 'consultorPerfil', { sub: subId, profId }) + location.search, { replace: true });
  };
  return h(ConsultorPerfilView, { db: {}, appUser, tenantId: 'acad', profId, tab, onTab, usersList: USERS, funnels: [], listenersActive: true });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date(2026, 9, 20, 10, 0), toFake: ['Date'] });
  nav.abas = [];
  s.dados = { carregando: false, erro: null, crm: {}, contratos: [], clientesPorId: new Map(), history: [], metaWeekdays: [1, 2, 3, 4, 5], graceDays: 15 };
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
    root.render(h(MemoryRouter, { initialEntries: [entry] }, h(ToastContext.Provider, { value: toast }, h(LeadProfileContext.Provider, { value: PERFIL }, h(Screen, { appUser })))));
  });
};
const button = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const aba = (comeco) => [...document.body.querySelectorAll('[role="tab"]')].find((t) => t.textContent.startsWith(comeco));
const pressionar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('perfil do consultor', () => {
  it('o gestor vê a trilha, o Trilha e nível e as vendas com o link da ficha', async () => {
    await render('/acad/carreira/consultor/ana');
    const texto = document.body.textContent;
    expect(texto).toContain('Ana Ribeiro');
    expect(texto).toContain('Trilha Consultor');
    expect(button('Trilha e nível')).toBeTruthy();
    expect(texto).toContain('Renovação');
    expect(texto).toContain('valor dos contratos, não o que entrou no caixa');
    const link = [...document.body.querySelectorAll('a')].find((a) => a.textContent === 'Carla Souza');
    expect(link?.getAttribute('href')).toBe('/acad/ficha/l1');
  });

  it('a consultora logada só lê', async () => {
    await render('/acad/carreira/consultor/ana', ANA);
    expect(document.body.textContent).toContain('Só leitura. Quem troca trilha, nível e metas é o gestor.');
    expect(button('Trilha e nível')).toBeUndefined();
    expect(document.body.textContent).toContain('Onde você está no plano de carreira');
  });

  it('a aba mora no endereço e a Meta diária mostra os dias', async () => {
    await render('/acad/carreira/consultor/ana');
    await pressionar(aba('Meta diária'));
    expect(nav.abas).toEqual(['meta']);
    expect(document.body.textContent).toContain('Bateu');
    expect(document.body.textContent).toContain('02/10');
  });

  it('o consultor que não existe mostra o aviso', async () => {
    await render('/acad/carreira/consultor/zeca');
    expect(document.body.textContent).toContain('Não achamos esse consultor.');
  });

  it('salvar grava a trilha, o nível e a data no cadastro da pessoa', async () => {
    await render('/acad/carreira/consultor/ana');
    await pressionar(button('Trilha e nível'));
    await pressionar([...document.body.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'Pleno'));
    const data = document.body.querySelector('input[type="date"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      set.call(data, '2026-10-01');
      data.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await pressionar(button('Salvar'));
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [ref, patch] = updateDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/acad/public/data/stronix_users/ana');
    expect(Object.keys(patch).sort()).toEqual(['nivel', 'nivelDesde', 'trilhaId']);
    expect(patch.trilhaId).toBe('consultor');
    expect(patch.nivel).toBe('pleno');
    expect(patch.nivelDesde.toDate()).toEqual(new Date(2026, 9, 1));
  });
});
