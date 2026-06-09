import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { logAudit } from './_audit.js';
import { loadPlans, getSeatUsage } from './_plans.js';

// Atualiza status / plano / cobrança / perfil de uma organização — SUPERADMIN only.
//
// POST body (todos opcionais exceto tenantId):
//   - status: 'active' | 'suspended'   (ao suspender, revoga refresh tokens)
//   - plan:   slug de um plano EXISTENTE (validado contra a coleção plans/)
//   - trialDays: number  (>0 reinicia trial a partir de agora; 0/null encerra)
//   - archived, internal, internalNotes, monthlyPrice  (já existiam)
//   - displayName, settings { city, state, logoUrl }
//   - paymentStatus: 'paid' | 'pending' | 'overdue' | null   (cobrança manual)
//   - lastPaymentAt, nextBillingAt: millis (number) | null
//   NUNCA altera tenantId (imutável).
//
// Vercel serverless function (não Express) — consistente com os demais api/.

const USERS_PATH = 'stronix_users';
const STATUSES = ['active', 'suspended'];
const PAYMENT_STATUSES = ['paid', 'pending', 'overdue'];

const usersCollection = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(USERS_PATH);

const dataCol = (tenantId, name) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(name);

// Revoga os refresh tokens de todos os usuários do tenant. Coleta uids tanto do
// id do doc quanto do campo authUid (legado). Best-effort por usuário.
async function revokeAllTenantTokens(tenantId) {
  const snap = await usersCollection(tenantId).get();
  const uids = new Set();
  snap.forEach((d) => {
    if (d.id) uids.add(d.id);
    const authUid = d.data()?.authUid;
    if (authUid) uids.add(authUid);
  });
  let revoked = 0;
  for (const uid of uids) {
    try {
      await adminAuth.revokeRefreshTokens(uid);
      revoked += 1;
    } catch (err) {
      console.error(`tenant-status: falha ao revogar tokens de ${uid}`, err?.message || err);
    }
  }
  return revoked;
}

// millis (number) | null | '' → Timestamp | null. Retorna undefined p/ valor
// inválido (sinaliza "não mexer no campo").
function toTimestampOrNull(v) {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return admin.firestore.Timestamp.fromMillis(n);
}

