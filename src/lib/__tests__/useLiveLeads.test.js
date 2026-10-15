// @vitest-environment jsdom
// Todos os leads e Configurações liam a coleção inteira de leads com getDocs a
// cada visita, e a leitura única sempre vem inteira do servidor. Com a leitura
// ao vivo e o cache persistente do Firestore, voltar à tela em até 30 minutos
// sincroniza só o que mudou. O hook só entrega a lista depois da primeira
// resposta do servidor, como o getDocs fazia, porque Configurações usa a lista
// para não deixar apagar etapa ou catálogo em uso.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const fs = vi.hoisted(() => ({ ouvintes: [], cancelados: 0 }));
vi.mock('../firebase.js', () => ({ appId: 'acad' }));
vi.mock('firebase/firestore', () => ({
  collection: (...p) => ({ path: p.slice(1).join('/') }),
  query: (col, ...cs) => ({ col, cs }),
  where: (...a) => ({ where: a }),
  orderBy: (...a) => ({ orderBy: a }),
  limit: (n) => ({ limit: n }),
  startAfter: (c) => ({ startAfter: c }),
  getDocs: async () => ({ docs: [] }),
  onSnapshot: (q, opcoes, aoChegar, aoFalhar) => {
    const ouvinte = { q, opcoes, aoChegar, aoFalhar, ativo: true };
    fs.ouvintes.push(ouvinte);
    return () => { ouvinte.ativo = false; fs.cancelados += 1; };
  },
}));

const { useLiveLeads } = await import('../../hooks/useLiveLeads.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const foto = (ids, fromCache = false) => ({
  metadata: { fromCache },
  docs: ids.map((id) => ({ id, data: () => ({ name: `Lead ${id}` }) })),
});
const SPEC = { wheres: [] };
// db fixo: um objeto novo a cada render refaria a leitura.
const DB = {};
const saida = { atual: null };
let root = null;

function Sonda(props) {
  const r = useLiveLeads({ db: DB, path: 'stronix_leads', spec: SPEC, specKey: 'todos', ...props });
  useEffect(() => { saida.atual = r; });
  return null;
}
async function montar(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(Sonda, props)); });
}
const rerender = (props) => act(async () => { root.render(h(Sonda, props)); });
const ultimo = () => fs.ouvintes.at(-1);
const chega = (snap) => act(async () => { ultimo().aoChegar(snap); });
const ids = () => saida.atual.items.map((l) => l.id);

beforeEach(() => { fs.ouvintes = []; fs.cancelados = 0; saida.atual = null; });
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.useRealTimers();
});

describe('useLiveLeads', () => {
  it('lê ao vivo, pedindo as mudanças de origem, e carrega até a resposta do servidor', async () => {
    await montar();
    expect(fs.ouvintes).toHaveLength(1);
    expect(ultimo().opcoes).toEqual({ includeMetadataChanges: true });
    expect(saida.atual.loading).toBe(true);
    expect(ids()).toEqual([]);
  });

  it('ignora a resposta do cache antes da primeira do servidor', async () => {
    await montar();
    await chega(foto(['a'], true));
    expect(saida.atual.loading).toBe(true);
    expect(ids()).toEqual([]);

    await chega(foto(['a', 'b'], false));
    expect(saida.atual.loading).toBe(false);
    expect(ids()).toEqual(['a', 'b']);
  });

  it('depois do servidor, as mudanças seguintes entram, mesmo as que vêm do cache local', async () => {
    await montar();
    await chega(foto(['a', 'b']));
    await chega(foto(['a', 'b', 'c'], true));
    expect(ids()).toEqual(['a', 'b', 'c']);
  });

  it('com a pausa, desliga e mantém a lista; na volta, religa', async () => {
    await montar({ enabled: true });
    await chega(foto(['a']));

    await rerender({ enabled: false });
    expect(fs.cancelados).toBe(1);
    expect(ids()).toEqual(['a']);
    expect(saida.atual.loading).toBe(false);

    await rerender({ enabled: true });
    expect(fs.ouvintes).toHaveLength(2);
    expect(ids()).toEqual(['a']);
    await chega(foto(['a', 'z']));
    expect(ids()).toEqual(['a', 'z']);
  });

  it('usa o mapDoc em cada documento', async () => {
    await montar({ mapDoc: (d) => ({ id: d.id, nome: d.data().name.toUpperCase() }) });
    await chega(foto(['a']));
    expect(saida.atual.items).toEqual([{ id: 'a', nome: 'LEAD A' }]);
  });

  it('acesso negado logo depois do login: tenta de novo, até três vezes', async () => {
    vi.useFakeTimers();
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    for (let i = 0; i < 3; i++) {
      await act(async () => { ultimo().aoFalhar({ code: 'permission-denied' }); });
      await act(async () => { vi.advanceTimersByTime(5000); });
    }
    expect(fs.ouvintes).toHaveLength(4);
    await act(async () => { ultimo().aoFalhar({ code: 'permission-denied' }); });
    expect(fs.ouvintes).toHaveLength(4);
    expect(saida.atual.error?.code).toBe('permission-denied');
    expect(saida.atual.loading).toBe(false);
    erro.mockRestore();
  });

  it('desmontar cancela a leitura', async () => {
    await montar();
    await act(async () => { root.unmount(); });
    root = null;
    expect(fs.cancelados).toBe(1);
  });
});
