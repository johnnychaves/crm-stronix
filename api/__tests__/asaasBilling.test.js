import { describe, it, expect } from 'vitest';
import { billingSnapshot } from '../_asaasBilling.js';

const pay = (id, status, dueDate, extra = {}) => ({ id, status, dueDate, invoiceUrl: `https://asaas/i/${id}`, ...extra });

describe('billingSnapshot', () => {
  it('novembro em aberto e dezembro já criado: a fatura a pagar é novembro', () => {
    const s = billingSnapshot([pay('dez', 'PENDING', '2026-12-05'), pay('nov', 'PENDING', '2026-11-05'), pay('out', 'RECEIVED', '2026-10-05')]);
    expect(s.due.id).toBe('nov');
    expect(s.paymentStatus).toBe('paid');
    expect(s.overdue).toBeNull();
  });

  it('pagar dezembro não apaga o atraso de novembro', () => {
    const s = billingSnapshot([pay('dez', 'RECEIVED', '2026-12-05'), pay('nov', 'OVERDUE', '2026-11-05')]);
    expect(s.paymentStatus).toBe('overdue');
    expect(s.due.id).toBe('nov');
    expect(s.overdue.id).toBe('nov');
  });

  it('com duas atrasadas, aponta a mais antiga', () => {
    const s = billingSnapshot([pay('dez', 'OVERDUE', '2026-12-05'), pay('nov', 'OVERDUE', '2026-11-05')]);
    expect(s.overdue.id).toBe('nov');
  });

  it('tudo pago: nada a pagar e em dia', () => {
    const s = billingSnapshot([pay('nov', 'CONFIRMED', '2026-11-05')]);
    expect(s.due).toBeNull();
    expect(s.paymentStatus).toBe('paid');
  });

  it('nunca pagou (teste ativando): pendente', () => {
    expect(billingSnapshot([pay('nov', 'PENDING', '2026-11-05')]).paymentStatus).toBe('pending');
    expect(billingSnapshot([]).paymentStatus).toBe('pending');
    expect(billingSnapshot(undefined).due).toBeNull();
  });

  it('cobrança apagada não conta', () => {
    const s = billingSnapshot([pay('nov', 'OVERDUE', '2026-11-05', { deleted: true }), pay('dez', 'PENDING', '2026-12-05')]);
    expect(s.paymentStatus).toBe('pending');
    expect(s.due.id).toBe('dez');
  });
});
