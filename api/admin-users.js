import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage, canAddSeat } from './_plans.js';
import { syncSubscriptionValue } from './_asaas.js';
import {
  dataCollection,
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
import { professorLinkRefusal } from './_professorLink.js';
import { diaDeBrasilia, isoDoDia } from './_horarioDeBrasilia.js';
import { modelDocs } from '../src/lib/rotinas.js';
import { ROLES, roleOf } from '../src/lib/acesso.js';
import {
  SET_ROLE_ACTION,
  PROFESSOR_LINK_MESSAGES,
  planRoleChange,
  professorIdProblem,
  isDocId
} from '../src/lib/teamRoles.js';
import {
  SET_EMAIL_ACTION,
  normalizeLoginEmail,
  loginEmailError,
  LOGIN_EMAIL_INVALID_MESSAGE,
  LOGIN_EMAIL_TAKEN_MESSAGE,
  LOGIN_EMAIL_FAILED_MESSAGE
} from '../src/lib/loginEmail.js';
import { withSentry } from './_sentry.js';

// Leads da academia, para a troca de papel conferir se a pessoa ainda tem
// carteira. O mesmo nome de coleção de src/lib/firebase.js.
const LEADS_PATH = 'stronix_leads';

// Teto de gravações num lote do Firestore.
const BATCH_LIMIT = 500;

// Modelos de rotina dos consultores e as versões do dia, os mesmos nomes de
// coleção de src/lib/firebase.js.
const ROUTINE_MODELS_PATH = 'stronix_rotina_modelos';
const ROUTINE_VERSIONS_PATH = 'stronix_rotina_versoes';

// Devolve ao dono do lead as tarefas que ficaram com a pessoa em lead de outro
// consultor: o contato que outros consultores passaram para ela (o "Para quem é
// a tarefa" do Agendar grava nextFollowUpOwnerId e nextFollowUpOwnerName) e a
// visita ou a aula que ela agendou no lead de outro (appointmentOwnerId e
// appointmentOwnerName, do appointmentTaskOwnerFor). A tarefa só aparece na
// Meta de quem a tem (contactOwnerId e appointmentTaskOwnerId, em
// src/lib/leads.js), e nem o professor nem quem foi excluído têm essa Meta:
// sem a devolução, a tarefa sumiria de todas as Metas no dia dela. Grava o
// mesmo null que o Agendar grava quando a tarefa é do dono do lead
// (src/lib/schedulePatch.js), só nos campos da tarefa que era da pessoa, e o
// lead com as duas tarefas muda numa gravação só. Devolve quantos leads
// mudaram. Quem chama: o set-role, quando a pessoa vira professor, e o delete,
// antes de excluir a pessoa.
async function returnDelegatedTasks(tenantId, userDocId) {
  const leads = dataCollection(tenantId, LEADS_PATH);
  const [contacts, appointments] = await Promise.all([
    leads.where('nextFollowUpOwnerId', '==', userDocId).get(),
    leads.where('appointmentOwnerId', '==', userDocId).get(),
  ]);
  const changes = new Map();
  const add = (docs, patch) => (docs || []).forEach((d) => {
    changes.set(d.id, { ref: d.ref, patch: { ...(changes.get(d.id)?.patch || {}), ...patch } });
  });
  add(contacts.docs, { nextFollowUpOwnerId: null, nextFollowUpOwnerName: null });
  add(appointments.docs, { appointmentOwnerId: null, appointmentOwnerName: null });
  const list = [...changes.values()];
  for (let i = 0; i < list.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const { ref, patch } of list.slice(i, i + BATCH_LIMIT)) batch.update(ref, patch);
    await batch.commit();
  }
  return list.length;
}

