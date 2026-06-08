import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { loadPlans, effectivePrice } from './_plans.js';
import {
  isAsaasConfigured, findOrCreateCustomer, createSubscription, updateSubscription,
  cancelSubscription, listSubscriptionPayments,
} from './_asaas.js';

// Gestão da assinatura Asaas de uma organização — SUPER-ADMIN only.
//   POST   { tenantId, cpfCnpj, email, mobilePhone, cycle: 'monthly'|'annual' }  → cria/atualiza
//   GET    ?tenantId=...                                                          → status + cobranças
//   DELETE { tenantId }                                                           → cancela
// O valor sai do catálogo de planos (priceMonthly ou priceAnnual), com override
// por-tenant (monthlyPrice) no caso mensal. billingType UNDEFINED: o cliente paga
// na fatura hospedada (Pix/boleto/cartão). Vercel serverless function.

const tenantsCol = () => adminDb.collection('tenants');
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

async function audit(action, tenantId, actorUid, details) {
  try {
    await adminDb.collection('superadmin_audit').add({
      action, tenantId, actorUid: actorUid || null, details: details || {},
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.error('audit', e?.message || e); }
}

export default async function handler(req, res) {
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) return res.status(403).json({ error: 'Apenas o super-admin gerencia cobrança.' });
  if (!isAsaasConfigured()) {
    return res.status(503).json({ error: 'Asaas não configurado. Defina ASAAS_API_KEY (e ASAAS_WEBHOOK_TOKEN) nas variáveis de ambiente. Veja docs/ASAAS_SETUP.md.' });
  }

  const tenantId = req.method === 'GET' ? req.query?.tenantId : req.body?.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'tenantId é obrigatório.' });

  const ref = tenantsCol().doc(String(tenantId));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Organização não encontrada.' });
  const tenant = snap.data() || {};

  try {
    // ---- GET: status + últimas cobranças ----
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

    // ---- DELETE: cancela ----
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

    // ---- POST: cria ou atualiza ----
    if (req.method === 'POST') {
      const { cpfCnpj, email, mobilePhone } = req.body || {};
      const cycle = req.body?.cycle === 'annual' ? 'annual' : 'monthly';

      // Valor a partir do catálogo de planos.
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

      // Já tem assinatura → atualiza valor/ciclo. Senão, cria (cliente + assinatura).
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
        // 1ª cobrança: hoje, ou no fim do trial se ainda estiver em trial.
        const trialMs = tenant.trialEndsAt?.toMillis?.() || null;
        const nextDueDate = ymd(trialMs && trialMs > Date.now() ? trialMs : Date.now());
        const sub = await createSubscription({
          customerId, value, cycle: cycleAsaas, nextDueDate,
          description: `STRONILEAD — plano ${tenant.plan}`, tenantId,
        });
        subscriptionId = sub.id;
      }

      // Pega a fatura mais recente p/ enviar o link ao cliente.
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
