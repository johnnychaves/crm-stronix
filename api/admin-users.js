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
  passwordPolicyError,
  passwordRejection
} from './_auth.js';
import { maskEmail } from './_passwordReset.js';
import {
  SET_EMAIL_ACTION,
  normalizeLoginEmail,
  loginEmailError,
  LOGIN_EMAIL_INVALID_MESSAGE,
  LOGIN_EMAIL_TAKEN_MESSAGE,
  LOGIN_EMAIL_FAILED_MESSAGE
} from '../src/lib/loginEmail.js';
import { withSentry } from './_sentry.js';

// Consolidação de admin-create-user, admin-set-password e admin-delete-user.
// Motivo: o plano Hobby da Vercel permite 12 funções e api/ estava no teto.
// Cada bloco abaixo é o corpo do handler original, sem mudança de regra. A
// troca do e-mail de login (set-email) entrou depois, aqui mesmo, pelo mesmo
// motivo.
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
    case SET_EMAIL_ACTION: return handleSetEmail(req, res);
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

    const passwordProblem = passwordPolicyError(password);
    if (passwordProblem) {
      return res.status(400).json({ error: passwordProblem });
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
      const rejected = passwordRejection(err, 'admin-create-user');
      if (rejected) return res.status(rejected.status).json({ error: rejected.error });
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

    const passwordProblem = passwordPolicyError(password);
    if (passwordProblem) {
      return res.status(400).json({ error: passwordProblem });
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

    try {
      await adminAuth.updateUser(targetAuthUid, { password });
    } catch (err) {
      const rejected = passwordRejection(err, 'admin-set-password');
      if (rejected) return res.status(rejected.status).json({ error: rejected.error });
      throw err;
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('admin-set-password', error);
    if (error?.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Conta de autenticação não encontrada.' });
    }
    return res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
}

// ---- admin-set-email ----
//
// O campo "E-mail de login" da tela da equipe. Troca o e-mail da conta no
// Firebase Auth e o do cadastro juntos, e revoga as sessões da pessoa. Gestor
// da academia only. As travas são as do set-password, na mesma ordem: o formato
// antes de qualquer leitura, o gestor, o claim do alvo e o cadastro achado pelo
// authUid.
//
// A troca vai na ordem Auth, cadastro e revogação. A revogação vem por último
// porque é a única que não volta atrás, e é ela que mata o código pendente do
// "Esqueci a senha": o código morre quando o tokensValidAfterTime da conta muda.
// Se o cadastro ou a revogação falharem, o que já foi gravado volta e a resposta
// é 500. A troca vale inteira ou não vale, e tentar de novo refaz tudo.
//
// O log nunca leva e-mail inteiro: sai mascarado pelo maskEmail, inclusive o
// que aparecer na mensagem de um erro.
async function handleSetEmail(req, res) {
  let who = {};
  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    who = { academia: auth.tenantId };

    const { targetAuthUid, email } = req.body || {};
    if (typeof targetAuthUid !== 'string' || !targetAuthUid || typeof email !== 'string' || !email) {
      return res.status(400).json({ error: 'Campos obrigatórios: targetAuthUid, email.' });
    }

    const newEmail = normalizeLoginEmail(email);
    const emailProblem = loginEmailError(newEmail);
    if (emailProblem) {
      return res.status(400).json({ error: emailProblem });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode trocar o e-mail de login.' });
    }

    // O alvo precisa ser desta academia pelo CLAIM da conta, e nunca o
    // super-admin. O cadastro não prova nada: é o próprio gestor que o escreve
    // (ver o set-password).
    const denied = await assertTargetInTenant(targetAuthUid, auth.tenantId);
    if (denied) return res.status(denied.status).json({ error: denied.error });

    // Segunda camada: gente cadastrada nesta academia. É esse cadastro que
    // muda junto com a conta.
    const memberSnap = await usersCollection(auth.tenantId)
      .where('authUid', '==', targetAuthUid)
      .limit(1)
      .get();
    if (memberSnap.empty) {
      return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' });
    }
    const member = memberSnap.docs[0];
    const recordEmailBefore = member.data()?.email ?? null;
    who = { conta: targetAuthUid, academia: auth.tenantId };

    const account = await adminAuth.getUser(targetAuthUid);
    const before = { email: account.email || null, emailVerified: account.emailVerified === true };

    // A conta já entra com esse e-mail, então o login não muda. Só acerta o
    // cadastro, se ele tinha ficado diferente, e não revoga nada.
    if (normalizeLoginEmail(before.email) === newEmail) {
      if (recordEmailBefore !== newEmail) await member.ref.update({ email: newEmail });
      return res.status(200).json({ ok: true, changed: false });
    }

    // A frase não diz de quem é o e-mail.
    if (await emailTaken(auth.tenantId, newEmail, targetAuthUid, member.id)) {
      return res.status(409).json({ error: LOGIN_EMAIL_TAKEN_MESSAGE });
    }

    // O e-mail novo nunca foi confirmado pela pessoa.
    await adminAuth.updateUser(targetAuthUid, { email: newEmail, emailVerified: false });

    try {
      await member.ref.update({ email: newEmail });
    } catch (err) {
      console.error('admin-set-email: o cadastro não gravou. O Auth volta ao e-mail antigo.', { ...who, ...errorForLog(err) });
      await undoAuthEmail(targetAuthUid, before, newEmail, who);
      return res.status(500).json({ error: LOGIN_EMAIL_FAILED_MESSAGE });
    }

    // Derruba as sessões abertas da pessoa e mata o código pendente do
    // "Esqueci a senha", que saiu para o e-mail antigo.
    try {
      await adminAuth.revokeRefreshTokens(targetAuthUid);
    } catch (err) {
      console.error('admin-set-email: as sessões não foram revogadas. O cadastro e o Auth voltam ao e-mail antigo.', { ...who, ...errorForLog(err) });
      try {
        await member.ref.update({ email: recordEmailBefore });
      } catch (undoErr) {
        console.error('admin-set-email: não voltou o e-mail do cadastro.', {
          ...who, antigo: maskEmail(recordEmailBefore), novo: maskEmail(newEmail), ...errorForLog(undoErr),
        });
      }
      await undoAuthEmail(targetAuthUid, before, newEmail, who);
      return res.status(500).json({ error: LOGIN_EMAIL_FAILED_MESSAGE });
    }

    console.info('admin-set-email: e-mail de login trocado', {
      ...who,
      por: auth.uid,
      acessarComo: auth.impersonatedBy || null,
      antigo: maskEmail(before.email),
      novo: maskEmail(newEmail),
    });
    return res.status(200).json({ ok: true, changed: true });
  } catch (error) {
    const refused = emailRefusal(error);
    if (refused) return res.status(refused.status).json({ error: refused.error });
    console.error('admin-set-email', { ...who, ...errorForLog(error) });
    return res.status(500).json({ error: LOGIN_EMAIL_FAILED_MESSAGE });
  }
}

// O e-mail já é de outra conta no Auth, ou de outro cadastro desta academia? Um
// cadastro repetido da própria pessoa (mesmo authUid) não conta.
async function emailTaken(tenantId, email, targetAuthUid, memberId) {
  try {
    const other = await adminAuth.getUserByEmail(email);
    if (other.uid !== targetAuthUid) return true;
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  const records = await usersCollection(tenantId).where('email', '==', email).get();
  return records.docs.some((d) => d.id !== memberId && d.data()?.authUid !== targetAuthUid);
}

// Volta o e-mail da conta ao de antes. A resposta já é de erro, então a falha
// daqui só vai para o log, com os dois e-mails mascarados, para quem investigar.
async function undoAuthEmail(uid, before, attempted, who) {
  try {
    await adminAuth.updateUser(uid, { email: before.email, emailVerified: before.emailVerified });
  } catch (err) {
    console.error('admin-set-email: não voltou o e-mail do Auth. A conta ficou com o e-mail novo.', {
      ...who, antigo: maskEmail(before.email), novo: maskEmail(attempted), ...errorForLog(err),
    });
  }
}

// A recusa do Firebase, pronta para responder, ou null quando o erro é outro.
// O Firebase confere o e-mail de novo no updateUser, e a checagem de e-mail em
// uso pode perder uma corrida para outra conta criada no mesmo instante.
function emailRefusal(err) {
  switch (err?.code) {
    case 'auth/email-already-exists': return { status: 409, error: LOGIN_EMAIL_TAKEN_MESSAGE };
    case 'auth/invalid-email': return { status: 400, error: LOGIN_EMAIL_INVALID_MESSAGE };
    case 'auth/user-not-found': return { status: 404, error: 'Conta de autenticação não encontrada.' };
    default: return null;
  }
}

// O erro como vai para o log: o código e a mensagem, com qualquer e-mail que
// aparecer nela mascarado. O objeto inteiro não vai, porque a pilha repete a
// mensagem.
const EMAIL_IN_TEXT = /[^\s@"'<>()[\]{},;:]+@[^\s@"'<>()[\]{},;:]+/g;
function errorForLog(err) {
  return {
    codigo: err?.code || null,
    erro: String(err?.message ?? err).replace(EMAIL_IN_TEXT, (found) => maskEmail(found)),
  };
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