// Rotinas dos consultores (spec 2026-10-06): quem vira professor ou é
// excluído sai do modelo de rotina que seguia, e a versão do dia do modelo é
// gravada junto, para o histórico saber que a pessoa saiu naquele dia. Cada
// consultor segue um modelo só, então o lote é pequeno.
async function leaveRoutineModels(tenantId, userDocId, actorId) {
  const snap = await dataCollection(tenantId, ROUTINE_MODELS_PATH).where('followerIds', 'array-contains', userDocId).get();
  if (snap.empty) return 0;
  const date = isoDoDia(diaDeBrasilia(new Date()));
  const batch = adminDb.batch();
  snap.docs.forEach((d) => {
    const data = d.data();
    // Mesma montagem de versão do app (modelDocs), para o histórico ler um formato só.
    const { model, version } = modelDocs({
      modelId: d.id,
      name: data.name || '',
      tasks: data.tasks,
      followerIds: (data.followerIds || []).filter((id) => id !== userDocId),
      userId: actorId,
      dateKey: date,
    });
    batch.update(d.ref, { followerIds: model.followerIds, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorId });
    batch.set(dataCollection(tenantId, ROUTINE_VERSIONS_PATH).doc(version.id), { ...version.data, savedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  return snap.size;
}

// Consolidação de admin-create-user, admin-set-password e admin-delete-user.
// Motivo: o plano Hobby da Vercel permite 12 funções e api/ estava no teto.
// Cada bloco abaixo é o corpo do handler original, sem mudança de regra. A
// troca do e-mail de login (set-email) entrou depois, aqui mesmo, pelo mesmo
// motivo.
//
// A troca de papel (set-role) entrou do mesmo jeito, com o acesso de professor.
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
    case SET_ROLE_ACTION: return handleSetRole(req, res);
    case 'delete': return handleDelete(req, res);
    default:
      return res.status(400).json({ error: 'Ação inválida' });
  }
});

// ---- admin-create-user ----
//
// Cadastra consultor ou, com o módulo Professor e faltosos ligado, professor
// ligado a um professor do cadastro (role: 'professor' e professorId no
// corpo). Qualquer outro papel no pedido cria consultor, como sempre: gestor
// só entra por convite.
async function handleCreate(req, res) {
  try {
    // Autenticação: ID token verificado (não confiamos mais no body).
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { name, email, password, allowExtra, role, professorId } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Campos obrigatórios: name, email, password.' });
    }

    const passwordProblem = passwordPolicyError(password);
    if (passwordProblem) {
      return res.status(400).json({ error: passwordProblem });
    }

    // O professor do cadastro tem formato de id, conferido antes de qualquer leitura.
    const newRole = role === ROLES.PROFESSOR ? ROLES.PROFESSOR : ROLES.CONSULTOR;
    if (newRole === ROLES.PROFESSOR) {
      const bad = professorIdProblem(professorId);
      if (bad) return res.status(bad.status).json({ error: bad.error });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o gestor pode cadastrar pessoas na equipe.' });
    }

    // Vagas por papel. Consultor além dos inclusos pode entrar como extra
    // pago, só com confirmação explícita do admin (allowExtra), para nunca
    // gerar cobrança surpresa. Professor não ocupa vaga, mas precisa do módulo
    // e do professor do cadastro, conferidos com a academia já lida.
    const seats = await getSeatUsage(auth.tenantId);
    if (newRole === ROLES.PROFESSOR) {
      const refused = await professorLinkRefusal({ tenantId: auth.tenantId, modules: seats.modules, professorId });
      if (refused) return res.status(refused.status).json({ error: refused.error });
    }
    const decision = canAddSeat(seats, newRole, { allowExtra: allowExtra === true });
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
        role: newRole,
        ...(newRole === ROLES.PROFESSOR ? { professorId } : {}),
        tenantId: auth.tenantId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // Consultor EXTRA muda o preço → ajusta a assinatura Asaas (best-effort,
    // vale na próxima fatura; auditado em superadmin_audit).
    if (decision.isExtra) await syncSubscriptionValue(auth.tenantId, { actorUid: auth.uid });

    return res.status(200).json({ ok: true, authUid: userRecord.uid, role: newRole, isExtra: decision.isExtra === true });
  } catch (error) {
    console.error('admin-create-user', error);
    return res.status(500).json({ error: 'Erro interno ao cadastrar o acesso.' });
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

// ---- admin-set-role ----
//
// Troca o papel entre Consultor e Professor, ou o professor do cadastro
// ligado a quem já é professor. Gestor da academia only. O papel do gestor
// não muda por aqui, e ninguém troca o próprio papel. Professor exige, nesta
// ordem: cadastro com id igual ao uid da conta (é por esse id que as regras
// do Firestore leem o papel), o módulo Professor e faltosos, um professor
// ativo do cadastro sem outro login e, por último, carteira vazia (o
// professor não é dono de lead). A carteira fica no fim porque a recusa dela
// pede uma migração de leads que não tem volta. Passadas as recusas, as
// tarefas que ficaram com a pessoa em lead de outro consultor (o contato que
// recebeu e a visita ou a aula que agendou) voltam para o dono de cada lead
// (returnDelegatedTasks), e só então o papel muda.
// Professor que volta a consultor ocupa vaga de consultor, com a mesma regra
// do cadastro (extra pago só com allowExtra).
//
// O cliente não grava role nem professorId (as regras travam os dois): a vaga,
// o módulo e o professor são conferidos aqui. Com o papel trocado, as sessões
// da pessoa são revogadas e ela entra de novo já com o menu novo. As regras
// leem o papel a cada pedido, então a trava vale na hora.
async function handleSetRole(req, res) {
  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { userDocId, role, professorId, allowExtra } = req.body || {};
    if (!isDocId(userDocId)) {
      return res.status(400).json({ error: 'Campo obrigatório: userDocId.' });
    }
    if (role !== ROLES.CONSULTOR && role !== ROLES.PROFESSOR) {
      return res.status(400).json({ error: 'Por aqui o papel muda só entre Consultor e Professor.' });
    }
    if (role === ROLES.PROFESSOR) {
      const bad = professorIdProblem(professorId);
      if (bad) return res.status(bad.status).json({ error: bad.error });
    }

    if (!(await isTenantAdmin(auth.tenantId, auth.uid))) {
      return res.status(403).json({ error: 'Apenas o master pode trocar o papel de alguém.' });
    }

    const ref = usersCollection(auth.tenantId).doc(userDocId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado neste tenant.' });
    }
    const member = snap.data() || {};
    if (snap.id === auth.uid || member.authUid === auth.uid) {
      return res.status(400).json({ error: 'Você não pode trocar o seu próprio papel.' });
    }
    const from = roleOf(member);
    if (from === ROLES.GESTOR) {
      return res.status(400).json({ error: 'O papel do gestor não muda por aqui.' });
    }

    // O cadastro é escrito pelo próprio gestor: quem prova que a conta é desta
    // academia é o claim do Auth, como no delete. Cadastro sem conta segue.
    const verdict = await resolveTargetVerdict(member.authUid || null, auth.tenantId);
    if (verdict === TARGET_FOREIGN || verdict === TARGET_SUPERADMIN) {
      const denied = targetVerdictError(verdict);
      return res.status(denied.status).json({ error: denied.error });
    }

    const change = planRoleChange(member, { role, professorId });
    if (!change) return res.status(200).json({ ok: true, changed: false });

    // Quem passa a ser professor agora. Quem já é professor e só troca o
    // professor ligado não tem carteira nem cadastro antigo para conferir.
    const becomesProfessor = change.role === ROLES.PROFESSOR && from !== ROLES.PROFESSOR;

    // As regras leem o papel em stronix_users/{uid}. No cadastro antigo, de
    // id diferente do uid, elas não veriam o professor e deixariam a pessoa
    // gravar como consultor. Não precisa de leitura, então vem primeiro.
    if (becomesProfessor && (!member.authUid || member.authUid !== snap.id)) {
      return res.status(422).json({ error: PROFESSOR_LINK_MESSAGES.legacyRecord(member.name) });
    }

    const seats = await getSeatUsage(auth.tenantId);
    let decision = { ok: true };
    if (change.role === ROLES.PROFESSOR) {
      const refused = await professorLinkRefusal({
        tenantId: auth.tenantId, modules: seats.modules, professorId: change.professorId, exceptUserId: snap.id,
      });
      if (refused) return res.status(refused.status).json({ error: refused.error });

      // A carteira fica por último. A recusa dela manda o gestor passar os
      // leads em Configurações → Migrar leads, e essa migração não tem volta:
      // se outra recusa (módulo, professor ou cadastro antigo) viesse só
      // depois, o gestor teria migrado a carteira à toa.
      //
      // Professor não é dono de lead: Migrar leads move pelo consultantId.
      // Barra qualquer lead da pessoa, cliente e perda inclusive: o cliente
      // que ficasse com ela passaria o consultantId para cada indicação nova
      // pelo link público (api/tenant-resolve.js). O texto da recusa diz os
      // três tipos que o gestor marca lá.
      if (becomesProfessor) {
        const owned = await dataCollection(auth.tenantId, LEADS_PATH)
          .where('consultantId', '==', snap.id).limit(1).get();
        if (!owned.empty) {
          return res.status(409).json({ error: PROFESSOR_LINK_MESSAGES.ownsLeads(member.name) });
        }
      }
    } else {
      decision = canAddSeat(seats, ROLES.CONSULTOR, { allowExtra: allowExtra === true });
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
    }

    // Com todas as recusas para trás, as tarefas que ficaram com a pessoa em
    // lead de outro consultor (contato, visita e aula) voltam para o dono de
    // cada lead. Vem antes do papel: se a troca do papel falhar depois, a
    // tarefa fica com o dono do lead, que a vê na Meta dele, e o gestor tenta
    // de novo.
    const returnedTasks = becomesProfessor ? await returnDelegatedTasks(auth.tenantId, snap.id) : 0;
    const leftRoutines = becomesProfessor ? await leaveRoutineModels(auth.tenantId, snap.id, auth.uid) : 0;

    // O professor não prospecta: a meta de prospecção sai junto.
    await ref.update(change.role === ROLES.PROFESSOR
      ? { role: ROLES.PROFESSOR, professorId: change.professorId, dailyVolumeTarget: admin.firestore.FieldValue.delete() }
      : { role: ROLES.CONSULTOR, professorId: admin.firestore.FieldValue.delete() });

    // Professor que vira consultor extra sobe o preço; consultor que vira
    // professor, com extras em uso, libera uma vaga paga.
    const freedExtra = from === ROLES.CONSULTOR && seats.extraConsultants > 0;
    if (decision.isExtra || freedExtra) await syncSubscriptionValue(auth.tenantId, { actorUid: auth.uid });

    if (verdict === TARGET_OK && from !== change.role) {
      try {
        await adminAuth.revokeRefreshTokens(member.authUid);
      } catch (err) {
        console.error('admin-set-role: as sessões não foram revogadas.', { academia: auth.tenantId, conta: member.authUid, codigo: err?.code || null });
      }
    }

    console.info('admin-set-role', { academia: auth.tenantId, cadastro: snap.id, de: from, para: change.role, por: auth.uid, tarefasDevolvidas: returnedTasks, rotinasDeixadas: leftRoutines });
    return res.status(200).json({ ok: true, changed: true, role: change.role, isExtra: decision.isExtra === true });
  } catch (error) {
    console.error('admin-set-role', error);
    return res.status(500).json({ error: 'Erro interno ao trocar o papel.' });
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
// Exclui um consultor do tenant do admin. ADMIN do tenant only. Passadas as
// recusas, as tarefas que a pessoa tinha em lead de outro consultor voltam
// para o dono de cada lead (returnDelegatedTasks), e só então a conta e o
// cadastro saem.
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
    if (!isDocId(userDocId)) {
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
    const deletedRole = roleOf(docSnap.data());

    // Tirar o uid do doc em vez do body NÃO fecha o IDOR sozinho: o doc é
    // editado pelo próprio admin (as rules liberam só o update nos usuários
    // da academia dele, e criar e apagar ficam com o servidor). Antes de as
    // rules travarem o authUid (authUidKept), dava para gravar ali o uid de
    // alguém de outra academia e apagar a conta dessa pessoa. Quem decide
    // continua sendo o claim do Auth, que não depende do que o cadastro diz.
    //
    // Recusa só o que é ataque: conta de OUTRA academia e conta do dono da
    // plataforma. Cadastro sem conta no Auth, ou com conta sem claim, segue e
    // apaga só o registro interno, como limpeza de cadastro antigo. Só o
    // servidor apaga cadastro de equipe: as rules têm `allow create, delete:
    // if false` em stronix_users.
    const verdict = await resolveTargetVerdict(resolvedAuthUid, auth.tenantId);
    if (verdict === TARGET_FOREIGN || verdict === TARGET_SUPERADMIN) {
      const denied = targetVerdictError(verdict);
      return res.status(denied.status).json({ error: denied.error });
    }

    // Com as recusas para trás, as tarefas que ficaram com a pessoa em lead de
    // outro consultor (o contato que recebeu e a visita ou a aula que agendou)
    // voltam para o dono de cada lead, como na troca para professor. Só quem
    // tem a tarefa a vê na Meta, então sem isso ela sumiria de todas as Metas.
    // Vem antes da exclusão: se ela falhar depois, a tarefa fica com o dono do
    // lead, que a vê na Meta dele, e o gestor tenta de novo.
    const returnedTasks = await returnDelegatedTasks(auth.tenantId, userDocId);
    const leftRoutines = await leaveRoutineModels(auth.tenantId, userDocId, auth.uid);

    // Excluir consultor com extras faturáveis em uso muda o preço → sync depois.
    // Só consultor ocupa vaga paga: excluir gestor ou professor não muda o
    // preço, então não há o que sincronizar.
    let hadExtras = false;
    if (deletedRole === ROLES.CONSULTOR) {
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

    console.info('admin-delete-user', { academia: auth.tenantId, cadastro: userDocId, por: auth.uid, tarefasDevolvidas: returnedTasks, rotinasDeixadas: leftRoutines });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('admin-delete-user', error);
    return res.status(500).json({ error: 'Erro interno ao excluir consultor.' });
  }
}
