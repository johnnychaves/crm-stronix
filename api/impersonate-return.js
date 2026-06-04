import { adminAuth, verifyRequest } from './_firebaseAdmin.js';
import { logAudit } from './_audit.js';

// Volta de uma sessão de "entrar como" para a conta de super-admin. O custom
// token de retorno é emitido ON-DEMAND aqui (nada reutilizável fica no cliente).
//
// Autorizado pela própria sessão impersonada: o ID token atual precisa carregar
// o claim impersonatedBy (injetado em /api/impersonate) apontando para o
// super-admin original — e esse uid precisa, de fato, ainda ser super-admin.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });

  const superUid = auth.impersonatedBy;
  if (!superUid) return res.status(403).json({ error: 'Esta sessão não é uma visualização.' });

  try {
    const userRecord = await adminAuth.getUser(superUid);
    if (userRecord.customClaims?.superAdmin !== true) {
      return res.status(403).json({ error: 'Conta de retorno inválida.' });
    }
    const returnToken = await adminAuth.createCustomToken(superUid);
    await logAudit({
      action: 'impersonate.stop',
      tenantId: auth.tenantId || null,
      actorUid: superUid,
      details: { from: auth.uid },
    });
    return res.status(200).json({ ok: true, returnToken });
  } catch (error) {
    console.error('impersonate-return', error);
    return res.status(500).json({ error: 'Erro ao voltar para o super-admin.' });
  }
}
