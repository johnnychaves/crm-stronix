import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';

const USERS_PATH = 'stronix_users';

const usersCollection = (tenantId) =>
  adminDb
    .collection('artifacts')
    .doc(tenantId)
    .collection('public')
    .doc('data')
    .collection(USERS_PATH);

const requireAdmin = async (tenantId, uid) => {
  if (!tenantId || !uid) return false;
  const col = usersCollection(tenantId);
  const direct = await col.doc(uid).get();
  if (direct.exists && direct.data()?.role === 'admin') return true;
  const byField = await col.where('authUid', '==', uid).limit(1).get();
  if (byField.empty) return false;
  return byField.docs[0].data()?.role === 'admin';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Autenticação: ID token verificado (não confiamos mais no body).
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: name, email, password.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
    }

    const isAdmin = await requireAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode cadastrar consultores.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: normalizedName
      });
    } catch (err) {
      if (err?.code === 'auth/email-already-exists') {
        return res
          .status(409)
          .json({ error: 'Já existe uma conta com esse e-mail no Firebase Auth.' });
      }
      throw err;
    }

    // Vincula o novo usuário ao MESMO tenant do admin que o criou.
    await adminAuth.setCustomUserClaims(userRecord.uid, { tenantId: auth.tenantId });

    await usersCollection(auth.tenantId)
      .doc(userRecord.uid)
      .set({
        name: normalizedName,
        email: normalizedEmail,
        authUid: userRecord.uid,
        role: 'consultant',
        tenantId: auth.tenantId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return res.status(200).json({ ok: true, authUid: userRecord.uid });
  } catch (error) {
    console.error('admin-create-user', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar consultor.' });
  }
}
