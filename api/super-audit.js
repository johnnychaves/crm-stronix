import { adminDb, verifyRequest } from './_firebaseAdmin.js';

// Lista as últimas entradas do log de auditoria do super-admin (atividade
// recente do painel). SUPER-ADMIN only. Vercel serverless function.

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) return res.status(403).json({ error: 'Apenas o super-admin pode ver o log.' });

  try {
    const snap = await adminDb.collection('superadmin_audit').orderBy('at', 'desc').limit(30).get();
    const entries = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        action: x.action || '',
        tenantId: x.tenantId || null,
        actorUid: x.actorUid || null,
        details: x.details || {},
        at: toMillis(x.at),
      };
    });
    return res.status(200).json({ entries });
  } catch (error) {
    console.error('super-audit', error);
    return res.status(500).json({ error: 'Erro ao carregar o log de auditoria.' });
  }
}
