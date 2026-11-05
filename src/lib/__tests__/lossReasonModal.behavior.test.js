// @vitest-environment jsdom
// A janela de motivo de perda grava uma vez só no clique repetido (gravava a perda
// duas e três vezes no Pipeline) e fecha com Esc, menos durante a gravação.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LossReasonModal } from '../../modals/LossReasonModal.jsx';
import { ToastProvider } from '../../contexts/ToastContext.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host, root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = (props) => act(() => root.render(h(ToastProvider, null, h(LossReasonModal, { lossReasons: [{ id: 'r', name: 'Preço' }], ...props }))));
const confirmar = () => [...host.querySelectorAll('button')].find((b) => /Confirmar Perda|Salvando/.test(b.textContent));
const esc = () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

describe('LossReasonModal', () => {
  it('três cliques seguidos gravam uma vez', async () => {
    let solta;
    const onConfirm = vi.fn(() => new Promise((r) => { solta = r; }));
    render({ onClose: () => {}, onConfirm });
    act(() => { confirmar().click(); confirmar().click(); confirmar().click(); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirmar().disabled).toBe(true);
    await act(async () => { solta(); });
    expect(confirmar().disabled).toBe(false);
  });

  it('ao fechar, o foco volta para quem abriu a janela', () => {
    const botao = document.createElement('button');
    document.body.appendChild(botao);
    botao.focus();
    render({ onClose: () => {}, onConfirm: () => {} });
    expect(document.activeElement.tagName).toBe('SELECT');
    act(() => root.render(null));
    expect(document.activeElement).toBe(botao);
    botao.remove();
  });

  it('com returnFocusTo, o foco volta para o elemento indicado', () => {
    const mover = document.createElement('button');
    const outro = document.createElement('button');
    document.body.append(mover, outro);
    outro.focus();
    render({ onClose: () => {}, onConfirm: () => {}, returnFocusTo: mover });
    act(() => root.render(null));
    expect(document.activeElement).toBe(mover);
    mover.remove(); outro.remove();
  });

  it('Esc fecha, mas não durante a gravação', async () => {
    let solta;
    const onClose = vi.fn();
    render({ onClose, onConfirm: () => new Promise((r) => { solta = r; }) });
    act(() => { confirmar().click(); });
    esc();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { solta(); });
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
