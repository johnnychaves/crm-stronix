// @vitest-environment jsdom
// A tela do "Esqueci a senha" (src/views/auth/ForgotPasswordScreen.jsx), num
// MemoryRouter e com o fetch trocado por respostas prontas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { ForgotPasswordScreen } from '../../views/auth/ForgotPasswordScreen.jsx';
import { PASSWORD_RULE_TEXT, passwordPolicyError } from '../passwordPolicy.js';
import {
  CODE_REFUSED_MESSAGE, EMAIL_INVALID_MESSAGE, MAIL_OFF_MESSAGE, RESET_PATH,
  SAVE_FAILED_MESSAGE, SEND_FAILED_MESSAGE, TOO_MANY_MESSAGE,
} from '../passwordReset.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MEMORIA = 'stronilead:recuperar-senha';
const ACADEMIA = { slug: 'academia-teste', displayName: 'Academia Teste' };

let root = null;
let respostas = [];
let chamadas = [];

// Fora de /recuperar-senha, mostra para onde a tela mandou, com que estado e se
// a entrada do histórico foi trocada (REPLACE) ou empilhada (PUSH).
function Palco() {
  const loc = useLocation();
  const tipo = useNavigationType();
  if (loc.pathname === RESET_PATH) return h(ForgotPasswordScreen);
  return h('pre', { id: 'fora', 'data-tipo': tipo }, JSON.stringify({ path: loc.pathname, state: loc.state ?? null }));
}

async function montar(state = null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [{ pathname: RESET_PATH, state }] }, h(Palco)));
  });
}

const lembrar = (email = 'ana@academia.com', sentAt = Date.now()) =>
  sessionStorage.setItem(MEMORIA, JSON.stringify({ email, sentAt }));
const texto = () => document.body.textContent;
const campo = (nome) => document.querySelector(`input[name="${nome}"]`);
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const botaoPorNome = (nome) => document.querySelector(`button[aria-label="${nome}"]`);
const reenvio = () => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Mandar outro código'));
const alerta = () => document.querySelector('[role="alert"]');
const aviso = () => document.querySelector('[role="status"]');
const fora = () => JSON.parse(document.getElementById('fora').textContent);
// O que o leitor de tela junta para descrever o campo: o texto de cada id do aria-describedby.
const descricao = (el) => (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();

// O React só vê a digitação pelo setter nativo mais o evento de input.
async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clicar(el) {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

// Como o clique do mouse: o foco sai do campo e vai para o botão. Sem isso, o
// cursor que o autoFocus já pôs no campo faria o teste de foco passar sozinho.
async function enviar(rotulo) {
  const alvo = botao(rotulo);
  alvo.focus();
  expect(document.activeElement).toBe(alvo);
  await clicar(alvo);
}

async function preencherPasso2(code = '123456', senha = 'Nova@Senha1', repetir = senha) {
  await escrever(campo('code'), code);
  await escrever(campo('newPassword'), senha);
  await escrever(campo('confirmPassword'), repetir);
}

// Só Date e setInterval são falsos, então o setTimeout do clicar segue real. O
// relógio para numa hora fixa e só anda quando o teste manda. O afterEach
// devolve os timers de verdade. Devolve a hora de agora, em milissegundos.
function relogioFalso() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date('2026-09-29T12:00:00Z'));
  return Date.now();
}

// O fetch só responde quando o teste manda, na ordem dos pedidos.
function fetchQueEspera(status = 200, corpo = { ok: true }) {
  const fila = [];
  const fn = vi.fn(() => new Promise((resolve) => {
    fila.push(() => resolve({ status, json: async () => corpo }));
  }));
  vi.stubGlobal('fetch', fn);
  return { fn, liberar: () => fila.shift()() };
}

