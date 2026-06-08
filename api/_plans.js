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

// Preço efetivo de uma organização: usa o override por-tenant (monthlyPrice)
// quando definido (número finito ≥ 0), senão o preço do plano. Base do MRR.
export function effectivePrice(tenant) {
  const override = Number(tenant?.monthlyPrice);
  if (Number.isFinite(override) && override >= 0) return override;
  return planPrice(tenant?.plan);
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
  { slug: 'starter',    name: 'Starter',    maxUsers: 3,    priceMonthly: 97,  order: 0, isDefault: true },
  { slug: 'pro',        name: 'Pro',        maxUsers: 10,   priceMonthly: 197, order: 1, isDefault: false },
  { slug: 'enterprise', name: 'Enterprise', maxUsers: null, priceMonthly: 397, order: 2, isDefault: false },
];

// maxUsers efetivo de um doc de plano: null/undefined = ilimitado → Infinity
// (para a comparação de seats). Retorna null quando não há doc (sinaliza
// "use o fallback sync").
export function planDocMaxUsers(planDoc) {
  if (!planDoc) return null;
  return planDoc.maxUsers == null ? Infinity : Number(planDoc.maxUsers);
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

// Lê o plano do tenant (default 'starter') e conta os usuários atuais.
// maxUsers resolve do plano DINÂMICO (coleção plans/) com fallback hard-coded.
// Retorna { plan, maxUsers, currentUsers, atLimit } — MESMA forma de antes
// (admin-create-user.js depende disto).
export async function getSeatUsage(tenantId) {
  const [tenantSnap, countSnap, plans] = await Promise.all([
    adminDb.collection('tenants').doc(tenantId).get(),
    usersCol(tenantId).count().get(),
    loadPlans(),
  ]);
  const plan = (tenantSnap.exists && tenantSnap.data()?.plan) || 'starter';
  const dynMax = planDocMaxUsers(plans.get(plan));
  const maxUsers = dynMax == null ? planMaxUsers(plan) : dynMax;
  const currentUsers = countSnap.data().count || 0;
  return { plan, maxUsers, currentUsers, atLimit: currentUsers >= maxUsers };
}

// Mensagem padronizada de limite atingido.
export function seatLimitMessage(plan, maxUsers) {
  return `Limite do plano ${plan} atingido (${maxUsers} usuário${maxUsers === 1 ? '' : 's'}). Faça upgrade do plano para adicionar mais.`;
}
