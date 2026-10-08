// @vitest-environment jsdom
// As peças das telas das rotinas: o círculo do estado, só de leitura, com os
// tons do cartão da Meta, e o rosto de iniciais, todo de span (ele mora também
// dentro do link do cartão do modelo, e link não aceita div).
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StateMark } from '../../components/rotinas/StateMark.jsx';
import { PersonInitials } from '../../components/rotinas/PersonInitials.jsx';
import { CHECK_TONE } from '../../components/rotinas/routineTones.js';

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
});

const montar = async (el) => { await act(async () => { root.render(el); }); };
const classes = (el) => el.className.split(/\s+/);

describe('StateMark', () => {
  it.each(['done', 'doneLate'])('%s leva o visto e o tom de feita', async (state) => {
    await montar(h(StateMark, { state }));
    const mark = container.firstElementChild;
    expect(mark.tagName).toBe('SPAN');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.querySelector('svg')).not.toBeNull();
    expect(classes(mark)).toContain('bg-emerald-600');
  });

  it.each(['late', 'now', 'later', 'open'])('%s não leva o visto e usa o tom do cartão da Meta', async (state) => {
    await montar(h(StateMark, { state }));
    const mark = container.firstElementChild;
    expect(mark.querySelector('svg')).toBeNull();
    expect(classes(mark)).toEqual(expect.arrayContaining(CHECK_TONE[state].split(' ')));
  });

  it('não é botão: quem olha não marca', async () => {
    await montar(h(StateMark, { state: 'late' }));
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('PersonInitials', () => {
  it('é um span decorativo com as iniciais e o tamanho pedido', async () => {
    await montar(h(PersonInitials, { name: 'Ana Souza', size: 30 }));
    const face = container.firstElementChild;
    expect(face.tagName).toBe('SPAN');
    expect(face.getAttribute('aria-hidden')).toBe('true');
    expect(face.textContent).toBe('AS');
    expect(face.style.width).toBe('30px');
    expect(face.style.height).toBe('30px');
  });

  it('a cor sai do nome: o mesmo nome tem sempre a mesma cor', async () => {
    await montar(h('div', null, h(PersonInitials, { name: 'Ana Souza' }), h(PersonInitials, { name: 'Ana Souza' })));
    const [a, b] = container.firstElementChild.children;
    expect(a.style.background).not.toBe('');
    expect(a.style.background).toBe(b.style.background);
  });
});
