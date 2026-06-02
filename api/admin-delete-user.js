import { adminAuth, adminDb, verifyRequest } from './_firebaseAdmin.js';

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
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { userDocId, targetAuthUid } = req.body || {};

    if (!userDocId) {
      return res.status(400).json({ error: 'Campo obrigatório: userDocId.' });
    }

    if (userDocId === auth.uid) {
      return res.status(400).json({ error: 'Não é possível excluir a própria conta.' });
    }

    const isAdmin = await requireAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode excluir consultores.' });
    }

    // O doc precisa existir DENTRO do tenant do admin — garante que ele não
    // exclui usuário de outra academia.
    const docRef = usersCollection(auth.tenantId).doc(userDocId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' });
    }

    const resolvedAuthUid = targetAuthUid || docSnap.data()?.authUid || null;

    if (resolvedAuthUid) {
      try {
        await adminAuth.deleteUser(resolvedAuthUid);
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
      }
    }

    await docRef.delete();

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('admin-delete-user', error);
    return res.status(500).json({ error: 'Erro interno ao excluir consultor.' });
  }
}
