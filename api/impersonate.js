import { adminAuth, adminDb, verifyRequest } from './_firebaseAdmin.js';
import { usersCollection } from './_auth.js';
import { logAudit } from './_audit.js';

// "Entrar como" — o super-admin assume a sessão do admin de um tenant para dar
// suporte/diagnosticar. SUPER-ADMIN only.
//
// Devolve dois custom tokens:
//   - token:       assume a sessão do admin do tenant (claims extra
//                  impersonatedBy/impersonatedTenant sinalizam a impersonação).
//   - returnToken: custom token do próprio super-admin, para voltar em 1 clique
//                  (gerado agora, enquanto a requisição ainda é autenticada como
//                  super-admin — depois de trocar a sessão isso não seria possível).
//
// Registra a entrada no log de auditoria. NÃO afrouxa as Firestore rules: a
// sessão assumida é um admin de tenant normal e passa pelas regras existentes.

async function resolveTenantAdmin(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  if (!tenantSnap.exists) return { error: 'not-found' };
  const data = tenantSnap.data() || {};
  // 1) primaryAdminUid do registro do tenant (caminho normal).
  if (data.primaryAdminUid) return { adminUid: data.primaryAdminUid, tenant: data };
  // 2) fallback p/ tenants legados (registrados via script, sem primaryAdminUid):
  //    1º usuário com role 'admin' no stronix_users.
  const snap = await usersCollection(tenantId).where('role', '==', 'admin').limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { adminUid: d.data()?.authUid || d.id, tenant: data };
  }
  return { error: 'no-admin', tenant: data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) return res.status(403).json({ error: 'Apenas o super-admin pode entrar como cliente.' });

  try {
    const tenantId = String(req.body?.tenantId || '').trim().toLowerCase();
    if (!tenantId) return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });

    const resolved = await resolveTenantAdmin(tenantId);
    if (resolved.error === 'not-found') return res.status(404).json({ error: `Organização "${tenantId}" não encontrada.` });
    if (resolved.error === 'no-admin') return res.status(409).json({ error: 'Esta organização não tem um admin para entrar como.' });

    const { adminUid, tenant } = resolved;

    // Não deixa impersonar uma org suspensa/arquivada (o acesso já é bloqueado
    // pelas rules; a sessão cairia direto na tela de bloqueio).
    if (tenant?.archived === true || tenant?.status === 'suspended') {
      return res.status(409).json({ error: 'Reative a organização antes de entrar como ela.' });
    }

    // O token de RETORNO (do super-admin) NÃO é gerado aqui nem guardado no
    // cliente — seria um custom token de super-admin reutilizável exposto a
    // qualquer XSS na sessão do cliente. O retorno é emitido on-demand em
    // /api/impersonate-return, que valida o claim impersonatedBy da sessão.
    const token = await adminAuth.createCustomToken(adminUid, {
      tenantId, // garante o tenant certo mesmo se o admin legado não tiver o claim persistido
      impersonatedBy: auth.uid,
      impersonatedTenant: tenantId,
    });

    await logAudit({
      action: 'impersonate.start',
      tenantId,
      actorUid: auth.uid,
      details: { adminUid, tenantName: tenant?.displayName || tenantId },
    });

    return res.status(200).json({
      ok: true,
      token,
      tenantName: tenant?.displayName || tenantId,
      adminUid,
    });
  } catch (error) {
    console.error('impersonate', error);
    return res.status(500).json({ error: 'Erro ao gerar o acesso de visualização.' });
  }
}
