import crypto from 'node:crypto';
import { adminAuth, adminDb, admin } from './_firebaseAdmin.js';
import { usersCollection } from './_auth.js';
import { logAudit } from './_audit.js';
import { sendMail } from './_mail.js';
import { checkRateLimit } from './_rateLimit.js';
import { normalizeEmail, RESET_WINDOW_MS } from '../src/lib/passwordReset.js';
import { hasDailyRoom, planIssue, planReserve, planKill, isTenantActive, RESET_MAILS_PER_DAY } from './_passwordReset.js';

// As operações de verdade do "Esqueci a senha": leituras, chamadas ao Firebase
// Auth e transações no documento da conta. As regras moram em _passwordReset.js
// (academia ativa e as contas que rodam dentro das transações). Aqui fica só a
// regra do cadastro legado, que precisa andar junto com o login e com as rules
// (ver findMember). Desenho em
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
    findMember(account.tenantId, user.uid, user.email),
  ]);
  // null quando a academia não tem documento (legado).
  const tenant = tenantSnap.exists ? tenantSnap.data() || {} : null;
  account.organizationActive = isTenantActive(tenant);
  account.isMember = Boolean(member);
  if (member?.name) account.name = member.name;
  return account;
}

// O cadastro na equipe, pelos dois caminhos do login (App.jsx). O primeiro é o
// authUid. O segundo é o legado: o cadastro achado pelo e-mail da conta, sem
// espaço e em minúsculas, como o login o normaliza. No legado o login grava o
// próprio uid no cadastro que achou, e as rules só aceitam essa gravação quando
// o id do cadastro é o uid (selfLinksOwnUid, em firestore.rules). Cadastro de
// outro id derruba o login, então aqui ele também não conta. O login usa o
// primeiro cadastro que o e-mail acha, e o limit(1) traz o mesmo, porque a busca
// sai ordenada pelo id. Mudou o login ou essas rules, mude aqui também.
async function findMember(tenantId, uid, accountEmail) {
  const byUid = await usersCollection(tenantId).where('authUid', '==', uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0].data() || {};
  // Sem e-mail na conta não há o que procurar, como no login.
  const email = normalizeEmail(accountEmail);
  if (!email) return null;
  const byEmail = await usersCollection(tenantId).where('email', '==', email).limit(1).get();
  if (byEmail.empty) return null;
  const legacy = byEmail.docs[0];
  return legacy.id === uid ? legacy.data() || {} : null;
}

// Cabe mais um código no dia desta conta? Leitura simples do documento da
// conta, sem transação e sem escrita, com a mesma regra do issueCode. Ela vem
// antes da vaga do teto, para a conta que já gastou os 5 códigos do dia não
// gastar vaga. O issueCode confere de novo na transação, e a corrida entre as
// duas pode gastar uma vaga de vez em quando, o que é aceito.
export async function dailyRoom(uid, now) {
  const snap = await resetDoc(uid).get();
  return hasDailyRoom(snap.exists ? snap.data() : null, now);
}

// Uma vaga no teto de e-mails do dia (RESET_MAILS_PER_DAY). Devolve se há vaga.
// Uma contagem só, em _ratelimit, vale para todas as academias. O limitador
// falha aberto: se a conta dele falhar, o e-mail sai.
export async function reserveMailSlot() {
  const rl = await checkRateLimit('pw-reset-mail-day', { limit: RESET_MAILS_PER_DAY, windowMs: RESET_WINDOW_MS });
  return rl.ok;
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

// O log da Vercel some em 1 hora. A auditoria fica para o super-admin. O
// ambiente separa a troca feita no Preview, que usa o Firebase de produção e
// escreve o código no log, da troca feita em produção.
export const audit = ({ uid, tenantId }) =>
  logAudit({
    action: 'password.reset', tenantId, actorUid: uid,
    details: { via: 'codigo-por-email', ambiente: process.env.VERCEL_ENV || null },
  });

// O que as ações do tenant-resolve passam para o fluxo.
export function realResetDeps() {
  const deps = {
    findAccount,
    dailyRoom,
    reserveMailSlot,
    issueCode,
    reserveAttempt,
    killCode,
    setPassword,
    revokeSessions,
    audit,
    sendMail: (msg) => sendMail(msg),
    now: () => Date.now(),
    randomInt: (max) => crypto.randomInt(0, max),
    log: console,
  };
  // A chave do HMAC sai da chave privada do Admin, que o _firebaseAdmin.js já
  // exige para subir. Ela não é enumerável, para não sair se alguém imprimir o
  // deps (log, Sentry, JSON). Por isso copiar o deps com spread deixa o secret
  // para trás, e o fluxo falha por falta de segredo: troque uma chave por
  // atribuição (deps.log = ...), nunca com { ...deps }.
  Object.defineProperty(deps, 'secret', { value: process.env.FIREBASE_ADMIN_PRIVATE_KEY, enumerable: false });
  return deps;
}
