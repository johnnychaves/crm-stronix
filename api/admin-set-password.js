import { adminAuth, adminDb } from './_firebaseAdmin.js';

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
    const { targetAuthUid, password, requesterAuthUid } = req.body || {};

    if (!targetAuthUid || !password || !requesterAuthUid) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: targetAuthUid, password, requesterAuthUid.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
    }

    const isAdmin = await requireAdmin(requesterAuthUid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode redefinir senhas.' });
    }

    await adminAuth.updateUser(targetAuthUid, { password });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('admin-set-password', error);
    if (error?.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Conta de autenticação não encontrada.' });
    }
    return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
}
