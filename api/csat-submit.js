import { adminDb } from './_firebaseAdmin.js';
import admin from 'firebase-admin';

const APP_ID = 'stronix-crm-app';
const LEADS_PATH = 'stronix_leads';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { token, score, comment } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: 'Token ausente' });
    }

    const numericScore = Number(score);

    if (numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ error: 'Nota inválida' });
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

    await leadDoc.ref.set(
      {
        satisfactionScore: numericScore,
        satisfactionComment: comment || '',
        satisfactionAt: admin.firestore.FieldValue.serverTimestamp(),
        satisfactionStage: lead.csatRequestedStage || 'pos_agendamento',
        satisfactionConsultantId: lead.consultantId || null,
        satisfactionConsultantName: lead.consultantName || '',
        csatStatus: 'answered'
      },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao salvar CSAT' });
  }
}