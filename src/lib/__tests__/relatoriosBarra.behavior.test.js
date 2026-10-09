// @vitest-environment jsdom
// Barra dos Relatórios e lista ao lado em uso (jsdom): o que o
// relatoriosBarra.test.js, que só lê o HTML, não alcança. O menu de consultores
// que marca e desmarca sem perder os outros, o submenu que chama onSection, o
// que o leitor de tela encontra em cada botão de filtro e nos dois balões, o
// filtro aceso e as listas de Origem, Funil e da lista ao lado. Os Select abrem
// pelo teclado (Enter no botão, Enter na opção): o mouse usa APIs de ponteiro
// que o jsdom não tem, e o teclado só precisa do stub de scrollIntoView.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { periodFromParams } from '../period.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, e a lista do Select leva
// a opção marcada para a vista com scrollIntoView. O jsdom não tem nenhum dos dois.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const { RelatoriosToolbar, FilterButton, ConsultoresMenu, ConsultoresControl, OrigemControl, FunilControl } = await import('../../views/relatorios/RelatoriosToolbar.jsx');
const { RelatoriosRail } = await import('../../views/relatorios/RelatoriosRail.jsx');

const NOW = new Date(2026, 8, 25, 14, 30);
const noop = () => {};
const people = [{ id: 'u1', name: 'Ana Ribeiro' }, { id: 'u2', name: 'Bruno Lima' }, { id: 'u3', name: 'Carla Souza' }];
const origens = ['Indicação', 'Instagram'];
const funnels = [{ id: 'f1', name: 'Vendas' }];
// Os props da barra inteira, sem nenhum filtro escolhido.
const barra = {
  period: periodFromParams({ monthKey: '2026-09' }, NOW), todayKey: '2026-09-25', onPeriod: noop, onRange: noop,
  monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
  canPrev: true, canNext: false, onPrev: noop, onNext: noop,
  resp: [], people, onResp: noop, origem: null, origens, onOrigem: noop,
  funnel: 'all', funnels, onFunnel: noop,
};
// Os três botões de filtro lado a lado, com o que estiver escolhido.
const filtros = ({ resp = [], origem = null, funnel = 'all' } = {}) => h('div', null,
  h(ConsultoresControl, { resp, people, onResp: noop }),
  h(OrigemControl, { origem, origens, onOrigem: noop }),
  h(FunilControl, { funnel, funnels, onFunnel: noop }));

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
// Aviso do React (key repetida, aninhamento inválido, act) ou do Radix é defeito: derruba o teste.
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args) => { avisos.push(`aviso: ${args.map(String).join(' ')}`); });
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
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
};
// Abre o Select como quem chega no botão com o Tab e aperta Enter.
const abrir = async (nome) => { gatilho(nome).focus(); await tecla(gatilho(nome), 'Enter'); };
const lista = () => document.querySelector('[data-slot="select-content"]');
const opcao = (texto) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === texto);

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

  it('no celular, o seletor chama onSection com o id, a lista tem borda própria e o botão tem 40px', async () => {
    const onSection = vi.fn();
    await montar(h(RelatoriosRail, { section: 'entrada', onSection }));
    // O h-9 do shadcn vem na variante data-[size=default]; um h-10 solto perderia para ele.
    expect(gatilho('Relatório').className).toContain('data-[size=default]:h-10');
    expect(gatilho('Relatório').className).not.toContain('data-[size=default]:h-9');
    await abrir('Relatório');
    expect(lista()).not.toBeNull();
    // Sem a cor, o `border` do shadcn sai na cor do texto.
    expect(lista().className).toContain('border-border');
    await tecla(opcao('Leads · Conversão'), 'Enter');
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('conversao');
  });
});