beforeEach(() => {
  sessionStorage.clear();
  respostas = [];
  chamadas = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    chamadas.push({ url, corpo: JSON.parse(init.body) });
    const [status, corpo] = respostas.shift() ?? [500, null];
    return { status, json: async () => corpo };
  }));
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('passo 1', () => {
  it('vem com o e-mail e a academia do login, manda o pedido e abre o passo 2', async () => {
    respostas = [[200, { ok: true }]];
    await montar({ email: 'ana@academia.com', tenant: ACADEMIA });
    expect(campo('email').value).toBe('ana@academia.com');
    expect(texto()).toContain('Academia Teste');
    await clicar(botao('Enviar código'));
    expect(chamadas).toEqual([{ url: '/api/tenant-resolve', corpo: { action: 'password-reset-request', email: 'ana@academia.com' } }]);
    expect(texto()).toContain('Criar senha nova');
    expect(texto()).toContain('Mandar outro código em 60s');
    expect(JSON.parse(sessionStorage.getItem(MEMORIA)).email).toBe('ana@academia.com');
  });

  it('sem @, avisa embaixo do campo e não manda nada', async () => {
    await montar();
    await escrever(campo('email'), 'ana');
    await clicar(botao('Enviar código'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('Digite o e-mail que você usa para entrar.');
    expect(campo('email').getAttribute('aria-describedby')).toBe('esqueci-email-erro');
  });

  it('o 503 mostra o aviso de função desligada', async () => {
    respostas = [[503, { error: MAIL_OFF_MESSAGE }]];
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(texto()).toContain(MAIL_OFF_MESSAGE);
    expect(texto()).toContain('Esqueci a senha');
  });

  it('o link de voltar leva ao login da academia', async () => {
    await montar({ email: '', tenant: ACADEMIA });
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Voltar para o login'));
    expect(link.getAttribute('href')).toBe('/academia-teste');
  });
});

describe('passo 2', () => {
  it('com a memória da aba, abre direto no passo 2', async () => {
    lembrar();
    await montar();
    expect(texto()).toContain('Criar senha nova');
    expect(texto()).toContain('ana@academia.com');
  });

  it('o código aceita colar com espaço e hífen', async () => {
    lembrar();
    await montar();
    await escrever(campo('code'), '123 45-6');
    expect(campo('code').value).toBe('123456');
  });

  it('confere o código e a senha antes de mandar', async () => {
    lembrar();
    await montar();
    await preencherPasso2('12', 'fraca');
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('Digite os 6 números do código.');
    expect(texto()).toContain(passwordPolicyError('fraca'));
  });

  it('as duas senhas precisam ser iguais', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'Nova@Senha1', 'Nova@Senha2');
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('As duas senhas não são iguais.');
  });

  it('código errado mostra a frase embaixo do campo do código e mantém a senha', async () => {
    lembrar();
    respostas = [[400, { error: CODE_REFUSED_MESSAGE }]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(chamadas[0].corpo).toEqual({ action: 'password-reset-confirm', email: 'ana@academia.com', code: '123456', newPassword: 'Nova@Senha1' });
    expect(document.getElementById('esqueci-codigo-erro').textContent).toBe(CODE_REFUSED_MESSAGE);
    expect(campo('code').getAttribute('aria-describedby')).toBe('esqueci-codigo-intro esqueci-codigo-erro');
    expect(campo('newPassword').value).toBe('Nova@Senha1');
  });

  it('senha recusada pelo servidor mostra a frase embaixo do campo da senha', async () => {
    lembrar();
    respostas = [[400, { error: 'O sistema recusou essa senha. Tente uma senha mais longa.', field: 'newPassword' }]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('esqueci-senha-erro').textContent).toBe('O sistema recusou essa senha. Tente uma senha mais longa.');
  });

  it('o sucesso volta para o login da academia com o e-mail e o aviso', async () => {
    lembrar();
    respostas = [[200, { ok: true }]];
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(fora()).toEqual({ path: '/academia-teste', state: { email: 'ana@academia.com', passwordReset: true } });
    expect(sessionStorage.getItem(MEMORIA)).toBeNull();
  });

  it('"Usar outro e-mail" volta ao passo 1 e apaga a memória', async () => {
    lembrar();
    await montar();
    await clicar(botao('Usar outro e-mail'));
    expect(texto()).toContain('Esqueci a senha');
    expect(sessionStorage.getItem(MEMORIA)).toBeNull();
  });
});

// Com erro, o foco vai para o primeiro campo errado, na ordem da tela. É por ele
// que o leitor de tela lê o rótulo e a descrição, que já traz o erro. Todos os
// envios saem do botão (enviar), senão o cursor que o autoFocus pôs no campo
// faria o teste passar sem que a tela mova o foco.
describe('foco no primeiro campo com erro', () => {
  it('passo 1: sem @ no e-mail, o foco fica no e-mail', async () => {
    await montar();
    await escrever(campo('email'), 'ana');
    await enviar('Enviar código');
    expect(chamadas).toEqual([]);
    expect(document.activeElement).toBe(campo('email'));
  });

  it('passo 1: e-mail recusado pelo servidor, o foco vai para o e-mail', async () => {
    respostas = [[400, { error: EMAIL_INVALID_MESSAGE }]];
    await montar({ email: 'ana@academia.com' });
    await enviar('Enviar código');
    expect(document.getElementById('esqueci-email-erro').textContent).toBe(EMAIL_INVALID_MESSAGE);
    expect(document.activeElement).toBe(campo('email'));
  });

  it.each([
    ['senha fraca', '12', 'fraca', 'fraca'],
    ['as duas senhas diferentes', '12', 'Nova@Senha1', 'Nova@Senha2'],
  ])('passo 2: com código curto e %s, o foco vai para o código', async (_erro, code, senha, repetir) => {
    lembrar();
    await montar();
    await preencherPasso2(code, senha, repetir);
    await enviar('Salvar senha nova');
    expect(chamadas).toEqual([]);
    expect(document.activeElement).toBe(campo('code'));
  });

  it('passo 2: com o código certo e a senha fraca, o foco vai para a senha nova', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'fraca');
    await enviar('Salvar senha nova');
    expect(chamadas).toEqual([]);
    expect(document.activeElement).toBe(campo('newPassword'));
  });

  it('passo 2: com a senha boa e as duas diferentes, o foco vai para repetir a senha', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'Nova@Senha1', 'Nova@Senha2');
    await enviar('Salvar senha nova');
    expect(chamadas).toEqual([]);
    expect(document.activeElement).toBe(campo('confirmPassword'));
  });

  it('passo 2: código recusado pelo servidor, o foco vai para o código', async () => {
    lembrar();
    respostas = [[400, { error: CODE_REFUSED_MESSAGE }]];
    await montar();
    await preencherPasso2();
    await enviar('Salvar senha nova');
    expect(chamadas).toHaveLength(1);
    expect(document.activeElement).toBe(campo('code'));
  });

  it('passo 2: senha recusada pelo servidor, o foco vai para a senha nova', async () => {
    lembrar();
    respostas = [[400, { error: 'O sistema recusou essa senha. Tente uma senha mais longa.', field: 'newPassword' }]];
    await montar();
    await preencherPasso2();
    await enviar('Salvar senha nova');
    expect(chamadas).toHaveLength(1);
    expect(document.activeElement).toBe(campo('newPassword'));
  });
});

