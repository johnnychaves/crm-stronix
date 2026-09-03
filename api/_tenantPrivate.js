import { admin, adminDb } from './_firebaseAdmin.js';

// Dados PRIVADOS da academia: perfil (CNPJ, CPF e nascimento do responsável,
// endereço, e-mail, telefone) e o WhatsApp do responsável.
//
// Eles moravam no doc raiz /tenants/{id}, que TODO membro da academia pode ler
// (o login precisa do status, do trial e da cobrança para decidir se bloqueia).
// Na prática, qualquer consultor abria o console do navegador e lia o CPF do
// dono. Agora vivem em /tenants/{id}/private/profile, cuja leitura as rules
// limitam ao admin da academia e ao super-admin. Nada no cliente lê este doc:
// o Console e a aba "Perfil da academia" passam pelo Admin SDK, por aqui.
//
// Arquivo com prefixo `_` → utilitário, não conta no limite de 12 funções.

export const PRIVATE_COLLECTION = 'private';
export const PRIVATE_DOC = 'profile';
export const PRIVATE_FIELDS = ['profile', 'responsiblePhone'];

export const privateRef = (tenantId) =>
  adminDb.collection('tenants').doc(tenantId).collection(PRIVATE_COLLECTION).doc(PRIVATE_DOC);

// Lê o perfil privado. `rootData` é o doc raiz já carregado pelo chamador:
// enquanto a migração (scripts/migrate-tenant-private.js) não roda, o dado
// pode ainda estar lá, e o fallback é por campo para uma escrita parcial no
// subdocumento não esconder o que sobrou na raiz.
export async function readTenantPrivate(tenantId, rootData = {}) {
  const snap = await privateRef(tenantId).get();
  const priv = snap.exists ? (snap.data() || {}) : {};
  const root = rootData || {};
  return {
    profile: priv.profile ?? root.profile ?? null,
    responsiblePhone: priv.responsiblePhone ?? root.responsiblePhone ?? '',
  };
}

// Grava só os campos conhecidos, em merge. Devolve os nomes gravados (o audit
// registra o que mudou) ou [] quando não havia nada útil.
export async function writeTenantPrivate(tenantId, { profile, responsiblePhone } = {}) {
  const patch = {};
  if (profile && typeof profile === 'object' && Object.keys(profile).length) patch.profile = profile;
  if (responsiblePhone !== undefined) patch.responsiblePhone = String(responsiblePhone || '').trim().slice(0, 30);
  const changed = Object.keys(patch);
  if (!changed.length) return [];
  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await privateRef(tenantId).set(patch, { merge: true });
  return changed;
}
