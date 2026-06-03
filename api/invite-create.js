import { randomUUID } from 'node:crypto';
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage, seatLimitMessage } from './_plans.js';
import { isTenantAdmin } from './_auth.js';

// Cria um convite para adicionar um usuário (admin ou consultor) ao tenant.
// ADMIN do tenant only. Vercel serverless function.
//
// POST body: { email, role }  (role: 'admin' | 'consultant')
// Retorna { inviteId, token, tenantId, expiresAt } — o app monta o link
// /?invite=<token>&t=<tenantId> e o admin envia ao convidado.

const ROLES = ['admin', 'consultant'];
const INVITE_TTL_DAYS = 7;

const invitesCollection = (tenantId) =>
  adminDb.collection('tenants').doc(tenantId).collection('invites');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode convidar usuários.' });
    }

    const { email, role } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = ROLES.includes(role) ? role : 'consultant';

    if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }

    // Limite de seats por plano: não adianta convidar se já está no limite.
    const seats = await getSeatUsage(auth.tenantId);
    if (seats.currentUsers >= seats.maxUsers) {
      return res.status(403).json({ error: seatLimitMessage(seats.plan, seats.maxUsers) });
    }

    const token = randomUUID();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const ref = await invitesCollection(auth.tenantId).add({
      email: normalizedEmail,
      role: normalizedRole,
      token,
      status: 'pending',
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.uid
    });

    return res.status(200).json({
      ok: true,
      inviteId: ref.id,
      token,
      tenantId: auth.tenantId,
      email: normalizedEmail,
      role: normalizedRole,
      expiresAt: expiresAt.toMillis()
    });
  } catch (error) {
    console.error('invite-create', error);
    return res.status(500).json({ error: 'Erro interno ao criar convite.' });
  }
}