// O foco só serve ao leitor de tela se o campo que o recebe já diz que está com
// erro: ele lê o rótulo e a descrição, e a descrição é a dica mais o erro.
describe('o erro fica ligado ao campo', () => {
  it('passo 1: sem @, o e-mail fica inválido e a descrição é o erro', async () => {
    await montar();
    await escrever(campo('email'), 'ana');
    await clicar(botao('Enviar código'));
    expect(campo('email').getAttribute('aria-invalid')).toBe('true');
    expect(descricao(campo('email'))).toBe('Digite o e-mail que você usa para entrar.');
  });

  it('senha fraca: o campo da senha fica inválido e a descrição junta a regra e o erro', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'fraca');
    await clicar(botao('Salvar senha nova'));
    expect(campo('newPassword').getAttribute('aria-invalid')).toBe('true');
    expect(descricao(campo('newPassword'))).toBe(`${PASSWORD_RULE_TEXT} ${passwordPolicyError('fraca')}`);
    expect(campo('confirmPassword').hasAttribute('aria-invalid')).toBe(false);
  });

  it('senhas diferentes: só o campo de repetir fica inválido, e a descrição dele é o erro', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'Nova@Senha1', 'Nova@Senha2');
    await clicar(botao('Salvar senha nova'));
    expect(campo('confirmPassword').getAttribute('aria-invalid')).toBe('true');
    expect(descricao(campo('confirmPassword'))).toBe('As duas senhas não são iguais.');
    expect(campo('newPassword').hasAttribute('aria-invalid')).toBe(false);
    expect(campo('code').hasAttribute('aria-invalid')).toBe(false);
  });

  it('código recusado pelo servidor: o campo do código fica inválido', async () => {
    lembrar();
    respostas = [[400, { error: CODE_REFUSED_MESSAGE }]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(campo('code').getAttribute('aria-invalid')).toBe('true');
    expect(campo('newPassword').hasAttribute('aria-invalid')).toBe(false);
  });

  it('sem erro, nenhum campo fica inválido e a descrição não leva erro', async () => {
    lembrar();
    await montar();
    expect(document.querySelectorAll('[aria-invalid]')).toHaveLength(0);
    expect(descricao(campo('code'))).toContain('Digite o código que mandamos para ana@academia.com');
    expect(descricao(campo('newPassword'))).toBe(PASSWORD_RULE_TEXT);
    expect(campo('confirmPassword').hasAttribute('aria-describedby')).toBe(false);
  });
});

