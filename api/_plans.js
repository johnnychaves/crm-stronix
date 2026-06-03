import { adminDb } from './_firebaseAdmin.js';

// Limites por plano (seats = nº de usuários da organização).
// Enterprise = ilimitado. Leads NÃO são limitados (dado central da academia).
export const PLAN_LIMITS = {
  starter: { maxUsers: 3 },
  pro: { maxUsers: 10 },
  enterprise: { maxUsers: Infinity },
};

export function planMaxUsers(plan) {
  return (PLAN_LIMITS[plan] || PLAN_LIMITS.starter).maxUsers;
}

// Preço mensal por plano (BRL) — base para o MRR estimado no painel super-admin.
// PLACEHOLDER: ajuste para os valores reais que você cobra. Pode ser sobrescrito
// por organização (ex.: desconto negociado) via campo `monthlyPrice` no doc
// /tenants/{id}, tratado em effectivePrice().
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

const usersCol = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection('stronix_users');

// Lê o plano do tenant (default 'starter') e conta os usuários atuais.
// Retorna { plan, maxUsers, currentUsers, atLimit }.
export async function getSeatUsage(tenantId) {
  const [tenantSnap, countSnap] = await Promise.all([
    adminDb.collection('tenants').doc(tenantId).get(),
    usersCol(tenantId).count().get(),
  ]);
  const plan = (tenantSnap.exists && tenantSnap.data()?.plan) || 'starter';
  const maxUsers = planMaxUsers(plan);
  const currentUsers = countSnap.data().count || 0;
  return { plan, maxUsers, currentUsers, atLimit: currentUsers >= maxUsers };
}

// Mensagem padronizada de limite atingido.
export function seatLimitMessage(plan, maxUsers) {
  return `Limite do plano ${plan} atingido (${maxUsers} usuário${maxUsers === 1 ? '' : 's'}). Faça upgrade do plano para adicionar mais.`;
}
