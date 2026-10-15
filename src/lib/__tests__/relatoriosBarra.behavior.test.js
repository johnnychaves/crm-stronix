// @vitest-environment jsdom
// Barra dos Relatórios e lista ao lado em uso (jsdom): o que o
// relatoriosBarra.test.js, que só lê o HTML, não alcança. O menu de consultores
// que marca e desmarca sem perder os outros, o grupo da lista ao lado que abre e
// fecha, o submenu que chama onSection, o que o leitor de tela encontra em cada
// pílula de filtro e nos balões, o filtro aceso, os menus de Origem e Funil, a
// lista dos meses e o corte de Leads parados. O Select do celular e os menus de
// Origem e Funil abrem pelo teclado (Enter no botão): o mouse usa APIs de
// ponteiro que o jsdom não tem.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { periodFromParams } from '../period.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, e a lista do Select leva
// a opção marcada para a vista com scrollIntoView. O jsdom não tem nenhum dos dois.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const { RelatoriosToolbar, FilterButton, ConsultoresMenu, ConsultoresControl, OrigemControl, FunilControl, DiasControl, PeriodBox } = await import('../../views/relatorios/RelatoriosToolbar.jsx');
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
const opcao = (texto) => [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === texto);
const menu = () => document.querySelector('[data-slot="dropdown-menu-content"]');
const itemDoMenu = (texto) => [...document.querySelectorAll('[role="menuitemradio"]')].find((o) => o.textContent.trim() === texto);
const radios = () => [...container.querySelectorAll('[role="radio"]')];
const radio = (nome, dentro = container) => dentro.querySelector(`[role="radio"][aria-label="${nome}"]`);
const classes = (el) => el.className.split(/\s+/);

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
  const hrefOf = (id) => `/acad/relatorios/${id}?mes=2026-09`;
  const lista = (section, onSection, numbers = null) => h(MemoryRouter, null, h(RelatoriosRail, { section, onSection, hrefOf, numbers }));
  const cabecalho = () => container.querySelector('nav button[aria-expanded]');
  const item = (texto) => [...container.querySelectorAll('nav a')].find((a) => a.textContent.includes(texto));

  it('o grupo abre fechado, fora do Tab, e o cabeçalho abre e fecha dizendo o que há dentro', async () => {
    await montar(lista('conversao', noop));
    const painel = document.getElementById(cabecalho().getAttribute('aria-controls'));
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false');
    expect(cabecalho().textContent).toContain('Aberto: Conversão');
    expect(painel.querySelector('[inert]')).not.toBeNull();
    expect(classes(painel)).toContain('grid-rows-[0fr]');
    expect(classes(painel)).toContain('motion-reduce:transition-none');
    await clicar(cabecalho());
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true');
    expect(cabecalho().textContent).toContain('5 relatórios');
    expect(painel.querySelector('[inert]')).toBeNull();
    expect(classes(painel)).toContain('grid-rows-[1fr]');
    await clicar(cabecalho());
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false');
  });

  it('um submenu chama onSection com o id dele, sem navegar pelo link, e o aceso é o que a tela devolve', async () => {
    const onSection = vi.fn();
    await montar(lista('conversao', onSection));
    await clicar(cabecalho());
    expect(item('Conversão').getAttribute('aria-current')).toBe('page');
    expect(item('Entrada de leads').getAttribute('href')).toBe('/acad/relatorios/entrada?mes=2026-09');
    await clicar(item('Entrada de leads'));
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('entrada');
    // O submenu aceso é o do endereço: só muda quando a tela devolve o novo.
    expect(item('Conversão').getAttribute('aria-current')).toBe('page');
    await remontar(lista('entrada', onSection));
    expect(item('Entrada de leads').getAttribute('aria-current')).toBe('page');
    expect(item('Conversão').hasAttribute('aria-current')).toBe(false);
  });

  it('Ctrl+clique fica com o navegador, para abrir o relatório em outra aba', async () => {
    const onSection = vi.fn();
    await montar(lista('conversao', onSection));
    await clicar(cabecalho());
    // Depois do React, o teste segura a navegação que o jsdom não sabe fazer e anota se alguém já a tinha segurado.
    let seguradoPeloApp = null;
    const segurar = (e) => { seguradoPeloApp = e.defaultPrevented; e.preventDefault(); };
    document.addEventListener('click', segurar);
    await act(async () => { item('Perdas').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })); });
    document.removeEventListener('click', segurar);
    expect(seguradoPeloApp).toBe(false);
    expect(onSection).not.toHaveBeenCalled();
  });

  it('cada item mostra o número do relatório, aceso no submenu aberto', async () => {
    await montar(lista('entrada', noop, { entrada: { text: '42' }, conversao: { none: true } }));
    const numero = (texto) => item(texto).lastElementChild;
    expect(numero('Entrada de leads').textContent).toBe('42');
    expect(classes(numero('Entrada de leads'))).toContain('font-display');
    expect(numero('Entrada de leads').className).toContain('text-brand-700');
    expect(numero('Conversão').textContent).toBe('—sem base');
    expect(numero('Conversão').querySelector('[aria-hidden="true"]').textContent).toBe('—');
    expect(numero('Conversão').className).toContain('text-muted-foreground');
    // Sem número (os meses ainda não chegaram), o item fica só com o nome.
    expect(item('Perdas').textContent).toBe('Perdas');
  });

  it('no celular, o seletor chama onSection com o id, a lista tem borda própria e o botão tem 40px', async () => {
    const onSection = vi.fn();
    await montar(lista('entrada', onSection));
    // O h-9 do shadcn vem na variante data-[size=default]; um h-10 solto perderia para ele.
    expect(gatilho('Relatório').className).toContain('data-[size=default]:h-10');
    expect(gatilho('Relatório').className).not.toContain('data-[size=default]:h-9');
    await abrir('Relatório');
    expect(document.querySelector('[data-slot="select-content"]')).not.toBeNull();
    // Sem a cor, o `border` do shadcn sai na cor do texto.
    expect(document.querySelector('[data-slot="select-content"]').className).toContain('border-border');
    await tecla(opcao('Leads · Conversão'), 'Enter');
    expect(onSection).toHaveBeenCalledTimes(1);
    expect(onSection).toHaveBeenCalledWith('conversao');
  });
});

