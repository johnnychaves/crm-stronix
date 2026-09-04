import { adminAuth, verifyRequest } from './_firebaseAdmin.js';
import { usersCollection, isTenantAdmin, assertTargetInTenant, passwordTooShort, passwordTooShortError } from './_auth.js';
import { withSentry } from './_sentry.js';

export default withSentry(async function handler(req, res) {
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

    if (passwordTooShort(password)) {
      return res.status(400).json({ error: passwordTooShortError() });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode redefinir senhas.' });
    }

    // O alvo precisa pertencer ao MESMO tenant do admin — e a prova disso é o
    // CLAIM da conta, não o doc em stronix_users. O doc é escrito pelo próprio
    // admin (as rules liberam o write na coleção de usuários da academia dele),
    // então bastava gravar o authUid de alguém de outra academia num membro do
    // próprio time para a busca abaixo encontrar e a troca de senha passar.
    const denied = await assertTargetInTenant(targetAuthUid, auth.tenantId);
    if (denied) return res.status(denied.status).json({ error: denied.error });

    // Segunda camada: além de ser do tenant, precisa ser gente cadastrada nele.
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
});
