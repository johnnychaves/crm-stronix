// @vitest-environment jsdom
// O balão "Novo" dos Relatórios (RelatoriosNovo), no item Relatórios do menu:
// aparece até 15/11/2026, inclusive, e no clique abre a apresentação em quatro
// passos (mockup 2026-10-15-relatorios-apresentacao.html, opção B). O primeiro
// passo cita os submenus da lista ao lado com o mesmo nome, para quem lê
// reconhecer cada um na tela.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOVO_ATE, RelatoriosNovo } from '../../views/relatorios/RelatoriosNovo.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../relatoriosRail.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const HOJE = new Date(2026, 9, 15, 9, 0);
// O endereço de agora, para o teste ver aonde o último passo leva.
function Endereco() {
  return h('output', { 'data-endereco': '' }, useLocation().pathname);
}
const montar = async (props = {}) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/pipeline'] }, h(RelatoriosNovo, { now: HOJE, ...props }), h(Endereco)));
  });
};
const endereco = () => container.querySelector('[data-endereco]').textContent;
const balao = () => document.body.querySelector('[aria-label="Novo: o que é esta tela"]');
const dialogo = () => document.body.querySelector('[role="dialog"]');
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const passo = () => {
  const titulo = dialogo().querySelector('h2');
  return { etapa: titulo.previousElementSibling.textContent, titulo: titulo.textContent };
};
const descricao = () => document.getElementById(dialogo().getAttribute('aria-describedby')).textContent;
const abrir = async (props) => {
  await montar(props);
  await clicar(balao());
};
const classes = (el) => el.className.split(/\s+/);

describe('RelatoriosNovo', () => {
  it('vale até 15/11/2026, inclusive', async () => {
    expect(NOVO_ATE).toBe('2026-11-15');
    await montar({ now: new Date(2026, 10, 15, 23, 59) });
    expect(balao()).not.toBeNull();
    await montar({ now: new Date(2026, 10, 16, 0, 0) });
    expect(balao()).toBeNull();
  });

  it('abre no primeiro passo, que cita todos os submenus da lista ao lado com o mesmo nome', async () => {
    await abrir();
    expect(passo()).toEqual({ etapa: '1 de 4', titulo: 'Os relatórios dos seus leads' });
    for (const { label } of RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items)) {
      expect(descricao(), label).toContain(label);
    }
    expect(classes(botao('Voltar'))).toContain('hidden');
  });

  it('os quatro passos, com Próximo e Voltar', async () => {
    await abrir();
    const titulos = [passo().titulo];
    for (let i = 0; i < 3; i += 1) {
      await clicar(botao('Próximo'));
      titulos.push(passo().titulo);
      expect(classes(botao('Voltar'))).not.toContain('hidden');
    }
    expect(titulos).toEqual([
      'Os relatórios dos seus leads',
      'Escolha o período e os filtros',
      'Clique num número para ver os nomes',
      'Imprima ou exporte a lista',
    ]);
    expect(passo().etapa).toBe('4 de 4');
    expect(descricao()).toContain('Imprimir');
    expect(descricao()).toContain('Exportar lista');
    await clicar(botao('Voltar'));
    expect(passo().etapa).toBe('3 de 4');
  });

  it('o botão principal é o mesmo em todos os passos, para o foco não se perder', async () => {
    await abrir({ href: '/acad/relatorios' });
    const primeiro = botao('Próximo');
    await clicar(primeiro);
    await clicar(primeiro);
    await clicar(primeiro);
    expect(botao('Abrir Relatórios')).toBe(primeiro);
  });

  it('abre com o foco no botão principal, e o Voltar ao primeiro passo devolve o foco a ele', async () => {
    await abrir();
    expect(document.activeElement).toBe(botao('Próximo'));
    await clicar(botao('Próximo'));
    botao('Voltar').focus();
    await clicar(botao('Voltar'));
    expect(passo().etapa).toBe('1 de 4');
    expect(document.activeElement).toBe(botao('Próximo'));
  });

  it('os pontinhos levam direto a cada passo e marcam o atual', async () => {
    await abrir();
    const pontos = () => [...dialogo().querySelectorAll('[role="group"][aria-label="Passos"] button')];
    expect(pontos()).toHaveLength(4);
    await clicar(pontos()[2]);
    expect(passo().titulo).toBe('Clique num número para ver os nomes');
    expect(pontos()[2].getAttribute('aria-current')).toBe('step');
    expect(pontos()[0].getAttribute('aria-current')).toBeNull();
  });

  it('o passo novo é anunciado de uma vez, com a etapa, o título e o texto, numa região só', async () => {
    await abrir();
    const regiao = dialogo().querySelector('h2').parentElement;
    expect(regiao.getAttribute('aria-live')).toBe('polite');
    expect(regiao.getAttribute('aria-atomic')).toBe('true');
    await clicar(botao('Próximo'));
    expect(dialogo().querySelector('h2').parentElement).toBe(regiao);
  });

  it('o desenho fica fora do leitor de tela e entra com o fade que respeita movimento reduzido', async () => {
    await abrir();
    const desenho = dialogo().querySelector('[data-ilustracao]');
    expect(desenho.getAttribute('aria-hidden')).toBe('true');
    expect(classes(desenho.firstElementChild)).toEqual(expect.arrayContaining(['animate-in', 'fade-in-0', 'motion-reduce:animate-none']));
  });

  it('fechar no meio e reabrir volta ao primeiro passo', async () => {
    await abrir();
    await clicar(botao('Próximo'));
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(dialogo()).toBeNull();
    await clicar(balao());
    expect(passo().etapa).toBe('1 de 4');
  });

  it('no último passo, Abrir Relatórios fecha e leva à tela', async () => {
    await abrir({ href: '/acad/relatorios' });
    for (let i = 0; i < 3; i += 1) await clicar(botao('Próximo'));
    await clicar(botao('Abrir Relatórios'));
    expect(dialogo()).toBeNull();
    expect(endereco()).toBe('/acad/relatorios');
  });

  it('quem já está nos Relatórios vê Entendi, que só fecha', async () => {
    await abrir({ href: null });
    for (let i = 0; i < 3; i += 1) await clicar(botao('Próximo'));
    expect(botao('Abrir Relatórios')).toBeUndefined();
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(endereco()).toBe('/acad/pipeline');
  });
});