// Corrigido o campo, o erro dele não pode ficar na tela: a pessoa leria uma
// frase que já não vale, e o leitor de tela continuaria dizendo "inválido".
describe('o erro some quando a pessoa muda o campo', () => {
  it('passo 1: o e-mail', async () => {
    await montar();
    await escrever(campo('email'), 'ana');
    await clicar(botao('Enviar código'));
    expect(document.getElementById('esqueci-email-erro')).not.toBeNull();
    await escrever(campo('email'), 'ana@');
    expect(document.getElementById('esqueci-email-erro')).toBeNull();
    expect(campo('email').hasAttribute('aria-invalid')).toBe(false);
    expect(campo('email').hasAttribute('aria-describedby')).toBe(false);
  });

  it('passo 2: o código, sem apagar o erro da senha', async () => {
    lembrar();
    await montar();
    await preencherPasso2('12', 'fraca');
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('esqueci-codigo-erro')).not.toBeNull();
    expect(document.getElementById('esqueci-senha-erro')).not.toBeNull();
    await escrever(campo('code'), '123');
    expect(document.getElementById('esqueci-codigo-erro')).toBeNull();
    expect(campo('code').hasAttribute('aria-invalid')).toBe(false);
    expect(document.getElementById('esqueci-senha-erro')).not.toBeNull();
    expect(campo('newPassword').getAttribute('aria-invalid')).toBe('true');
  });

  it('passo 2: a senha nova', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'fraca');
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('esqueci-senha-erro')).not.toBeNull();
    await escrever(campo('newPassword'), 'Nova@Senha1');
    expect(document.getElementById('esqueci-senha-erro')).toBeNull();
    expect(campo('newPassword').hasAttribute('aria-invalid')).toBe(false);
    expect(descricao(campo('newPassword'))).toBe(PASSWORD_RULE_TEXT);
  });

  it('passo 2: mudar a senha nova apaga também o erro de repetir senha', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'Nova@Senha1', 'Nova@Senha2');
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('esqueci-confirma-erro')).not.toBeNull();
    await escrever(campo('newPassword'), 'Nova@Senha2');
    expect(document.getElementById('esqueci-confirma-erro')).toBeNull();
    expect(campo('confirmPassword').hasAttribute('aria-invalid')).toBe(false);
  });

  it('passo 2: repetir senha', async () => {
    lembrar();
    await montar();
    await preencherPasso2('123456', 'Nova@Senha1', 'Nova@Senha2');
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('esqueci-confirma-erro')).not.toBeNull();
    await escrever(campo('confirmPassword'), 'Nova@Senha1');
    expect(document.getElementById('esqueci-confirma-erro')).toBeNull();
    expect(campo('confirmPassword').hasAttribute('aria-invalid')).toBe(false);
  });

  it('o aviso que não é de campo não some ao digitar', async () => {
    lembrar();
    respostas = [[500, null]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(alerta().textContent).toBe(SAVE_FAILED_MESSAGE);
    await escrever(campo('code'), '654321');
    expect(alerta().textContent).toBe(SAVE_FAILED_MESSAGE);
  });
});

// O input com autoFocus só ganha o cursor quando nasce. Por isso cada passo tem a
// sua key: sem ela o React reaproveitaria o input do e-mail no lugar do código.
describe('cursor ao trocar de passo', () => {
  it('abre no e-mail e, com o código enviado, vai para o campo do código', async () => {
    respostas = [[200, { ok: true }]];
    await montar({ email: 'ana@academia.com' });
    expect(document.activeElement).toBe(campo('email'));
    await enviar('Enviar código');
    expect(campo('code')).not.toBeNull();
    expect(document.activeElement).toBe(campo('code'));
  });

  it('"Usar outro e-mail" leva o cursor de volta ao campo do e-mail', async () => {
    lembrar();
    await montar();
    expect(document.activeElement).toBe(campo('code'));
    await enviar('Usar outro e-mail');
    expect(campo('email')).not.toBeNull();
    expect(document.activeElement).toBe(campo('email'));
  });

  it('depois do reenvio, o cursor vai para o campo do código, que acabou de ser limpo', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    respostas = [[200, { ok: true }]];
    await montar();
    await escrever(campo('code'), '123');
    await enviar('Mandar outro código');
    expect(campo('code').value).toBe('');
    expect(document.activeElement).toBe(campo('code'));
  });
});

