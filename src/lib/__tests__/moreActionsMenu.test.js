// @vitest-environment jsdom
// O menu "Mais ações" do cabeçalho da ficha (MoreActionsMenu).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MoreActionsMenu } from '../../components/profile/MoreActionsMenu.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

let root = null;
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const all = { isClient: false, canLoss: true, lossDisabled: false, onLoss: vi.fn(), canDelete: true, onDelete: vi.fn(), ...props };
  await act(async () => { root.render(h(MoreActionsMenu, all)); });
  return all;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const gatilho = () => document.body.querySelector('[aria-label="Mais ações"]');
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
};
const abrir = () => tecla(gatilho(), 'Enter');
const itens = () => [...document.body.querySelectorAll('[role="menuitem"]')];
const item = (texto) => itens().find((el) => el.textContent.includes(texto));

describe('MoreActionsMenu', () => {
  it('sem nenhuma ação permitida, o botão nem existe', async () => {
    await montar({ canLoss: false, canDelete: false });
    expect(gatilho()).toBeNull();
  });

  it('lead: Marcar perda e Excluir lead', async () => {
    await montar();
    await abrir();
    expect(itens().map((el) => el.textContent.trim())).toEqual(['Marcar perda', 'Excluir lead']);
  });

  it('cliente: só Excluir cliente', async () => {
    await montar({ isClient: true, canLoss: false });
    await abrir();
    expect(itens().map((el) => el.textContent.trim())).toEqual(['Excluir cliente']);
  });

  it('quem só pode marcar perda não vê Excluir', async () => {
    await montar({ canDelete: false });
    await abrir();
    expect(item('Excluir')).toBeUndefined();
    expect(item('Marcar perda')).toBeTruthy();
  });

  it('escolher chama a função da ação', async () => {
    const props = await montar();
    await abrir();
    await act(async () => { item('Marcar perda').click(); });
    // A janela do motivo só abre depois de o menu fechar (onCloseAutoFocus).
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(props.onLoss).toHaveBeenCalledTimes(1);
    await abrir();
    await act(async () => { item('Excluir lead').click(); });
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('com a ficha gravando, Marcar perda fica desligado', async () => {
    const props = await montar({ lossDisabled: true });
    await abrir();
    const perda = item('Marcar perda');
    expect(perda.hasAttribute('data-disabled')).toBe(true);
    await act(async () => { perda.click(); });
    expect(props.onLoss).not.toHaveBeenCalled();
  });

  it('o Esc fecha e devolve o foco ao botão, e o botão tem o anel de foco do app', async () => {
    await montar();
    expect(gatilho().className).toContain('focus-visible:anel-foco');
    gatilho().focus();
    await abrir();
    await tecla(document.activeElement, 'Escape');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(itens()).toHaveLength(0);
    expect(document.activeElement).toBe(gatilho());
  });
});
