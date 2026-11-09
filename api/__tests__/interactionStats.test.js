// Contas do console de super-admin sobre as interações (api/_interactionStats.js).
// A linha de sinal da conversa pelo Stronizap (type zap_signal) só diz que o
// lead escreveu ou que a equipe enviou: não é atividade registrada por quem
// atende, então não conta na última atividade da academia nem no total de
// interações.
import { describe, it, expect } from 'vitest';
import {
  pickLastHumanInteractionMillis,
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

  it('só sinais devolve null, como academia sem interação', () => {
    expect(pickLastHumanInteractionMillis([doc('zap_signal', 990), doc('zap_signal', 950)])).toBeNull();
    expect(pickLastHumanInteractionMillis([])).toBeNull();
  });

  it('interação sem type conta como de quem atende', () => {
    expect(pickLastHumanInteractionMillis([doc('zap_signal', 990), doc(undefined, 800)])).toBe(800);
  });

  it('com o teto de leitura atingido e só sinais, devolve a mais antiga lida (limite superior da atividade real)', () => {
    const docs = [doc('zap_signal', 990), doc('zap_signal', 950), doc('zap_signal', 920)];
    expect(pickLastHumanInteractionMillis(docs, { capped: true })).toBe(920);
  });

  it('com o teto atingido mas com uma de quem atende na leitura, devolve essa', () => {
    expect(pickLastHumanInteractionMillis([doc('zap_signal', 990), doc('note', 700), doc('zap_signal', 600)], { capped: true })).toBe(700);
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
