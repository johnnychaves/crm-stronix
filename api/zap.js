// Ponte com o Stronizap. Um sentido só nesta Parte A: o Zap pergunta quem é a
// pessoa por trás de um telefone e recebe o cartão de contexto.
//
// Autenticação por chave emitida no Stronilead (Configurações → Integrações),
// guardada aqui só como hash em tenants/{id}.integrations.zap.keyHash.
//
// O POST é o outro lado da ponte: quem GERA e REVOGA a chave é o admin da
// academia, logado no CRM — autenticado por verifyRequest (ID token), nunca
// pela própria chave do Zap.
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { withSentry } from './_sentry.js';
import { isTenantAdmin } from './_auth.js';
import { generateZapKey, verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard } from './_zapCard.js';

const LEADS_PATH = 'stronix_leads';
// Config geral da academia (mesmo doc que PaceSection.jsx grava em
// Configurações → Metas & ritmo). Não importar src/lib/firebase.js aqui pelo
// mesmo motivo do zapStrip com dailyGoal.js: aquele módulo inicializa o SDK
// CLIENTE do Firebase (App Check, IndexedDB) e quebra em runtime de servidor.
const CONFIG_PATH = 'stronix_config';
const CONFIG_GENERAL_ID = 'general';

export default withSentry(async function handler(req, res) {
  if (req.method === 'POST') return handlePost(req, res);

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

  // Marcos de renovação da academia. Só lê depois de achar o lead — em
  // 'found: false' não há faixa pra montar, então não vale o custo da
  // consulta. Doc inexistente (academia nunca abriu Configurações → Metas &
  // ritmo) ou campo ausente/malformado: buildZapCard/buildZapStrip caem no
  // padrão 90/60/30 sozinhos, não precisa validar aqui.
  const configSnap = await adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(CONFIG_PATH).doc(CONFIG_GENERAL_ID).get();
  const renewalCheckpoints = configSnap.exists ? configSnap.data()?.renewalCheckpoints : undefined;

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(buildZapCard(lead, new Date(), renewalCheckpoints));
});

// Gera e revoga a chave de conexão do Stronizap. Ação do admin da academia,
// pela tela de Configurações → Integrações — nunca pelo próprio Zap.
async function handlePost(req, res) {
  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Só o admin da academia pode alterar a integração' });
    }

    const { action } = req.body || {};
    const tenantRef = adminDb.collection('tenants').doc(auth.tenantId);

    if (action === 'generate') {
      const { key, keyPrefix, keyHash } = generateZapKey();
      await tenantRef.set({
        integrations: {
          zap: {
            keyHash,
            keyPrefix,
            revokedAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.uid
          }
        }
      }, { merge: true });
      // Única vez que a chave em claro sai do servidor: quem perder isto tem
      // que gerar outra.
      return res.status(200).json({ key, keyPrefix });
    }

    if (action === 'revoke') {
      await tenantRef.set({
        integrations: {
          zap: { revokedAt: admin.firestore.FieldValue.serverTimestamp() }
        }
      }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error) {
    console.error('zap POST', error);
    return res.status(500).json({ error: 'Erro interno ao alterar a integração.' });
  }
}
