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
    const { userDocId, targetAuthUid, requesterAuthUid } = req.body || {};

    if (!userDocId || !requesterAuthUid) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: userDocId, requesterAuthUid.' });
    }

    if (userDocId === requesterAuthUid) {
      return res.status(400).json({ error: 'Não é possível excluir a própria conta.' });
    }

    const isAdmin = await requireAdmin(requesterAuthUid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode excluir consultores.' });
    }

    const docRef = usersCollection().doc(userDocId);
    const docSnap = await docRef.get();
    const resolvedAuthUid = targetAuthUid || docSnap.data()?.authUid || null;

    if (resolvedAuthUid) {
      try {
        await adminAuth.deleteUser(resolvedAuthUid);
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
      }
    }

    if (docSnap.exists) {
      await docRef.delete();
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('admin-delete-user', error);
    return res.status(500).json({ error: 'Erro interno ao excluir consultor.' });
  }
}
