import { adminAuth, adminDb, verifyRequest } from './_firebaseAdmin.js';
import { usersCollection } from './_auth.js';
import { logAudit } from './_audit.js';

// "Entrar como" — duas ações num só endpoint (o plano Hobby do Vercel limita o
// nº de Serverless Functions, então start+return moram aqui):
//
//   POST { action: 'start', tenantId } → SUPER-ADMIN assume a sessão do admin do
//     tenant. Devolve um custom token (claims tenantId + impersonatedBy).
//   POST { action: 'return' }          → de uma sessão impersonada, volta ao
//     super-admin. Autorizado pelo claim impersonatedBy; devolve o token de
//     retorno ON-DEMAND (nada reutilizável fica guardado no cliente).
//
// NÃO afrouxa as Firestore rules: a sessão assumida é um admin de tenant normal.

async function resolveTenantAdmin(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  if (!tenantSnap.exists) return { error: 'not-found' };
  const data = tenantSnap.data() || {};
  // 1) primaryAdminUid do registro do tenant (caminho normal).
  if (data.primaryAdminUid) return { adminUid: data.primaryAdminUid, tenant: data };
  // 2) fallback p/ tenants legados (sem primaryAdminUid): 1º usuário role 'admin'.
  const snap = await usersCollection(tenantId).where('role', '==', 'admin').limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { adminUid: d.data()?.authUid || d.id, tenant: data };
  }
  return { error: 'no-admin', tenant: data };
}

// Volta ao super-admin: emite o token de retorno on-demand, autorizado pelo
// claim impersonatedBy da sessão atual (que precisa apontar para um super-admin).
async function handleReturn(auth, res) {
  const superUid = auth.impersonatedBy;
  if (!superUid) return res.status(403).json({ error: 'Esta sessão não é uma visualização.' });
  const userRecord = await adminAuth.getUser(superUid);
  if (userRecord.customClaims?.superAdmin !== true) {
    return res.status(403).json({ error: 'Conta de retorno inválida.' });
  }
  const returnToken = await adminAuth.createCustomToken(superUid);
  await logAudit({ action: 'impersonate.stop', tenantId: auth.tenantId || null, actorUid: superUid, details: { from: auth.uid } });
  return res.status(200).json({ ok: true, returnToken });
}

// Inicia a visualização: super-admin assume a sessão do admin do tenant.
async function handleStart(auth, tenantId, res) {
  if (!auth.superAdmin) return res.status(403).json({ error: 'Apenas o super-admin pode entrar como cliente.' });
  if (!tenantId) return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });

  const resolved = await resolveTenantAdmin(tenantId);
  if (resolved.error === 'not-found') return res.status(404).json({ error: `Organização "${tenantId}" não encontrada.` });
  if (resolved.error === 'no-admin') return res.status(409).json({ error: 'Esta organização não tem um admin para entrar como.' });

  const { adminUid, tenant } = resolved;
  // Não impersona org suspensa/arquivada (o acesso já é bloqueado pelas rules).
  if (tenant?.archived === true || tenant?.status === 'suspended') {
    return res.status(409).json({ error: 'Reative a organização antes de entrar como ela.' });
  }

  const token = await adminAuth.createCustomToken(adminUid, {
    tenantId, // garante o tenant certo mesmo se o admin legado não tiver o claim persistido
    impersonatedBy: auth.uid,
    impersonatedTenant: tenantId,
  });
  await logAudit({
    action: 'impersonate.start', tenantId, actorUid: auth.uid,
    details: { adminUid, tenantName: tenant?.displayName || tenantId },
  });
  return res.status(200).json({ ok: true, token, tenantName: tenant?.displayName || tenantId, adminUid });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });

  try {
    const action = req.body?.action || 'start';
    if (action === 'return') return await handleReturn(auth, res);
    const tenantId = String(req.body?.tenantId || '').trim().toLowerCase();
    return await handleStart(auth, tenantId, res);
  } catch (error) {
    console.error('impersonate', error);
    return res.status(500).json({ error: 'Erro na operação de visualização.' });
  }
}
