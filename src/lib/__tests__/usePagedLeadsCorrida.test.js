// @vitest-environment jsdom
// A resposta de uma consulta que não é mais a de agora não entra na lista. No
// Pipeline, trocar de mês ou de funil com a rede lenta deixava a Perda e a Venda
// com os leads do recorte anterior quando a resposta velha chegava por último.
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pending = [];
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), startAfter: vi.fn(),
  getDocs: vi.fn(() => new Promise((r) => { pending.push(r); })),
}));
vi.mock('../firebase.js', () => ({ appId: 'app' }));

const { usePagedLeads } = await import('../../hooks/usePagedLeads.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DB = {};
const SPEC = { wheres: [], limit: 1 };
const page = (...ids) => ({ docs: ids.map((id) => ({ id, data: () => ({}) })), size: ids.length });
let root, host, last;
function Probe({ specKey, enabled = true }) {
  last = usePagedLeads({ db: DB, path: 'leads', spec: SPEC, specKey, enabled });
  return null;
}

beforeEach(() => { host = document.createElement('div'); root = createRoot(host); pending.length = 0; });
afterEach(() => { act(() => root.unmount()); });

describe('usePagedLeads: resposta velha', () => {
  it('a consulta anterior chegando depois não substitui a de agora', async () => {
    act(() => root.render(h(Probe, { specKey: 'setembro' })));
    act(() => root.render(h(Probe, { specKey: 'agosto' })));
    await act(async () => { pending[1](page('agosto-1')); });
    await act(async () => { pending[0](page('setembro-1')); });
    expect(last.items.map((l) => l.id)).toEqual(['agosto-1']);
    expect(last.ready).toBe(true);
  });

  it('"carregar mais" da consulta anterior não se junta à lista nova', async () => {
    act(() => root.render(h(Probe, { specKey: 'a' })));
    await act(async () => { pending[0](page('a-1')); });
    act(() => last.loadMore());
    act(() => root.render(h(Probe, { specKey: 'b' })));
    await act(async () => { pending[2](page('b-1')); });
    await act(async () => { pending[1](page('a-2')); });
    expect(last.items.map((l) => l.id)).toEqual(['b-1']);
  });

  it('desligar com a leitura em voo descarta a resposta, e religar traz a nova', async () => {
    act(() => root.render(h(Probe, { specKey: 'perda' })));
    act(() => root.render(h(Probe, { specKey: 'perda', enabled: false })));
    await act(async () => { pending[0](page('velho')); });
    expect(last.items).toEqual([]);
    expect(last.loading).toBe(false);
    act(() => root.render(h(Probe, { specKey: 'perda' })));
    await act(async () => { pending[1](page('novo')); });
    expect(last.items.map((l) => l.id)).toEqual(['novo']);
    expect(last.ready).toBe(true);
  });
});
