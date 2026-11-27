// @vitest-environment jsdom
// src/lib/__tests__/freepassLaunchModal.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

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
const CONFIG = { professores: [{ id: 'p1', nome: 'Leonardo', modalidadeIds: ['m1'] }], metaWeekdays: [1, 2, 3, 4, 5] };

let root = null;
async function montar(props) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(h(GeneralConfigContext.Provider, { value: CONFIG }, h(FreepassLaunchModal, { ...base, ...props }))); });
}
afterEach(async () => { await act(async () => { root?.unmount(); }); document.body.innerHTML = ''; root = null; vi.useRealTimers(); });
// Os cartões de dia do "Marcar as aulas" leem o relógio: quinta 26/11 às 10h.
const relogio = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-26T10:00:00')); };
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
    await montar({ freepasses: [{ modalidadeId: 'm2', status: 'encerrado' }], gestor: true, onConfirm });
    await escolher('Muscu 7 dias');
    await act(async () => { botao('Lançar mesmo assim').click(); });
    expect(onConfirm).toHaveBeenCalled();
  });
  it('por aulas, marca as aulas e lança com elas em ordem de data, a primeira é o início', async () => {
    relogio();
    const onConfirm = vi.fn();
    await montar({ freepasses: [], gestor: false, onConfirm });
    await escolher('Pilates 2 aulas');
    expect(texto()).toContain('Aula 2');
    expect(botao('Lançar freepass').disabled).toBe(true);
    const aula1 = document.querySelector('fieldset');
    await act(async () => { [...aula1.querySelectorAll('button')].find((b) => b.textContent === 'Hoje').click(); });
    await act(async () => {
      const sel = aula1.querySelector('select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'p1');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(texto()).toContain('Rafa vira Visitante com 2 aulas');
    await act(async () => { botao('Lançar freepass').click(); });
    const arg = onConfirm.mock.calls[0][0];
    expect(arg.type.id).toBe('t1');
    expect(arg.modalidadeName).toBe('Pilates');
    expect(arg.aulas.map((a) => a.date)).toEqual([new Date('2026-11-26T18:00:00'), new Date('2026-12-03T18:00:00')]);
    expect(arg.aulas[0]).toMatchObject({ professorId: 'p1', soloTraining: false });
  });
  it('por aulas, a aula pendente reaproveitada nasce na linha 1, com o aviso', async () => {
    relogio();
    const pend = { id: 'pend', scheduledFor: new Date('2026-11-27T18:00:00'), professorId: 'p1' };
    const reusableFor = vi.fn((mod) => (mod === 'Pilates' ? pend : null));
    await montar({ freepasses: [], gestor: false, onConfirm: vi.fn(), reusableFor });
    await escolher('Pilates 2 aulas');
    expect(texto()).toContain('A aula experimental de Pilates marcada para sex 27/11 às 18:00 vira a aula 1 deste freepass. Dá para trocar a data dela aqui.');
    const aula1 = document.querySelector('fieldset');
    expect(aula1.querySelector('input[type="time"]').value).toBe('18:00');
    expect(aula1.querySelector('select').value).toBe('p1');
    expect([...aula1.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent)).toEqual(['Amanhã']);
  });
  it('por aulas, sem pendente reaproveitável, não há aviso', async () => {
    await montar({ freepasses: [], gestor: false, onConfirm: vi.fn(), reusableFor: () => null });
    await escolher('Pilates 2 aulas');
    expect(texto()).not.toContain('vira a aula 1');
  });
  it('a aula que passou da hora com a janela aberta mostra o aviso no clique', async () => {
    relogio();
    const onConfirm = vi.fn();
    await montar({ freepasses: [], gestor: false, onConfirm, now: undefined });
    await escolher('Pilates 2 aulas');
    const aula1 = document.querySelector('fieldset');
    await act(async () => { [...aula1.querySelectorAll('button')].find((b) => b.textContent === 'Hoje').click(); });
    await act(async () => {
      const sel = aula1.querySelector('select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'p1');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // A janela ficou aberta até depois das 18h.
    vi.setSystemTime(new Date('2026-11-26T19:00:00'));
    await act(async () => { botao('Lançar freepass').click(); });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(texto()).toContain('A aula 1 já passou. Escolha outro dia ou horário.');
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