describe('listas de Origem e de Funil', () => {
  it('Origem: "Todas as origens" limpa o filtro (null), e a lista tem borda própria', async () => {
    const onOrigem = vi.fn();
    await montar(h(OrigemControl, { origem: 'Instagram', origens, onOrigem }));
    await abrir('Origem');
    expect(lista()).not.toBeNull();
    expect(lista().className).toContain('border-border');
    await tecla(opcao('Todas as origens'), 'Enter');
    expect(onOrigem).toHaveBeenCalledTimes(1);
    expect(onOrigem).toHaveBeenCalledWith(null);
  });

  it('Origem: escolher uma origem passa o nome dela', async () => {
    const onOrigem = vi.fn();
    await montar(h(OrigemControl, { origem: null, origens, onOrigem }));
    await abrir('Origem');
    await tecla(opcao('Indicação'), 'Enter');
    expect(onOrigem).toHaveBeenCalledTimes(1);
    expect(onOrigem).toHaveBeenCalledWith('Indicação');
  });

  it('Funil: escolher um funil passa o id, "Todos os funis" passa all, e a lista tem borda própria', async () => {
    const onFunnel = vi.fn();
    const funil = (funnel) => h(FunilControl, { funnel, funnels, onFunnel });
    await montar(funil('all'));
    await abrir('Funil');
    expect(lista().className).toContain('border-border');
    await tecla(opcao('Vendas'), 'Enter');
    expect(onFunnel).toHaveBeenLastCalledWith('f1');
    // A tela devolve o funil do endereço, e a escolha de voltar a todos passa o valor de "sem filtro".
    await remontar(funil('f1'));
    await abrir('Funil');
    await tecla(opcao('Todos os funis'), 'Enter');
    expect(onFunnel).toHaveBeenLastCalledWith('all');
    expect(onFunnel).toHaveBeenCalledTimes(2);
  });
});

describe('filtro aceso', () => {
  const nomes = ['Consultores', 'Origem', 'Funil'];

  it('o filtro escolhido acende o botão, e o sem escolha fica apagado', async () => {
    await montar(filtros({ resp: ['u2'], origem: 'Instagram', funnel: 'f1' }));
    for (const nome of nomes) {
      expect(gatilho(nome).className, nome).toContain('border-brand-600');
      expect(gatilho(nome).className, nome).not.toContain('border-border');
    }
    await remontar(filtros());
    for (const nome of nomes) {
      expect(gatilho(nome).className, nome).not.toContain('border-brand-600');
      expect(gatilho(nome).className, nome).toContain('border-border');
    }
  });

  it('o botão de filtros do celular acende, ganha o ponto e diz que há filtro ativo quando algum está escolhido', async () => {
    const filtrosDoCelular = () => container.querySelector('button[aria-label^="Filtros dos relatórios"]');
    // O ponto é o único span do botão: o ícone é um svg.
    const ponto = () => filtrosDoCelular().querySelector('span');
    await montar(h(RelatoriosToolbar, barra));
    expect(filtrosDoCelular().getAttribute('aria-label')).toBe('Filtros dos relatórios');
    expect(ponto()).toBeNull();
    expect(filtrosDoCelular().className).not.toContain('border-brand-600');
    for (const escolhido of [{ resp: ['u1'] }, { origem: 'Instagram' }, { funnel: 'f1' }]) {
      const quem = JSON.stringify(escolhido);
      await remontar(h(RelatoriosToolbar, { ...barra, ...escolhido }));
      expect(filtrosDoCelular().getAttribute('aria-label'), quem).toBe('Filtros dos relatórios, há filtro ativo');
      expect(ponto(), quem).not.toBeNull();
      expect(filtrosDoCelular().className, quem).toContain('border-brand-600');
    }
    // Limpar o filtro apaga o botão de novo.
    await remontar(h(RelatoriosToolbar, barra));
    expect(filtrosDoCelular().getAttribute('aria-label')).toBe('Filtros dos relatórios');
    expect(ponto()).toBeNull();
  });
});

