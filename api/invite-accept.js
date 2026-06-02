import { adminAuth, adminDb, admin } from './_firebaseAdmin.js';

// Aceita um convite e cria a conta do usuário no tenant. PÚBLICO (o token UUID
// é o segredo). Vercel serverless function.
//
// POST body: { tenantId, token, password, name }
//   - O e-mail é tirado do convite (não do body) — evita troca de e-mail.
//   - Cria o usuário no Firebase Auth com o e-mail do convite + senha informada,
//     seta o claim { tenantId }, cria o doc em stronix_users e marca o convite
//     como aceito.

const USERS_PATH = 'stronix_users';

const usersCollection = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(USERS_PATH);
const invitesCollection = (tenantId) =>
  adminDb.collection('tenants').doc(tenantId).collection('invites');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { tenantId, token, password, name } = req.body || {};
    const slug = String(tenantId || '').trim().toLowerCase();
    const cleanToken = String(token || '').trim();

    if (!slug || !cleanToken) {
      return res.status(400).json({ error: 'Convite inválido.' });
    }
    if (String(password || '').length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
    }
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
      return res.status(400).json({ error: 'Informe seu nome.' });
    }

    // Localiza o convite pelo token dentro do tenant.
    const snap = await invitesCollection(slug).where('token', '==', cleanToken).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ error: 'Convite não encontrado.' });
    }
    const inviteDoc = snap.docs[0];
    const invite = inviteDoc.data();

    if (invite.status !== 'pending') {
      return res.status(409).json({ error: 'Este convite já foi utilizado ou cancelado.' });
    }
    const expMs = invite.expiresAt?.toMillis?.() ?? 0;
    if (expMs && expMs < Date.now()) {
      await inviteDoc.ref.set({ status: 'expired' }, { merge: true });
      return res.status(410).json({ error: 'Este convite expirou. Peça um novo ao administrador.' });
    }

    const email = String(invite.email || '').trim().toLowerCase();
    const role = invite.role === 'admin' ? 'admin' : 'consultant';
    if (!email) {
      return res.status(400).json({ error: 'Convite sem e-mail válido.' });
    }

    // Cria a conta no Firebase Auth.
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({ email, password, displayName: normalizedName });
    } catch (err) {
      if (err?.code === 'auth/email-already-exists') {
        return res.status(409).json({
          error: 'Já existe uma conta com esse e-mail. Faça login normalmente ou contate o administrador.'
        });
      }
      throw err;
    }

    // Claim de tenant + doc de usuário.
    await adminAuth.setCustomUserClaims(userRecord.uid, { tenantId: slug });
    await usersCollection(slug).doc(userRecord.uid).set({
      name: normalizedName,
      email,
      authUid: userRecord.uid,
      role,
      tenantId: slug,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Marca o convite como aceito.
    await inviteDoc.ref.set(
      { status: 'accepted', acceptedAt: admin.firestore.FieldValue.serverTimestamp(), acceptedUid: userRecord.uid },
      { merge: true }
    );

    return res.status(200).json({ ok: true, tenantId: slug, role });
  } catch (error) {
    console.error('invite-accept', error);
    return res.status(500).json({ error: 'Erro interno ao aceitar convite.' });
  }
}
