// @vitest-environment jsdom
// Proteção de erro dos modais, do cabeçalho e das telas de entrada. O
// AppErrorBoundary só envolve o conteúdo da tela, e o que fica fora dele (os
// modais de topo, as peças do cabeçalho e as telas sem sessão) derrubava o app
// inteiro com tela branca: em 2026-09-25 foi assim com o Novo lead com
// indicação (Sentry STRONILEAD-8) e com o título do cabeçalho (STRONILEAD-6).
// Aqui, um erro dentro da proteção fica nela e o resto do app continua de pé.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModalErrorBoundary, ScreenErrorBoundary, SilentErrorBoundary } from '../../components/ErrorBoundary.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let naoTratados = [];
let tratados = [];

async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container, {
    onUncaughtError: (e) => naoTratados.push(e),
    // É por este gancho que o main.jsx manda o erro tratado para o Sentry.
    onCaughtError: (e) => tratados.push(e),
  });
  await act(async () => { root.render(elemento); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  root = null;
  naoTratados = [];
  tratados = [];
});

const resto = () => document.getElementById('resto');
const texto = () => document.body.textContent;
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => { await act(async () => { el.click(); }); };

function Quebra() {
  throw new Error('quebrou no render');
}

function App({ children }) {
  return h('div', null, h('p', { id: 'resto' }, 'Resto do app'), children);
}

describe('ModalErrorBoundary', () => {
  it('erro no render do modal mostra o aviso e deixa o resto do app de pé', async () => {
    await montar(h(App, null, h(ModalErrorBoundary, { onClose: () => {} }, h(Quebra))));

    expect(resto()).not.toBeNull();
    expect(texto()).toContain('Essa janela travou');
    expect(naoTratados).toEqual([]);
    expect(tratados).toHaveLength(1);
  });

  it('Fechar no aviso fecha o modal', async () => {
    let fechou = 0;
    await montar(h(App, null, h(ModalErrorBoundary, { onClose: () => { fechou += 1; } }, h(Quebra))));

    await clicar(botao('Fechar'));

    expect(fechou).toBe(1);
  });

  it('modal fechado que quebra não mostra aviso', async () => {
    await montar(h(App, null, h(ModalErrorBoundary, { open: false, onClose: () => {} }, h(Quebra))));

    expect(resto()).not.toBeNull();
    expect(texto()).not.toContain('Essa janela travou');
    expect(naoTratados).toEqual([]);
  });

  it('depois de fechar o aviso, a próxima abertura do modal volta limpa', async () => {
    // Modal sempre montado, aberto pelo `open` (molde do HelpCenterModal),
    // com um problema que só existe na primeira abertura. É uma flag, e não
    // um contador de chamadas, porque o React repete o render que falhou
    // antes de entregar o erro à proteção.
    let quebrado = true;
    function Central({ open }) {
      if (open && quebrado) throw new Error('quebrou nesta abertura');
      return open ? h('div', null, 'Central de ajuda') : null;
    }
    function Casca() {
      const [open, setOpen] = useState(true);
      return h(App, null,
        h('button', { type: 'button', onClick: () => setOpen(true) }, 'Abrir'),
        h(ModalErrorBoundary, { open, onClose: () => setOpen(false) }, h(Central, { open })));
    }
    await montar(h(Casca));
    expect(texto()).toContain('Essa janela travou');
    quebrado = false;

    await clicar(botao('Fechar'));
    expect(texto()).not.toContain('Essa janela travou');

    await clicar(botao('Abrir'));
    expect(texto()).toContain('Central de ajuda');
    expect(texto()).not.toContain('Essa janela travou');
  });

  it('o tradutor trocando o texto da origem não derruba mais o app', async () => {
    // O STRONILEAD-8: o ícone da origem troca ao lado do nome da origem, e o
    // tradutor do navegador já tinha trocado esse nome por <font>. O React
    // quebra no insertBefore, e agora quem recebe o erro é a proteção do modal.
    function Cartao() {
      const [indicacao, setIndicacao] = useState(false);
      return h('div', null,
        h('button', { type: 'button', onClick: () => setIndicacao(true) }, 'É uma indicação?'),
        h('span', { id: 'origem' },
          indicacao ? h('i', null, 'mão') : h('b', null, 'câmera'),
          indicacao ? 'Indicação' : 'Instagram'));
    }
    await montar(h(App, null, h(ModalErrorBoundary, { onClose: () => {} }, h(Cartao))));
    const nome = [...document.getElementById('origem').childNodes].find((n) => n.nodeType === 3);
    const font = document.createElement('font');
    font.textContent = nome.nodeValue;
    nome.replaceWith(font);

    await clicar(botao('É uma indicação?'));

    expect(resto()).not.toBeNull();
    expect(texto()).toContain('Essa janela travou');
    expect(naoTratados).toEqual([]);
    expect(tratados[0]?.name).toBe('NotFoundError');
  });
});

