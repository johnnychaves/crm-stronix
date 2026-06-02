import { adminDb } from './_firebaseAdmin.js';

const LEADS_PATH = 'stronix_leads';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token ausente' });
    }

    // Multi-tenant: o token CSAT é aleatório de 192 bits (globalmente único),
    // então buscamos em TODOS os tenants via collectionGroup. Links já enviados
    // continuam válidos (a URL não muda).
    const snap = await adminDb
      .collectionGroup(LEADS_PATH)
      .where('csatToken', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: 'Token inválido' });
    }

    const leadDoc = snap.docs[0];
    const lead = leadDoc.data();

    if (lead.csatStatus === 'answered') {
      return res.status(409).json({ error: 'CSAT já respondido' });
    }

    return res.status(200).json({
      leadId: leadDoc.id,
      name: lead.name || '',
      stage: lead.csatRequestedStage || 'pos_agendamento'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao carregar CSAT' });
  }
}