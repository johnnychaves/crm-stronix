import { adminDb, adminAuth } from './_firebaseAdmin.js';
import { targetVerdict, targetVerdictError, TARGET_NO_ACCOUNT } from '../src/lib/tenantGuard.js';

// Helpers de autorização/coleções compartilhados pelos endpoints admin.
// Centraliza a lógica de "é admin do tenant?" para não divergir entre arquivos
// (uma correção de brecha aqui vale para todos os endpoints).

const USERS_PATH = 'stronix_users';

export const dataCollection = (tenantId, name) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(name);

export const usersCollection = (tenantId) => dataCollection(tenantId, USERS_PATH);

// Regra de senha: mora em src/lib/passwordPolicy.js e é repassada aqui para os
// endpoints não precisarem saber que o arquivo vive do outro lado. O front
// importa do mesmo lugar, então os dois nunca divergem.
export { MIN_PASSWORD_LENGTH, passwordTooShort, passwordTooShortError } from '../src/lib/passwordPolicy.js';

// A regra pura de "este alvo é do meu tenant?" mora em src/lib/tenantGuard.js,
// e é reexportada aqui pelo mesmo motivo da política de senha: os endpoints não
// precisam saber que o arquivo vive do outro lado.
export {
  targetVerdict, targetAllowed, targetVerdictError,
  TARGET_OK, TARGET_FOREIGN, TARGET_SUPERADMIN, TARGET_UNCLAIMED, TARGET_NO_ACCOUNT
} from '../src/lib/tenantGuard.js';

// Veredito sobre `targetAuthUid` para quem opera no `tenantId`, decidido pelo
// CLAIM da conta no Firebase Auth — a única fonte que o admin do tenant não
// escreve.
//
// Não usar o doc de stronix_users para isso: as rules deixam o admin escrever
// qualquer campo dos usuários da própria academia, incluindo o authUid, então o
// documento consultado podia ser o que o próprio atacante acabou de forjar.
export async function resolveTargetVerdict(targetAuthUid, tenantId) {
  if (!targetAuthUid) return TARGET_NO_ACCOUNT;
  try {
    const userRecord = await adminAuth.getUser(targetAuthUid);
    return targetVerdict(userRecord.customClaims, tenantId);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return TARGET_NO_ACCOUNT;
    throw err;
  }
}

// Atalho para quem só quer barrar: devolve null quando pode seguir, ou
// { status, error } pronto para responder.
export async function assertTargetInTenant(targetAuthUid, tenantId) {
  return targetVerdictError(await resolveTargetVerdict(targetAuthUid, tenantId));
}

// True se `uid` é admin do `tenantId` (por doc-id == uid OU por campo authUid).
export async function isTenantAdmin(tenantId, uid) {
  if (!tenantId || !uid) return false;
  const col = usersCollection(tenantId);
  const direct = await col.doc(uid).get();
  if (direct.exists && direct.data()?.role === 'admin') return true;
  const byField = await col.where('authUid', '==', uid).limit(1).get();
  if (byField.empty) return false;
  return byField.docs[0].data()?.role === 'admin';
}
