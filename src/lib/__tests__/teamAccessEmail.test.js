// @vitest-environment jsdom
// O "E-mail de login" do "Editar membro", em Equipe & acessos. Para quem tem
// conta, o e-mail troca pela ação set-email do /api/admin-users, que muda o Auth
// e o cadastro juntos, e o cliente não grava mais o e-mail do cadastro. O
// cadastro sem conta continua trocando só o cadastro, pelo cliente. Sem
// Firebase de verdade.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { updateDoc } from 'firebase/firestore';
import { TeamAccessSection } from '../../views/settings/TeamAccessSection.jsx';
import { LOGIN_EMAIL_INVALID_MESSAGE, LOGIN_EMAIL_TAKEN_MESSAGE } from '../loginEmail.js';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
// A ordem em que o Salvar fala com o mundo: a API e a gravação do cadastro.
const ordem = vi.hoisted(() => []);

vi.mock('../firebase.js', () => ({
  auth: { currentUser: { getIdToken: async () => 'token-do-gestor' } },
  appId: 'academia-teste',
  LEADS_PATH: 'stronix_leads',
  PROFESSORS_PATH: 'stronix_professores',
  USERS_PATH: 'stronix_users',
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  query: (ref, ...filtros) => ({ ref, filtros }),
  where: (...args) => args,
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  updateDoc: vi.fn(async (ref) => { ordem.push(['cadastro', ref.caminho]); }),
  addDoc: vi.fn(async () => {}),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  deleteField: () => 'apagar',
  serverTimestamp: () => 'agora',
  writeBatch: vi.fn(),
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
// A faixa de assentos busca o plano na API. Fora do teste.
vi.mock('../../hooks/useSeatLimits.js', () => ({ useSeatLimits: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GESTOR = { id: 'gestor-1', authUid: 'gestor-1', name: 'Gestor', email: 'gestor@academia.com', role: 'admin' };
// Ana foi cadastrada com o domínio digitado errado.
const ANA = { id: 'uid-ana', authUid: 'uid-ana', name: 'Ana', email: 'ana@gmial.com', role: 'consultant' };
// Cadastro sem conta vinculada: o selo "Sem vínculo" da lista.
const BETO = { id: 'doc-beto', name: 'Beto', email: 'beto@academia.com', role: 'consultant' };
const EQUIPE = [GESTOR, ANA, BETO];

let root = null;
let respostaDaApi = null;

beforeEach(() => {
  ordem.length = 0;
  updateDoc.mockClear();
  for (const fn of Object.values(toast)) fn.mockClear();
  respostaDaApi = { status: 200, body: { ok: true, changed: true } };
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    ordem.push(['api', url, JSON.parse(init.body)]);
    return { ok: respostaDaApi.status < 400, status: respostaDaApi.status, json: async () => respostaDaApi.body };
  }));
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.unstubAllGlobals();
});

async function montar(appUser = GESTOR) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(TeamAccessSection, { db: {}, appUser, usersList: EQUIPE, leads: [] }));
  });
}

