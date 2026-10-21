// @vitest-environment jsdom
// O `ready` do usePagedLeads diz que a lista é a da consulta de agora. O App
// espera por ele antes de gravar o dia batido: o `loading` começa falso e só
// vira verdadeiro no effect, e com ele o dia sem tarefa seria gravado antes de
// os clientes chegarem (21/10/2026).
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let resolveFetch;
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), startAfter: vi.fn(),
  getDocs: vi.fn(() => new Promise((r) => { resolveFetch = r; })),
}));
vi.mock('../firebase.js', () => ({ appId: 'app' }));

const { usePagedLeads } = await import('../../hooks/usePagedLeads.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DB = {};
const SPEC = { wheres: [] };
let root, host, seen;
function Probe({ specKey }) {
  const { ready, items } = usePagedLeads({ db: DB, path: 'leads', spec: SPEC, specKey });
  seen.push({ ready, n: items.length });
  return null;
}

beforeEach(() => { host = document.createElement('div'); root = createRoot(host); seen = []; });
afterEach(() => { act(() => root.unmount()); });

describe('usePagedLeads: ready', () => {
  it('fica falso até a primeira leitura terminar', async () => {
    act(() => root.render(h(Probe, { specKey: 'a' })));
    expect(seen.every((s) => !s.ready)).toBe(true);
    await act(async () => { resolveFetch({ docs: [{ id: '1', data: () => ({}) }], size: 1 }); });
    expect(seen.at(-1)).toEqual({ ready: true, n: 1 });
  });

  it('volta a falso quando a consulta muda', async () => {
    act(() => root.render(h(Probe, { specKey: 'a' })));
    await act(async () => { resolveFetch({ docs: [], size: 0 }); });
    expect(seen.at(-1).ready).toBe(true);
    act(() => root.render(h(Probe, { specKey: 'b' })));
    expect(seen.at(-1).ready).toBe(false);
  });
});
