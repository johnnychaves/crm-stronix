// @vitest-environment jsdom
// O item Rotinas do menu com o balão "Novo" vermelho (mockup
// 2026-10-08-balao-novo-rotinas.html, opção C). O balão é irmão do link, nunca
// filho: o clique nele abre a explicação sem trocar de tela, e o clique no
// resto do item abre a tela. No trilho recolhido do desktop o balão some e não
// recebe clique, e um ponto vermelho no ícone avisa.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarItem } from '../../components/layout/Sidebar.jsx';
import { RotinasNovo } from '../../components/rotinas/RotinasIntro.jsx';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HOJE = new Date(2026, 9, 8, 9, 0);
// A duração da largura do menu (o <aside> do App.jsx). O balão só aparece
// depois dela, senão o clique rápido no ícone cairia nele.
// No jsdom o new URL relativo não é file:, então o caminho sai do import.meta.url como texto.
const APP = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../App.jsx'), 'utf8');
const MENU_MS = Number(APP.match(/className=\{`group\/sidebar [^`]*?transition-\[transform,width,box-shadow\] duration-(\d+) /)?.[1]);
const nav = { pathname: null };
function Where() {
  const location = useLocation();
  useEffect(() => { nav.pathname = location.pathname; });
  return null;
}

let container;
let root;
// O jsdom não navega: quem cancela o clique que o Link deixou passar é este
// ouvinte, depois de anotar se o app tinha cancelado (clique tratado pelo
// roteador) ou não.
let cancelledByApp;
const record = (event) => {
  cancelledByApp = event.defaultPrevented;
  event.preventDefault();
};
beforeEach(() => {
  nav.pathname = null;
  cancelledByApp = null;
  document.addEventListener('click', record);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  document.removeEventListener('click', record);
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const montar = async ({ novo, active = false, onNavigate = () => {} } = {}) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad'] },
      h(Where),
      h(SidebarItem, { label: 'Rotinas', href: '/acad/rotinas', active, onNavigate, novo })));
  });
};
const link = () => container.querySelector('a');
const balao = () => document.body.querySelector('[aria-label="Novo: o que é esta tela"]');
const dialogo = () => document.body.querySelector('[role="dialog"]');
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const pontoVermelho = () => link().querySelector('span[aria-hidden="true"].bg-red-600');

describe('o item Rotinas com o balão "Novo"', () => {
  it('a largura do menu tem duração conhecida no App.jsx', () => {
    expect(MENU_MS).toBe(300);
  });

  it('o balão fica fora do link, ao lado dele, e é vermelho', async () => {
    await montar({ novo: h(RotinasNovo, { tone: 'alert', now: HOJE }) });
    expect(link().getAttribute('href')).toBe('/acad/rotinas');
    expect(balao()).not.toBeNull();
    expect(link().contains(balao())).toBe(false);
    expect(link().querySelector('button')).toBeNull();
    expect(balao().closest('a')).toBeNull();
    // Irmão do link, dentro do mesmo contêiner que o posiciona.
    expect(link().parentElement.contains(balao())).toBe(true);
    expect(link().parentElement.className).toContain('relative');
    expect(balao().className).toContain('bg-red-600');
  });

  it('o clique no balão abre a explicação e não troca de tela, nem no Entendi', async () => {
    const onNavigate = vi.fn();
    await montar({ novo: h(RotinasNovo, { tone: 'alert', now: HOJE }), onNavigate });
    expect(nav.pathname).toBe('/acad');
    await clicar(balao());
    expect(cancelledByApp).toBe(false);
    expect(dialogo().querySelector('h2').textContent).toBe('Rotinas');
    expect(nav.pathname).toBe('/acad');
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(nav.pathname).toBe('/acad');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('o clique no resto do item abre a tela', async () => {
    const onNavigate = vi.fn();
    await montar({ novo: h(RotinasNovo, { tone: 'alert', now: HOJE }), onNavigate });
    await clicar(link());
    expect(cancelledByApp).toBe(true);
    expect(nav.pathname).toBe('/acad/rotinas');
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
  });

  // O jsdom não roda transição: aqui as classes bastam. O comportamento de
  // verdade (clique rápido no ícone abre a tela, o balão aparece depois que o
  // menu abre) foi conferido no navegador.
  it('no trilho recolhido, o balão fica com tamanho zero e só aparece depois que o menu termina de abrir', async () => {
    await montar({ novo: h(RotinasNovo, { tone: 'alert', now: HOJE }) });
    const lugar = balao().parentElement.className.split(/\s+/);
    expect(lugar).toEqual(expect.arrayContaining([
      'absolute', 'right-3', 'top-1/2', '-translate-y-1/2',
      // Recolhido: tamanho zero (sem clique) e transparente, e some na hora.
      'md:scale-0', 'md:opacity-0', 'md:[transition:none]',
      // Aberto pelo mouse ou pelo Tab: aparece depois da largura do menu.
      'md:group-hover/sidebar:scale-100', 'md:group-hover/sidebar:opacity-100',
      `md:group-hover/sidebar:[transition:opacity_200ms_${MENU_MS}ms,scale_0s_${MENU_MS}ms]`,
      'md:group-has-[:focus-visible]/sidebar:scale-100', 'md:group-has-[:focus-visible]/sidebar:opacity-100',
      `md:group-has-[:focus-visible]/sidebar:[transition:opacity_200ms_${MENU_MS}ms,scale_0s_${MENU_MS}ms]`,
    ]));
    // Sem `invisible` nem `hidden`: elemento invisível não recebe foco, e o
    // Tab e a volta do foco ao fechar o pop-up precisam do balão.
    expect(lugar.filter((c) => /(^|:)(invisible|hidden|pointer-events-none)$/.test(c))).toEqual([]);
    // No celular (sem o prefixo md:) fica à vista, clicável e sem atraso.
    expect(lugar.filter((c) => !c.startsWith('md:') && /scale|opacity|transition|delay/.test(c))).toEqual([]);
  });

  it('no trilho recolhido, um ponto vermelho no ícone avisa, e some no hover ou no foco', async () => {
    await montar({ novo: h(RotinasNovo, { tone: 'alert', now: HOJE }), active: true });
    const ponto = pontoVermelho();
    expect(ponto).not.toBeNull();
    expect(ponto.className.split(/\s+/)).toEqual(expect.arrayContaining([
      'hidden', 'md:block', 'pointer-events-none', 'md:group-hover/sidebar:opacity-0', 'md:group-has-[:focus-visible]/sidebar:opacity-0',
    ]));
    expect(link().querySelector('.bg-accent-500[aria-hidden="true"].size-2')).toBeNull();
  });

  it('o rótulo guarda lugar para o balão', async () => {
    await montar({ novo: h(RotinasNovo, { tone: 'alert', now: HOJE }) });
    const rotulo = [...link().querySelectorAll('span')].find((s) => s.textContent === 'Rotinas');
    expect(rotulo.className).toContain('pr-[68px]');
  });
});

describe('o item Rotinas sem o balão', () => {
  it('depois do último dia o App passa null: é o link de sempre, sem ponto e sem contêiner', async () => {
    await montar({ novo: null });
    expect(container.firstElementChild.tagName).toBe('A');
    expect(balao()).toBeNull();
    expect(pontoVermelho()).toBeNull();
    expect(link().querySelector('span[aria-hidden="true"].size-2')).toBeNull();
    const rotulo = [...link().querySelectorAll('span')].find((s) => s.textContent === 'Rotinas');
    expect(rotulo.className).not.toContain('pr-[68px]');
  });
});
