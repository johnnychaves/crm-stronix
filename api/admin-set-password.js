import { adminAuth, verifyRequest } from './_firebaseAdmin.js';
import { usersCollection, isTenantAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { targetAuthUid, password } = req.body || {};

    if (!targetAuthUid || !password) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: targetAuthUid, password.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode redefinir senhas.' });
    }

    // O alvo precisa pertencer ao MESMO tenant do admin.
    const targetSnap = await usersCollection(auth.tenantId)
      .where('authUid', '==', targetAuthUid)
      .limit(1)
      .get();
    if (targetSnap.empty) {
      return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' });
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