describe('menus de Origem e de Funil e a lista dos meses', () => {
  it('Origem: "Todas as origens" limpa o filtro (null), e o menu tem borda própria', async () => {
    const onOrigem = vi.fn();
    await montar(h(OrigemControl, { origem: 'Instagram', origens, onOrigem }));
    await abrir('Origem');
    expect(menu()).not.toBeNull();
    expect(menu().className).toContain('border-border');
    expect(itemDoMenu('Instagram').getAttribute('aria-checked')).toBe('true');
    await clicar(itemDoMenu('Todas as origens'));
    expect(onOrigem).toHaveBeenCalledTimes(1);
    expect(onOrigem).toHaveBeenCalledWith(null);
  });

  it('Origem: escolher uma origem passa o nome dela e fecha o menu', async () => {
    const onOrigem = vi.fn();
    await montar(h(OrigemControl, { origem: null, origens, onOrigem }));
    await abrir('Origem');
    await clicar(itemDoMenu('Indicação'));
    expect(onOrigem).toHaveBeenCalledTimes(1);
    expect(onOrigem).toHaveBeenCalledWith('Indicação');
    expect(menu()).toBeNull();
  });

  it('Funil: escolher um funil passa o id, e "Todos os funis" passa all', async () => {
    const onFunnel = vi.fn();
    const funil = (funnel) => h(FunilControl, { funnel, funnels, onFunnel });
    await montar(funil('all'));
    await abrir('Funil');
    expect(menu().className).toContain('border-border');
    await clicar(itemDoMenu('Vendas'));
    expect(onFunnel).toHaveBeenLastCalledWith('f1');
    // A tela devolve o funil do endereço, e a escolha de voltar a todos passa o valor de "sem filtro".
    await remontar(funil('f1'));
    await abrir('Funil');
    await clicar(itemDoMenu('Todos os funis'));
    expect(onFunnel).toHaveBeenLastCalledWith('all');
    expect(onFunnel).toHaveBeenCalledTimes(2);
  });

  it('a lista dos meses mora no balão do período, só no modo mês, e passa o mês escolhido', async () => {
    const onMonth = vi.fn();
    const meses = [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }, { key: '2026-08', label: 'Agosto 2026' }];
    await montar(h(RelatoriosToolbar, { ...barra, monthOptions: meses, onMonth }));
    await clicar(gatilho('Período'));
    expect(balao().getAttribute('aria-label')).toBe('Escolher período');
    // Sem a cor, o `border` do shadcn sai na cor do texto: no navegador, um contorno escuro em volta do balão.
    expect(balao().className).toContain('border-border');
    const mes = (texto) => [...(balao()?.querySelectorAll('button') || [])].find((b) => b.textContent.trim() === texto);
    expect(mes('Setembro 2026 · em andamento').getAttribute('aria-pressed')).toBe('true');
    expect(mes('Agosto 2026').getAttribute('aria-pressed')).toBe('false');
    await clicar(mes('Agosto 2026'));
    expect(onMonth).toHaveBeenCalledTimes(1);
    expect(onMonth).toHaveBeenCalledWith('2026-08');
    expect(balao()).toBeNull();
    // Fora do modo mês, sem setas e sem a lista.
    await remontar(h(RelatoriosToolbar, { ...barra, period: periodFromParams({ periodo: 'hoje' }, NOW) }));
    expect(gatilho('Mês anterior')).toBeNull();
    await clicar(gatilho('Período'));
    expect(balao()).not.toBeNull();
    expect(mes('Agosto 2026')).toBeUndefined();
  });

  it('as setas do mês andam e respeitam a janela', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    await montar(h(PeriodBox, { ...barra, onPrev, onNext, canPrev: true, canNext: false }));
    await clicar(gatilho('Mês anterior'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(gatilho('Próximo mês').disabled).toBe(true);
  });
});

