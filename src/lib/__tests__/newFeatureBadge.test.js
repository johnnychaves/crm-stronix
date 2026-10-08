// @vitest-environment jsdom
// O balão "Novo" de tela nova (NewFeatureBadge): aparece até o dia `until`,
// inclusive, no dia do aparelho, e no clique abre o pop-up que explica a tela.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NewFeatureBadge } from '../../components/NewFeatureBadge.jsx';
import { isNewFeatureOn } from '../newFeature.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOME = 'Novo: o que é esta tela';
const ATE = '2026-11-07';

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
  await act(async () => {
    root.render(h(NewFeatureBadge, {
      until: ATE,
      title: 'Rotinas',
      description: 'O que a tela faz.',
      ...props,
    }, h('p', null, 'O corpo da explicação.')));
  });
};
const balao = () => document.body.querySelector(`[aria-label="${NOME}"]`);
const dialogo = () => document.body.querySelector('[role="dialog"]');
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};

describe('até quando o balão aparece', () => {
  it.each([
    ['um mês antes', new Date(2026, 9, 8, 9, 0)],
    ['no último dia, de manhã', new Date(2026, 10, 7, 0, 0)],
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

  it('com a data fora do formato, não aparece', async () => {
    await montar({ now: new Date(2026, 9, 8), until: '07/11/2026' });
    expect(balao()).toBeNull();
  });
});

describe('o pop-up', () => {
  it('abre no clique com o título, a descrição e o corpo, e o Entendi fecha', async () => {
    await montar({ now: new Date(2026, 9, 8, 9, 0) });
    expect(dialogo()).toBeNull();
    await clicar(balao());
    expect(dialogo()).not.toBeNull();
    expect(dialogo().querySelector('h2').textContent).toBe('Rotinas');
    expect(dialogo().textContent).toContain('O que a tela faz.');
    expect(dialogo().textContent).toContain('O corpo da explicação.');
    await clicar(botao('Entendi'));
    expect(dialogo()).toBeNull();
    expect(balao()).not.toBeNull();
  });
});

describe('o tom', () => {
  const classes = () => balao().className.split(/\s+/);

  it('sem tom, é o laranja suave de sempre', async () => {
    await montar({ now: new Date(2026, 9, 8, 9, 0) });
    expect(classes()).toEqual(expect.arrayContaining(['bg-accent-500/10', 'text-orange-700', 'h-6', 'text-[10.5px]', 'leading-none']));
    expect(classes()).not.toContain('bg-red-600');
    expect(classes()).not.toContain('text-white');
  });

  it('alert é vermelho cheio com texto branco, mais baixo, para caber na linha do menu', async () => {
    await montar({ now: new Date(2026, 9, 8, 9, 0), tone: 'alert' });
    expect(classes()).toEqual(expect.arrayContaining(['bg-red-600', 'text-white', 'hover:bg-red-700', 'h-5', 'text-[10px]', 'leading-none']));
    expect(classes()).not.toContain('bg-accent-500/10');
    expect(classes()).not.toContain('text-orange-700');
    expect(classes()).not.toContain('h-6');
    // O ponto fica branco, e o anel de foco continua.
    expect(balao().querySelector('[aria-hidden="true"]').className).toContain('bg-white');
    expect(classes()).toContain('focus-visible:ring-2');
    expect(balao().getAttribute('aria-label')).toBe(NOME);
    expect(balao().textContent.trim()).toBe('Novo');
  });

  it('tom desconhecido cai no suave', async () => {
    await montar({ now: new Date(2026, 9, 8, 9, 0), tone: 'gritante' });
    expect(classes()).toContain('bg-accent-500/10');
  });
});

describe('isNewFeatureOn', () => {
  it('vale até o último dia, inclusive, e some no seguinte', () => {
    expect(isNewFeatureOn(ATE, new Date(2026, 9, 8, 9, 0))).toBe(true);
    expect(isNewFeatureOn(ATE, new Date(2026, 10, 7, 23, 59))).toBe(true);
    expect(isNewFeatureOn(ATE, new Date(2026, 10, 8, 0, 0))).toBe(false);
  });

  it('com a data fora do formato, não vale', () => {
    expect(isNewFeatureOn('07/11/2026', new Date(2026, 9, 8))).toBe(false);
    expect(isNewFeatureOn(undefined, new Date(2026, 9, 8))).toBe(false);
  });
});
