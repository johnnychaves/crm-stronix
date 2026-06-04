import { adminDb, verifyRequest } from './_firebaseAdmin.js';
import { effectivePrice } from './_plans.js';

// Visão agregada da plataforma para o painel super-admin — SUPER-ADMIN only.
// Usa o Admin SDK (o super-admin não lê /artifacts de outro tenant pelas rules).
// Por tenant: contagens (users/leads/interactions) via aggregation count() e a
// última atividade (interação mais recente). Nos totais: orgs por status, MRR
// estimado, somas e trials vencendo. Custo linear no nº de tenants — ok para a
// escala atual (poucos clientes); denormalizar contadores se crescer muito.
//
// Vercel serverless function.

const dataCol = (tenantId, name) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(name);

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

// Contagem barata via aggregation; tenants legados podem falhar — não bloqueia.
async function countOr(col) {
  try { return (await col.count().get()).data().count || 0; }
  catch { return 0; }
}

// Última atividade = interação mais recente. orderBy num único campo usa índice
// single-field automático (sem índice composto). Best-effort.
async function lastInteractionMillis(tenantId) {
  try {
    const snap = await dataCol(tenantId, 'stronix_interactions')
      .orderBy('createdAt', 'desc').limit(1).get();
    return snap.empty ? null : toMillis(snap.docs[0].data()?.createdAt);
  } catch (err) {
    console.error('super-overview lastActivity', tenantId, err?.message || err);
    return null;
  }
}

async function tenantMetrics(doc) {
  const id = doc.id;
  const data = doc.data() || {};
  const [userCount, leadCount, interactionCount, lastInteractionMs] = await Promise.all([
    countOr(dataCol(id, 'stronix_users')),
    countOr(dataCol(id, 'stronix_leads')),
    countOr(dataCol(id, 'stronix_interactions')),
    lastInteractionMillis(id),
  ]);
  const createdAt = toMillis(data.createdAt);
  const plan = data.plan || 'starter';
  const monthlyPrice = typeof data.monthlyPrice === 'number' ? data.monthlyPrice : null;
  // Piso de atividade na criação do tenant: cliente recém-criado sem interação
  // NÃO é "em risco" — é novo. O front usa isto para o badge de saúde.
  const lastActivityAt = Math.max(lastInteractionMs || 0, createdAt || 0) || null;
  return {
    id,
    displayName: data.displayName || id,
    status: data.status || 'active',
    plan,
    archived: data.archived === true,
    trialEndsAt: toMillis(data.trialEndsAt),
    createdAt,
    primaryAdminEmail: data.primaryAdminEmail || null,
    monthlyPrice,
    internalNotes: data.internalNotes || '',
    price: effectivePrice({ plan, monthlyPrice }),
    userCount,
    leadCount,
    interactionCount,
    lastActivityAt,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode ver a visão geral.' });
  }

  try {
    const snap = await adminDb.collection('tenants').get();
    const tenants = await Promise.all(snap.docs.map(tenantMetrics));
    tenants.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const now = Date.now();
    const DAY = 86400000;
    const RISK_DAYS = 14; // cliente ativo/trial sem atividade há +14 dias = risco de churn
    const totals = {
      total: tenants.length,
      active: 0, trial: 0, suspended: 0, archived: 0,
      mrr: 0,
      atRisk: 0,          // clientes ativos/trial sem uso há RISK_DAYS+ dias
      leads: 0, interactions: 0, users: 0, // somas brutas (não exibidas como KPI; uso interno/futuro)
      trialsExpiring: [], // { id, displayName, trialEndsAt, daysLeft }
      newByMonth: [],     // últimos 6 meses [{ ym, label, count }]
    };

    for (const t of tenants) {
      if (t.archived) totals.archived += 1;
      else if (t.status === 'trial') totals.trial += 1;
      else if (t.status === 'suspended') totals.suspended += 1;
      else totals.active += 1;

      totals.leads += t.leadCount;
      totals.interactions += t.interactionCount;
      totals.users += t.userCount;

      // MRR = receita recorrente real: só organizações ativas e pagantes.
      // Trials (ainda não pagam) e suspensas/arquivadas não entram.
      if (!t.archived && t.status === 'active') totals.mrr += t.price || 0;

      // Clientes em risco (churn): ativos/trial sem atividade há RISK_DAYS+ dias.
      // Arquivadas e suspensas não contam (já não são clientes ativos).
      if (!t.archived && (t.status === 'active' || t.status === 'trial')) {
        if (!t.lastActivityAt || now - t.lastActivityAt > RISK_DAYS * DAY) totals.atRisk += 1;
      }

      // Trials vencendo nos próximos 7 dias (inclui os que vencem hoje/atrasados).
      if (!t.archived && t.status === 'trial' && t.trialEndsAt && t.trialEndsAt - now <= 7 * DAY) {
        totals.trialsExpiring.push({
          id: t.id, displayName: t.displayName, trialEndsAt: t.trialEndsAt,
          daysLeft: Math.ceil((t.trialEndsAt - now) / DAY),
        });
      }
    }
    totals.trialsExpiring.sort((a, b) => a.trialEndsAt - b.trialEndsAt);

    // Novas organizações por mês (últimos 6, incluindo o atual) a partir de createdAt.
    const base = new Date(now);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ ym, label: d.toLocaleDateString('pt-BR', { month: 'short' }), count: 0 });
    }
    const monthIndex = Object.fromEntries(months.map((m, i) => [m.ym, i]));
    for (const t of tenants) {
      if (!t.createdAt) continue;
      const d = new Date(t.createdAt);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (ym in monthIndex) months[monthIndex[ym]].count += 1;
    }
    totals.newByMonth = months;

    return res.status(200).json({ totals, tenants });
  } catch (error) {
    console.error('super-overview', error);
    return res.status(500).json({ error: 'Erro ao montar a visão geral.' });
  }
}