describe('o que o leitor de tela encontra', () => {
  // O texto visível do botão, que o aria-describedby aponta.
  const valorDe = (nome) => {
    const ligacao = gatilho(nome).getAttribute('aria-describedby');
    expect(ligacao, nome).toBeTruthy();
    const valor = document.getElementById(ligacao);
    expect(gatilho(nome).contains(valor), nome).toBe(true);
    return valor.textContent;
  };

  it('o botão de consultores é descrito pelo valor visível; Origem e Funil, que já são combobox, não o repetem', async () => {
    await montar(filtros({ resp: ['u2'], origem: 'Instagram', funnel: 'f1' }));
    // Botão comum: o aria-label troca o texto, então o valor chega como descrição, ligada ao texto visível.
    expect(valorDe('Consultores')).toBe('Bruno Lima');
    // O que o Radix põe no botão continua lá: a ordem das props não desligou o popover nem o combobox.
    expect(gatilho('Consultores').getAttribute('aria-haspopup')).toBe('dialog');
    // O combobox já expõe o próprio texto como valor, e a descrição o faria ser lido duas vezes.
    for (const [nome, texto] of [['Origem', 'Instagram'], ['Funil', 'Vendas']]) {
      expect(gatilho(nome).getAttribute('role'), nome).toBe('combobox');
      expect(gatilho(nome).hasAttribute('aria-describedby'), nome).toBe(false);
      expect(gatilho(nome).textContent, nome).toContain(texto);
    }
    // A descrição acompanha o valor e continua ligada ao mesmo texto.
    const ligacao = gatilho('Consultores').getAttribute('aria-describedby');
    await remontar(filtros({ resp: ['u1', 'u2'], origem: 'Instagram', funnel: 'f1' }));
    expect(valorDe('Consultores')).toBe('2 consultores');
    expect(gatilho('Consultores').getAttribute('aria-describedby')).toBe(ligacao);
  });

  it('o nome e a descrição do botão vencem o que chega pelo ...rest, e uma descrição de fora só passa quando o botão não descreve o valor', async () => {
    // O Radix entrega seus atributos ao botão por esse caminho (asChild). Hoje nenhum colide com estes, mas
    // se um dia colidir, o botão tem de continuar com o nome do filtro e a descrição ligada ao valor.
    const Icone = () => h('svg');
    await montar(h('div', null,
      h(FilterButton, { label: 'Consultores', icon: Icone, text: 'Bruno Lima', describeValue: true, 'aria-label': 'intruso', 'aria-describedby': 'intruso' }),
      h(FilterButton, { label: 'Origem', icon: Icone, text: 'Instagram', 'aria-describedby': 'descricao-de-fora' })));
    const [consultores, origem] = container.querySelectorAll('button');
    expect(consultores.getAttribute('aria-label')).toBe('Consultores');
    expect(document.getElementById(consultores.getAttribute('aria-describedby')).textContent).toBe('Bruno Lima');
    // Sem describeValue, o botão não mexe na descrição: o que vier de fora fica.
    expect(origem.getAttribute('aria-label')).toBe('Origem');
    expect(origem.getAttribute('aria-describedby')).toBe('descricao-de-fora');
  });

  it('o balão de consultores tem nome e borda próprios, e marcar dentro dele chega ao onResp', async () => {
    const onResp = vi.fn();
    await montar(h(ConsultoresControl, { resp: [], people, onResp }));
    await clicar(gatilho('Consultores'));
    expect(balao().getAttribute('role')).toBe('dialog');
    // O nome do balão não repete o do botão, e sem a cor o `border` do shadcn sai na cor do texto.
    expect(balao().getAttribute('aria-label')).toBe('Escolher consultores');
    expect(balao().className).toContain('border-border');
    // Com muitos consultores, o balão rola por dentro em vez de passar da tela.
    expect(balao().className).toContain('max-h-(--radix-popover-content-available-height)');
    expect(balao().className).toContain('overflow-y-auto');
    await clicar(caixa('Ana Ribeiro', balao()));
    expect(onResp).toHaveBeenCalledWith(['u1']);
  });

  it('o balão de filtros do celular tem nome, borda e rolagem próprios e traz os controles', async () => {
    await montar(h(RelatoriosToolbar, barra));
    await clicar(gatilho('Filtros dos relatórios'));
    expect(balao().getAttribute('role')).toBe('dialog');
    expect(balao().getAttribute('aria-label')).toBe('Filtros');
    expect(balao().className).toContain('border-border');
    expect(balao().className).toContain('max-h-(--radix-popover-content-available-height)');
    expect(balao().className).toContain('overflow-y-auto');
    // Coluna flex com altura máxima encolhe os filhos antes de rolar: medido num celular deitado, os
    // botões de 36px ficavam com 25px. Com o shrink-0, o balão rola e cada controle tem o tamanho de sempre.
    expect(balao().className).toContain('[&>*]:shrink-0');
    for (const nome of ['Período', 'Mês de competência', 'Consultores', 'Origem', 'Funil']) {
      expect(balao().querySelector(`[aria-label="${nome}"]`), nome).not.toBeNull();
    }
  });
});

describe('fundo da barra fixa', () => {
  it('é o da raiz do App, e não o bg-background, que no tema escuro é azul-marinho', async () => {
    await montar(h(RelatoriosToolbar, barra));
    const fundo = container.firstElementChild.className;
    expect(fundo).toContain('sticky');
    expect(fundo).toContain('bg-paper-50');
    expect(fundo).toContain('dark:bg-neutral-950');
    expect(fundo).not.toContain('bg-background');
    // A raiz do App continua com esse mesmo par: se ela mudar, a barra tem de mudar junto.
    // Pelo caminho em texto: no jsdom o URL global não é o do Node, e o readFileSync recusa.
    const app = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../App.jsx'), 'utf8');
    expect(app).toContain('bg-paper-50 dark:bg-neutral-950');
  });
});