export default async function handler(req, res) {
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode acessar organizações.' });
  }

  // GET ?tenantId=... → estatísticas de uso da organização. (Antes era o endpoint
  // /api/tenant-stats; fundido aqui para caber no limite de 12 funções do Hobby.)
  if (req.method === 'GET') {
    const tid = String(req.query?.tenantId || '').trim().toLowerCase();
    if (!tid) return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });
    try {
      const [seats, leadCountSnap, interactionCountSnap] = await Promise.all([
        getSeatUsage(tid),
        dataCol(tid, 'stronix_leads').count().get(),
        dataCol(tid, 'stronix_interactions').count().get(),
      ]);
      return res.status(200).json({
        tenantId: tid, plan: seats.plan,
        maxUsers: seats.maxUsers === Infinity ? null : seats.maxUsers,
        userCount: seats.currentUsers,
        leadCount: leadCountSnap.data().count || 0,
        interactionCount: interactionCountSnap.data().count || 0,
      });
    } catch (err) {
      console.error('tenant-status GET stats:', err?.message || err);
      return res.status(500).json({ error: 'Erro ao obter estatísticas da organização.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      tenantId, status, plan, trialDays, archived, internal, internalNotes, monthlyPrice,
      displayName, settings, paymentStatus, lastPaymentAt, nextBillingAt,
    } = req.body || {};
    const slug = String(tenantId || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });

    const ref = adminDb.collection('tenants').doc(slug);
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ error: `Organização "${slug}" não encontrada.` });
    }

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let statusChanged = false;

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: "status deve ser 'active' ou 'suspended'." });
      }
      update.status = status;
      statusChanged = true;
    }
    if (plan !== undefined) {
      // Plano validado contra a coleção DINÂMICA plans/ (fallback p/ os 3 hard-coded).
      const plans = await loadPlans();
      if (!plans.has(String(plan))) {
        return res.status(400).json({ error: `Plano "${plan}" não existe.` });
      }
      update.plan = String(plan);
    }
    if (trialDays !== undefined) {
      const days = Number(trialDays);
      update.trialEndsAt = Number.isFinite(days) && days > 0
        ? admin.firestore.Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;
    }
    // Desativar/arquivar (soft-delete): arquivar bloqueia o acesso (status
    // 'suspended' é negado pelas rules) e sai da lista de ativas; restaurar reativa.
    if (archived !== undefined) {
      update.archived = archived === true;
      if (update.archived) { update.status = 'suspended'; statusChanged = true; }
      else if (status === undefined) { update.status = 'active'; statusChanged = true; }
    }
    // Conta interna/teste: fica fora dos KPIs de negócio. Não muda acesso/status.
    if (internal !== undefined) {
      update.internal = internal === true;
    }
    // Notas internas (CRM do dono sobre o cliente) — só o super-admin lê/escreve.
    if (internalNotes !== undefined) {
      update.internalNotes = String(internalNotes || '').slice(0, 2000);
    }
    // Preço mensal por cliente (override do preço do plano; vazio/null = usa o plano).
    if (monthlyPrice !== undefined) {
      if (monthlyPrice === null || monthlyPrice === '') {
        update.monthlyPrice = null;
      } else {
        const p = Number(monthlyPrice);
        if (!Number.isFinite(p) || p < 0) {
          return res.status(400).json({ error: 'monthlyPrice deve ser um número ≥ 0 (ou vazio para usar o preço do plano).' });
        }
        update.monthlyPrice = p;
      }
    }
    // Nome de exibição (não pode ficar vazio se enviado).
    if (displayName !== undefined) {
      const name = String(displayName || '').trim();
      if (!name) return res.status(400).json({ error: 'displayName não pode ficar vazio.' });
      update.displayName = name.slice(0, 120);
    }
    // settings.{city,state,logoUrl} — merge parcial (set merge:true preserva as
    // outras chaves de settings).
    if (settings && typeof settings === 'object') {
      const s = {};
      if (settings.city !== undefined) s.city = String(settings.city || '').slice(0, 120);
      if (settings.state !== undefined) s.state = String(settings.state || '').slice(0, 60);
      if (settings.logoUrl !== undefined) s.logoUrl = String(settings.logoUrl || '').slice(0, 500);
      if (Object.keys(s).length) update.settings = s;
    }
    // Cobrança manual (ainda sem gateway de pagamento).
    if (paymentStatus !== undefined) {
      if (paymentStatus === null || paymentStatus === '') {
        update.paymentStatus = null;
      } else if (!PAYMENT_STATUSES.includes(paymentStatus)) {
        return res.status(400).json({ error: "paymentStatus deve ser 'paid', 'pending', 'overdue' ou vazio." });
      } else {
        update.paymentStatus = paymentStatus;
      }
    }
    if (lastPaymentAt !== undefined) {
      const ts = toTimestampOrNull(lastPaymentAt);
      if (ts !== undefined) update.lastPaymentAt = ts;
    }
    if (nextBillingAt !== undefined) {
      const ts = toTimestampOrNull(nextBillingAt);
      if (ts !== undefined) update.nextBillingAt = ts;
    }

    // Marca quando o status mudou — base do "churn nos últimos 30 dias" no
    // painel financeiro (tenants existentes sem este campo não contam: métrica
    // forward-looking).
    if (statusChanged) {
      update.statusChangedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    await ref.set(update, { merge: true });

    await logAudit({
      action: 'tenant.update', tenantId: slug, actorUid: auth.uid,
      details: { changed: Object.keys(update).filter((k) => k !== 'updatedAt') },
    });

    // Ao suspender, derruba as sessões ativas imediatamente.
    let revoked = 0;
    if (update.status === 'suspended') {
      revoked = await revokeAllTenantTokens(slug);
    }

    return res.status(200).json({ ok: true, tenantId: slug, status: update.status, revokedSessions: revoked });
  } catch (error) {
    console.error('tenant-status', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar organização.' });
  }
}
