import crypto from 'node:crypto';
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { loadPlans, effectivePrice } from './_plans.js';
import {
  isAsaasConfigured, findOrCreateCustomer, createSubscription, updateSubscription,
  cancelSubscription, listSubscriptionPayments,
} from './_asaas.js';

// Endpoint ÚNICO do Asaas (gestão de assinatura + webhook no mesmo arquivo, para
// caber no limite de 12 Serverless Functions do Vercel Hobby).
//   • Requisição com header `asaas-access-token`  → WEBHOOK (público, validado por token)
//   • Caso contrário                              → gestão da assinatura (SUPER-ADMIN, Bearer)
// Vercel serverless function.

const tenantsCol = () => adminDb.collection('tenants');
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const toTs = (s) => { const d = s ? new Date(s.length <= 10 ? s + 'T12:00:00' : s) : new Date(); return admin.firestore.Timestamp.fromDate(d); };

async function audit(action, tenantId, actorUid, details) {
  try {
    await adminDb.collection('superadmin_audit').add({
      action, tenantId, actorUid: actorUid || null, details: details || {},
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.error('audit', e?.message || e); }
}

// ============================ WEBHOOK (público) ============================
// Segurança: o Asaas manda o segredo no header `asaas-access-token` (não é HMAC).
// Comparação constant-time. A fila do Asaas é sequencial e PAUSA em erros seguidos,
// então respondemos 200 para tudo que foi processado/ignorado; 500 só em exceção.
function tokenOk(req) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const got = req.headers['asaas-access-token'] || '';
  if (!expected) return false;
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

async function handleWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!tokenOk(req)) return res.status(401).json({ error: 'Token inválido.' });

  const body = req.body || {};
  const eventId = body.id || null;
  const event = body.event || null;
  const payment = body.payment || null;
  if (!event || !payment) return res.status(200).json({ ignored: 'payload sem event/payment' });

  try {
    if (eventId) {
      const evRef = adminDb.collection('asaas_events').doc(String(eventId));
      const seen = await evRef.get();
      if (seen.exists) return res.status(200).json({ duplicate: true });
      await evRef.set({ event, paymentId: payment.id || null, at: admin.firestore.FieldValue.serverTimestamp() });
    }

    const tenantId = await findTenantId(payment);
    if (!tenantId) return res.status(200).json({ ignored: 'tenant não encontrado', event });

    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (PAID.has(event)) {
      patch.paymentStatus = 'paid';
      patch.lastPaymentAt = toTs(payment.paymentDate || payment.confirmedDate);
    } else if (event === 'PAYMENT_OVERDUE') {
      patch.paymentStatus = 'overdue';
    } else if (REVOKE.has(event)) {
      patch.paymentStatus = 'pending';
    } else if (event === 'PAYMENT_CREATED') {
      if (payment.dueDate) patch.nextBillingAt = toTs(payment.dueDate);
      if (payment.invoiceUrl) patch.lastInvoiceUrl = payment.invoiceUrl;
    }
    if (Object.keys(patch).length > 1) await tenantsCol().doc(tenantId).update(patch);

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
    console.error('asaas-webhook', event, err?.message || err);
    return res.status(500).json({ error: 'erro ao processar (será retentado)' });
  }
}

