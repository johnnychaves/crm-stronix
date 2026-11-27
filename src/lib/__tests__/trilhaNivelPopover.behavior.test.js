// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { TrilhaNivelPopover } = await import('../../views/professores/TrilhaNivelPopover.jsx');
const { trilhasDe } = await import('../carreira/trilhas.js');

const trilhas = trilhasDe(null).filter((t) => t.base === 'professor');
let root;
let box;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = () => {};
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
});
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; });

const abrir = async (props) => {
  await act(async () => { root.render(h(TrilhaNivelPopover, props)); });
  await act(async () => { box.querySelector('button').click(); });
};
const radio = (texto) => [...document.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes(texto));
const pressionar = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('Trilha e nível', () => {
  it('abre na trilha e no nível de agora, com a sugerida marcada', async () => {
    await abrir({ trilhas, trilhaId: 'professor', nivel: 'pleno', sugeridaId: 'professor', onSalvar: vi.fn() });
    expect(box.querySelector('button').textContent).toBe('Trilha e nível');
    expect(radio('Professor').getAttribute('aria-checked')).toBe('true');
    expect(radio('Professor').textContent).toContain('sugerida');
    expect(radio('Pleno').getAttribute('aria-checked')).toBe('true');
  });

  it('trocar a trilha pede o nível de novo', async () => {
    const onSalvar = vi.fn().mockResolvedValue(true);
    await abrir({ trilhas, trilhaId: 'professor', nivel: 'pleno', sugeridaId: 'professor', onSalvar });
    await pressionar(radio('Estagiário'));
    expect(radio('Estagiário I')).toBeTruthy();
    expect(document.querySelector('[role="status"]').textContent).toBe('Escolha o nível.');
    expect(document.querySelector('button[type="submit"]').disabled).toBe(true);
    await pressionar(radio('Estagiário II'));
    await act(async () => { document.querySelector('form').requestSubmit(); });
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ trilhaId: 'estagiario', nivel: 'estagiario2' }));
    expect(onSalvar.mock.calls[0][0].desde).toBeInstanceOf(Date);
  });

  it('sem trilha nem nível, o botão diz Definir', async () => {
    await act(async () => { root.render(h(TrilhaNivelPopover, { trilhas, trilhaId: null, nivel: null, sugeridaId: null, onSalvar: vi.fn() })); });
    expect(box.querySelector('button').textContent).toBe('Definir trilha e nível');
  });
});
