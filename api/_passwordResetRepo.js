import crypto from 'node:crypto';
import { adminAuth, adminDb, admin } from './_firebaseAdmin.js';
import { usersCollection } from './_auth.js';
import { logAudit } from './_audit.js';
import { sendMail } from './_mail.js';
import { planIssue, planReserve, planKill } from './_passwordReset.js';

// As operações de verdade do "Esqueci a senha": leituras, chamadas ao Firebase
// Auth e transações no documento da conta. Sem regra de negócio: as contas
// moram nos planejadores de _passwordReset.js. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

// Um documento por conta, com o uid como id: garante um código vivo só. O
// sublinhado segue o _ratelimit, que também é coleção só do servidor. As rules
// negam qualquer caminho sem regra, e esta coleção não ganha regra.
const resetDoc = (uid) => adminDb.collection('_password_reset').doc(uid);
const stamp = () => admin.firestore.FieldValue.serverTimestamp();

// A conta como a regra enxerga, ou null quando o e-mail não tem conta.
export async function findAccount(email) {
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-email') return null;
    throw err;
  }
  const claims = user.customClaims || {};
  const account = {
    uid: user.uid,
    // O endereço que o Firebase guarda: é para ele que o código vai, nunca para
    // o que foi digitado. Entra antes dos retornos antecipados abaixo para
    // existir em toda forma de conta.
    email: user.email || null,
    tenantId: typeof claims.tenantId === 'string' && claims.tenantId ? claims.tenantId : null,
    superAdmin: claims.superAdmin === true,
    disabled: user.disabled === true,
    isMember: false,
    organizationActive: false,
    name: user.displayName || '',
    signInMark: user.metadata?.lastSignInTime || null,
    tokensMark: user.tokensValidAfterTime || null,
  };
  if (!account.tenantId || account.superAdmin || account.disabled) return account;

  const [tenantSnap, member] = await Promise.all([
    adminDb.collection('tenants').doc(account.tenantId).get(),
    findMember(account.tenantId, user.uid, email),
  ]);
  const tenant = tenantSnap.exists ? tenantSnap.data() || {} : null;
  // Academia sem documento (legado): o login libera, e aqui também. O par de
  // checagens é o do invite-accept e da página de indicação.
  account.organizationActive = !tenant || !(tenant.status === 'suspended' || tenant.archived === true);
  account.isMember = Boolean(member);
  if (member?.name) account.name = member.name;
  return account;
}

// O cadastro na equipe, pelos mesmos dois caminhos do login (App.jsx): o
// authUid e, no legado, o e-mail.
async function findMember(tenantId, uid, email) {
  const byUid = await usersCollection(tenantId).where('authUid', '==', uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0].data() || {};
  const byEmail = await usersCollection(tenantId).where('email', '==', email).limit(1).get();
  return byEmail.empty ? null : byEmail.docs[0].data() || {};
}

// A transação faz pedidos ao mesmo tempo da mesma conta esperarem a vez, e
// nenhum passa do limite do dia.
export async function issueCode(uid, input) {
  const ref = resetDoc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const plano = planIssue(snap.exists ? snap.data() : null, input);
    if (!plano.ok) return plano;
    tx.set(ref, { ...plano.doc, updatedAt: stamp() });
    return { ok: true };
  });
}

export async function reserveAttempt(uid, now) {
  const ref = resetDoc(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const plano = planReserve(snap.exists ? snap.data() : null, now);
    if (!plano.ok) return { ok: false };
    tx.update(ref, { ...plano.patch, updatedAt: stamp() });
    return { ok: true, attempt: plano.attempt, code: plano.code };
  });
}

export async function killCode(uid, codeHash, now) {
  const ref = resetDoc(uid);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const patch = planKill(snap.exists ? snap.data() : null, codeHash, now);
    if (patch) tx.update(ref, { ...patch, updatedAt: stamp() });
  });
}

// A política de senha do console vale no updateUser. A recusa sobe para o
// fluxo, que a traduz.
export const setPassword = (uid, password) => adminAuth.updateUser(uid, { password });

// A troca de senha já revoga as sessões no Firebase. A chamada explícita deixa
// isso escrito e vale também se o Firebase mudar esse comportamento.
export const revokeSessions = (uid) => adminAuth.revokeRefreshTokens(uid);

// O log da Vercel some em 1 hora. A auditoria fica para o super-admin.
export const audit = ({ uid, tenantId }) =>
  logAudit({ action: 'password.reset', tenantId, actorUid: uid, details: { via: 'codigo-por-email' } });

// O que as ações do tenant-resolve passam para o fluxo.
export function realResetDeps() {
  return {
    findAccount,
    issueCode,
    reserveAttempt,
    killCode,
    setPassword,
    revokeSessions,
    audit,
    sendMail: (msg) => sendMail(msg),
    now: () => Date.now(),
    randomInt: (max) => crypto.randomInt(0, max),
    // A chave do HMAC sai da chave privada do Admin, que o _firebaseAdmin.js
    // já exige para subir.
    secret: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    log: console,
  };
}
