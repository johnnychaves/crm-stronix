// @vitest-environment jsdom
// src/lib/__tests__/freepassTypesPanel.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';

vi.mock('../firebase.js', () => ({ appId: 'acad', CONFIG_PATH: 'stronix_config', CONFIG_GENERAL_ID: 'general' }));
const setDoc = vi.fn(async () => {});
vi.mock('firebase/firestore', () => ({ doc: (...p) => ({ path: p.join('/') }), setDoc: (...a) => setDoc(...a), serverTimestamp: () => 'TS' }));
const { FreepassTypesPanel } = await import('../../views/settings/FreepassTypesPanel.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const modalities = [{ id: 'm1', name: 'Pilates' }, { id: 'm2', name: 'Musculação' }];

let root = null;
async function montar(freepassTypes) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast }, h(FreepassTypesPanel, { db: {}, modalities, freepassTypes })));
  });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; vi.clearAllMocks(); });
const texto = () => document.body.textContent;
const clicar = async (rotulo) => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.textContent).trim().includes(rotulo));
  expect(b, `botão "${rotulo}"`).toBeTruthy();
  await act(async () => { b.click(); });
};

describe('FreepassTypesPanel', () => {
  it('mostra os tipos com a modalidade, a quantidade e o selo de padrão', async () => {
    await montar([{ id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true }]);
    expect(texto()).toContain('Pilates 2 aulas');
    expect(texto()).toContain('Pilates · 2 aulas');
    expect(texto()).toContain('Padrão');
  });
  it('não salva sem nome e diz o que falta', async () => {
    await montar([]);
    await clicar('Novo freepass');
    await clicar('Criar freepass');
    expect(texto()).toContain('Dê um nome ao freepass.');
    expect(setDoc).not.toHaveBeenCalled();
  });
});
