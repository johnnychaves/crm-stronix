// @vitest-environment jsdom
// src/lib/__tests__/freepassLaunchModal.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { FreepassLaunchModal } = await import('../../modals/FreepassLaunchModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const types = [
  { id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true },
  { id: 't2', name: 'Muscu 7 dias', modalidadeId: 'm2', kind: 'dias', quantity: 7, padrao: true, ativo: true },
  { id: 't3', name: 'Desligado', modalidadeId: 'm2', kind: 'dias', quantity: 3, padrao: false, ativo: false }
];
const modalities = [{ id: 'm1', name: 'Pilates' }, { id: 'm2', name: 'Musculação' }];
const base = { open: true, onOpenChange: () => {}, firstName: 'Rafa', types, modalities, loading: false, now: new Date('2026-11-26T10:00:00') };

let root = null;
async function montar(props) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(h(FreepassLaunchModal, { ...base, ...props })); });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; });
const texto = () => document.body.textContent;
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const escolher = async (nome) => {
  const r = document.querySelector(`[role="radio"][aria-label^="${nome}"]`);
  expect(r, `opção "${nome}"`).toBeTruthy();
  await act(async () => { r.click(); });
};

describe('FreepassLaunchModal', () => {
  it('lista só os tipos ativos e não deixa lançar sem escolher', async () => {
    await montar({ freepasses: [], gestor: false, onConfirm: vi.fn() });
    expect(texto()).not.toContain('Desligado');
    expect(botao('Lançar freepass').disabled).toBe(true);
  });
  it('por dias, diz até quando vale e lança com o início', async () => {
    const onConfirm = vi.fn();
    await montar({ freepasses: [], gestor: false, onConfirm });
    await escolher('Muscu 7 dias');
    expect(texto()).toContain('Rafa vira Visitante de 26/11 a 02/12.');
    await act(async () => { botao('Lançar freepass').click(); });
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ type: expect.objectContaining({ id: 't2' }), modalidadeName: 'Musculação' }));
  });
  it('barra o consultor na modalidade repetida', async () => {
    await montar({ freepasses: [{ modalidadeId: 'm1', status: 'encerrado' }], gestor: false, onConfirm: vi.fn() });
    await escolher('Pilates 2 aulas');
    expect(texto()).toContain('Essa pessoa já teve um freepass de Pilates. Só o gestor libera outro.');
    expect(botao('Lançar freepass').disabled).toBe(true);
  });
  it('o gestor lança mesmo assim', async () => {
    const onConfirm = vi.fn();
    await montar({ freepasses: [{ modalidadeId: 'm1', status: 'encerrado' }], gestor: true, onConfirm });
    await escolher('Pilates 2 aulas');
    await act(async () => { botao('Lançar mesmo assim').click(); });
    expect(onConfirm).toHaveBeenCalled();
  });
  it('barra o por dias que terminaria antes de hoje', async () => {
    await montar({ freepasses: [], gestor: false, onConfirm: vi.fn(), now: new Date('2026-11-26T10:00:00') });
    await escolher('Muscu 7 dias');
    const input = document.querySelector('input[type="date"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2026-11-19');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(texto()).toContain('Esse freepass terminaria antes de hoje. Escolha um início mais recente.');
    expect(botao('Lançar freepass').disabled).toBe(true);
  });
});
