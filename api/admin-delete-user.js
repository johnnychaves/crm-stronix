import { adminAuth, verifyRequest } from './_firebaseAdmin.js';
import { usersCollection, isTenantAdmin } from './_auth.js';
import { getSeatUsage } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';

// Exclui um consultor do tenant do admin. ADMIN do tenant only.
// SEGURANÇA: o authUid a deletar vem SEMPRE do doc validado dentro do tenant —
// nunca do body — para evitar IDOR (admin de A apagando conta de usuário de B).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { userDocId } = req.body || {};
    if (!userDocId) {
      return res.status(400).json({ error: 'Campo obrigatório: userDocId.' });
    }
    if (userDocId === auth.uid) {
      return res.status(400).json({ error: 'Não é possível excluir a própria conta.' });
    }

    if (!(await isTenantAdmin(auth.tenantId, auth.uid))) {
      return res.status(403).json({ error: 'Apenas o master pode excluir consultores.' });
    }

    // O doc precisa existir DENTRO do tenant do admin.
    const docRef = usersCollection(auth.tenantId).doc(userDocId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' });
    }

    // authUid SEMPRE do doc validado (não confiar em valor do body).
    const resolvedAuthUid = docSnap.data()?.authUid || null;
    const deletedRole = docSnap.data()?.role || 'consultant';

    // Excluir consultor com extras faturáveis em uso muda o preço → sync depois.
    let hadExtras = false;
    if (deletedRole !== 'admin') {
      try { hadExtras = (await getSeatUsage(auth.tenantId)).extraConsultants > 0; }
      catch (e) { console.error('seat check (delete)', e?.message || e); }
    }

    if (resolvedAuthUid) {
      try {
        await adminAuth.deleteUser(resolvedAuthUid);
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
      }
    }

    await docRef.delete();

    if (hadExtras) await syncSubscriptionValue(auth.tenantId, { actorUid: auth.uid });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('admin-delete-user', error);
    return res.status(500).json({ error: 'Erro interno ao excluir consultor.' });
  }
}
