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

vi.mock('../firebase.js', () => ({ auth: {}, persistenceFor: async () => 'local' }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn(), setPersistence: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;

// Lê um arquivo do projeto pelo caminho relativo a este teste. No jsdom o new
// URL resolve contra a base http do jsdom, então o caminho sai do
// import.meta.url como texto.
const AQUI = dirname(fileURLToPath(import.meta.url));
const fonte = (relativo) => readFileSync(join(AQUI, relativo), 'utf8');

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
  const arvore = h(MemoryRouter, { initialEntries: [{ pathname: path, search, state }] }, h(Palco, { urlTenant, authSetupError }));
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

// Preenche e envia o formulário, com o Firebase recusando as credenciais.
async function entrarComSenhaErrada() {
  signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
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

// O F5 lê o que ficou no histórico do navegador. O React Router guarda o estado
// da navegação em history.state.usr, e o teste usa o histórico de verdade do
// jsdom para conferir que a volta não fica lá.
describe('F5 depois da volta', () => {
  async function montarNoNavegador() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(h(BrowserRouter, { useTransitions: false }, h(LoginScreen, { urlTenant: null })));
    });
  }

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('o estado da volta sai do histórico, com o mesmo endereço e o mesmo idx, e o F5 não repete o aviso', async () => {
    window.history.replaceState({ usr: { email: 'ana@academia.com', passwordReset: true }, key: 'volta', idx: 0 }, '', '/academia-teste?a=1#topo');
    await montarNoNavegador();
    expect(document.body.textContent).toContain('Senha nova salva. Entre com ela.');
    expect(window.history.state.usr).toBeNull();
    expect(window.history.state.idx).toBe(0);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/academia-teste?a=1#topo');

    // O F5: a página nasce de novo e lê o histórico que ficou.
    await act(async () => { root.unmount(); });
    document.body.innerHTML = '';
    await montarNoNavegador();
    expect(document.body.textContent).not.toContain('Senha nova salva');
    expect(campoEmail().value).toBe('');
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

  it('o erro de configuração do Firebase continua aparecendo na tela', async () => {
    await montar({ authSetupError: 'Configure o Firebase Auth.' });
    expect(document.body.textContent).toContain('Configure o Firebase Auth.');
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
    const app = fonte('../../App.jsx');
    const semSessao = app.slice(app.indexOf('if (!appUser) {'));
    const desvio = semSessao.indexOf('if (isPasswordResetPath(location.pathname)) return <ForgotPasswordScreen />;');
    expect(desvio).toBeGreaterThan(-1);
    expect(semSessao.indexOf('return <LoginScreen ')).toBeGreaterThan(desvio);
  });
});
