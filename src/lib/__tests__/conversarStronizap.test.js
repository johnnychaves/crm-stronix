// @vitest-environment jsdom
// O botão Conversar (opção C do mockup 2026-11-27-whatsapp-ou-stronizap.html):
// na academia com o Stronizap ligado, o WhatsApp vira um menu com WhatsApp e
// Stronizap. O link do Stronizap, o aviso no appUser e o menu.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stronizapHref } from '../guardian.js';
import { ConversarMenu } from '../../components/profile/ConversarMenu.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

describe('stronizapHref', () => {
  it('põe o 55 na frente do número nacional e leva ao /chamar', () => {
    expect(stronizapHref('(51) 99812-4430')).toBe('https://stronizap.com.br/chamar/5551998124430');
    expect(stronizapHref('555199812443')).toBe('https://stronizap.com.br/chamar/555199812443');
    expect(stronizapHref('')).toBeNull();
    expect(stronizapHref(null)).toBeNull();
  });
});

describe('o Stronizap ligado no appUser', () => {
  const app = readFileSync(path.join(import.meta.dirname, '../../App.jsx'), 'utf8');
  it('todo appUser montado no login leva o tenantZap, junto com os módulos', () => {
    const comModulos = app.split('setAppUser({').slice(1).map((t) => t.slice(0, t.indexOf('});')));
    const doLogin = comModulos.filter((t) => t.includes('tenantModules'));
    expect(doLogin.length).toBeGreaterThanOrEqual(4);
    for (const t of doLogin) expect(t).toContain('tenantZap');
  });
  it('só vale com a integração conectada', () => {
    expect(app).toContain('tenantZap = zapIntegrationState(tData?.integrations?.zap) === ZAP_STATE.CONECTADO');
  });
});

describe('ConversarMenu', () => {
  let root = null;
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    root = null;
    document.body.innerHTML = '';
  });
  const montar = async (props) => {
    const c = document.createElement('div');
    document.body.appendChild(c);
    root = createRoot(c);
    await act(async () => { root.render(h(ConversarMenu, props)); });
  };
  const abrir = async () => {
    const b = [...document.body.querySelectorAll('button')].find((x) => x.textContent.includes('Conversar'));
    await act(async () => { b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  };
  const item = (t) => [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.includes(t));

  it('abre com as duas saídas, e cada uma chama a sua', async () => {
    const onWhatsapp = vi.fn();
    const onStronizap = vi.fn();
    await montar({ onWhatsapp, onStronizap, teclas: true });
    await abrir();
    expect(item('WhatsApp')).toBeTruthy();
    expect(item('Stronizap').textContent).toContain('Z');
    await act(async () => { item('Stronizap').click(); });
    expect(onStronizap).toHaveBeenCalledTimes(1);
    expect(onWhatsapp).not.toHaveBeenCalled();
    await abrir();
    await act(async () => { item('WhatsApp').click(); });
    expect(onWhatsapp).toHaveBeenCalledTimes(1);
  });

  it('sem teclas, os itens não mostram o W e o Z', async () => {
    await montar({ onWhatsapp: vi.fn(), onStronizap: vi.fn() });
    await abrir();
    expect(document.body.querySelectorAll('[role="menuitem"] kbd')).toHaveLength(0);
  });
});
