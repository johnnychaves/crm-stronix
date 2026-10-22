// @vitest-environment jsdom
// A barra fina da ficha (StickyMini) e quem decide quando ela aparece
// (useHeaderGone). JSX, e não createElement, por causa do ref do Harness.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { StickyMini } from '../../components/profile/StickyMini.jsx';
import { useHeaderGone } from '../../hooks/useHeaderGone.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
async function render(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(element); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  delete globalThis.IntersectionObserver;
});

const barra = () => document.body.querySelector('[data-slot="ficha-mini"]');
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);

describe('StickyMini', () => {
  const props = (extra = {}) => ({
    visible: true, name: 'Rafael Moreira', photoUrl: null, tone: 'brand', stateText: 'Lead',
    onWhatsApp: vi.fn(), onCall: vi.fn(), ...extra,
  });

  it('visível: nome, estado, WhatsApp e Ligar funcionam', async () => {
    const p = props();
    await render(<StickyMini {...p} />);
    expect(barra().textContent).toContain('Rafael Moreira');
    expect(barra().textContent).toContain('Lead');
    expect(barra().hasAttribute('inert')).toBe(false);
    await act(async () => { botao('WhatsApp').click(); });
    await act(async () => { botao('Ligar').click(); });
    expect(p.onWhatsApp).toHaveBeenCalledTimes(1);
    expect(p.onCall).toHaveBeenCalledTimes(1);
  });

  it('repete os botões do cabeçalho: fica fora do Tab e da leitura de tela', async () => {
    await render(<StickyMini {...props()} />);
    expect(barra().getAttribute('aria-hidden')).toBe('true');
    expect(botao('WhatsApp').getAttribute('tabindex')).toBe('-1');
    expect(botao('Ligar').getAttribute('tabindex')).toBe('-1');
  });

  it('o clique não leva o foco para a barra, que some sem deixar o foco no body', async () => {
    await render(
      <>
        <input id="campo" />
        <StickyMini {...props()} />
      </>
    );
    const campo = document.getElementById('campo');
    campo.focus();
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    await act(async () => { botao('WhatsApp').dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(campo);
  });

  it('escondida: fica fora da tela, transparente e inerte', async () => {
    await render(<StickyMini {...props({ visible: false })} />);
    expect(barra().hasAttribute('inert')).toBe(true);
    expect(barra().className).toContain('-translate-y-[110%]');
    expect(barra().className).toContain('opacity-0');
  });

  it('gruda no topo da área que rola sem ocupar lugar no fluxo', async () => {
    await render(<StickyMini {...props()} />);
    const cls = barra().className.split(/\s+/);
    ['sticky', '-top-4', 'md:-top-8', 'h-14', '-mb-14'].forEach((c) => expect(cls).toContain(c));
  });

  it('a transição respeita o movimento reduzido', async () => {
    await render(<StickyMini {...props()} />);
    expect(barra().className).toContain('motion-reduce:transition-none');
  });
});

describe('useHeaderGone', () => {
  function Harness() {
    const ref = useRef(null);
    const gone = useHeaderGone(ref);
    return (
      <div>
        <section ref={ref} id="alvo" />
        <output id="gone">{String(gone)}</output>
      </div>
    );
  }
  const saida = () => document.body.querySelector('#gone').textContent;
  const observador = () => {
    const box = { callback: null, observed: null, disconnected: false };
    globalThis.IntersectionObserver = class {
      constructor(cb) { box.callback = cb; }
      observe(el) { box.observed = el; }
      disconnect() { box.disconnected = true; }
    };
    return box;
  };

  it('o cabeçalho que sai por cima da área que rola liga a barra, e voltar desliga', async () => {
    const io = observador();
    await render(<Harness />);
    expect(io.observed?.id).toBe('alvo');
    expect(saida()).toBe('false');
    await act(async () => { io.callback([{ isIntersecting: false, boundingClientRect: { top: -240 } }]); });
    expect(saida()).toBe('true');
    await act(async () => { io.callback([{ isIntersecting: true, boundingClientRect: { top: 20 } }]); });
    expect(saida()).toBe('false');
  });

  it('fora da área visível mas por baixo (não por cima), não liga', async () => {
    const io = observador();
    await render(<Harness />);
    await act(async () => { io.callback([{ isIntersecting: false, boundingClientRect: { top: 900 } }]); });
    expect(saida()).toBe('false');
  });

  it('desmontar desliga o observador', async () => {
    const io = observador();
    await render(<Harness />);
    await act(async () => { root.unmount(); });
    root = null;
    expect(io.disconnected).toBe(true);
  });

  it('sem IntersectionObserver, fica desligado e nada quebra', async () => {
    delete globalThis.IntersectionObserver;
    await render(<Harness />);
    expect(saida()).toBe('false');
  });
});
