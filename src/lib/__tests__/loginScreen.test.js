// @vitest-environment jsdom
// O login leva o e-mail e a academia ao "Esqueci a senha" e mostra o aviso de
// quem volta de lá com a senha trocada. Sem Firebase de verdade.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode, createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LoginScreen } from '../../views/auth/LoginScreen.jsx';
import { ForgotPasswordScreen } from '../../views/auth/ForgotPasswordScreen.jsx';
import { TOO_MANY_MESSAGE, isPasswordResetPath } from '../passwordReset.js';

vi.mock('../firebase.js', () => ({ auth: {}, persistenceFor: async () => 'local' }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn(), setPersistence: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
// Monta a árvore do montar com as props dadas, para o redesenhar.
let desenhar = null;

// Lê um arquivo do projeto pelo caminho relativo a este teste. No jsdom o new
// URL resolve contra a base http do jsdom, então o caminho sai do
// import.meta.url como texto.
const AQUI = dirname(fileURLToPath(import.meta.url));
const fonte = (relativo) => readFileSync(join(AQUI, relativo), 'utf8');

// Tira comentário de bloco e de linha, como a varredura do endereço faz: a linha
// comentada tem o mesmo texto da linha ligada e não liga nada.
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MEMORIA = 'stronilead:recuperar-senha';
// As classes que as caixas de erro do login já tinham antes de virarem o
// AuthAlert, com o mb-4.
const CAIXA_DO_ERRO = 'mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300'.split(' ').sort();
const classesDe = (el) => [...el.classList].sort();

// Mostra o endereço e o estado de agora, e o login fora do /recuperar-senha. O
// tipo da navegação diz se a entrada do histórico foi trocada (REPLACE) ou se
// ficou a de sempre (POP). O link leva a outro endereço com o login ainda montado.
function Palco({ urlTenant, authSetupError }) {
  const loc = useLocation();
  const tipo = useNavigationType();
  return h('div', null,
    loc.pathname === '/recuperar-senha' ? null : h(LoginScreen, { urlTenant, authSetupError }),
    h(Link, { id: 'ir-para-outra', to: '/outra' }, 'ir'),
    h('pre', { id: 'rota', 'data-tipo': tipo, 'data-search': loc.search }, JSON.stringify({ path: loc.pathname, state: loc.state ?? null })));
}

// O estrito monta como o main.jsx, dentro do StrictMode, que roda os efeitos duas vezes.
async function montar({ path = '/academia-teste', search = '', state = null, urlTenant = null, authSetupError = '', estrito = false } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  desenhar = (props) => {
    const arvore = h(MemoryRouter, { initialEntries: [{ pathname: path, search, state }] }, h(Palco, props));
    return estrito ? h(StrictMode, null, arvore) : arvore;
  };
  await act(async () => {
    root.render(desenhar({ urlTenant, authSetupError }));
  });
}

// Desenha de novo a árvore que o montar criou, com as props de agora: os
// elementos são os mesmos, só mudam as props.
async function redesenhar(props) {
  await act(async () => {
    root.render(desenhar(props));
  });
}

// Monta no histórico de verdade do jsdom, como o main.jsx. O React Router guarda
// o estado da navegação em history.state.usr.
async function montarNoNavegador(elemento, { estrito = false } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const arvore = h(BrowserRouter, { useTransitions: false }, elemento);
  await act(async () => {
    root.render(estrito ? h(StrictMode, null, arvore) : arvore);
  });
}

const rota = () => JSON.parse(document.getElementById('rota').textContent);
const campoEmail = () => document.querySelector('input[type="email"]');
const campoSenha = () => document.querySelector('input[autocomplete="current-password"]');
const link = (rotulo) => [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === rotulo);
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const regiaoDoErro = () => document.getElementById('login-erro');
const regiaoDoAviso = () => document.getElementById('login-aviso');
// O que o leitor de tela junta para descrever o campo: o texto de cada id do aria-describedby.
const descricao = (el) => (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();

async function escrever(el, valor) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// O login espera a resposta do Firebase, então o clique deixa uma volta do
// relógio antes de o act fechar.
async function clicar(el) {
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

// Preenche e envia o formulário, com o Firebase recusando a entrada do jeito
// dado. Sem argumento, recusa como credencial inválida.
async function entrarComSenhaErrada(rejeicao = { code: 'auth/invalid-credential' }) {
  signInWithEmailAndPassword.mockRejectedValueOnce(rejeicao);
  await escrever(campoEmail(), 'bia@academia.com');
  await escrever(campoSenha(), 'Senha@Errada1');
  await clicar(botao('Entrar'));
}

beforeEach(() => {
  signInWithEmailAndPassword.mockReset();
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  desenhar = null;
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('volta do "Esqueci a senha"', () => {
  it('mostra o aviso, preenche o e-mail e limpa o estado da navegação', async () => {
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    expect(document.body.textContent).toContain('Senha nova salva. Entre com ela.');
    expect(document.querySelector('[role="status"]').textContent).toContain('Senha nova salva.');
    expect(campoEmail().value).toBe('ana@academia.com');
    expect(rota()).toEqual({ path: '/academia-teste', state: null });
  });

  it('sem a volta, não mostra aviso', async () => {
    await montar();
    expect(document.body.textContent).not.toContain('Senha nova salva');
  });

  it('limpa o estado trocando a entrada do histórico, sem mudar o endereço', async () => {
    await montar({ search: '?x=1', state: { email: 'ana@academia.com', passwordReset: true } });
    const palco = document.getElementById('rota');
    expect(palco.dataset.tipo).toBe('REPLACE');
    expect(palco.dataset.search).toBe('?x=1');
    expect(rota()).toEqual({ path: '/academia-teste', state: null });
  });

  it('sem a volta, não mexe no histórico', async () => {
    await montar();
    expect(document.getElementById('rota').dataset.tipo).toBe('POP');
  });

  it('no StrictMode do app, mostra o aviso e deixa o estado limpo', async () => {
    await montar({ estrito: true, state: { email: 'ana@academia.com', passwordReset: true } });
    expect(regiaoDoAviso().textContent).toBe('Senha nova salva. Entre com ela.');
    expect(campoEmail().value).toBe('ana@academia.com');
    expect(rota()).toEqual({ path: '/academia-teste', state: null });
  });

  it('depois de limpar o estado, uma troca de endereço não é desfeita', async () => {
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    await clicar(document.getElementById('ir-para-outra'));
    expect(rota().path).toBe('/outra');
  });

  it('o aviso sai na primeira tentativa de entrar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    expect(regiaoDoAviso().textContent).toBe('Senha nova salva. Entre com ela.');
    await entrarComSenhaErrada();
    expect(regiaoDoAviso().textContent).toBe('');
    expect(campoSenha().hasAttribute('aria-describedby')).toBe(false);
  });
});

// O F5 lê o que ficou no histórico do navegador, e o teste usa o histórico de
// verdade do jsdom para conferir que a volta não fica lá.
describe('F5 depois da volta', () => {
  it('o estado da volta sai do histórico, com o mesmo endereço e o mesmo idx, e o F5 não repete o aviso', async () => {
    window.history.replaceState({ usr: { email: 'ana@academia.com', passwordReset: true }, key: 'volta', idx: 0 }, '', '/academia-teste?a=1#topo');
    await montarNoNavegador(h(LoginScreen, { urlTenant: null }));
    expect(document.body.textContent).toContain('Senha nova salva. Entre com ela.');
    expect(window.history.state.usr).toBeNull();
    expect(window.history.state.idx).toBe(0);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/academia-teste?a=1#topo');

    // O F5: a página nasce de novo e lê o histórico que ficou.
    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montarNoNavegador(h(LoginScreen, { urlTenant: null }));
    expect(document.body.textContent).not.toContain('Senha nova salva');
    expect(campoEmail().value).toBe('');
  });
});

// A ida e a volta com as duas telas de verdade, no histórico do navegador: o
// que a tela do "Esqueci a senha" manda é o que o login lê. O Palco faz o mesmo
// desvio do App sem sessão, e o fetch responde como o servidor responde quando
// dá certo.
describe('ida e volta do "Esqueci a senha"', () => {
  const ACADEMIA = { slug: 'academia-teste', found: true, displayName: 'Academia Teste' };

  function PalcoDoApp() {
    const loc = useLocation();
    return isPasswordResetPath(loc.pathname) ? h(ForgotPasswordScreen) : h(LoginScreen, { urlTenant: ACADEMIA });
  }

  let servidor = null;

  beforeEach(() => {
    sessionStorage.clear();
    servidor = vi.fn(async () => ({ status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal('fetch', servidor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it.each([['sem StrictMode', false], ['com StrictMode', true]])('a senha trocada volta ao login com o aviso, o e-mail e o cursor na senha, %s', async (_nome, estrito) => {
    window.history.replaceState({ usr: null, key: 'inicio', idx: 0 }, '', '/academia-teste');
    await montarNoNavegador(h(PalcoDoApp), { estrito });

    // Do login ao "Esqueci a senha", com o e-mail digitado e a academia do endereço.
    await escrever(campoEmail(), 'bia@academia.com');
    await clicar(link('Esqueci a senha'));
    expect(window.location.pathname).toBe('/recuperar-senha');
    expect(document.querySelector('input[name="email"]').value).toBe('bia@academia.com');
    expect(document.body.textContent).toContain('Academia Teste');

    // Passo 1, o código por e-mail. Passo 2, o código com a senha nova.
    await clicar(botao('Enviar código'));
    expect(sessionStorage.getItem(MEMORIA)).not.toBeNull();
    await escrever(document.querySelector('input[name="code"]'), '123456');
    await escrever(document.querySelector('input[name="newPassword"]'), 'Nova@Senha1');
    await escrever(document.querySelector('input[name="confirmPassword"]'), 'Nova@Senha1');
    await clicar(botao('Salvar senha nova'));
    expect(servidor).toHaveBeenCalledTimes(2);

    // De volta ao login da academia, com tudo o que a outra tela mandou. O idx
    // 1 é a entrada do "Esqueci a senha" trocada pelo login: nenhuma sobrou.
    expect(window.location.pathname).toBe('/academia-teste');
    expect(campoEmail().value).toBe('bia@academia.com');
    expect(document.activeElement).toBe(campoSenha());
    expect(descricao(campoSenha())).toBe('Senha nova salva. Entre com ela.');
    expect(document.body.textContent).toContain('Academia Teste');
    expect(window.history.state.usr).toBeNull();
    expect(window.history.state.idx).toBe(1);
    expect(sessionStorage.getItem(MEMORIA)).toBeNull();
  });
});

describe('quem volta com a senha nova', () => {
  it('cai no campo da senha, e o leitor de tela lê o aviso junto com ele', async () => {
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    expect(document.activeElement).toBe(campoSenha());
    expect(descricao(campoSenha())).toContain('Senha nova salva.');
  });

  it('sem a volta, o foco não vai para o campo da senha e ele não tem descrição', async () => {
    await montar();
    expect(document.activeElement).not.toBe(campoSenha());
    expect(campoSenha().hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('avisos do login', () => {
  it('a região do erro já está na tela, vazia, e o mesmo elemento recebe a frase', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    const regiao = regiaoDoErro();
    expect(regiao).not.toBeNull();
    expect(regiao.getAttribute('role')).toBe('alert');
    expect(regiao.textContent).toBe('');
    await entrarComSenhaErrada();
    expect(regiaoDoErro()).toBe(regiao);
    expect(regiao.textContent).toBe('E-mail ou senha inválidos.');
  });

  it('a região do aviso já está na tela, vazia, e é a que o campo da senha descreve', async () => {
    await montar();
    const regiao = regiaoDoAviso();
    expect(regiao).not.toBeNull();
    expect(regiao.getAttribute('role')).toBe('status');
    expect(regiao.textContent).toBe('');

    // Na volta, o campo aponta para ela e o texto é o do aviso.
    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    expect(campoSenha().getAttribute('aria-describedby')).toBe('login-aviso');
    expect(regiaoDoAviso().textContent).toBe('Senha nova salva. Entre com ela.');
  });

  it('erro e aviso ganham a margem de baixo só quando têm mensagem, como as caixas de antes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar({ state: { email: 'ana@academia.com', passwordReset: true } });
    expect(regiaoDoAviso().classList.contains('mb-4')).toBe(true);
    expect(regiaoDoErro().classList.contains('mb-4')).toBe(false);
    expect(regiaoDoErro().classList.contains('sr-only')).toBe(true);
    await entrarComSenhaErrada();
    expect(regiaoDoErro().classList.contains('mb-4')).toBe(true);
    expect(regiaoDoErro().classList.contains('sr-only')).toBe(false);
    expect(regiaoDoAviso().classList.contains('mb-4')).toBe(false);
    expect(regiaoDoAviso().classList.contains('sr-only')).toBe(true);
  });

  it('o erro de configuração também é anunciado: a região já está na tela e recebe a frase na caixa de sempre', async () => {
    await montar();
    // O login tem duas regiões de alerta: a do erro de entrada (#login-erro) e a
    // da configuração, que não tem id porque não descreve campo nenhum.
    const regiao = [...document.querySelectorAll('[role="alert"]')].find((el) => el.id !== 'login-erro');
    expect(regiao).toBeDefined();
    expect(regiao.textContent).toBe('');
    await redesenhar({ urlTenant: null, authSetupError: 'Configure o Firebase Auth.' });
    expect(regiao.isConnected).toBe(true);
    expect(regiao.textContent).toBe('Configure o Firebase Auth.');
    expect(classesDe(regiao)).toEqual(CAIXA_DO_ERRO);
  });
});

// O que a pessoa da recepção lê quando o Firebase recusa a entrada: nenhuma
// frase fala em configuração nem em Firebase, e o código do erro fica só no console.
describe('erro de entrada do login', () => {
  it.each([
    ['auth/invalid-credential', 'E-mail ou senha inválidos.'],
    ['auth/wrong-password', 'E-mail ou senha inválidos.'],
    ['auth/user-not-found', 'E-mail ou senha inválidos.'],
    ['auth/too-many-requests', TOO_MANY_MESSAGE],
    ['auth/network-request-failed', 'Sem conexão com a internet. Confira a rede e tente de novo.'],
    ['auth/user-disabled', 'Essa conta está desativada. Fale com o administrador da sua academia.'],
    ['auth/internal-error', 'Não deu para entrar agora. Tente de novo.'],
  ])('%s mostra "%s"', async (code, frase) => {
    const erroNoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    const recusa = { code };
    await entrarComSenhaErrada(recusa);
    expect(regiaoDoErro().textContent).toBe(frase);
    expect(regiaoDoErro().textContent).not.toMatch(/firebase/i);
    expect(erroNoConsole).toHaveBeenCalledWith(recusa);
  });

  it('um erro sem código também cai em "Não deu para entrar agora"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await entrarComSenhaErrada(new Error('falha sem código'));
    expect(regiaoDoErro().textContent).toBe('Não deu para entrar agora. Tente de novo.');
  });
});

describe('links para o "Esqueci a senha"', () => {
  it('"Esqueci a senha" leva o e-mail digitado e a academia achada', async () => {
    await montar({ urlTenant: { slug: 'academia-teste', found: true, displayName: 'Academia Teste' } });
    await escrever(campoEmail(), 'bia@academia.com');
    await clicar(link('Esqueci a senha'));
    expect(rota()).toEqual({
      path: '/recuperar-senha',
      state: { email: 'bia@academia.com', tenant: { slug: 'academia-teste', displayName: 'Academia Teste' } },
    });
  });

  it('"Recuperar acesso" sem academia no endereço vai sem academia', async () => {
    await montar({ path: '/' });
    await clicar(link('Recuperar acesso'));
    expect(rota()).toEqual({ path: '/recuperar-senha', state: { email: '', tenant: null } });
  });
});

describe('o login de hoje', () => {
  it('não usa mais o link de redefinição do Firebase', () => {
    expect(fonte('../../views/auth/LoginScreen.jsx')).not.toContain('sendPasswordResetEmail');
  });

  it('não tem travessão nos textos', async () => {
    await montar({ urlTenant: { slug: 'nao-existe', found: false } });
    expect(document.body.textContent).toContain('Academia “nao-existe” não encontrada. Confira o link.');
    // \u2014 é o travessão e \u2013 é o meio-traço.
    expect(document.body.textContent).not.toMatch(/[\u2014\u2013]/);
  });
});

// O App é grande demais para montar num teste, então o desvio do endereço é
// conferido pelo texto, no molde da varredura do endereço.
describe('o App e o endereço /recuperar-senha', () => {
  it('sem sessão, desenha o "Esqueci a senha" no lugar do login, só nesse endereço', () => {
    // Sem os comentários: a linha comentada tem o mesmo texto e não liga nada.
    const app = semComentarios(fonte('../../App.jsx'));
    const semSessao = app.slice(app.indexOf('if (!appUser) {'));
    const desvio = semSessao.indexOf('if (isPasswordResetPath(location.pathname)) return <ForgotPasswordScreen />;');
    expect(desvio).toBeGreaterThan(-1);
    expect(semSessao.indexOf('return <LoginScreen ')).toBeGreaterThan(desvio);
  });
});