describe('SilentErrorBoundary', () => {
  it('peça que quebra some sem aviso e o resto continua', async () => {
    await montar(h(App, null, h(SilentErrorBoundary, null, h(Quebra))));

    expect(resto()).not.toBeNull();
    expect(texto()).toBe('Resto do app');
    expect(naoTratados).toEqual([]);
    expect(tratados).toHaveLength(1);
  });
});

// No jsdom o new URL resolve contra a base http do jsdom, então o caminho do
// arquivo sai do import.meta.url como texto.
const AQUI = dirname(fileURLToPath(import.meta.url));
const AVISO = 'Não deu para abrir esta tela.';

// As telas de entrada (login, "Esqueci a senha", convite e indicação pública)
// são desenhadas sem sessão e fora do app. Tudo aqui é montado sem roteador,
// sem toast e sem nenhum contexto do app, porque o aviso não pode precisar deles.
describe('ScreenErrorBoundary', () => {
  it('sem erro, desenha a tela como ela é', async () => {
    await montar(h(ScreenErrorBoundary, null, h('p', { id: 'tela' }, 'Entrar')));

    expect(document.getElementById('tela')?.textContent).toBe('Entrar');
    expect(texto()).not.toContain(AVISO);
    expect(botao('Recarregar')).toBeUndefined();
    expect(naoTratados).toEqual([]);
    expect(tratados).toEqual([]);
  });

  it('erro no render da tela mostra o aviso e o botão Recarregar no lugar dela', async () => {
    await montar(h(ScreenErrorBoundary, null, h('p', { id: 'tela' }, 'Entrar'), h(Quebra)));

    expect(texto()).toContain(AVISO);
    expect(botao('Recarregar')).toBeDefined();
    // Nada da tela que quebrou fica na página, e o aviso é anunciado.
    expect(document.getElementById('tela')).toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(AVISO);
    expect(naoTratados).toEqual([]);
  });

  it('o botão Recarregar recarrega a página', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { href: window.location.href, reload });
    await montar(h(ScreenErrorBoundary, null, h(Quebra)));
    expect(reload).not.toHaveBeenCalled();

    await clicar(botao('Recarregar'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('o erro chega ao Sentry pelo mesmo gancho dos outros e o aviso mostra o código', async () => {
    await montar(h(ScreenErrorBoundary, null, h(Quebra)));

    expect(naoTratados).toEqual([]);
    expect(tratados).toHaveLength(1);
    expect(tratados[0].message).toBe('quebrou no render');
    // O Sentry devolve o id do evento em 32 hexadecimais, com ou sem cliente.
    expect(texto()).toMatch(/Código do erro: [0-9a-f]{32}/);
  });

  it('o aviso não usa nada do app: nenhum hook e só o Button e um ícone', () => {
    const fonte = readFileSync(join(AQUI, '../../components/ErrorBoundary.jsx'), 'utf8');
    const inicio = fonte.indexOf('function ScreenErrorFallback(');
    expect(inicio).toBeGreaterThan(-1);
    const corpo = fonte.slice(inicio, fonte.indexOf('\n}\n', inicio));
    // Hook é a porta para contexto, estado e dado do app. Sem ele, não há como
    // o aviso depender de toast, de roteador ou da moldura das telas de entrada.
    expect(corpo).not.toMatch(/\buse[A-Z]\w*\s*\(/);
    const componentes = [...corpo.matchAll(/<([A-Z][\w.]*)[\s>/]/g)].map((m) => m[1]);
    expect([...new Set(componentes)].sort()).toEqual(['AlertTriangle', 'Button']);
  });

  it('trocar de tela, com outra key, tira o aviso da tela que quebrou', async () => {
    // É o molde do AppInner: carregando, login e "Esqueci a senha" se revezam no
    // mesmo lugar, e o aviso de uma não pode ficar preso quando a outra entrar.
    function Casca() {
      const [tela, setTela] = useState('esqueci');
      return h('div', null,
        h('button', { type: 'button', onClick: () => setTela('login') }, 'Voltar ao login'),
        h(ScreenErrorBoundary, { key: tela }, tela === 'esqueci' ? h(Quebra) : h('p', { id: 'login' }, 'Entrar')));
    }
    await montar(h(Casca));
    expect(texto()).toContain(AVISO);

    await clicar(botao('Voltar ao login'));

    expect(texto()).not.toContain(AVISO);
    expect(document.getElementById('login')?.textContent).toBe('Entrar');
  });
});