describe('mostrar senha', () => {
  it('o botão se chama Mostrar senha e, depois do clique, Ocultar senha, e os dois campos viram texto', async () => {
    lembrar();
    await montar();
    expect(campo('newPassword').type).toBe('password');
    expect(campo('confirmPassword').type).toBe('password');
    expect(document.querySelectorAll('button[aria-label="Mostrar senha"]')).toHaveLength(1);
    expect(botaoPorNome('Mostrar senha').hasAttribute('title')).toBe(false);

    await clicar(botaoPorNome('Mostrar senha'));
    expect(botaoPorNome('Mostrar senha')).toBeNull();
    expect(botaoPorNome('Ocultar senha')).not.toBeNull();
    expect(botaoPorNome('Ocultar senha').hasAttribute('title')).toBe(false);
    expect(campo('newPassword').type).toBe('text');
    expect(campo('confirmPassword').type).toBe('text');
    expect(chamadas).toEqual([]);

    await clicar(botaoPorNome('Ocultar senha'));
    expect(botaoPorNome('Mostrar senha')).not.toBeNull();
    expect(campo('newPassword').type).toBe('password');
    expect(campo('confirmPassword').type).toBe('password');
  });
});

describe('mandar outro código', () => {
  it('fica travado no primeiro minuto', async () => {
    relogioFalso();
    lembrar();
    await montar();
    expect(reenvio().disabled).toBe(true);
    expect(reenvio().hasAttribute('aria-disabled')).toBe(false);
    expect(reenvio().textContent).toBe('Mandar outro código em 60s');
  });

  it('depois de 1 minuto, pede de novo, limpa o código e avisa que só o último vale', async () => {
    const agora = relogioFalso();
    lembrar('ana@academia.com', agora - 61 * 1000);
    respostas = [[200, { ok: true }]];
    await montar();
    await escrever(campo('code'), '123');
    expect(reenvio().textContent).toBe('Mandar outro código');
    expect(reenvio().disabled).toBe(false);

    // Passa tempo entre abrir a tela e clicar, como na vida real, sem disparar o
    // intervalo: o relógio da tela ainda marca a hora de antes.
    vi.setSystemTime(agora + 5000);
    await clicar(reenvio());
    expect(chamadas).toEqual([{ url: '/api/tenant-resolve', corpo: { action: 'password-reset-request', email: 'ana@academia.com' } }]);
    expect(campo('code').value).toBe('');
    expect(aviso().textContent).toBe('Mandamos outro código. Só o último vale.');
    expect(reenvio().textContent).toBe('Mandar outro código em 60s');
    expect(reenvio().disabled).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(MEMORIA)).sentAt).toBe(agora + 5000);
  });

  it('o 400 vira o aviso de e-mail acima do botão, porque o passo 2 não tem campo de e-mail', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    respostas = [[400, null]];
    await montar();
    await clicar(reenvio());
    expect(alerta().textContent).toBe(EMAIL_INVALID_MESSAGE);
    expect(document.getElementById('esqueci-email-erro')).toBeNull();
  });

  it('o pedido que dá certo apaga o aviso do pedido anterior que falhou', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    respostas = [[429, null], [200, { ok: true }]];
    await montar();
    await clicar(reenvio());
    expect(alerta().textContent).toBe(TOO_MANY_MESSAGE);
    await clicar(reenvio());
    expect(alerta().textContent).toBe('');
    expect(aviso().textContent).toBe('Mandamos outro código. Só o último vale.');
  });
});

