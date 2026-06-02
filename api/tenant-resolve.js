import { adminDb } from './_firebaseAdmin.js';

// Resolve PÚBLICO de organização por slug (?slug=ironfit).
// Usado pela tela de login (pré-autenticação) para mostrar a MARCA da academia
// identificada pela URL (crmstronix.com.br/#<slug>). Retorna apenas dados
// públicos (nome) — nunca ownerEmail/plan/status/etc. O acesso aos dados
// continua 100% gateado pelo login + claim tenantId + Firestore Rules; este
// endpoint só informa "qual academia" para a UI do login.
//
// Vercel serverless function (não Express) — consistente com os demais api/.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const slug = String(req.query?.slug || '').trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  try {
    const snap = await adminDb.collection('tenants').doc(slug).get();
    if (!snap.exists) {
      return res.status(200).json({ found: false });
    }
    const data = snap.data() || {};
    return res.status(200).json({
      found: true,
      tenantId: snap.id,
      displayName: data.displayName || snap.id
    });
  } catch (err) {
    console.error('tenant-resolve:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao resolver organização.' });
  }
}
