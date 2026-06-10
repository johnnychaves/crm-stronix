import { adminDb, admin } from './_firebaseAdmin.js';

// Limites por plano (seats = nº de usuários da organização).
// Enterprise = ilimitado. Leads NÃO são limitados (dado central da academia).
// FALLBACK hard-coded: usado quando a coleção dinâmica `plans/` está vazia ou
// a leitura falha (ver loadPlans). Mantido p/ retrocompatibilidade total.
export const PLAN_LIMITS = {
  starter: { maxUsers: 3 },
  pro: { maxUsers: 10 },
  enterprise: { maxUsers: Infinity },
};

export function planMaxUsers(plan) {
  return (PLAN_LIMITS[plan] || PLAN_LIMITS.starter).maxUsers;
}

// Preço mensal por plano (BRL) — base para o MRR estimado no painel super-admin.
// Pode ser sobrescrito por organização (ex.: desconto negociado) via campo
// `monthlyPrice` no doc /tenants/{id}, tratado em effectivePrice().
export const PLAN_PRICES = {
  starter: 97,
  pro: 197,
  enterprise: 397,
};

export function planPrice(plan) {
  return PLAN_PRICES[plan] ?? PLAN_PRICES.starter;
}

// Preço efetivo de uma organização (base do MRR). Ordem de precedência:
//  1) override por-tenant (monthlyPrice, ex.: desconto negociado) — é o valor
//     FINAL fechado com o cliente: extras NÃO somam por cima;
//  2) preço ATUAL do catálogo dinâmico (plansMap.get(plan).priceMonthly)
//     + consultores EXTRAS faturáveis (modelo gestor+consultores, ver abaixo);
//  3) fallback hard-coded (planPrice) — retrocompat starter/pro/enterprise.
// plansMap = Map de loadPlans(); é OPCIONAL (sem ele, cai direto no fallback,
// preservando o comportamento antigo). tenant.consultantCount é OPCIONAL —
// sem ele, extras não são computados (comportamento antigo).
export function effectivePrice(tenant, plansMap) {
  const override = Number(tenant?.monthlyPrice);
  if (Number.isFinite(override) && override >= 0) return override;
  const planDoc = plansMap?.get?.(tenant?.plan);
  const catalog = Number(planDoc?.priceMonthly);
  if (Number.isFinite(catalog) && catalog >= 0) {
    return catalog + extraConsultantsCharge(planDoc, tenant?.consultantCount);
  }
  return planPrice(tenant?.plan);
}

// Valor mensal dos consultores EXTRAS (além dos inclusos no plano).
// Só cobra quando o plano define extraUserPrice; respeita maxExtraUsers.
export function billableExtraConsultants(planDoc, consultantCount) {
  if (!planDoc || consultantCount == null) return 0;
  const { maxConsultants } = planSeatLimits(planDoc);
  if (!Number.isFinite(maxConsultants)) return 0; // ilimitado → nunca há extra
  const price = Number(planDoc.extraUserPrice);
  if (!Number.isFinite(price) || price <= 0) return 0;
  let extras = Math.max(0, Number(consultantCount) - maxConsultants);
  const cap = planDoc.maxExtraUsers == null ? null : Number(planDoc.maxExtraUsers);
  if (cap != null && Number.isFinite(cap)) extras = Math.min(extras, Math.max(0, cap));
  return extras;
}

export function extraConsultantsCharge(planDoc, consultantCount) {
  const extras = billableExtraConsultants(planDoc, consultantCount);
  return extras > 0 ? extras * Number(planDoc.extraUserPrice) : 0;
}

// ===========================================================================
// Planos dinâmicos (coleção raiz `plans/`)
// ---------------------------------------------------------------------------
// Os planos viraram editáveis pelo painel super-admin. Esta camada lê a
// coleção `plans/` e, se ela estiver vazia ou a leitura falhar, cai no
// FALLBACK hard-coded acima — então tudo continua funcionando mesmo antes do
// 1º seed e 100% retrocompatível com tenants existentes (starter/pro/enterprise).
// ===========================================================================

export const PLANS_COLLECTION = 'plans';