describe('o relógio da contagem', () => {
  it('desce de 1 em 1 segundo e libera o botão no fim', async () => {
    const agora = relogioFalso();
    lembrar('ana@academia.com', agora - 55 * 1000);
    await montar();
    expect(reenvio().textContent).toBe('Mandar outro código em 5s');
    expect(reenvio().disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(reenvio().textContent).toBe('Mandar outro código em 2s');
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(reenvio().textContent).toBe('Mandar outro código');
    expect(reenvio().disabled).toBe(false);
  });

  it('para quando a pessoa sai da tela', async () => {
    relogioFalso();
    lembrar();
    await montar();
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => { root.unmount(); });
    root = null;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('só anda no passo 2', async () => {
    relogioFalso();
    respostas = [[200, { ok: true }]];
    await montar({ email: 'ana@academia.com' });
    expect(vi.getTimerCount()).toBe(0);
    await clicar(botao('Enviar código'));
    expect(vi.getTimerCount()).toBe(1);
    await clicar(botao('Usar outro e-mail'));
    expect(vi.getTimerCount()).toBe(0);
  });
});

// Depois do erro o botão volta e a mesma tela manda o pedido de novo. Cada
// tentativa segue o caminho inteiro, e a segunda só sai se a primeira soltou o
// que segurava (o busy e o inFlight).
describe('depois de um erro, os botões voltam e dá para tentar de novo', () => {
  it('passo 1: depois do 503, o mesmo botão manda o segundo pedido e abre o passo 2', async () => {
    respostas = [[503, { error: MAIL_OFF_MESSAGE }], [200, { ok: true }]];
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(alerta().textContent).toBe(MAIL_OFF_MESSAGE);
    expect(botao('Enviar código').hasAttribute('aria-disabled')).toBe(false);
    await clicar(botao('Enviar código'));
    expect(chamadas).toHaveLength(2);
    expect(texto()).toContain('Criar senha nova');
  });

  it('passo 2: depois do 500, o mesmo botão manda a segunda troca e volta para o login', async () => {
    lembrar();
    respostas = [[500, null], [200, { ok: true }]];
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(alerta().textContent).toBe(SAVE_FAILED_MESSAGE);
    expect(botao('Salvar senha nova').hasAttribute('aria-disabled')).toBe(false);
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toHaveLength(2);
    expect(fora().path).toBe('/academia-teste');
  });

  it('reenvio: depois do 429, os três botões voltam', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    respostas = [[429, null]];
    await montar();
    await clicar(reenvio());
    expect(alerta().textContent).toBe(TOO_MANY_MESSAGE);
    for (const b of [reenvio(), botao('Usar outro e-mail'), botao('Salvar senha nova')]) {
      expect(b.hasAttribute('aria-disabled')).toBe(false);
    }
    expect(reenvio().disabled).toBe(false);
    expect(reenvio().textContent).toBe('Mandar outro código');
  });
});

describe('respostas e entradas que faltavam', () => {
  it('passo 1: o 429 mostra o aviso de muitas tentativas', async () => {
    respostas = [[429, null]];
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(alerta().textContent).toBe(TOO_MANY_MESSAGE);
  });

  it('passo 1: o 503 sem frase do servidor cai no aviso de que não deu para enviar', async () => {
    respostas = [[503, null]];
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(alerta().textContent).toBe(SEND_FAILED_MESSAGE);
  });

  it('passo 1: o e-mail com espaço nas pontas vai e fica na memória sem o espaço', async () => {
    respostas = [[200, { ok: true }]];
    await montar({ email: '  ana@academia.com  ' });
    await clicar(botao('Enviar código'));
    expect(chamadas[0].corpo.email).toBe('ana@academia.com');
    expect(JSON.parse(sessionStorage.getItem(MEMORIA)).email).toBe('ana@academia.com');
  });

  it('"Usar outro e-mail" não deixa o que foi digitado para o próximo envio', async () => {
    lembrar();
    respostas = [[200, { ok: true }]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Usar outro e-mail'));
    await clicar(botao('Enviar código'));
    expect(campo('code').value).toBe('');
    expect(campo('newPassword').value).toBe('');
    expect(campo('confirmPassword').value).toBe('');
  });

  it('memória vencida abre o passo 1, com o e-mail que veio do login', async () => {
    lembrar('ana@academia.com', Date.now() - 16 * 60 * 1000);
    await montar({ email: 'bia@academia.com' });
    expect(texto()).toContain('Esqueci a senha');
    expect(campo('email').value).toBe('bia@academia.com');
  });

  it('confirmar apaga o aviso de código reenviado, mesmo quando a conferência da tela barra o envio', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    respostas = [[200, { ok: true }]];
    await montar();
    await clicar(reenvio());
    expect(aviso().textContent).toBe('Mandamos outro código. Só o último vale.');
    await preencherPasso2('12', 'fraca');
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toHaveLength(1);
    expect(aviso().textContent).toBe('');
  });

  it('o sucesso troca a entrada do histórico em vez de empilhar', async () => {
    lembrar();
    respostas = [[200, { ok: true }]];
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('fora').dataset.tipo).toBe('REPLACE');
  });

  // O servidor responde { ok: true } no sucesso. Um 200 sem isso (corpo vazio,
  // ilegível ou de outra coisa) não vale como sucesso.
  const SEM_OK = [
    ['com corpo ilegível', () => { throw new SyntaxError('Unexpected end of JSON input'); }],
    ['com corpo vazio', () => ({})],
    ['com ok falso', () => ({ ok: false })],
  ];

  it.each(SEM_OK)('passo 1: 200 %s não vale como código enviado', async (_nome, corpo) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => corpo() })));
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(texto()).toContain('Esqueci a senha');
    expect(alerta().textContent).toBe(SEND_FAILED_MESSAGE);
    expect(sessionStorage.getItem(MEMORIA)).toBeNull();
  });

  it.each(SEM_OK)('passo 2: 200 %s não vale como senha salva', async (_nome, corpo) => {
    lembrar();
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => corpo() })));
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(document.getElementById('fora')).toBeNull();
    expect(alerta().textContent).toBe(SAVE_FAILED_MESSAGE);
    expect(sessionStorage.getItem(MEMORIA)).not.toBeNull();
  });
});