describe('corte de Leads parados', () => {
  it('um grupo de escolha única com os quatro cortes, cada um chamado pelos dias, e o de agora marcado', async () => {
    await montar(h(DiasControl, { dias: 7, onDias: noop }));
    const grupo = container.querySelector('[role="radiogroup"]');
    expect(document.getElementById(grupo.getAttribute('aria-labelledby')).textContent).toBe('Sem registro há mais de');
    expect(radios().map((r) => r.getAttribute('aria-label'))).toEqual(['3 dias', '7 dias', '15 dias', '30 dias']);
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    // Só o escolhido fica na ordem do Tab.
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
    // Os dias com algarismos de largura fixa, como o período.
    expect(classes(radio('7 dias'))).toContain('num');
  });

  it('o clique escolhe, e clicar no que já vale não faz nada', async () => {
    const onDias = vi.fn();
    await montar(h(DiasControl, { dias: 7, onDias }));
    await clicar(radio('15 dias'));
    expect(onDias).toHaveBeenCalledWith(15);
    await clicar(radio('7 dias'));
    expect(onDias).toHaveBeenCalledTimes(1);
  });

  it('as setas andam e escolhem, dando a volta, e Home e End vão às pontas', async () => {
    const onDias = vi.fn();
    await montar(h(DiasControl, { dias: 7, onDias }));
    radio('7 dias').focus();
    await tecla(radio('7 dias'), 'ArrowRight');
    expect(onDias).toHaveBeenLastCalledWith(15);
    expect(document.activeElement).toBe(radio('15 dias'));
    await tecla(radio('7 dias'), 'ArrowLeft');
    expect(onDias).toHaveBeenLastCalledWith(3);
    await remontar(h(DiasControl, { dias: 3, onDias }));
    await tecla(radio('3 dias'), 'ArrowUp');
    expect(onDias).toHaveBeenLastCalledWith(30);
    await tecla(radio('3 dias'), 'End');
    expect(onDias).toHaveBeenLastCalledWith(30);
    await remontar(h(DiasControl, { dias: 30, onDias }));
    await tecla(radio('30 dias'), 'Home');
    expect(onDias).toHaveBeenLastCalledWith(3);
    expect(document.activeElement).toBe(radio('3 dias'));
  });

  it('no balão do celular o corte ocupa a largura toda, com o texto em cima, e no computador não', async () => {
    await montar(h(RelatoriosToolbar, { ...barra, showPeriod: false, dias: 30, onDias: noop }));
    const computador = container.querySelector('[role="radiogroup"]');
    expect(classes(computador)).not.toContain('flex-1');
    await clicar(gatilho('Filtros dos relatórios'));
    const celular = balao().querySelector('[role="radiogroup"]');
    expect(classes(celular)).toContain('flex-1');
    expect(classes(celular.parentElement.parentElement)).toContain('flex-col');
    expect(radio('30 dias', balao()).getAttribute('aria-checked')).toBe('true');
  });

  it('a barra sem período traz o corte no computador e no balão do celular, e o corte não acende o botão de filtros', async () => {
    await montar(h(RelatoriosToolbar, { ...barra, showPeriod: false, dias: 30, onDias: noop }));
    expect(gatilho('Período')).toBeNull();
    expect(radio('30 dias').getAttribute('aria-checked')).toBe('true');
    expect(gatilho('Filtros dos relatórios')).not.toBeNull();
    await clicar(gatilho('Filtros dos relatórios'));
    expect(balao().querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(balao().querySelector('[aria-label="Período"]')).toBeNull();
  });
});

describe('filtro aceso', () => {
  const nomes = ['Consultor', 'Origem', 'Funil'];

  it('a pílula escolhida acende (fundo, borda e texto da marca), e a sem escolha fica apagada', async () => {
    await montar(filtros({ resp: ['u2'], origem: 'Instagram', funnel: 'f1' }));
    for (const nome of nomes) {
      expect(classes(gatilho(nome)), nome).toEqual(expect.arrayContaining(['border-brand-200', 'bg-brand-50', 'text-brand-700', 'rounded-full']));
      expect(classes(gatilho(nome)), nome).not.toContain('border-border');
    }
    await remontar(filtros());
    for (const nome of nomes) {
      expect(classes(gatilho(nome)), nome).not.toContain('border-brand-200');
      expect(classes(gatilho(nome)), nome).toContain('border-border');
    }
  });

  it('o botão de filtros do celular acende, ganha o ponto e diz que há filtro ativo quando algum está escolhido', async () => {
    const filtrosDoCelular = () => container.querySelector('button[aria-label^="Filtros dos relatórios"]');
    // O ponto é o único span do botão: o ícone é um svg.
    const ponto = () => filtrosDoCelular().querySelector('span');
    await montar(h(RelatoriosToolbar, barra));
    expect(filtrosDoCelular().getAttribute('aria-label')).toBe('Filtros dos relatórios');
    expect(ponto()).toBeNull();
    expect(classes(filtrosDoCelular())).not.toContain('border-brand-200');
    for (const escolhido of [{ resp: ['u1'] }, { origem: 'Instagram' }, { funnel: 'f1' }]) {
      const quem = JSON.stringify(escolhido);
      await remontar(h(RelatoriosToolbar, { ...barra, ...escolhido }));
      expect(filtrosDoCelular().getAttribute('aria-label'), quem).toBe('Filtros dos relatórios, há filtro ativo');
      expect(ponto(), quem).not.toBeNull();
      expect(classes(filtrosDoCelular()), quem).toContain('border-brand-200');
    }
    // Limpar o filtro apaga o botão de novo.
    await remontar(h(RelatoriosToolbar, barra));
    expect(filtrosDoCelular().getAttribute('aria-label')).toBe('Filtros dos relatórios');
    expect(ponto()).toBeNull();
  });
});

describe('o que o leitor de tela encontra', () => {
  // O texto visível do valor, que o aria-describedby aponta.
  const valorDe = (nome) => {
    const ligacao = gatilho(nome).getAttribute('aria-describedby');
    expect(ligacao, nome).toBeTruthy();
    const valor = document.getElementById(ligacao);
    expect(gatilho(nome).contains(valor), nome).toBe(true);
    return valor.textContent;
  };

  it('cada pílula se chama pelo filtro e é descrita pelo valor visível', async () => {
    await montar(filtros({ resp: ['u2'], origem: 'Instagram', funnel: 'f1' }));
    expect(valorDe('Consultor')).toBe('Bruno Lima');
    expect(valorDe('Origem')).toBe('Instagram');
    expect(valorDe('Funil')).toBe('Vendas');
    // O que o Radix põe no botão continua lá: a ordem das props não desligou o balão nem o menu.
    expect(gatilho('Consultor').getAttribute('aria-haspopup')).toBe('dialog');
    expect(gatilho('Origem').getAttribute('aria-haspopup')).toBe('menu');
    expect(gatilho('Funil').getAttribute('aria-haspopup')).toBe('menu');
    // O nome visível do filtro não é lido de novo: o nome do botão já o leva.
    expect(gatilho('Origem').querySelector('[aria-hidden="true"]:not(svg)').textContent).toBe('Origem');
    // A descrição acompanha o valor e continua ligada ao mesmo texto.
    const ligacao = gatilho('Consultor').getAttribute('aria-describedby');
    await remontar(filtros({ resp: ['u1', 'u2'], origem: 'Instagram', funnel: 'f1' }));
    expect(valorDe('Consultor')).toBe('2 pessoas');
    expect(gatilho('Consultor').getAttribute('aria-describedby')).toBe(ligacao);
  });

  it('o nome e a descrição da pílula vencem o que chega pelo ...rest', async () => {
    // O Radix entrega seus atributos ao botão por esse caminho (asChild). Hoje nenhum colide com estes, mas
    // se um dia colidir, o botão tem de continuar com o nome do filtro e a descrição ligada ao valor.
    const Icone = () => h('svg');
    await montar(h(FilterButton, { label: 'Consultor', icon: Icone, text: 'Bruno Lima', 'aria-label': 'intruso', 'aria-describedby': 'intruso' }));
    const pilula = container.querySelector('button');
    expect(pilula.getAttribute('aria-label')).toBe('Consultor');
    expect(document.getElementById(pilula.getAttribute('aria-describedby')).textContent).toBe('Bruno Lima');
  });

  it('o balão de consultores tem nome e borda próprios, e marcar dentro dele chega ao onResp', async () => {
    const onResp = vi.fn();
    await montar(h(ConsultoresControl, { resp: [], people, onResp }));
    await clicar(gatilho('Consultor'));
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
    for (const nome of ['Período', 'Mês anterior', 'Próximo mês', 'Consultor', 'Origem', 'Funil']) {
      expect(balao().querySelector(`[aria-label="${nome}"]`), nome).not.toBeNull();
    }
  });
});

describe('controles da barra no computador', () => {
  it('ficam a 8px um do outro e quebram linha quando não cabem', async () => {
    // Medido no navegador a 1280px, com a lista de relatórios ao lado: com 10px, a barra padrão do mês em
    // andamento media 881px para 880px de espaço, e o funil caía sozinho para uma segunda linha.
    await montar(h(RelatoriosToolbar, barra));
    const linha = container.firstElementChild.firstElementChild.className.split(/\s+/);
    expect(linha).toContain('gap-2');
    expect(linha).not.toContain('gap-2.5');
    expect(linha).toContain('flex-wrap');
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
    // No computador a barra passa 8px para cada lado do conteúdo (md:-mx-2, com o md:px-2 que deixa os
    // controles onde estavam), para o anel do número aceso e a sombra dos cartões que rolam por baixo
    // não aparecerem como um fio cortado na borda da barra. No celular, nada mudou: -mx-4 e px-4.
    const classes = fundo.split(/\s+/);
    for (const classe of ['md:-mx-2', 'md:px-2', '-mx-4', 'px-4']) expect(classes, classe).toContain(classe);
    for (const classe of ['md:mx-0', 'md:px-0']) expect(classes, classe).not.toContain(classe);
    // A raiz do App continua com esse mesmo par: se ela mudar, a barra tem de mudar junto. A tela de
    // carregamento (min-h-screen) tem o mesmo par e não é o que fica atrás da barra, então a conferência
    // se prende à div da raiz pelas classes que só ela tem (flex h-[100dvh]). O fim do par olha adiante
    // para não aceitar uma classe mais comprida, como dark:bg-neutral-950/50.
    // Pelo caminho em texto: no jsdom o URL global não é o do Node, e o readFileSync recusa.
    const app = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../App.jsx'), 'utf8');
    const raizDoApp = /<div className="flex h-\[100dvh\] bg-paper-50 dark:bg-neutral-950(?=[\s"])/;
    expect(raizDoApp.test(app), 'a div da raiz do App (flex h-[100dvh]) mudou de fundo: acerte o da barra em RelatoriosToolbar.jsx').toBe(true);
  });
});
