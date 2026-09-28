// @vitest-environment jsdom
// Proteção de erro dos modais e do cabeçalho. O AppErrorBoundary só envolve o
// conteúdo da tela, e o que fica fora dele (os modais de topo e as peças do
// cabeçalho) derrubava o app inteiro com tela branca: em 2026-09-25 foi assim
// com o Novo lead com indicação (Sentry STRONILEAD-8) e com o título do
// cabeçalho (STRONILEAD-6). Aqui, um erro dentro da proteção fica nela e o
// resto do app continua de pé.
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ModalErrorBoundary, SilentErrorBoundary } from '../../components/ErrorBoundary.jsx';

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