// Definição-semente dos 3 planos atuais (mesmos slugs/limites/preços do fallback).
// maxUsers null = ilimitado (no doc do Firestore); Infinity existe só em memória.
export const DEFAULT_PLAN_SEED = [
  { slug: 'starter',    name: 'Starter',    maxManagers: 1,    maxConsultants: 2,    maxUsers: 3,    priceMonthly: 97,  order: 0, isDefault: true },
  { slug: 'pro',        name: 'Pro',        maxManagers: 1,    maxConsultants: 9,    maxUsers: 10,   priceMonthly: 197, order: 1, isDefault: false },
  { slug: 'enterprise', name: 'Enterprise', maxManagers: null, maxConsultants: null, maxUsers: null, priceMonthly: 397, order: 2, isDefault: false },
];

// maxUsers efetivo de um doc de plano: null/undefined = ilimitado → Infinity
// (para a comparação de seats). Retorna null quando não há doc (sinaliza
// "use o fallback sync").
export function planDocMaxUsers(planDoc) {
  if (!planDoc) return null;
  return planDoc.maxUsers == null ? Infinity : Number(planDoc.maxUsers);
}

// ===========================================================================
// Modelo de vagas GESTOR + CONSULTORES
// ---------------------------------------------------------------------------
// O plano define vagas por PAPEL: maxManagers (gestores, role 'admin') e
// maxConsultants (consultores inclusos). null = ilimitado. Planos legados (só
// maxUsers) derivam: 1 gestor + (maxUsers-1) consultores — mesma conta total.
// Consultores ALÉM do incluso podem entrar como EXTRAS pagos quando o plano
// define extraUserPrice (até maxExtraUsers) — cobrados em effectivePrice().
// ===========================================================================

export function planSeatLimits(planDoc) {
  const inf = (v) => (v == null ? Infinity : Math.max(0, Math.floor(Number(v))));
  if (planDoc && (planDoc.maxManagers !== undefined || planDoc.maxConsultants !== undefined)) {
    return { maxManagers: inf(planDoc.maxManagers), maxConsultants: inf(planDoc.maxConsultants) };
  }
  // Legado (doc sem os campos novos) ou fallback hard-coded via slug.
  const total = planDoc ? planDocMaxUsers(planDoc) : null;
  const t = total == null ? null : total;
  if (t == null) return null; // sem doc → o chamador resolve pelo fallback de slug
  if (!Number.isFinite(t)) return { maxManagers: Infinity, maxConsultants: Infinity };
  return { maxManagers: 1, maxConsultants: Math.max(0, t - 1) };
}

// Limites por papel a partir do SLUG no fallback hard-coded (coleção vazia).
function fallbackSeatLimits(plan) {
  const total = planMaxUsers(plan);
  if (!Number.isFinite(total)) return { maxManagers: Infinity, maxConsultants: Infinity };
  return { maxManagers: 1, maxConsultants: Math.max(0, total - 1) };
}

// Lê todos os planos da coleção `plans/` num Map por slug. SEM cache entre
// invocações (edição de plano reflete na hora). Fallback para os planos
// hard-coded quando a coleção está vazia ou a leitura falha.
export async function loadPlans() {
  const map = new Map();
  try {
    const snap = await adminDb.collection(PLANS_COLLECTION).get();
    snap.forEach((d) => {
      const data = d.data() || {};
      const slug = data.slug || d.id;
      if (slug) map.set(slug, { id: d.id, ...data });
    });
  } catch (err) {
    console.error('loadPlans', err?.message || err);
  }
  if (map.size === 0) {
    for (const p of DEFAULT_PLAN_SEED) map.set(p.slug, { ...p });
  }
  return map;
}

// Semeia os 3 planos atuais na coleção `plans/` — SÓ se ela estiver vazia.
// Idempotente: chamadas repetidas não duplicam. Doc id = slug (estável).
export async function ensurePlansSeeded() {
  const probe = await adminDb.collection(PLANS_COLLECTION).limit(1).get();
  if (!probe.empty) return { seeded: false };
  const batch = adminDb.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const p of DEFAULT_PLAN_SEED) {
    batch.set(adminDb.collection(PLANS_COLLECTION).doc(p.slug), {
      name: p.name, slug: p.slug, maxUsers: p.maxUsers,
      maxManagers: p.maxManagers, maxConsultants: p.maxConsultants,
      priceMonthly: p.priceMonthly, priceAnnual: null,
      extraUserPrice: null, maxExtraUsers: null,
      isActive: true, isDefault: !!p.isDefault, order: p.order,
      features: [], createdAt: now, updatedAt: now,
    });
  }
  await batch.commit();
  return { seeded: true, count: DEFAULT_PLAN_SEED.length };
}

