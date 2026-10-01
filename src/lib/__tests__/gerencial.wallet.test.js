import { describe, it, expect } from 'vitest';
import { walletAt } from '../gerencial/wallet.js';
import { normalizeContracts } from '../operacional/base.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const now = D(2026, 9, 17);
const c = (over) => ({ id: 'c', personKey: 'p', value: 1200, durationMonths: 12, startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), pauses: [], ...over });

describe('walletAt', () => {
  it('conta contrato vigente e soma o ticket mensal', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', value: 600, durationMonths: 6 })], now);
    expect(w.count).toBe(2);
    expect(w.monthly).toBe(200);
    expect(w.ticket).toBe(100);
  });

  it('contrato que ainda não começou ou já acabou fica fora', () => {
    const w = walletAt([c({ startsAt: D(2026, 10, 1), endsAt: D(2027, 10, 1) }), c({ id: 'b', personKey: 'p2', endsAt: D(2026, 8, 1) })], now);
    expect(w.count).toBe(0);
  });

  it('trancado continua na carteira e aparece à parte', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', pauses: [{ from: D(2026, 8, 1), to: null }] })], now);
    expect(w.count).toBe(2);
    expect(w.lockedCount).toBe(1);
    expect(w.lockedMonthly).toBe(100);
    expect(w.monthly).toBe(200);
  });

  it('contrato sem valor entra na contagem e fica fora do dinheiro e do ticket', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', value: 0, durationMonths: 0 })], now);
    expect(w.count).toBe(2);
    expect(w.blind).toBe(1);
    expect(w.monthly).toBe(100);
    expect(w.ticket).toBe(100); // 100 ÷ 1 contrato com valor, nunca ÷ 2
  });

  it('duas vigências da mesma pessoa contam duas vezes e viram sobreposição', () => {
    const w = walletAt([c({ id: 'a' }), c({ id: 'b' })], now);
    expect(w.count).toBe(2);
    expect(w.overlap).toBe(1);
  });

  it('cancelado sai na hora do cancelamento', () => {
    expect(walletAt([c({ cancelledAt: D(2026, 9, 1) })], now).count).toBe(0);
  });

  it('base vazia devolve zeros', () => {
    expect(walletAt([], now)).toMatchObject({ count: 0, monthly: 0, ticket: 0, blind: 0, overlap: 0 });
  });
});

// A carteira recebe a lista do normalizeContracts, como na tela. A renovação
// que começa antes do fim encurta o contrato atual para a véspera dela, na
// mesma hora; a emendada começa no dia seguinte ao fim, na mesma hora.
describe('walletAt com a renovação que encosta no fim', () => {
  const H = (y, m, d, h) => new Date(y, m - 1, d, h);
  const raw = (id, over) => ({ id, leadId: 'P', value: 1200, durationMonths: 12, status: 'ativo', ...over });

  it('encurtada: um contrato por vez, sem somar os dois no que era sobreposição e sem buraco na véspera', () => {
    const list = normalizeContracts([
      raw('k1', { startsAt: H(2025, 10, 11, 0), endsAt: H(2026, 9, 27, 15), originalEndsAt: H(2026, 10, 11, 0), shortenedById: 'k2' }),
      raw('k2', { renewedFromId: 'k1', startsAt: H(2026, 9, 28, 15), endsAt: H(2027, 9, 28, 15), createdAt: H(2026, 9, 28, 15) })
    ]);
    [H(2026, 9, 20, 12), H(2026, 9, 28, 10), H(2026, 10, 5, 12)].forEach((t) => {
      expect(walletAt(list, t), t.toISOString()).toMatchObject({ count: 1, monthly: 100, overlap: 0 });
    });
  });

  it('emendada: o contrato segue na carteira até a renovação começar', () => {
    const list = normalizeContracts([
      raw('k1', { startsAt: H(2025, 10, 31, 15), endsAt: H(2026, 10, 31, 15) }),
      raw('k2', { renewedFromId: 'k1', seamless: true, startsAt: H(2026, 11, 1, 15), endsAt: H(2027, 11, 1, 15), createdAt: H(2026, 10, 20, 12) })
    ]);
    expect(walletAt(list, H(2026, 11, 1, 10))).toMatchObject({ count: 1, monthly: 100 });
  });
});
