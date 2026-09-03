import { adminAuth, verifyRequest } from './_firebaseAdmin.js';
import { usersCollection, isTenantAdmin, resolveTargetVerdict, targetVerdictError, TARGET_OK, TARGET_FOREIGN, TARGET_SUPERADMIN } from './_auth.js';
import { getSeatUsage } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';
import { withSentry } from './_sentry.js';

// Exclui um consultor do tenant do admin. ADMIN do tenant only.
//
// SEGURANÇA: o authUid a deletar vem do doc dentro do tenant, nunca do body —
// mas isso sozinho NÃO evitava o IDOR, porque o doc é escrito pelo próprio
// admin. Quem prova que a conta é desta academia é o claim `tenantId` do
// Firebase Auth, checado em resolveTargetVerdict antes do deleteUser.

export default withSentry(async function handler(req, res) {
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

    // Tirar o uid do doc em vez do body NÃO fecha o IDOR sozinho: o doc é
    // escrito pelo próprio admin (as rules liberam o write nos usuários da
    // academia dele), então dava para gravar ali o uid de alguém de outra
    // academia e apagar a conta dessa pessoa. Quem decide é o claim do Auth.
    //
    // Recusa só o que é ataque: conta de OUTRA academia e conta do dono da
    // plataforma. Cadastro sem conta no Auth ou com conta sem claim segue e
    // apaga apenas o registro interno — é limpeza de cadastro legado, e o
    // gestor já pode apagar esse doc direto pelas rules de qualquer jeito.
    const verdict = await resolveTargetVerdict(resolvedAuthUid, auth.tenantId);
    if (verdict === TARGET_FOREIGN || verdict === TARGET_SUPERADMIN) {
      const denied = targetVerdictError(verdict);
      return res.status(denied.status).json({ error: denied.error });
    }

    // Excluir consultor com extras faturáveis em uso muda o preço → sync depois.
    let hadExtras = false;
    if (deletedRole !== 'admin') {
      try { hadExtras = (await getSeatUsage(auth.tenantId)).extraConsultants > 0; }
      catch (e) { console.error('seat check (delete)', e?.message || e); }
    }

    // Só apaga a conta do Auth quando ela é comprovadamente desta academia.
    if (verdict === TARGET_OK) {
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
});