const usersCol = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection('stronix_users');

// Lê o plano do tenant (default 'starter') e conta os usuários POR PAPEL.
// Gestor = role 'admin'; consultor = todo o resto (docs legados sem `role`
// contam como consultor — mais seguro para o limite). Mantém os campos
// legados { maxUsers, currentUsers, atLimit } para retrocompatibilidade.
export async function getSeatUsage(tenantId) {
  const [tenantSnap, totalSnap, managersSnap, plans] = await Promise.all([
    adminDb.collection('tenants').doc(tenantId).get(),
    usersCol(tenantId).count().get(),
    usersCol(tenantId).where('role', '==', 'admin').count().get(),
    loadPlans(),
  ]);
  const plan = (tenantSnap.exists && tenantSnap.data()?.plan) || 'starter';
  const planDoc = plans.get(plan) || null;
  const limits = planSeatLimits(planDoc) || fallbackSeatLimits(plan);

  const currentUsers = totalSnap.data().count || 0;
  const managers = managersSnap.data().count || 0;
  const consultants = Math.max(0, currentUsers - managers);

  const extraUserPrice = Number(planDoc?.extraUserPrice);
  const hasExtraSlots = Number.isFinite(extraUserPrice) && extraUserPrice > 0;
  const maxExtraUsers = planDoc?.maxExtraUsers == null ? null : Number(planDoc.maxExtraUsers);
  const extraConsultants = billableExtraConsultants(planDoc, consultants);

  const dynMax = planDocMaxUsers(planDoc);
  const maxUsers = dynMax == null ? planMaxUsers(plan) : dynMax;

  return {
    plan,
    managers, consultants,
    maxManagers: limits.maxManagers,
    maxConsultants: limits.maxConsultants,
    extraUserPrice: hasExtraSlots ? extraUserPrice : null,
    maxExtraUsers,
    extraConsultants,
    // legado
    maxUsers, currentUsers, atLimit: currentUsers >= maxUsers,
  };
}

// Pode adicionar um usuário com este papel? Centraliza a regra dos endpoints
// (create-user / invite-create / invite-accept). Retorna:
//   { ok:true, isExtra? }                                → pode criar
//   { ok:false, code:'managers_limit'|'consultants_limit', error }
//   { ok:false, code:'extra_confirm', extraUserPrice, error }  → cabe como
//     EXTRA pago, mas o chamador precisa confirmar (allowExtra=true).
export function canAddSeat(seats, role, { allowExtra = false } = {}) {
  if (role === 'admin') {
    if (seats.managers < seats.maxManagers) return { ok: true };
    const max = seats.maxManagers;
    return {
      ok: false, code: 'managers_limit',
      error: `Seu plano ${seats.plan} inclui ${max} gestor${max === 1 ? '' : 'es'}. Para adicionar outro gestor, faça upgrade do plano.`,
    };
  }
  // consultor
  if (seats.consultants < seats.maxConsultants) return { ok: true };
  const canBuyExtra = seats.extraUserPrice != null
    && (seats.maxExtraUsers == null || (seats.consultants - seats.maxConsultants) < seats.maxExtraUsers);
  if (canBuyExtra) {
    if (allowExtra) return { ok: true, isExtra: true };
    return {
      ok: false, code: 'extra_confirm', extraUserPrice: seats.extraUserPrice,
      error: `Os ${seats.maxConsultants} consultores inclusos no plano ${seats.plan} já foram usados. É possível adicionar como consultor extra por R$ ${seats.extraUserPrice}/mês.`,
    };
  }
  return {
    ok: false, code: 'consultants_limit',
    error: `Limite de consultores do plano ${seats.plan} atingido (${Number.isFinite(seats.maxConsultants) ? seats.maxConsultants : 'ilimitado'}${seats.maxExtraUsers != null ? ` + ${seats.maxExtraUsers} extras` : ''}). Faça upgrade do plano para adicionar mais.`,
  };
}
