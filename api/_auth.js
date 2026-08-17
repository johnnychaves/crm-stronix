import { adminDb } from './_firebaseAdmin.js';

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
