// @vitest-environment jsdom
// src/lib/__tests__/equipeTela.behavior.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

const estado = vi.hoisted(() => ({ leitura: { fichas: [], pronto: true, erro: null }, aulas: [], apagados: [] }));
vi.mock('../../hooks/useEquipeFichas.js', () => ({ useEquipeFichas: () => estado.leitura }));
vi.mock('../../hooks/useSeatLimits.js', () => ({ useSeatLimits: () => null }));
vi.mock('../settingsLeads.js', () => ({ leadsWhere: async () => estado.aulas }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig()),
  doc: (...a) => ({ path: a.slice(1).join('/') }),
  deleteDoc: async (ref) => { estado.apagados.push(ref.path); },
}));
vi.mock('../firebase.js', () => ({ auth: {}, appId: 'acad', storage: {}, LEADS_PATH: 'l', PROFESSORS_PATH: 'p', USERS_PATH: 'u', EQUIPE_PATH: 'e' }));
const avisos = vi.hoisted(() => ({ warning: [], error: [] }));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => ({ success: () => {}, error: (m) => avisos.error.push(m), warning: (m) => avisos.warning.push(m), info: () => {} }) }));

const { TeamAccessSection } = await import('../../views/settings/TeamAccessSection.jsx');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
let root;
afterEach(async () => {
  await act(async () => root?.unmount()); document.body.innerHTML = '';
  estado.leitura = { fichas: [], pronto: true, erro: null }; estado.aulas = []; estado.apagados = []; avisos.warning = []; avisos.error = [];
  vi.restoreAllMocks();
});

const GESTOR = { id: 'g1', authUid: 'g1', name: 'Johnny', role: 'admin', tenantId: 'acad', tenantModules: ['faltosos'] };
const EQUIPE = [GESTOR, { id: 'u2', authUid: 'u2', name: 'Camila', role: 'consultant', email: 'c@x.com' }];
const PROFESSORES = [{ id: 'p1', nome: 'Marina', modalidadeIds: [] }];

async function montar(caminho, props = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [caminho] },
      h(GeneralConfigContext.Provider, { value: { modalities: [], professores: PROFESSORES } },
        h(TeamAccessSection, { db: {}, appUser: GESTOR, usersList: EQUIPE, leads: [], listenersActive: true, ...props }))));
  });
}

describe('Equipe & acessos', () => {
  it('a lista junta quem tem login e o professor sem login, e o card Professores saiu', async () => {
    await montar('/acad/configuracoes/equipe');
    const nomes = [...document.querySelectorAll('a[aria-label^="Abrir a ficha de"]')].map((a) => a.getAttribute('aria-label'));
    expect(nomes).toEqual(['Abrir a ficha de Camila', 'Abrir a ficha de Johnny', 'Abrir a ficha de Marina']);
    expect(document.body.textContent).not.toContain('Participação');
  });
  it('com o id no endereço, mostra a ficha', async () => {
    await montar('/acad/configuracoes/equipe/p1', { pessoaId: 'p1', pessoaAba: 'dados' });
    expect(document.querySelector('h1').textContent).toBe('Marina');
  });
  it('id que não existe diz isso, sem quebrar', async () => {
    await montar('/acad/configuracoes/equipe/zzz', { pessoaId: 'zzz', pessoaAba: 'dados' });
    expect(document.body.textContent).toContain('Não achamos essa pessoa na equipe.');
  });
  it('sem a leitura das fichas, a ficha não deixa editar', async () => {
    estado.leitura = { fichas: [], pronto: false, erro: null };
    await montar('/acad/configuracoes/equipe/p1', { pessoaId: 'p1', pessoaAba: 'dados' });
    expect(document.querySelector('h1')).toBeNull();
    estado.leitura = { fichas: [], pronto: true, erro: new Error('x') };
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    await montar('/acad/configuracoes/equipe/p1', { pessoaId: 'p1', pessoaAba: 'dados' });
    expect(document.body.textContent).toContain('Não deu para ler as fichas da equipe.');
    expect(document.querySelector('h1')).toBeNull();
  });
  it('Excluir cadastro: recusa quando há aulas registradas', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    estado.aulas = [{ id: 'l1' }];
    await montar('/acad/configuracoes/equipe/p1', { pessoaId: 'p1', pessoaAba: 'dados' });
    const botao = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Excluir cadastro'));
    await act(async () => botao.click());
    expect(avisos.warning.join(' ')).toContain('tem aulas ou alunos registrados');
    expect(estado.apagados).toEqual([]);
  });
  it('Excluir cadastro: apaga o professor quando nada o usa', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    await montar('/acad/configuracoes/equipe/p1', { pessoaId: 'p1', pessoaAba: 'dados' });
    const botao = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Excluir cadastro'));
    await act(async () => botao.click());
    expect(estado.apagados).toEqual(['artifacts/acad/public/data/p/p1']);
  });
});
