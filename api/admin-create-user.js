import { adminAuth, admin, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage, canAddSeat } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';
import { usersCollection, isTenantAdmin } from './_auth.js';

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

    const { name, email, password, allowExtra } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: name, email, password.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
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
