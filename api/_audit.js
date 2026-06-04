import { adminDb, admin } from './_firebaseAdmin.js';

// Log de auditoria de ações sensíveis do super-admin (coleção raiz
// /superadmin_audit). Escrito SEMPRE via Admin SDK; leitura só para super-admin
// (ver firestore.rules). Best-effort: nunca bloqueia a ação principal.

const auditCol = () => adminDb.collection('superadmin_audit');

export async function logAudit({ action, tenantId = null, actorUid = null, details = {} }) {
  try {
    await auditCol().add({
      action,
      tenantId,
      actorUid,
      details,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('logAudit', action, err?.message || err);
  }
}
