const slugify = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40);

// Limites de seats por plano (espelha api/_plans.js) — só p/ exibição no painel.
const PLAN_MAX_USERS = { starter: 3, pro: 10, enterprise: Infinity };
const planLabel = (p) => ({ starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }[p] || p || 'starter');
const tenantSeatLabel = (t) => {
  if (typeof t.userCount !== 'number') return null;
  const max = PLAN_MAX_USERS[t.plan] ?? 3;
  return max === Infinity ? `${t.userCount} usuários` : `${t.userCount}/${max} seats`;
};

// "Entrar como" (impersonação): o token de retorno + dados do cliente ficam no
// sessionStorage (escopo da aba). É a fonte de verdade do banner — ver o App
// (banner + "sair") e o SuperAdminView (o "entrar").
const IMPERSONATION_KEY = 'crm-impersonation';
const readImpersonation = () => {
  try { return JSON.parse(sessionStorage.getItem(IMPERSONATION_KEY) || 'null'); }
  catch { return null; }
};

// Saúde do cliente pela última atividade: ativo ≤7d, ocioso 8–14d, em risco >14d
// (alinhado ao KPI "Clientes em risco"). Usado nos badges da lista e do modal.
const HEALTH = {
  active: { key: 'active', label: 'Ativo',    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  idle:   { key: 'idle',   label: 'Ocioso',   cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  risk:   { key: 'risk',   label: 'Em risco', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
};
const tenantHealth = (lastActivityAt) => {
  if (!lastActivityAt) return HEALTH.risk;
  const days = (Date.now() - lastActivityAt) / 86400000;
  if (days <= 7) return HEALTH.active;
  if (days <= 14) return HEALTH.idle;
  return HEALTH.risk;
};
// Rótulo curto da última atividade ("há X dias").
const lastActivityLabel = (ms) => {
  if (!ms) return 'sem atividade registrada';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'ativo hoje';
  if (days === 1) return 'última atividade ontem';
  return `última atividade há ${days} dias`;
};

// Descrição legível de uma entrada do log de auditoria do super-admin.
const auditActionLabel = (e) => {
  const t = e.tenantId || '—';
  switch (e.action) {
    case 'impersonate.start': return `Entrou como ${e.details?.tenantName || t}`;
    case 'tenant.provision': return `Criou a organização ${e.details?.displayName || t}`;
    case 'tenant.update': {
      const ch = (e.details?.changed || []).join(', ');
      return `Atualizou ${t}${ch ? ` (${ch})` : ''}`;
    }
    default: return `${e.action} · ${t}`;
  }
};
export { slugify, PLAN_MAX_USERS, planLabel, tenantSeatLabel, IMPERSONATION_KEY, readImpersonation, HEALTH, tenantHealth, lastActivityLabel, auditActionLabel };
