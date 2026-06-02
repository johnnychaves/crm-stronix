import { adminDb, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage } from './_plans.js';

// Estatísticas de uso de uma organização — SUPER-ADMIN only. Usa o Admin SDK
// (o super-admin não pode ler /artifacts de outro tenant pelas rules). Conta
// via aggregation count() — barato. GET ?tenantId=<slug>.
//
// Vercel serverless function.

const dataCol = (tenantId, name) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(name);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode ver estatísticas.' });
  }

  const tenantId = String(req.query?.tenantId || '').trim().toLowerCase();
  if (!tenantId) {
    return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });
  }

  try {
    const [seats, leadCountSnap, interactionCountSnap] = await Promise.all([
      getSeatUsage(tenantId),
      dataCol(tenantId, 'stronix_leads').count().get(),
      dataCol(tenantId, 'stronix_interactions').count().get(),
    ]);

    return res.status(200).json({
      tenantId,
      plan: seats.plan,
      maxUsers: seats.maxUsers === Infinity ? null : seats.maxUsers,
      userCount: seats.currentUsers,
      leadCount: leadCountSnap.data().count || 0,
      interactionCount: interactionCountSnap.data().count || 0,
    });
  } catch (err) {
    console.error('tenant-stats:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao obter estatísticas da organização.' });
  }
}
