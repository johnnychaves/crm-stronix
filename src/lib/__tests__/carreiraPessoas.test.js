// @vitest-environment jsdom
// A aba Pessoas da trilha em Configurações → Plano de carreira (pedido do
// Johnny, 27/11/2026): quem está na trilha e quem pode entrar, o "Mudar nível",
// o "Pôr na trilha" e o "Tirar do plano", que grava a marca fora-do-plano.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const banco = vi.hoisted(() => ({ updates: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {}, CONFIG_PATH: 'stronix_config', PROFESSORS_PATH: 'stronix_professores', USERS_PATH: 'stronix_users' }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...partes) => ({ path: partes.join('/') }),
  updateDoc: async (ref, valor) => { banco.updates.push({ path: ref.path, valor }); },
}));

const { trilhasDe, FORA_DO_PLANO, foraDoPlano } = await import('../carreira/trilhas.js');
const { pessoasDaTrilha, pessoasPorNivel, SEM_NIVEL } = await import('../carreira/rascunho.js');
const { gravarTrilhaDaPessoa, tirarDoPlano } = await import('../carreiraWrites.js');
const { parseAppPath, hrefFor } = await import('../routes.js');
const { TrilhaPessoas } = await import('../../views/settings/carreira/TrilhaPessoas.jsx');

const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);
const PROFESSORES = [
  { id: 'p1', nome: 'Bruno', nivel: 'junior' },
  { id: 'p2', nome: 'Ana', trilhaId: 'estagiario', nivel: 'estagiario1' },
  { id: 'p3', nome: 'Carla', trilhaId: FORA_DO_PLANO },
  { id: 'p4', nome: 'Zeca', ativo: false },
];
const USUARIOS = [
  { id: 'u1', name: 'Hosiel', role: 'consultant', trilhaId: 'consultor', nivel: 'pleno' },
  { id: 'u2', name: 'Vanessa', role: 'consultant' },
  { id: 'u3', name: 'Fiama', role: 'consultant', trilhaId: FORA_DO_PLANO },
  { id: 'g', name: 'Gestor', role: 'admin' },
];

describe('quem está na trilha e quem pode entrar', () => {
  it('na trilha Professor: o professor sem trilha entra, o de outra trilha e o de fora do plano podem entrar, o inativo some', () => {
    const { naTrilha, deFora } = pessoasDaTrilha(PROFESSOR, { professores: PROFESSORES });
    expect(naTrilha.map((p) => p.id)).toEqual(['p1']);
    expect(deFora.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(naTrilha[0]).toMatchObject({ tipo: 'professor', nome: 'Bruno' });
  });

  it('na trilha Consultor: só o papel consultor, e quem não tem trilha pode entrar', () => {
    const { naTrilha, deFora } = pessoasDaTrilha(CONSULTOR, { usuarios: USUARIOS });
    expect(naTrilha.map((p) => p.id)).toEqual(['u1']);
    expect(deFora.map((p) => p.id)).toEqual(['u3', 'u2']);
    expect(deFora[0]).toMatchObject({ tipo: 'consultor', nome: 'Fiama' });
  });

  it('quem está fora do plano não conta nos níveis', () => {
    expect(foraDoPlano(PROFESSORES[2])).toBe(true);
    const contagem = pessoasPorNivel(PROFESSOR, { professores: PROFESSORES });
    expect(contagem.junior).toBe(1);
    expect(contagem[SEM_NIVEL]).toBe(0);
    expect(pessoasDaTrilha(ESTAGIARIO, { professores: PROFESSORES }).naTrilha.map((p) => p.id)).toEqual(['p2']);
  });
});

describe('a gravação na pessoa', () => {
  beforeEach(() => { banco.updates = []; });

  it('o professor grava no cadastro de professor, e o consultor no de usuário', async () => {
    await gravarTrilhaDaPessoa({}, { id: 'p1', tipo: 'professor' }, { trilhaId: 'professor', nivel: 'pleno', desde: new Date(2026, 10, 27) });
    await gravarTrilhaDaPessoa({}, { id: 'u2', tipo: 'consultor' }, { trilhaId: 'consultor', nivel: 'junior', desde: new Date(2026, 10, 1) });
    expect(banco.updates[0].path).toBe('artifacts/acad/public/data/stronix_professores/p1');
    expect(banco.updates[0].valor.trilhaId).toBe('professor');
    expect(banco.updates[0].valor.nivel).toBe('pleno');
    expect(banco.updates[0].valor.nivelDesde.toDate()).toEqual(new Date(2026, 10, 27));
    expect(banco.updates[1].path).toBe('artifacts/acad/public/data/stronix_users/u2');
  });

  it('tirar do plano grava a marca e apaga o nível', async () => {
    await tirarDoPlano({}, { id: 'u1', tipo: 'consultor' });
    expect(banco.updates).toEqual([{ path: 'artifacts/acad/public/data/stronix_users/u1', valor: { trilhaId: FORA_DO_PLANO, nivel: null, nivelDesde: null } }]);
  });
});

describe('o endereço da aba Pessoas', () => {
  it('é /configuracoes/carreira/<id>/pessoas, ida e volta', () => {
    expect(parseAppPath('/acad/configuracoes/carreira/consultor/pessoas')).toMatchObject({ screen: 'settings', sub: 'carreira', trilhaId: 'consultor', trilhaAba: 'pessoas' });
    expect(hrefFor('acad', 'settings', { sub: 'carreira', trilhaId: 'consultor', trilhaAba: 'pessoas' })).toBe('/acad/configuracoes/carreira/consultor/pessoas');
    expect(hrefFor('acad', 'settings', { sub: 'carreira', trilhaId: 'consultor', trilhaAba: 'metas' })).toBe('/acad/configuracoes/carreira/consultor');
  });
});

describe('a aba Pessoas', () => {
  let container;
  let root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });
  const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
  const clicar = async (el) => {
    expect(el).toBeTruthy();
    await act(async () => { el.click(); });
  };

  it('lista quem está na trilha e quem pode entrar, e o Tirar do plano pede confirmação', async () => {
    const onTirar = vi.fn(async () => true);
    const equipe = pessoasDaTrilha(CONSULTOR, { usuarios: USUARIOS });
    await act(async () => {
      root.render(h(TrilhaPessoas, { trilha: CONSULTOR, trilhas: trilhasDe(null), equipe, onGravar: vi.fn(async () => true), onTirar }));
    });
    const texto = document.body.textContent;
    expect(texto).toContain('Hosiel');
    expect(texto).toContain('Pleno');
    expect(botao('Mudar nível')).toBeTruthy();
    expect(texto).toContain('Fora do plano de carreira');
    expect(texto).toContain('Sem trilha');
    expect([...document.body.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Pôr na trilha')).toHaveLength(2);

    await clicar(botao('Tirar do plano'));
    expect(document.body.querySelector('[role="alertdialog"]').textContent).toContain('Tirar Hosiel do plano de carreira?');
    expect(onTirar).not.toHaveBeenCalled();
    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Tirar do plano');
    await clicar(confirmar);
    expect(onTirar).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', tipo: 'consultor' }));
  });
});
