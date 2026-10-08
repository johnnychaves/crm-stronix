// @vitest-environment jsdom
// O balão "Novo" das Rotinas (RotinasNovo), que mora no item Rotinas do menu
// (mockup 2026-10-08-balao-novo-rotinas.html, opção C): aparece até
// 07/11/2026, inclusive, e no clique abre a explicação da tela.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOVO_ATE, RotinasNovo } from '../../components/rotinas/RotinasIntro.jsx';

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

const montar = async (props) => {
  await act(async () => { root.render(h(RotinasNovo, props)); });
};
const balao = () => document.body.querySelector('[aria-label="Novo: o que é esta tela"]');
const dialogo = () => document.body.querySelector('[role="dialog"]');
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};

describe('RotinasNovo', () => {
  it('vale até 07/11/2026', () => {
    expect(NOVO_ATE).toBe('2026-11-07');
  });

  it.each([
    ['um mês antes', new Date(2026, 9, 8, 9, 0)],
    ['no último dia, à noite', new Date(2026, 10, 7, 23, 59)],
  ])('aparece %s', async (_quando, now) => {
    await montar({ now });
    expect(balao()).not.toBeNull();
    expect(balao().textContent.trim()).toBe('Novo');
  });

  it('some no dia seguinte ao último', async () => {
    await montar({ now: new Date(2026, 10, 8, 0, 0) });
    expect(balao()).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('repassa o tom ao balão', async () => {
    await montar({ now: new Date(2026, 9, 8, 9, 0), tone: 'alert' });
    expect(balao().className).toContain('bg-red-600');
  });

  it('o clique abre a explicação da tela, e o Entendi fecha', async () => {
    await montar({ now: new Date(2026, 9, 8, 9, 0), tone: 'alert' });
    expect(dialogo()).toBeNull();
    await clicar(balao());
    expect(dialogo().querySelector('h2').textContent).toBe('Rotinas');
    expect(dialogo().textContent).toContain('O dia de trabalho de cada consultor, com as tarefas que não envolvem lead.');
    expect(dialogo().textContent).toContain('Aqui você monta modelos com as tarefas que se repetem, como abrir a recepção, postar o story da aula ou mandar o resumo do dia, e escolhe quem segue cada modelo.');
    expect(dialogo().textContent).toContain('Cada tarefa tem os dias em que vale e, se quiser, um horário.');
    expect(dialogo().textContent).toContain('Para uma rotina diferente, duplique o modelo e ajuste.');
    expect(dialogo().textContent).toContain('A rotina não conta para o dia batido.');
    expect(dialogo().textContent).toContain('Mudou um modelo? Vale a partir de hoje. Os dias anteriores ficam como estavam.');
    expect(dialogo().querySelectorAll('li')).toHaveLength(4);
    expect(dialogo().querySelectorAll('li svg[aria-hidden="true"]')).toHaveLength(4);
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(balao()).not.toBeNull();
  });
});
