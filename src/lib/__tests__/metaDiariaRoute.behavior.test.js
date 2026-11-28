// @vitest-environment jsdom
// A rota da Meta diária: professor, gestor com o seletor e consultor.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const montagens = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../components/dailygoal/professor/ProfessorMetaScreen.jsx', () => ({
  ProfessorMetaScreen: (p) => {
    useState(() => { montagens.n += 1; });
    return h('div', { 'data-testid': 'prof', 'data-gestor': String(p.gestorVendo), 'data-nome': p.nomeVisto }, h('header', null, p.seletor));
  },
}));
// O seletor vai para dentro da DailyGoalView (faixa do topo), e não antes dela.
// O botão "filtro" troca a categoria pelo endereço, como o "Foco em" da Meta.
vi.mock('../../views/DailyGoalView.jsx', async () => {
  const { useScreenParams } = await import('../../hooks/useScreenParams.js');
  const vazio = {};
  return {
    DailyGoalView: ({ seletor, vendo, paramsCtx }) => {
      const [, setParams] = useScreenParams('dailyGoal', paramsCtx || vazio);
      return h('div', { 'data-testid': 'consultor', 'data-vendo': vendo?.id || '' },
        seletor, h('button', { type: 'button', onClick: () => setParams({ cat: 'atrasado' }) }, 'filtro'));
    },
  };
});
vi.mock('../../hooks/useFaltososDoProfessor.js', () => ({ useFaltososDoProfessor: () => ({ estados: [], leadsById: new Map() }) }));
vi.mock('../../hooks/useAulasDeHojeDoProfessor.js', () => ({ useAulasDeHojeDoProfessor: () => [] }));
vi.mock('../../lib/faltosos/contatoDeFaltaWrites.js', () => ({ registrarContatoDeFalta: vi.fn(), marcarJaVoltou: vi.fn() }));

const { MetaDiariaRoute } = await import('../../views/MetaDiariaRoute.jsx');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');

const professores = [{ id: 'p1', nome: 'Heloísa Dias' }, { id: 'p2', nome: 'Gilson' }];
const modulos = ['faltosos'];
const gestor = { id: 'g', role: 'admin', tenantModules: modulos };
const consultor = { id: 'c', role: 'consultant', tenantModules: modulos };
const professor = { id: 'u', role: 'professor', professorId: 'p2', name: 'Gilson Souza', tenantModules: modulos };
const usersList = [
  { id: 'g', role: 'admin', name: 'Gestora' },
  { id: 'c1', role: 'consultant', name: 'Ana Souza' },
  { id: 'c2', role: 'consultant', name: 'Bruno Lima', active: false },
  professor,
];

let root = null;
async function montar(appUser, search = '') {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [`/x/meta-diaria${search}`] },
      h(GeneralConfigContext.Provider, { value: { professores, faltosos: null } },
        h(MetaDiariaRoute, { db: {}, appUser, listenersActive: true, dailyGoalProps: { usersList } }))));
  });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; });
const q = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('MetaDiariaRoute', () => {
  it('professor: a tela dele, sem seletor', async () => {
    await montar(professor);
    expect(q('prof').dataset.gestor).toBe('false');
    expect(document.querySelector('select')).toBeNull();
  });
  it('gestor com ?prof: a tela do professor escolhido e o seletor', async () => {
    await montar(gestor, '?prof=p1');
    expect(q('prof').dataset.gestor).toBe('true');
    expect(q('prof').dataset.nome).toBe('Heloísa');
    expect(document.querySelector('select').value).toBe('p:p1');
    // No mesmo lugar da Meta do consultor: dentro do cabeçalho.
    expect(document.querySelector('header select')).not.toBeNull();
  });
  it('gestor trocando de professor remonta a tela, para o estado dela recomeçar', async () => {
    montagens.n = 0;
    await montar(gestor, '?prof=p1');
    expect(montagens.n).toBe(1);
    const sel = document.querySelector('select');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'p:p2');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(q('prof').dataset.nome).toBe('Gilson');
    expect(montagens.n).toBe(2);
  });
  it('consultor com ?prof: a Meta dele, sem seletor', async () => {
    await montar(consultor, '?prof=p1');
    expect(q('consultor')).not.toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });
  it('gestor sem ?prof: a DailyGoalView e o seletor em Minha meta', async () => {
    await montar(gestor);
    expect(q('consultor')).not.toBeNull();
    expect(document.querySelector('select').value).toBe('');
    expect(q('consultor').querySelector('select')).not.toBeNull();
  });
  it('gestor sem o módulo: o seletor tem só os consultores ativos, e a Meta escolhida abre só para olhar', async () => {
    await montar({ id: 'g', role: 'admin', tenantModules: [] });
    const opcoes = [...document.querySelectorAll('select option')].map((o) => o.textContent);
    expect(opcoes).toEqual(['Minha meta', 'Ana Souza']);
    const sel = document.querySelector('select');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'c:c1');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(q('consultor').dataset.vendo).toBe('c1');
  });
  it('gestor com o módulo: consultores e professores em grupos', async () => {
    await montar(gestor, '?consultor=c1');
    expect([...document.querySelectorAll('select optgroup')].map((g) => g.label)).toEqual(['Consultores', 'Professores']);
    expect(document.querySelector('select').value).toBe('c:c1');
    expect(q('consultor').dataset.vendo).toBe('c1');
  });
  it('consultor não vê o seletor nem abre a Meta de um colega pelo endereço', async () => {
    await montar(consultor, '?consultor=c1');
    expect(document.querySelector('select')).toBeNull();
    expect(q('consultor').dataset.vendo).toBe('');
  });
  it('trocar de filtro olhando a Meta de um consultor continua na Meta dele', async () => {
    await montar(gestor, '?consultor=c1');
    const filtro = [...document.querySelectorAll('button')].find((b) => b.textContent === 'filtro');
    await act(async () => { filtro.click(); });
    expect(q('consultor').dataset.vendo).toBe('c1');
    expect(document.querySelector('select').value).toBe('c:c1');
  });
});
