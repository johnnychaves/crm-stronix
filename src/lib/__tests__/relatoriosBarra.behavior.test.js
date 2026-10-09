// @vitest-environment jsdom
// Barra dos Relatórios e lista ao lado em uso (jsdom): o que o
// relatoriosBarra.test.js, que só lê o HTML, não alcança. O menu de consultores
// que marca e desmarca sem perder os outros, o submenu que chama onSection, o
// que o leitor de tela encontra em cada botão de filtro e nos dois balões. Os
// Select abertos ficam de fora: o Radix usa APIs de ponteiro que o jsdom não tem.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { periodFromParams } from '../period.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const { RelatoriosToolbar, ConsultoresMenu, ConsultoresControl, OrigemControl, FunilControl } = await import('../../views/relatorios/RelatoriosToolbar.jsx');
const { RelatoriosRail } = await import('../../views/relatorios/RelatoriosRail.jsx');

const NOW = new Date(2026, 8, 25, 14, 30);
const noop = () => {};
const people = [{ id: 'u1', name: 'Ana Ribeiro' }, { id: 'u2', name: 'Bruno Lima' }, { id: 'u3', name: 'Carla Souza' }];

let root = null;
let container = null;
let avisos = [];
async function montar(el) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
}
const remontar = (el) => act(async () => { root.render(el); });
// Aviso do React (key repetida, aninhamento inválido, act) é defeito: derruba o teste.
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.restoreAllMocks();
  expect(avisos).toEqual([]);
});

const clicar = async (el) => { await act(async () => { el.click(); }); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const caixa = (nome, dentro = container) => [...dentro.querySelectorAll('[role="checkbox"]')].find((c) => c.getAttribute('aria-label') === nome);
const gatilho = (nome) => container.querySelector(`button[aria-label="${nome}"]`);
const balao = () => document.querySelector('[data-slot="popover-content"]');

describe('menu de consultores', () => {
  it('Equipe toda limpa a escolha: onResp recebe a lista vazia', async () => {
    const onResp = vi.fn();
    await montar(h(ConsultoresMenu, { resp: ['u1', 'u2'], people, onResp }));
    expect(botao('Equipe toda').getAttribute('aria-pressed')).toBe('false');
    await clicar(botao('Equipe toda'));
    expect(onResp).toHaveBeenCalledTimes(1);
    expect(onResp).toHaveBeenCalledWith([]);
  });

  it('marcar uma pessoa soma o id aos que já estavam, e desmarcar tira só o dela', async () => {
    const onResp = vi.fn();
    const menu = (resp) => h(ConsultoresMenu, { resp, people, onResp });
    await montar(menu(['u1']));
    await clicar(caixa('Carla Souza'));
    expect(onResp).toHaveBeenLastCalledWith(['u1', 'u3']);
    // A tela devolve a lista nova do endereço; desmarcar a do meio deixa as outras como estavam.
    await remontar(menu(['u1', 'u2', 'u3']));
    expect(people.map((p) => caixa(p.name).getAttribute('aria-checked'))).toEqual(['true', 'true', 'true']);
    await clicar(caixa('Bruno Lima'));
    expect(onResp).toHaveBeenLastCalledWith(['u1', 'u3']);
    expect(onResp).toHaveBeenCalledTimes(2);
  });
});

describe('lista ao lado', () => {
  it('um submenu chama onSection com o id dele, e o aceso é o que a tela devolve', async () => {
    const onSection = vi.fn();
    const lista = (section) => h(RelatoriosRail, { section, onSection });
    const item = (texto) => [...container.querySelectorAll('nav button')].find((b) => b.textContent.includes(texto));
    await montar(lista('conversao'));
    expect(item('Conversão').getAttribute('aria-current')).toBe('page');
    await clicar(item('Entrada de leads'));
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('entrada');
    // O submenu aceso é o do endereço: só muda quando a tela devolve o novo.
    expect(item('Conversão').getAttribute('aria-current')).toBe('page');
    await remontar(lista('entrada'));
    expect(item('Entrada de leads').getAttribute('aria-current')).toBe('page');
    expect(item('Conversão').hasAttribute('aria-current')).toBe(false);
  });
});

describe('o que o leitor de tela encontra', () => {
  const filtros = (resp) => h('div', null,
    h(ConsultoresControl, { resp, people, onResp: noop }),
    h(OrigemControl, { origem: 'Instagram', origens: ['Instagram', 'Indicação'], onOrigem: noop }),
    h(FunilControl, { funnel: 'f1', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop }));
  // O texto visível do botão, que o aria-describedby aponta.
  const valorDe = (nome) => {
    const ligacao = gatilho(nome).getAttribute('aria-describedby');
    expect(ligacao, nome).toBeTruthy();
    const valor = document.getElementById(ligacao);
    expect(gatilho(nome).contains(valor), nome).toBe(true);
    return valor.textContent;
  };

  it('cada botão de filtro se chama pelo filtro e é descrito pelo valor visível, no Popover e no Select', async () => {
    await montar(filtros(['u2']));
    expect(valorDe('Consultores')).toBe('Bruno Lima');
    expect(valorDe('Origem')).toBe('Instagram');
    expect(valorDe('Funil')).toBe('Vendas');
    const ids = ['Consultores', 'Origem', 'Funil'].map((n) => gatilho(n).getAttribute('aria-describedby'));
    expect(new Set(ids).size).toBe(3);
    // O que o Radix põe no botão continua lá: a ordem das props não desligou o popover nem o combobox.
    expect(gatilho('Consultores').getAttribute('aria-haspopup')).toBe('dialog');
    expect(gatilho('Origem').getAttribute('role')).toBe('combobox');
    expect(gatilho('Funil').getAttribute('role')).toBe('combobox');
    // A descrição acompanha o valor e continua ligada ao mesmo texto.
    await remontar(filtros(['u1', 'u2']));
    expect(valorDe('Consultores')).toBe('2 consultores');
    expect(gatilho('Consultores').getAttribute('aria-describedby')).toBe(ids[0]);
  });

  it('o balão de consultores tem nome e borda próprios, e marcar dentro dele chega ao onResp', async () => {
    const onResp = vi.fn();
    await montar(h(ConsultoresControl, { resp: [], people, onResp }));
    await clicar(gatilho('Consultores'));
    expect(balao().getAttribute('role')).toBe('dialog');
    // O nome do balão não repete o do botão, e sem a cor o `border` do shadcn sai na cor do texto.
    expect(balao().getAttribute('aria-label')).toBe('Escolher consultores');
    expect(balao().className).toContain('border-border');
    await clicar(caixa('Ana Ribeiro', balao()));
    expect(onResp).toHaveBeenCalledWith(['u1']);
  });

  it('o balão de filtros do celular tem nome e borda próprios e traz os controles', async () => {
    const props = {
      period: periodFromParams({ monthKey: '2026-09' }, NOW), todayKey: '2026-09-25', onPeriod: noop, onRange: noop,
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      resp: [], people, onResp: noop, origem: null, origens: ['Instagram'], onOrigem: noop,
      funnel: 'all', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop,
    };
    await montar(h(RelatoriosToolbar, props));
    await clicar(gatilho('Filtros dos relatórios'));
    expect(balao().getAttribute('role')).toBe('dialog');
    expect(balao().getAttribute('aria-label')).toBe('Filtros');
    expect(balao().className).toContain('border-border');
    for (const nome of ['Período', 'Mês de competência', 'Consultores', 'Origem', 'Funil']) {
      expect(balao().querySelector(`[aria-label="${nome}"]`), nome).not.toBeNull();
    }
  });
});
