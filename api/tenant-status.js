import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';

// Atualiza o status/plano de uma organização — SUPERADMIN only.
//
// POST body: { tenantId, status?, plan?, trialDays? }
//   - status: 'active' | 'suspended'  (ao suspender, revoga os refresh tokens
//     de todos os usuários do tenant → forçados a re-logar; o app bloqueia o
//     acesso quando lê status === 'suspended').
//   - plan:   'starter' | 'pro' | 'enterprise'  (opcional, altera o plano)
//   - trialDays: number  (opcional; >0 reinicia o trial a partir de agora,
//     0/null encerra o trial)
//
// Vercel serverless function (não Express) — consistente com os demais api/.

const USERS_PATH = 'stronix_users';
const PLANS = ['starter', 'pro', 'enterprise'];
const STATUSES = ['active', 'suspended'];

const usersCollection = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(USERS_PATH);

// Revoga os refresh tokens de todos os usuários do tenant. Coleta uids tanto
// do id do doc (padrão dos usuários criados pelo provisionamento) quanto do
// campo authUid (usuários legados). Best-effort por usuário.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode alterar organizações.' });
  }

  try {
    const { tenantId, status, plan, trialDays, archived } = req.body || {};
    const slug = String(tenantId || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });

    const ref = adminDb.collection('tenants').doc(slug);
    const existing = await ref.get();
    if (!existing.exists) {
      return res.status(404).json({ error: `Organização "${slug}" não encontrada.` });
    }

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: "status deve ser 'active' ou 'suspended'." });
      }
      update.status = status;
    }
    if (plan !== undefined) {
      if (!PLANS.includes(plan)) {
        return res.status(400).json({ error: "plan deve ser 'starter', 'pro' ou 'enterprise'." });
      }
      update.plan = plan;
    }
    if (trialDays !== undefined) {
      const days = Number(trialDays);
      update.trialEndsAt = Number.isFinite(days) && days > 0
        ? admin.firestore.Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;
    }
    // Desativar/arquivar (soft-delete): arquivar bloqueia o acesso (status
    // 'suspended' já é negado pelas rules) e sai da lista de ativas; restaurar
    // reativa. Reversível, preserva todos os dados.
    if (archived !== undefined) {
      update.archived = archived === true;
      if (update.archived) {
        update.status = 'suspended';
      } else if (status === undefined) {
        update.status = 'active';
      }
    }

    if (Object.keys(update).length === 1) {
      return res.status(400).json({ error: 'Nada para atualizar (informe status, plan e/ou trialDays).' });
    }

    await ref.set(update, { merge: true });

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
