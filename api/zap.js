// Ponte com o Stronizap. Um sentido só nesta Parte A: o Zap pergunta quem é a
// pessoa por trás de um telefone e recebe o cartão de contexto.
//
// Autenticação por chave emitida no Stronilead (Configurações → Integrações),
// guardada aqui só como hash em tenants/{id}.integrations.zap.keyHash.
import { adminDb } from './_firebaseAdmin.js';
import { withSentry } from './_sentry.js';
import { verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard } from './_zapCard.js';

const LEADS_PATH = 'stronix_leads';

export default withSentry(async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const chave = req.headers['x-stronizap-key'];
  const tenantId = String(req.query.tenant ?? '').trim();
  const matchKey = zapMatchKey(req.query.phone);

  if (!chave || !tenantId) {
    res.status(401).json({ error: 'Credencial ausente' });
    return;
  }
  if (!matchKey) {
    res.status(400).json({ error: 'Telefone inválido' });
    return;
  }

  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  // Tenant inexistente responde igual a chave errada: não confirmamos quais
  // academias existem para quem não tem credencial.
  const zap = tenantSnap.exists ? tenantSnap.data()?.integrations?.zap : null;
  if (!zap?.keyHash || zap.revokedAt || !verifyZapKey(chave, zap.keyHash)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }

  const leadsRef = adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(LEADS_PATH);
  const achados = await leadsRef.where('zapMatchKey', '==', matchKey).limit(1).get();

  if (achados.empty) {
    res.status(200).json({ found: false });
    return;
  }

  const doc = achados.docs[0];
  const lead = { id: doc.id, ...doc.data() };
  // Firestore devolve Timestamp; os módulos puros esperam Date.
  for (const campo of [
    'currentContractStartsAt', 'currentContractEndsAt',
    'appointmentScheduledFor', 'nextFollowUp', 'lastInteractionAt'
  ]) {
    if (lead[campo]?.toDate) lead[campo] = lead[campo].toDate();
  }

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(buildZapCard(lead, new Date()));
});
