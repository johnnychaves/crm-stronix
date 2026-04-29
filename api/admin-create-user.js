import { adminAuth, adminDb, admin } from './_firebaseAdmin.js';

const APP_ID = 'stronix-crm-app';
const USERS_PATH = 'stronix_users';

const usersCollection = () =>
  adminDb
    .collection('artifacts')
    .doc(APP_ID)
    .collection('public')
    .doc('data')
    .collection(USERS_PATH);

const requireAdmin = async (requesterAuthUid) => {
  if (!requesterAuthUid) return false;
  const direct = await usersCollection().doc(requesterAuthUid).get();
  if (direct.exists && direct.data()?.role === 'admin') return true;
  const byField = await usersCollection()
    .where('authUid', '==', requesterAuthUid)
    .limit(1)
    .get();
  if (byField.empty) return false;
  return byField.docs[0].data()?.role === 'admin';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { name, email, password, requesterAuthUid } = req.body || {};

    if (!name || !email || !password || !requesterAuthUid) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: name, email, password, requesterAuthUid.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
    }

    const isAdmin = await requireAdmin(requesterAuthUid);
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

    await usersCollection()
      .doc(userRecord.uid)
      .set({
        name: normalizedName,
        email: normalizedEmail,
        authUid: userRecord.uid,
        role: 'consultant',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return res.status(200).json({ ok: true, authUid: userRecord.uid });
  } catch (error) {
    console.error('admin-create-user', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar consultor.' });
  }
}
