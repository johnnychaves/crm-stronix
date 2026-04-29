import { adminDb } from './_firebaseAdmin.js';

const APP_ID = 'stronix-crm-app';
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

    const snap = await adminDb
      .collection('artifacts')
      .doc(APP_ID)
      .collection('public')
      .doc('data')
      .collection(LEADS_PATH)
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