async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// O Salvar espera o token, a API e o Firestore, então o clique deixa o relógio
// dar uma volta antes de o act fechar.
async function clicar(el) {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const campoEmail = () => document.querySelector('input[type="email"]');
const campoNome = () => document.querySelector('input[placeholder="Ex: Ana Duarte"]');
const campoSenha = () => document.querySelector('input[placeholder="Deixe em branco para não alterar"]');

async function editar(membro) {
  const botoes = [...document.querySelectorAll('button[title="Editar membro"]')];
  await clicar(botoes[EQUIPE.indexOf(membro)]);
  expect(campoEmail().value).toBe(membro.email);
}

const chamadasDaApi = () => ordem.filter(([tipo]) => tipo === 'api');
// O que o Salvar gravou no cadastro, pelo cliente.
const gravado = () => updateDoc.mock.calls.map(([ref, dados]) => ({ caminho: ref.caminho, dados }));

describe('Editar membro: e-mail de login de quem tem conta', () => {
  it('troca pelo set-email, pede confirmação antes, e o cliente não grava o e-mail', async () => {
    await montar();
    await editar(ANA);
    await escrever(campoEmail(), ' Ana@Gmail.com ');
    await clicar(botao('Salvar alterações'));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('Trocar o e-mail de login de "Ana" para ana@gmail.com?');
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-email', targetAuthUid: 'uid-ana', email: 'ana@gmail.com' }],
    ]);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-do-gestor');
    // A API vem antes do resto do cadastro.
    expect(ordem.map(([tipo]) => tipo)).toEqual(['api', 'cadastro']);
    expect(gravado()).toHaveLength(1);
    expect(gravado()[0].caminho).toBe('artifacts/academia-teste/public/data/stronix_users/uid-ana');
    expect(gravado()[0].dados).not.toHaveProperty('email');
    expect(gravado()[0].dados).toMatchObject({ name: 'Ana' });
    expect(toast.success).toHaveBeenCalledWith('Cadastro atualizado.');
    expect(campoEmail()).toBeNull();
  });

  it('se o set-email falhar, mostra o erro do servidor e não salva o resto', async () => {
    respostaDaApi = { status: 409, body: { error: LOGIN_EMAIL_TAKEN_MESSAGE } };
    await montar();
    await editar(ANA);
    await escrever(campoNome(), 'Ana Duarte');
    await escrever(campoEmail(), 'ana@gmail.com');
    await clicar(botao('Salvar alterações'));

    expect(toast.error).toHaveBeenCalledWith(LOGIN_EMAIL_TAKEN_MESSAGE);
    expect(updateDoc).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    // O formulário continua aberto, com o que foi digitado.
    expect(campoEmail().value).toBe('ana@gmail.com');
  });

  it('confirmação recusada não chama a API nem grava nada', async () => {
    confirm.mockReturnValue(false);
    await montar();
    await editar(ANA);
    await escrever(campoEmail(), 'ana@gmail.com');
    await clicar(botao('Salvar alterações'));

    expect(chamadasDaApi()).toEqual([]);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('formato ruim avisa antes de perguntar e não chama nada', async () => {
    await montar();
    await editar(ANA);
    // Passa na conferência do navegador, que aceita domínio sem ponto.
    await escrever(campoEmail(), 'ana@gmail');
    await clicar(botao('Salvar alterações'));

    expect(toast.warning).toHaveBeenCalledWith(LOGIN_EMAIL_INVALID_MESSAGE);
    expect(confirm).not.toHaveBeenCalled();
    expect(chamadasDaApi()).toEqual([]);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('e-mail igual ao de antes não chama a API, não pergunta e não grava e-mail', async () => {
    await montar();
    await editar(ANA);
    await escrever(campoNome(), 'Ana Duarte');
    await escrever(campoEmail(), ' ANA@gmial.com');
    await clicar(botao('Salvar alterações'));

    expect(confirm).not.toHaveBeenCalled();
    expect(chamadasDaApi()).toEqual([]);
    expect(gravado()).toHaveLength(1);
    expect(gravado()[0].dados).not.toHaveProperty('email');
    expect(gravado()[0].dados).toMatchObject({ name: 'Ana Duarte' });
  });
});

describe('Editar membro: cadastro sem conta', () => {
  it('troca só o cadastro, pelo cliente, sem API e sem confirmação', async () => {
    await montar();
    await editar(BETO);
    await escrever(campoEmail(), 'Beto.Novo@academia.com');
    await clicar(botao('Salvar alterações'));

    expect(confirm).not.toHaveBeenCalled();
    expect(chamadasDaApi()).toEqual([]);
    expect(gravado()).toHaveLength(1);
    expect(gravado()[0].dados).toMatchObject({ name: 'Beto', email: 'beto.novo@academia.com' });
  });
});

describe('Editar membro: o próprio gestor', () => {
  it('a confirmação fala com ele e a troca vai para a conta dele', async () => {
    await montar();
    await editar(GESTOR);
    await escrever(campoEmail(), 'gestor.novo@academia.com');
    await clicar(botao('Salvar alterações'));

    expect(confirm.mock.calls[0][0]).toContain('Trocar o seu e-mail de login para gestor.novo@academia.com?');
    expect(chamadasDaApi()).toEqual([
      ['api', '/api/admin-users', { action: 'set-email', targetAuthUid: 'gestor-1', email: 'gestor.novo@academia.com' }],
    ]);
    expect(toast.success).toHaveBeenCalledWith('Seu e-mail de login mudou. Saia e entre de novo com o e-mail novo.');
  });

  it('e-mail e senha juntos: avisa para fazer em duas vezes e não chama nada', async () => {
    // A troca do e-mail derruba a sessão do próprio gestor, e a troca de senha
    // que viria em seguida seria recusada pelo servidor.
    await montar();
    await editar(GESTOR);
    await escrever(campoEmail(), 'gestor.novo@academia.com');
    await escrever(campoSenha(), 'Nova@Senha1');
    await clicar(botao('Salvar alterações'));

    expect(toast.warning).toHaveBeenCalledWith('Troque o seu e-mail e a sua senha em duas vezes: salve o e-mail, entre de novo e depois troque a senha.');
    expect(confirm).not.toHaveBeenCalled();
    expect(chamadasDaApi()).toEqual([]);
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('o campo', () => {
  it('na edição, diz que trocar o e-mail muda o login', async () => {
    await montar();
    await editar(ANA);
    expect(document.body.textContent).toContain('Trocar o e-mail muda o login da pessoa.');
  });

  it('no cadastro de consultor, não mostra a dica', async () => {
    await montar();
    await clicar(botao('Cadastrar consultor'));
    expect(campoEmail()).not.toBeNull();
    expect(document.body.textContent).not.toContain('Trocar o e-mail muda o login da pessoa.');
  });
});
