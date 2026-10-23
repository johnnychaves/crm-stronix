// @vitest-environment jsdom
// O `onDone` do ContractModal chega ao Kanban com as funções da renderização em que a pessoa clicou
// em Confirmar. Com a internet fora o commit fica pendente: a pessoa fecha pelo X, troca o mês ou o
// funil do quadro, e só depois a gravação termina. As funções de recarga daquela hora buscam a
// consulta antiga e põem na coluna do mês novo os leads do mês velho. O `useLatestRef` guarda sempre
// as funções da última renderização, e o `onDone` chama por ele.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'colecao'),
  query: vi.fn((colecao, ...restricoes) => ({ colecao, restricoes })),
  where: vi.fn((campo, op, valor) => ({ where: [campo, op, valor] })),
  orderBy: vi.fn((campo, dir) => ({ orderBy: [campo, dir] })),
  limit: vi.fn((n) => ({ limit: n })),
  startAfter: vi.fn((cursor) => ({ startAfter: cursor })),
  getDocs: vi.fn(async () => ({ docs: [], size: 0 }))
}));
vi.mock('../firebase.js', () => ({ appId: 'acad' }));

const { usePagedLeads } = await import('../../hooks/usePagedLeads.js');
const { useLatestRef } = await import('../../hooks/useLatestRef.js');
const { where } = await import('firebase/firestore');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O db é estável no app. Um objeto novo a cada render religaria o efeito do hook sem parar.
const DB = {};

let root = null;
const montar = async (arvore) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(arvore); });
};
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('useLatestRef', () => {
  it('guarda o valor da última renderização, sempre no mesmo ref', async () => {
    let visto;
    function Sonda({ valor }) { visto = useLatestRef({ valor }); return null; }
    await montar(h(Sonda, { valor: 'a' }));
    const ref = visto;
    expect(ref.current.valor).toBe('a');
    await act(async () => { root.render(h(Sonda, { valor: 'b' })); });
    expect(visto).toBe(ref);
    expect(ref.current.valor).toBe('b');
  });

  it('a recarga chamada depois de trocar a consulta busca a consulta nova, e a pega antes busca a velha', async () => {
    let pega;
    let porRef;
    function Quadro({ inicio }) {
      const spec = { wheres: [{ field: 'convertedAt', op: '>=', value: inicio }], limit: 10 };
      const { reload } = usePagedLeads({ db: DB, path: 'leads', spec, specKey: `mes:${inicio}`, enabled: true });
      const recargas = useLatestRef({ reload });
      if (!pega) pega = reload;
      porRef = recargas;
      return null;
    }
    await montar(h(Quadro, { inicio: 1 }));
    // A pessoa troca o mês do quadro: a 1ª página do mês novo carrega sozinha.
    await act(async () => { root.render(h(Quadro, { inicio: 2 })); });
    expect(where).toHaveBeenLastCalledWith('convertedAt', '>=', 2);

    // A função pega no 1º render ainda consulta o mês antigo: era o defeito.
    where.mockClear();
    await act(async () => { await pega(); });
    expect(where).toHaveBeenCalledTimes(1);
    expect(where.mock.calls[0][2]).toBe(1);

    // A do ref consulta o mês de agora.
    where.mockClear();
    await act(async () => { await porRef.current.reload(); });
    expect(where).toHaveBeenCalledTimes(1);
    expect(where.mock.calls[0][2]).toBe(2);
  });
});