// O gerenciador de senhas do navegador só salva a senha nova ligada ao e-mail
// certo se o formulário tiver um campo de usuário, e o passo 2 não tem campo de e-mail.
describe('o gerenciador de senhas', () => {
  it('o passo 2 leva o e-mail num campo de usuário oculto, dentro do formulário das senhas', async () => {
    lembrar('ana@academia.com');
    await montar();
    const usuario = campo('username');
    expect(usuario).not.toBeNull();
    expect(usuario.value).toBe('ana@academia.com');
    expect(usuario.type).toBe('email');
    expect(usuario.getAttribute('autocomplete')).toBe('username');
    expect(usuario.readOnly).toBe(true);
    expect(usuario.hidden).toBe(true);
    expect(usuario.form).toBe(campo('newPassword').form);
  });

  it('o campo de usuário acompanha o e-mail que acabou de receber o código', async () => {
    respostas = [[200, { ok: true }]];
    await montar({ email: 'ana@academia.com' });
    expect(campo('username')).toBeNull();
    await clicar(botao('Enviar código'));
    expect(campo('username').value).toBe('ana@academia.com');
  });
});

// Só o leitor de tela muda: o formulário segue com noValidate, e quem avisa do
// campo vazio é a própria tela.
describe('campos obrigatórios', () => {
  it('passo 1: o e-mail é obrigatório e o formulário segue sem a validação do navegador', async () => {
    await montar();
    expect(campo('email').required).toBe(true);
    expect(document.querySelector('form').noValidate).toBe(true);
  });

  it('passo 2: código, senha nova e repetir senha são obrigatórios, e o formulário segue sem a validação do navegador', async () => {
    lembrar();
    await montar();
    for (const nome of ['code', 'newPassword', 'confirmPassword']) expect(campo(nome).required, nome).toBe(true);
    expect(document.querySelector('form').noValidate).toBe(true);
  });

  it('passo 2: com tudo vazio, quem avisa é a tela, não o navegador', async () => {
    lembrar();
    await montar();
    await clicar(botao('Salvar senha nova'));
    expect(chamadas).toEqual([]);
    expect(texto()).toContain('Digite os 6 números do código.');
    expect(texto()).toContain(passwordPolicyError(''));
  });
});

describe('texto do passo 2', () => {
  it('diz que o código vale 15 minutos e aceita até 5 tentativas', async () => {
    lembrar();
    await montar();
    expect(document.getElementById('esqueci-codigo-intro').textContent)
      .toBe('Digite o código que mandamos para ana@academia.com. Ele vale por 15 minutos e aceita até 5 tentativas.');
  });

  // O e-mail entra na frase sem espaço. Comprido, estoura a coluna de 380px e
  // causa rolagem horizontal no celular. O break-words não serve: ele só quebra
  // depois de a linha estourar e não reduz a largura mínima do item da grade. O
  // wrap-anywhere reduz.
  it('a frase que traz o e-mail pode quebrar a linha dentro dele', async () => {
    lembrar('maria.fernanda.oliveira.santos@dominio-muito-comprido-da-academia.com.br');
    await montar();
    const frase = document.getElementById('esqueci-codigo-intro');
    expect(frase.textContent).toContain('maria.fernanda.oliveira.santos@dominio-muito-comprido-da-academia.com.br');
    expect(frase.classList.contains('wrap-anywhere')).toBe(true);
    expect(frase.classList.contains('break-words')).toBe(false);
  });
});

