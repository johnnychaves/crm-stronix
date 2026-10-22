// @vitest-environment jsdom
// O botão Indicações do cabeçalho da ficha (ReferralsMenu).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ReferralsMenu } from '../../components/profile/ReferralsMenu.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Radix mede e rola a lista; o jsdom não tem essas APIs.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

let root = null;
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const all = {
    count: 3, canRegister: true, onRegister: vi.fn(), onCopy: vi.fn(),
    whatsappHref: 'https://wa.me/5551999990000?text=oi', toGuardian: false, ...props,
  };
  await act(async () => { root.render(h(ReferralsMenu, all)); });
  return all;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const gatilho = () => document.body.querySelector('[aria-label^="Indicações"]');
const tecla = async (el, key) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
};
const abrir = () => tecla(gatilho(), 'Enter');
const itens = () => [...document.body.querySelectorAll('[role="menuitem"]')];
const item = (texto) => itens().find((el) => el.textContent.includes(texto));

describe('ReferralsMenu', () => {
  it('o botão diz Indicações, mostra o contador e anuncia os dois juntos', async () => {
    await montar({ count: 3 });
    expect(gatilho().getAttribute('aria-label')).toBe('Indicações, 3');
    expect(gatilho().textContent).toContain('Indicações');
    expect(gatilho().textContent).toContain('3');
  });

  it('abre com as três opções', async () => {
    await montar();
    await abrir();
    expect(itens().map((el) => el.textContent.trim())).toEqual([
      'Cadastrar indicação', 'Copiar link de indicação', 'Enviar link pelo WhatsApp',
    ]);
  });

  it('sem permissão de cadastrar, o item some', async () => {
    await montar({ canRegister: false });
    await abrir();
    expect(item('Cadastrar indicação')).toBeUndefined();
    expect(item('Copiar link de indicação')).toBeTruthy();
  });

  it('sem número para o WhatsApp, o item some', async () => {
    await montar({ whatsappHref: null });
    await abrir();
    expect(item('WhatsApp')).toBeUndefined();
  });

  it('com responsável, o texto avisa que o link vai para ele', async () => {
    await montar({ toGuardian: true });
    await abrir();
    expect(item('Enviar link ao responsável pelo WhatsApp')).toBeTruthy();
  });

  it('escolher uma opção chama a função dela', async () => {
    const props = await montar();
    await abrir();
    await act(async () => { item('Copiar link de indicação').click(); });
    expect(props.onCopy).toHaveBeenCalledTimes(1);
    await abrir();
    await act(async () => { item('Cadastrar indicação').click(); });
    expect(props.onRegister).toHaveBeenCalledTimes(1);
  });

  it('a opção do WhatsApp é um link para fora, em outra aba', async () => {
    await montar();
    await abrir();
    const link = item('Enviar link pelo WhatsApp');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://wa.me/5551999990000?text=oi');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('o Esc fecha o menu e devolve o foco ao botão, nunca ao body', async () => {
    await montar();
    gatilho().focus();
    await abrir();
    expect(itens()).toHaveLength(3);
    await tecla(document.activeElement, 'Escape');
    // O Radix devolve o foco num setTimeout, depois de desmontar a lista.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(itens()).toHaveLength(0);
    expect(document.activeElement).toBe(gatilho());
  });

  it('o gatilho tem o anel de foco do app', async () => {
    await montar();
    expect(gatilho().className).toContain('focus-visible:anel-foco');
  });
});
