import { adminAuth, admin, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage, canAddSeat } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';
import {
  usersCollection,
  isTenantAdmin,
  assertTargetInTenant,
  resolveTargetVerdict,
  targetVerdictError,
  TARGET_OK,
  TARGET_FOREIGN,
  TARGET_SUPERADMIN,
  passwordTooShort,
  passwordTooShortError
} from './_auth.js';
import { withSentry } from './_sentry.js';

// Consolidação de admin-create-user, admin-set-password e admin-delete-user.
// Motivo: o plano Hobby da Vercel permite 12 funções e api/ estava no teto.
// Cada bloco abaixo é o corpo do handler original, sem mudança de regra.
//
// Mantido o withSentry no export (os três originais eram todos envolvidos por
// ele) para não perder a captura de erro inesperado — isso não estava no
// esqueleto pedido, mas removê-lo mudaria comportamento de monitoramento.
export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const { action } = req.body ?? {};
  switch (action) {
    case 'create': return handleCreate(req, res);
    case 'set-password': return handleSetPassword(req, res);
    case 'delete': return handleDelete(req, res);
    default:
      return res.status(400).json({ error: 'Ação inválida' });
  }
});

// ---- admin-create-user ----
async function handleCreate(req, res) {
  try {
    // Autenticação: ID token verificado (não confiamos mais no body).
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { name, email, password, allowExtra } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: name, email, password.' });
    }

    if (passwordTooShort(password)) {
      return res.status(400).json({ error: passwordTooShortError() });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode cadastrar consultores.' });
    }

    // Vagas por papel: este endpoint cria sempre CONSULTOR. Além dos inclusos,
    // pode entrar como extra pago — mas só com confirmação explícita do admin
    // (allowExtra), para nunca gerar cobrança surpresa.
    const seats = await getSeatUsage(auth.tenantId);
    const decision = canAddSeat(seats, 'consultant', { allowExtra: allowExtra === true });
    if (!decision.ok) {
      if (decision.code === 'extra_confirm') {
        return res.status(409).json({
          error: decision.error,
          requiresExtraConfirmation: true,
          extraUserPrice: decision.extraUserPrice,
        });
      }
      return res.status(403).json({ error: decision.error });
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

    // Consultor EXTRA muda o preço → ajusta a assinatura Asaas (best-effort,
    // vale na próxima fatura; auditado em superadmin_audit).
    if (decision.isExtra) await syncSubscriptionValue(auth.tenantId, { actorUid: auth.uid });

    return res.status(200).json({ ok: true, authUid: userRecord.uid, isExtra: decision.isExtra === true });
  } catch (error) {
    console.error('admin-create-user', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar consultor.' });
  }
}

// ---- admin-set-password ----
async function handleSetPassword(req, res) {
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
}

// ---- admin-delete-user ----
//
// Exclui um consultor do tenant do admin. ADMIN do tenant only.
//
// SEGURANÇA: o authUid a deletar vem do doc dentro do tenant, nunca do body —
// mas isso sozinho NÃO evitava o IDOR, porque o doc é escrito pelo próprio
// admin. Quem prova que a conta é desta academia é o claim `tenantId` do
// Firebase Auth, checado em resolveTargetVerdict antes do deleteUser.
async function handleDelete(req, res) {
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
}