// Enquanto espera a resposta, os botões ficam com aria-disabled e não com
// disabled: no Chrome, o botão focado que vira disabled solta o foco no body, e
// o foco não volta. O jsdom não reproduz essa queda (o botão continua sendo o
// activeElement), então o teste confere a causa: o atributo. Como o aria-disabled
// não barra o clique, quem impede o segundo pedido é o inFlight. Um clique duplo
// mandaria dois pedidos, e cada código pedido gasta um dos 5 do dia.
describe('enquanto espera a resposta', () => {
  it('passo 1: o botão fica com aria-disabled, sem disabled, e o segundo clique não manda outro pedido', async () => {
    const { fn, liberar } = fetchQueEspera();
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    const enviando = botao('Enviando…');
    expect(enviando.getAttribute('aria-disabled')).toBe('true');
    expect(enviando.hasAttribute('disabled')).toBe(false);
    await clicar(enviando);
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { liberar(); });
    expect(texto()).toContain('Criar senha nova');
  });

  it('passo 2: o botão e os dois links ficam com aria-disabled, sem disabled, e nenhum clique faz nada', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    const { fn, liberar } = fetchQueEspera();
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    const salvando = botao('Salvando…');
    for (const b of [salvando, reenvio(), botao('Usar outro e-mail')]) {
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.hasAttribute('disabled')).toBe(false);
    }
    await clicar(salvando);
    await clicar(reenvio());
    await clicar(botao('Usar outro e-mail'));
    expect(fn).toHaveBeenCalledTimes(1);
    // "Usar outro e-mail" não levou ao passo 1, não apagou a memória e não limpou os campos.
    expect(texto()).toContain('Criar senha nova');
    expect(sessionStorage.getItem(MEMORIA)).not.toBeNull();
    expect(campo('newPassword').value).toBe('Nova@Senha1');
    await act(async () => { liberar(); });
    expect(fora().path).toBe('/academia-teste');
  });

  it('mandar outro código: o botão fica com aria-disabled, sem disabled, e o clique de novo não manda outro pedido', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    const { fn, liberar } = fetchQueEspera();
    await montar();
    await clicar(reenvio());
    expect(reenvio().getAttribute('aria-disabled')).toBe('true');
    expect(reenvio().hasAttribute('disabled')).toBe(false);
    await clicar(reenvio());
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { liberar(); });
    expect(aviso().textContent).toBe('Mandamos outro código. Só o último vale.');
  });

  // O busy só muda no render seguinte, então dois envios no mesmo instante ainda
  // leriam busy falso. Dentro de um único act o React não renderiza entre eles.
  it('passo 1: dois envios no mesmo instante mandam um pedido só', async () => {
    const { fn, liberar } = fetchQueEspera();
    await montar({ email: 'ana@academia.com' });
    await act(async () => {
      const form = document.querySelector('form');
      form.requestSubmit();
      form.requestSubmit();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { liberar(); });
    expect(texto()).toContain('Criar senha nova');
  });

  it('passo 2: dois envios no mesmo instante mandam uma troca só', async () => {
    lembrar();
    const { fn, liberar } = fetchQueEspera();
    await montar({ tenant: ACADEMIA });
    await preencherPasso2();
    await act(async () => {
      const form = document.querySelector('form');
      form.requestSubmit();
      form.requestSubmit();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { liberar(); });
    expect(fora().path).toBe('/academia-teste');
  });

  it('mandar outro código: dois cliques no mesmo instante mandam um pedido só', async () => {
    lembrar('ana@academia.com', Date.now() - 61 * 1000);
    const { fn, liberar } = fetchQueEspera();
    await montar();
    await act(async () => {
      const b = reenvio();
      b.click();
      b.click();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { liberar(); });
    expect(aviso().textContent).toBe('Mandamos outro código. Só o último vale.');
  });
});

// O que não é de um campo só vai para a região com role="alert", acima do botão.
// Ela já está na tela, vazia, antes do erro: o leitor de tela só anuncia o que
// aparece numa região que estava na página.
describe('avisos que não são de um campo só', () => {
  it('a região de alerta já está na tela, vazia, e o mesmo elemento recebe a frase', async () => {
    respostas = [[503, { error: MAIL_OFF_MESSAGE }]];
    await montar({ email: 'ana@academia.com' });
    const regiao = alerta();
    expect(regiao).not.toBeNull();
    expect(regiao.textContent).toBe('');
    await clicar(botao('Enviar código'));
    expect(alerta()).toBe(regiao);
    expect(regiao.textContent).toBe(MAIL_OFF_MESSAGE);
  });

  it('sem resposta do servidor, o passo 1 diz que não deu para enviar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await montar({ email: 'ana@academia.com' });
    await clicar(botao('Enviar código'));
    expect(alerta().textContent).toBe(SEND_FAILED_MESSAGE);
    expect(texto()).toContain('Esqueci a senha');
  });

  it('429 no passo 2 mostra o aviso e mantém o que foi digitado', async () => {
    lembrar();
    respostas = [[429, null]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(alerta().textContent).toBe(TOO_MANY_MESSAGE);
    expect(campo('code').value).toBe('123456');
    expect(campo('newPassword').value).toBe('Nova@Senha1');
  });

  it('erro do servidor no passo 2 diz que não deu para salvar', async () => {
    lembrar();
    respostas = [[500, null]];
    await montar();
    await preencherPasso2();
    await clicar(botao('Salvar senha nova'));
    expect(alerta().textContent).toBe(SAVE_FAILED_MESSAGE);
  });
});
