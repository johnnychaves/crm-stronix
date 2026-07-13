import crypto from 'node:crypto';
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { loadPlans, effectivePrice, getSeatUsage, extraConsultantsCharge, planSeatLimits } from './_plans.js';
import {
  isAsaasConfigured, findOrCreateCustomer, createSubscription, updateSubscription,
  cancelSubscription, listSubscriptionPayments,
} from './_asaas.js';
import { sanitizeProfile } from './_profile.js';

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
    // Chave de idempotência estável: id do evento quando existe; senão derivada
    // do pagamento + tipo (cobre webhooks sem body.id, que antes duplicavam
    // tenant_payments a cada reentrega). O MARCADOR é gravado só no FIM, depois
    // dos efeitos (ver abaixo), então "já visto" aqui significa "já processado
    // por completo" — seguro pular. Antes o marcador era gravado ANTES dos
    // efeitos: uma falha transitória no meio marcava o evento como visto e a
    // reentrega do Asaas era descartada, deixando o cliente pago porém bloqueado.
    const idemKey = eventId ? String(eventId) : (payment.id ? `${payment.id}:${event}` : null);
    if (idemKey) {
      const seen = await adminDb.collection('asaas_events').doc(idemKey).get();
      if (seen.exists) return res.status(200).json({ duplicate: true });
    }

    const tenantId = await findTenantId(payment);
    if (!tenantId) return res.status(200).json({ ignored: 'tenant não encontrado', event });

    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (PAID.has(event)) {
      patch.paymentStatus = 'paid';
      patch.lastPaymentAt = toTs(payment.paymentDate || payment.confirmedDate);
      patch.paymentOverdueSince = admin.firestore.FieldValue.delete(); // pagou → libera acesso
      // Pagou durante/após o trial → ENCERRA o trial (status 'active'). Sem isto
      // o tenant fica 'trial' com trialEndsAt vencido e o app mantém o bloqueio
      // 'trial_expired' apesar de pago. Só mexe quando ainda está em trial (não
      // reativa academia suspensa manualmente).
      const curSnap = await tenantsCol().doc(tenantId).get();
      if (curSnap.data()?.status === 'trial') patch.status = 'active';
    } else if (event === 'PAYMENT_OVERDUE') {
      patch.paymentStatus = 'overdue';
      patch.paymentOverdueSince = admin.firestore.FieldValue.serverTimestamp(); // marca início da carência
    } else if (REVOKE.has(event)) {
      patch.paymentStatus = 'pending';
    } else if (event === 'PAYMENT_CREATED') {
      if (payment.dueDate) patch.nextBillingAt = toTs(payment.dueDate);
      if (payment.invoiceUrl) patch.lastInvoiceUrl = payment.invoiceUrl;
    }
    if (Object.keys(patch).length > 1) await tenantsCol().doc(tenantId).update(patch);

    // Registro de pagamento IDEMPOTENTE: id de doc determinístico (idemKey) p/
    // que uma reentrega SOBRESCREVA em vez de criar duplicata. Sem idemKey (caso
    // patológico sem nenhum id), cai no add() best-effort de antes.
    const paymentRecord = {
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
    };
    if (idemKey) await adminDb.collection('tenant_payments').doc(idemKey).set(paymentRecord);
    else await adminDb.collection('tenant_payments').add(paymentRecord);

    // MARCADOR DE PROCESSADO gravado só AGORA, no fim, depois de TODOS os efeitos.
    // Se qualquer passo acima falhar, o catch devolve 500 e, como o marcador não
    // existe, a reentrega do Asaas reprocessa — o update do tenant é idempotente e
    // o payment usa id determinístico, então nada duplica.
    if (idemKey) {
      await adminDb.collection('asaas_events').doc(idemKey).set({
        event, paymentId: payment.id || null, at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

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
async function handleSubscription(req, res, auth) {
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
      // best-effort: se a assinatura remota não existir mais (ex.: resquício de
      // sandbox), ainda assim desvincula localmente em vez de travar.
      if (tenant.asaasSubscriptionId) {
        try { await cancelSubscription(tenant.asaasSubscriptionId); }
        catch (e) { console.error('cancelSubscription (ignorado p/ desvincular)', e?.message || e); }
      }
      await ref.update({
        asaasCustomerId: admin.firestore.FieldValue.delete(),
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

      const [plansMap, seats] = await Promise.all([loadPlans(), getSeatUsage(tenantId)]);
      const planDoc = plansMap.get(tenant.plan);
      // Consultores EXTRAS (além dos inclusos) entram no valor da assinatura —
      // exceto com preço negociado (monthlyPrice), que é valor final fechado.
      const negotiated = Number(tenant.monthlyPrice) > 0;
      const extraMonthly = negotiated ? 0 : extraConsultantsCharge(planDoc, seats.consultants);
      let value, cycleAsaas;
      if (cycle === 'annual') {
        value = Number(planDoc?.priceAnnual);
        cycleAsaas = 'YEARLY';
        if (!Number.isFinite(value) || value <= 0) {
          return res.status(400).json({ error: `O plano "${tenant.plan}" não tem preço anual definido.` });
        }
        value += extraMonthly * 12;
      } else {
        value = effectivePrice({ plan: tenant.plan, monthlyPrice: tenant.monthlyPrice, consultantCount: seats.consultants }, plansMap);
        cycleAsaas = 'MONTHLY';
        if (!Number.isFinite(value) || value <= 0) {
          return res.status(400).json({ error: 'Valor mensal do plano é zero — defina um preço antes de cobrar.' });
        }
      }

      let subscriptionId = tenant.asaasSubscriptionId || null;
      let customerId = tenant.asaasCustomerId || null;

      // Atualiza a assinatura existente; se ela não existir mais no Asaas
      // (resquício de sandbox após migrar p/ produção), cai para recriar.
      if (subscriptionId) {
        try {
          await updateSubscription(subscriptionId, { value, cycle: cycleAsaas });
        } catch (e) {
          if (e?.status === 404 || e?.status === 400) subscriptionId = null;
          else throw e;
        }
      }

      if (!subscriptionId) {
        // SEMPRE resolve o cliente no ambiente ATUAL (dedupe por externalReference).
        // NÃO reusa tenant.asaasCustomerId cru: um id de cliente de sandbox é
        // inválido na produção e gerava "Cliente inválido ou não informado".
        if (!cpfCnpj) return res.status(400).json({ error: 'CPF/CNPJ é obrigatório para criar a assinatura.' });
        const customer = await findOrCreateCustomer({ tenantId, name: tenant.displayName, cpfCnpj, email: email || tenant.primaryAdminEmail, mobilePhone });
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

// ============== SELF-SERVICE (admin do tenant, sobre a PRÓPRIA assinatura) ==============
//   GET                                   → plano + faturas + renovação + planos + Perfil da academia
//   POST { action:'migrate', plan }       → troca o próprio plano (ajusta a assinatura no Asaas)
//   POST { action:'updateProfile', ... }  → salva o Perfil da academia (sem função nova)
async function handleTenantSelf(req, res, auth) {
  // Cobrança/plano é coisa de ADMIN da academia (não de consultor).
  const userSnap = await adminDb.collection('artifacts').doc(auth.tenantId).collection('public').doc('data').collection('stronix_users').doc(auth.uid).get();
  if (userSnap.data()?.role !== 'admin') return res.status(403).json({ error: 'Apenas o admin da academia gerencia o plano.' });

  const ref = tenantsCol().doc(auth.tenantId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Organização não encontrada.' });
  const tenant = snap.data() || {};
  const plansMap = await loadPlans();

  if (req.method === 'GET') {
    let invoices = [];
    if (tenant.asaasSubscriptionId && isAsaasConfigured()) {
      try {
        const pays = await listSubscriptionPayments(tenant.asaasSubscriptionId);
        invoices = (pays?.data || []).map((p) => ({ id: p.id, status: p.status, value: p.value, dueDate: p.dueDate, invoiceUrl: p.invoiceUrl, billingType: p.billingType }));
      } catch (e) { console.error('self invoices', e?.message || e); }
    }
    const availablePlans = [...plansMap.values()]
      .filter((p) => p.isActive !== false)
      .map((p) => {
        const lim = planSeatLimits(p) || { maxManagers: 1, maxConsultants: 0 };
        return {
          slug: p.slug, name: p.name, priceMonthly: p.priceMonthly ?? null, priceAnnual: p.priceAnnual ?? null,
          maxUsers: p.maxUsers ?? null,
          maxManagers: Number.isFinite(lim.maxManagers) ? lim.maxManagers : null,       // null = ilimitado
          maxConsultants: Number.isFinite(lim.maxConsultants) ? lim.maxConsultants : null,
          extraUserPrice: p.extraUserPrice ?? null,
          maxExtraUsers: p.maxExtraUsers ?? null,
          features: Array.isArray(p.features) ? p.features : [],
        };
      })
      .sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));
    const cur = plansMap.get(tenant.plan);
    const curLimits = cur ? planSeatLimits(cur) : null;
    return res.status(200).json({
      plan: tenant.plan || null,
      planName: cur?.name || tenant.plan || '—',
      // Perfil da academia (lido pela aba "Perfil da academia"): nome + campos de
      // texto (profile) + cidade/UF (settings) + WhatsApp (responsiblePhone).
      displayName: tenant.displayName || null,
      profile: tenant.profile || null,
      settings: { city: tenant.settings?.city || '', state: tenant.settings?.state || '' },
      responsiblePhone: tenant.responsiblePhone || '',
      priceMonthly: cur?.priceMonthly ?? null,
      billingCycle: tenant.billingCycle || 'monthly',
      paymentStatus: tenant.paymentStatus || null,
      nextBillingAt: tenant.nextBillingAt?.toMillis?.() || null,
      hasSubscription: !!tenant.asaasSubscriptionId,
      lastInvoiceUrl: tenant.lastInvoiceUrl || null,
      // Limites do plano ATUAL p/ a tela de Equipe mostrar "X de Y" por papel.
      seatLimits: curLimits ? {
        maxManagers: Number.isFinite(curLimits.maxManagers) ? curLimits.maxManagers : null,
        maxConsultants: Number.isFinite(curLimits.maxConsultants) ? curLimits.maxConsultants : null,
        extraUserPrice: cur?.extraUserPrice ?? null,
        maxExtraUsers: cur?.maxExtraUsers ?? null,
      } : null,
      invoices, availablePlans,
    });
  }

  // Self-service: o admin salva o Perfil da academia (campos de texto; logo
  // adiada). Grava em tenant.profile + cidade/UF (settings) + WhatsApp
  // (responsiblePhone) — exatamente as mesmas fontes do caminho do super-admin.
  if (req.method === 'POST' && req.body?.action === 'updateProfile') {
    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const profilePatch = sanitizeProfile(req.body.profile);
    if (profilePatch) patch.profile = profilePatch;
    const s = req.body.settings;
    if (s && typeof s === 'object') {
      const setS = {};
      if (s.city !== undefined) setS.city = String(s.city || '').trim().slice(0, 120);
      if (s.state !== undefined) setS.state = String(s.state || '').trim().toUpperCase().slice(0, 2);
      if (Object.keys(setS).length) patch.settings = setS;
    }
    if (req.body.responsiblePhone !== undefined) {
      patch.responsiblePhone = String(req.body.responsiblePhone || '').trim().slice(0, 30);
    }
    if (Object.keys(patch).length === 1) return res.status(400).json({ error: 'Nada para atualizar.' });
    await ref.set(patch, { merge: true });
    await audit('tenant.profile.self', auth.tenantId, auth.uid, { changed: Object.keys(patch).filter((k) => k !== 'updatedAt') });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST' && req.body?.action === 'migrate') {
    const newPlan = String(req.body.plan || '');
    const planDoc = plansMap.get(newPlan);
    if (!planDoc || planDoc.isActive === false) return res.status(400).json({ error: 'Plano inválido ou indisponível.' });
    if (newPlan === tenant.plan) return res.status(200).json({ ok: true, plan: newPlan });
    // Planos sob consulta (sem preço) não são auto-migráveis — evita loophole.
    if (!(Number(planDoc.priceMonthly) > 0)) return res.status(400).json({ error: 'Este plano é sob consulta — fale com o suporte para migrar.' });
    // Tem assinatura Asaas → ajusta o valor (vale no próximo ciclo). Senão, só
    // troca o plano. Consultores além do incluso no plano NOVO entram como
    // extras no valor (se o novo plano vender extras).
    if (tenant.asaasSubscriptionId && isAsaasConfigured()) {
      const cycle = tenant.billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';
      const seats = await getSeatUsage(auth.tenantId);
      const extraMonthly = extraConsultantsCharge(planDoc, seats.consultants);
      const base = cycle === 'YEARLY' ? Number(planDoc.priceAnnual) : Number(planDoc.priceMonthly);
      const value = base + (cycle === 'YEARLY' ? extraMonthly * 12 : extraMonthly);
      if (Number.isFinite(value) && value > 0) {
        try { await updateSubscription(tenant.asaasSubscriptionId, { value, cycle }); }
        catch (e) { console.error('self migrate', e?.message || e); return res.status(502).json({ error: `Asaas: ${e?.message || 'erro ao atualizar a assinatura.'}` }); }
      }
    }
    await ref.update({ plan: newPlan, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await audit('plan.migrate.self', auth.tenantId, auth.uid, { from: tenant.plan, to: newPlan });
    return res.status(200).json({ ok: true, plan: newPlan, priceMonthly: planDoc.priceMonthly ?? null });
  }

  // Self-service: ATIVA a 1ª assinatura ao fim do trial (tela de ativação). Cria
  // cliente + assinatura no Asaas e devolve o link da 1ª fatura. Valor vem do
  // catálogo dinâmico (priceMonthly/priceAnnual) + consultores extras; preço
  // negociado (monthlyPrice) tem prioridade. Mesma base do caminho super-admin.
  if (req.method === 'POST' && req.body?.action === 'activate') {
    if (!isAsaasConfigured()) return res.status(503).json({ error: 'Cobrança indisponível no momento. Fale com o suporte.' });
    const chosen = String(req.body.plan || tenant.plan || '');
    const planDoc = plansMap.get(chosen);
    if (!planDoc || planDoc.isActive === false) return res.status(400).json({ error: 'Plano inválido ou indisponível.' });
    const cpfCnpj = String(req.body.cpfCnpj || '').replace(/\D/g, '');
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) return res.status(400).json({ error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' });
    const cycle = req.body.cycle === 'annual' ? 'annual' : 'monthly';

    // Já tem assinatura → não duplica; devolve a fatura atual.
    if (tenant.asaasSubscriptionId) {
      return res.status(200).json({ ok: true, alreadyActive: true, invoiceUrl: tenant.lastInvoiceUrl || null });
    }

    const seats = await getSeatUsage(auth.tenantId);
    const negotiated = Number(tenant.monthlyPrice) > 0;
    const extraMonthly = negotiated ? 0 : extraConsultantsCharge(planDoc, seats.consultants);
    let value, cycleAsaas;
    if (cycle === 'annual') {
      value = Number(planDoc.priceAnnual); cycleAsaas = 'YEARLY';
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'Este plano não tem preço anual — escolha mensal ou fale com o suporte.' });
      value += extraMonthly * 12;
    } else {
      value = effectivePrice({ plan: chosen, monthlyPrice: tenant.monthlyPrice, consultantCount: seats.consultants }, plansMap);
      cycleAsaas = 'MONTHLY';
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'Este plano é sob consulta — fale com o suporte para ativar.' });
    }

    try {
      if (chosen !== tenant.plan) await ref.update({ plan: chosen, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      const customer = await findOrCreateCustomer({ tenantId: auth.tenantId, name: tenant.displayName, cpfCnpj, email: tenant.primaryAdminEmail, mobilePhone: tenant.responsiblePhone });
      const nextDueDate = ymd(Date.now()); // trial encerrado → cobra a partir de hoje
      const sub = await createSubscription({ customerId: customer.id, value, cycle: cycleAsaas, nextDueDate, description: `STRONILEAD — plano ${chosen}`, tenantId: auth.tenantId });
      let invoiceUrl = null, nextBillingMs = null;
      try { const pays = await listSubscriptionPayments(sub.id); const first = pays?.data?.[0]; if (first) { invoiceUrl = first.invoiceUrl || null; if (first.dueDate) nextBillingMs = new Date(first.dueDate + 'T12:00:00').getTime(); } } catch (e) { console.error('activate listPayments', e?.message || e); }
      await ref.update({
        asaasCustomerId: customer.id, asaasSubscriptionId: sub.id, billingProvider: 'asaas', billingCycle: cycle,
        paymentStatus: 'pending',
        ...(invoiceUrl ? { lastInvoiceUrl: invoiceUrl } : {}),
        ...(nextBillingMs ? { nextBillingAt: admin.firestore.Timestamp.fromMillis(nextBillingMs) } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await audit('asaas.subscription.activate.self', auth.tenantId, auth.uid, { plan: chosen, cycle, value, subscriptionId: sub.id });
      return res.status(200).json({ ok: true, invoiceUrl, plan: chosen, value, cycle });
    } catch (e) {
      console.error('self activate', e?.status, e?.message || e);
      return res.status(e?.status === 400 ? 400 : 502).json({ error: `Asaas: ${e?.message || 'erro ao ativar a assinatura.'}` });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}

export default async function handler(req, res) {
  // Webhook do Asaas chega com o header `asaas-access-token` (público, validado por token).
  if (req.headers['asaas-access-token'] !== undefined) return handleWebhook(req, res);
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (auth.superAdmin) return handleSubscription(req, res, auth);   // super-admin: gerencia qualquer tenant
  if (auth.tenantId) return handleTenantSelf(req, res, auth);       // admin do tenant: self-service na própria assinatura
  return res.status(403).json({ error: 'Sem permissão.' });
}
