import crypto from 'node:crypto';
import { adminDb, admin } from './_firebaseAdmin.js';

// Webhook do Asaas (PÚBLICO — sem auth Firebase). Recebe eventos de pagamento e
// atualiza a cobrança da organização automaticamente (paymentStatus, lastPaymentAt,
// nextBillingAt) + grava histórico em tenant_payments.
//
// Segurança: o Asaas manda o segredo no header `asaas-access-token` (NÃO é HMAC).
// Comparação constant-time contra ASAAS_WEBHOOK_TOKEN.
// Robustez (CRÍTICO): a fila do Asaas é SEQUENCIAL e PAUSA se receber erros
// seguidos. Então: idempotência por event.id, e responder 200 para tudo que foi
// processado/ignorado. 500 só em exceção inesperada (Asaas retenta).

const tenantsCol = () => adminDb.collection('tenants');
const toTs = (s) => { const d = s ? new Date(s.length <= 10 ? s + 'T12:00:00' : s) : new Date(); return admin.firestore.Timestamp.fromDate(d); };

function tokenOk(req) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const got = req.headers['asaas-access-token'] || '';
  if (!expected) return false; // sem segredo configurado, recusa por segurança
  const a = Buffer.from(String(got)); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const PAID = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH']);
const REVOKE = new Set(['PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE']);

async function findTenantId(payment) {
  if (payment?.externalReference) {
    const s = await tenantsCol().doc(String(payment.externalReference)).get();
    if (s.exists) return s.id;
  }
  if (payment?.subscription) {
    const q = await tenantsCol().where('asaasSubscriptionId', '==', payment.subscription).limit(1).get();
    if (!q.empty) return q.docs[0].id;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!tokenOk(req)) return res.status(401).json({ error: 'Token inválido.' });

  const body = req.body || {};
  const eventId = body.id || null;
  const event = body.event || null;
  const payment = body.payment || null;
  if (!event || !payment) return res.status(200).json({ ignored: 'payload sem event/payment' });

  try {
    // Idempotência: se já vimos esse event.id, não reprocessa.
    if (eventId) {
      const evRef = adminDb.collection('asaas_events').doc(String(eventId));
      const seen = await evRef.get();
      if (seen.exists) return res.status(200).json({ duplicate: true });
      await evRef.set({ event, paymentId: payment.id || null, at: admin.firestore.FieldValue.serverTimestamp() });
    }

    const tenantId = await findTenantId(payment);
    if (!tenantId) return res.status(200).json({ ignored: 'tenant não encontrado', event });

    // Monta o patch no tenant conforme o evento.
    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (PAID.has(event)) {
      patch.paymentStatus = 'paid';
      patch.lastPaymentAt = toTs(payment.paymentDate || payment.confirmedDate);
    } else if (event === 'PAYMENT_OVERDUE') {
      patch.paymentStatus = 'overdue';
    } else if (REVOKE.has(event)) {
      patch.paymentStatus = 'pending';
    } else if (event === 'PAYMENT_CREATED') {
      // Nova cobrança do ciclo: guarda vencimento + link da fatura p/ enviar ao cliente.
      if (payment.dueDate) patch.nextBillingAt = toTs(payment.dueDate);
      if (payment.invoiceUrl) patch.lastInvoiceUrl = payment.invoiceUrl;
    }

    // Só escreve no tenant se o evento mexe em algo (além do updatedAt).
    if (Object.keys(patch).length > 1) await tenantsCol().doc(tenantId).update(patch);

    // Histórico (para o painel financeiro).
    await adminDb.collection('tenant_payments').add({
      tenantId,
      paymentId: payment.id || null,
      subscriptionId: payment.subscription || null,
      event,
      status: payment.status || null,
      value: typeof payment.value === 'number' ? payment.value : null,
      netValue: typeof payment.netValue === 'number' ? payment.netValue : null,
      billingType: payment.billingType || null,
      dueDate: payment.dueDate || null,
      paidAt: payment.paymentDate || payment.confirmedDate || null,
      invoiceUrl: payment.invoiceUrl || null,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, tenantId, event });
  } catch (err) {
    // Exceção inesperada (ex.: Firestore indisponível) → 500 p/ o Asaas retentar.
    console.error('asaas-webhook', event, err?.message || err);
    return res.status(500).json({ error: 'erro ao processar (será retentado)' });
  }
}
