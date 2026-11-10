// Contas do console de super-admin sobre as interações (api/_interactionStats.js).
// A linha de sinal da conversa pelo Stronizap (type zap_signal) só diz que o
// lead escreveu ou que a equipe enviou: não é atividade registrada por quem
// atende, então não conta na última atividade da academia nem no total de
// interações.
import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_MAX_PAGES,
  pickLastHumanInteractionMillis,
  lastHumanInteractionMillis,
  humanInteractionCount,
  zapSignalCount
} from '../_interactionStats.js';

const ts = (ms) => ({ toMillis: () => ms });
const doc = (type, ms) => ({ data: () => ({ ...(type ? { type } : {}), createdAt: ts(ms) }) });

describe('pickLastHumanInteractionMillis', () => {
  it('sem sinais devolve a primeira, a mais recente', () => {
    expect(pickLastHumanInteractionMillis([doc('note', 900), doc('status_change', 500)])).toBe(900);
  });

  it('com sinais no topo pula até a primeira que não é sinal', () => {
    const docs = [doc('zap_signal', 990), doc('zap_signal', 950), doc('note', 700), doc('zap_signal', 600), doc('note', 100)];
    expect(pickLastHumanInteractionMillis(docs)).toBe(700);
  });

  it('só sinais devolve null: nenhuma interação de quem atende nesta lista', () => {
    expect(pickLastHumanInteractionMillis([doc('zap_signal', 990), doc('zap_signal', 950)])).toBeNull();
    expect(pickLastHumanInteractionMillis([])).toBeNull();
  });

  it('interação sem type conta como de quem atende', () => {
    expect(pickLastHumanInteractionMillis([doc('zap_signal', 990), doc(undefined, 800)])).toBe(800);
  });

  it('nunca devolve a data de um sinal', () => {
    expect(pickLastHumanInteractionMillis([doc('zap_signal', 990), doc('zap_signal', 920)])).toBeNull();
  });
});

// Coleção falsa, com as interações da mais nova para a mais antiga, que anota
// cada leitura (quantos documentos pediu e se veio depois de um cursor).
const colecao = (itens) => {
  const leituras = [];
  const consulta = (estado) => ({
    limit: (n) => consulta({ ...estado, n }),
    startAfter: (cursor) => consulta({ ...estado, cursor }),
    get: async () => {
      leituras.push({ n: estado.n, depois: Boolean(estado.cursor) });
      let docs = itens.map((it, id) => ({
        id,
        data: () => ({ ...(it.type ? { type: it.type } : {}), createdAt: it.ms == null ? null : ts(it.ms) }),
      }));
      if (estado.cursor) docs = docs.slice(estado.cursor.id + 1);
      docs = docs.slice(0, estado.n);
      return { empty: docs.length === 0, docs };
    },
  });
  return { orderBy: () => consulta({}), leituras };
};
const sinais = (n, aPartirDe = 100000) => Array.from({ length: n }, (_, i) => ({ type: 'zap_signal', ms: aPartirDe - i }));

describe('lastHumanInteractionMillis', () => {
  it('coleção vazia: null, com uma leitura só', async () => {
    const col = colecao([]);
    expect(await lastHumanInteractionMillis(col)).toBeNull();
    expect(col.leituras).toEqual([{ n: 1, depois: false }]);
  });

  it('o topo é de quem atende: devolve a data dele e custa uma leitura só, como antes do sinal', async () => {
    const col = colecao([{ type: 'note', ms: 900 }, ...sinais(300, 800)]);
    expect(await lastHumanInteractionMillis(col)).toBe(900);
    expect(col.leituras).toEqual([{ n: 1, depois: false }]);
  });

  it('o topo é de quem atende mas sem createdAt válido: null, sem paginar', async () => {
    const col = colecao([{ type: 'note', ms: null }, { type: 'note', ms: 500 }]);
    expect(await lastHumanInteractionMillis(col)).toBeNull();
    expect(col.leituras).toEqual([{ n: 1, depois: false }]);
  });

  it('o topo é sinal: passa para páginas de ACTIVITY_PAGE_SIZE até achar a de quem atende', async () => {
    const col = colecao([...sinais(150), { type: 'note', ms: 5000 }]);
    expect(await lastHumanInteractionMillis(col)).toBe(5000);
    expect(col.leituras).toEqual([
      { n: 1, depois: false },
      { n: ACTIVITY_PAGE_SIZE, depois: true },
      { n: ACTIVITY_PAGE_SIZE, depois: true },
    ]);
  });

  it('só sinais, menos que uma página: null, e para ao esgotar a coleção', async () => {
    const col = colecao(sinais(5));
    expect(await lastHumanInteractionMillis(col)).toBeNull();
    expect(col.leituras).toEqual([{ n: 1, depois: false }, { n: ACTIVITY_PAGE_SIZE, depois: true }]);
  });

  it('só sinais além do teto de páginas: null, nunca a data de um sinal', async () => {
    const col = colecao(sinais(1200));
    expect(await lastHumanInteractionMillis(col)).toBeNull();
    expect(col.leituras).toHaveLength(1 + ACTIVITY_MAX_PAGES);
  });
});

describe('humanInteractionCount', () => {
  it('é o total menos as linhas de sinal, e nunca fica negativo', () => {
    expect(humanInteractionCount(10, 4)).toBe(6);
    expect(humanInteractionCount(10, 0)).toBe(10);
    expect(humanInteractionCount(3, 5)).toBe(0);
    expect(humanInteractionCount(undefined, undefined)).toBe(0);
  });
});

describe('zapSignalCount', () => {
  it('conta só as de type zap_signal, por um campo só', async () => {
    const pedidos = [];
    const col = {
      where: (campo, op, valor) => {
        pedidos.push([campo, op, valor]);
        return { count: () => ({ get: async () => ({ data: () => ({ count: 7 }) }) }) };
      }
    };
    expect(await zapSignalCount(col)).toBe(7);
    expect(pedidos).toEqual([['type', '==', 'zap_signal']]);
  });

  it('se a contagem falhar devolve 0, e o total fica como está', async () => {
    const col = { where: () => ({ count: () => ({ get: async () => { throw new Error('sem índice'); } }) }) };
    expect(await zapSignalCount(col)).toBe(0);
  });
});
