// O webhook do Asaas grava a academia pela lista de cobranças do cliente, e não
// só pelo evento: pagar dezembro não libera novembro atrasado, e a cobrança de
// dezembro recém-criada não vira a fatura a pagar com novembro em aberto.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEL = { __del: true };
const NOW = { __now: true };
const docs = new Map();
let listaDoAsaas = [];

vi.mock('../_firebaseAdmin.js', () => {
  const ref = (path) => ({
    get: async () => ({ exists: docs.has(path), id: path.split('/').pop(), data: () => docs.get(path) }),
    set: async (v) => { docs.set(path, { ...v }); },
    update: async (patch) => {
      const cur = { ...(docs.get(path) || {}) };
      for (const [k, v] of Object.entries(patch)) { if (v === DEL) delete cur[k]; else cur[k] = v; }
      docs.set(path, cur);
    },
  });
  const collection = (name) => ({
    doc: (id) => ref(`${name}/${id}`),
    add: async () => ({}),
    where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
  });
  return {
    adminDb: { collection },
    admin: { firestore: {
      FieldValue: { delete: () => DEL, serverTimestamp: () => NOW },
      Timestamp: { fromDate: (d) => ({ ms: d.getTime() }), fromMillis: (ms) => ({ ms }) },
    } },
    verifyRequest: async () => null,
  };
});
vi.mock('../_asaas.js', () => ({
  isAsaasConfigured: () => true,
  findOrCreateCustomer: vi.fn(), createSubscription: vi.fn(), updateSubscription: vi.fn(),
  cancelSubscription: vi.fn(), listSubscriptionPayments: vi.fn(),
  listCustomerPayments: vi.fn(async () => ({ data: listaDoAsaas })),
}));
vi.mock('../_sentry.js', () => ({ withSentry: (h) => h }));

process.env.ASAAS_WEBHOOK_TOKEN = 'tok';
const { default: handler } = await import('../asaas.js');

const pay = (id, status, dueDate) => ({ id, status, dueDate, value: 97, customer: 'cus_1', externalReference: 'academia', invoiceUrl: `https://asaas/i/${id}` });
async function evento(event, payment) {
  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: 'POST', headers: { 'asaas-access-token': 'tok' }, body: { id: `${event}-${payment.id}-${Math.random()}`, event, payment } }, res);
  return res;
}
const academia = () => docs.get('tenants/academia');

beforeEach(() => {
  docs.clear();
  docs.set('tenants/academia', { status: 'active', paymentStatus: 'paid' });
});

describe('webhook do Asaas e a fatura a pagar', () => {
  it('cobrança de dezembro criada com novembro em aberto: o link segue em novembro', async () => {
    listaDoAsaas = [pay('nov', 'PENDING', '2026-11-05'), pay('dez', 'PENDING', '2026-12-05'), pay('out', 'RECEIVED', '2026-10-05')];
    const res = await evento('PAYMENT_CREATED', listaDoAsaas[1]);
    expect(res.statusCode).toBe(200);
    expect(academia().lastInvoiceUrl).toBe('https://asaas/i/nov');
    expect(academia().nextBillingAt.ms).toBe(new Date('2026-11-05T12:00:00').getTime());
    expect(academia().paymentStatus).toBe('paid');
  });

  it('pagar dezembro com novembro atrasado mantém o atraso e a carência de antes', async () => {
    const desde = { ms: 1 };
    docs.set('tenants/academia', { status: 'active', paymentStatus: 'overdue', paymentOverdueSince: desde, overdueInvoiceUrl: 'https://asaas/i/nov' });
    listaDoAsaas = [pay('nov', 'OVERDUE', '2026-11-05'), pay('dez', 'RECEIVED', '2026-12-05')];
    await evento('PAYMENT_RECEIVED', listaDoAsaas[1]);
    expect(academia().paymentStatus).toBe('overdue');
    expect(academia().paymentOverdueSince).toBe(desde);
    expect(academia().lastInvoiceUrl).toBe('https://asaas/i/nov');
    expect(academia().overdueInvoiceUrl).toBe('https://asaas/i/nov');
  });

  it('pagar novembro atrasado libera e passa a apontar dezembro', async () => {
    docs.set('tenants/academia', { status: 'active', paymentStatus: 'overdue', paymentOverdueSince: { ms: 1 }, overdueInvoiceUrl: 'https://asaas/i/nov' });
    listaDoAsaas = [pay('nov', 'RECEIVED', '2026-11-05'), pay('dez', 'PENDING', '2026-12-05')];
    await evento('PAYMENT_RECEIVED', listaDoAsaas[0]);
    expect(academia().paymentStatus).toBe('paid');
    expect(academia().paymentOverdueSince).toBeUndefined();
    expect(academia().overdueInvoiceUrl).toBeUndefined();
    expect(academia().lastInvoiceUrl).toBe('https://asaas/i/dez');
  });

  it('primeiro atraso marca o início da carência', async () => {
    listaDoAsaas = [pay('nov', 'OVERDUE', '2026-11-05')];
    await evento('PAYMENT_OVERDUE', listaDoAsaas[0]);
    expect(academia().paymentStatus).toBe('overdue');
    expect(academia().paymentOverdueSince).toBe(NOW);
  });

  it('se a lista do Asaas falhar, vale o evento, como antes', async () => {
    const { listCustomerPayments } = await import('../_asaas.js');
    listCustomerPayments.mockRejectedValueOnce(new Error('fora do ar'));
    await evento('PAYMENT_OVERDUE', pay('nov', 'OVERDUE', '2026-11-05'));
    expect(academia().paymentStatus).toBe('overdue');
    expect(academia().overdueInvoiceUrl).toBe('https://asaas/i/nov');
  });
});