// ===================== ASSINATURA (super-admin) =====================
//   POST   { tenantId, cpfCnpj, email, mobilePhone, cycle: 'monthly'|'annual' }  → cria/atualiza
//   GET    ?tenantId=...                                                          → status + cobranças
//   DELETE { tenantId }                                                           → cancela
async function handleSubscription(req, res) {
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) return res.status(403).json({ error: 'Apenas o super-admin gerencia cobrança.' });
  if (!isAsaasConfigured()) {
    return res.status(503).json({ error: 'Asaas não configurado. Defina ASAAS_API_KEY (e ASAAS_WEBHOOK_TOKEN). Veja docs/ASAAS_SETUP.md.' });
  }

  const tenantId = req.method === 'GET' ? req.query?.tenantId : req.body?.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenantId é obrigatório.' });

  const ref = tenantsCol().doc(String(tenantId));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Organização não encontrada.' });
  const tenant = snap.data() || {};

  try {
    if (req.method === 'GET') {
      if (!tenant.asaasSubscriptionId) return res.status(200).json({ subscription: null, payments: [] });
      const payments = await listSubscriptionPayments(tenant.asaasSubscriptionId);
      return res.status(200).json({
        subscriptionId: tenant.asaasSubscriptionId,
        customerId: tenant.asaasCustomerId || null,
        billingCycle: tenant.billingCycle || null,
        payments: (payments?.data || []).map(p => ({
          id: p.id, status: p.status, value: p.value, billingType: p.billingType,
          dueDate: p.dueDate, invoiceUrl: p.invoiceUrl,
        })),
      });
    }

    if (req.method === 'DELETE') {
      if (tenant.asaasSubscriptionId) await cancelSubscription(tenant.asaasSubscriptionId);
      await ref.update({
        asaasSubscriptionId: admin.firestore.FieldValue.delete(),
        billingProvider: admin.firestore.FieldValue.delete(),
        billingCycle: admin.firestore.FieldValue.delete(),
        lastInvoiceUrl: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await audit('asaas.subscription.cancel', tenantId, auth.uid, {});
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
      const { cpfCnpj, email, mobilePhone } = req.body || {};
      const cycle = req.body?.cycle === 'annual' ? 'annual' : 'monthly';

      const plansMap = await loadPlans();
      const planDoc = plansMap.get(tenant.plan);
      let value, cycleAsaas;
      if (cycle === 'annual') {
        value = Number(planDoc?.priceAnnual);
        cycleAsaas = 'YEARLY';
        if (!Number.isFinite(value) || value <= 0) {
          return res.status(400).json({ error: `O plano "${tenant.plan}" não tem preço anual definido.` });
        }
      } else {
        value = effectivePrice({ plan: tenant.plan, monthlyPrice: tenant.monthlyPrice }, plansMap);
        cycleAsaas = 'MONTHLY';
        if (!Number.isFinite(value) || value <= 0) {
          return res.status(400).json({ error: 'Valor mensal do plano é zero — defina um preço antes de cobrar.' });
        }
      }

      let subscriptionId = tenant.asaasSubscriptionId || null;
      let customerId = tenant.asaasCustomerId || null;
      if (subscriptionId) {
        await updateSubscription(subscriptionId, { value, cycle: cycleAsaas });
      } else {
        if (!cpfCnpj) return res.status(400).json({ error: 'CPF/CNPJ é obrigatório para criar a assinatura.' });
        const customer = customerId
          ? { id: customerId }
          : await findOrCreateCustomer({ tenantId, name: tenant.displayName, cpfCnpj, email: email || tenant.primaryAdminEmail, mobilePhone });
        customerId = customer.id;
        const trialMs = tenant.trialEndsAt?.toMillis?.() || null;
        const nextDueDate = ymd(trialMs && trialMs > Date.now() ? trialMs : Date.now());
        const sub = await createSubscription({
          customerId, value, cycle: cycleAsaas, nextDueDate,
          description: `STRONILEAD — plano ${tenant.plan}`, tenantId,
        });
        subscriptionId = sub.id;
      }

      let lastInvoiceUrl = null, nextBillingMs = null;
      try {
        const pays = await listSubscriptionPayments(subscriptionId);
        const first = pays?.data?.[0];
        if (first) { lastInvoiceUrl = first.invoiceUrl || null; if (first.dueDate) nextBillingMs = new Date(first.dueDate + 'T12:00:00').getTime(); }
      } catch (e) { console.error('listPayments', e?.message || e); }

      await ref.update({
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        billingProvider: 'asaas',
        billingCycle: cycle,
        paymentStatus: tenant.paymentStatus === 'paid' ? 'paid' : 'pending',
        ...(lastInvoiceUrl ? { lastInvoiceUrl } : {}),
        ...(nextBillingMs ? { nextBillingAt: admin.firestore.Timestamp.fromMillis(nextBillingMs) } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await audit('asaas.subscription.upsert', tenantId, auth.uid, { cycle, value, subscriptionId });
      return res.status(200).json({ ok: true, subscriptionId, customerId, value, cycle, invoiceUrl: lastInvoiceUrl });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('asaas-subscription', err?.status, err?.message || err);
    return res.status(err?.status === 400 ? 400 : 502).json({ error: `Asaas: ${err?.message || 'erro ao processar a assinatura.'}` });
  }
}

export default async function handler(req, res) {
  // Webhook do Asaas chega com o header `asaas-access-token`; o resto é gestão (super-admin).
  if (req.headers['asaas-access-token'] !== undefined) return handleWebhook(req, res);
  return handleSubscription(req, res);
}
