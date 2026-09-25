// Ponte com o Stronizap. Um sentido só nesta Parte A: o Zap pergunta quem é a
// pessoa por trás de um telefone e recebe o cartão de contexto.
//
// O GET procura também os menores que têm aquele telefone como responsável
// (`guardianZapMatchKey`), e o `match` conta o número do responsável como
// cadastro enquanto ele é o contato do menor.
//
// Autenticação por chave emitida no Stronilead (Configurações → Integrações),
// guardada aqui só como hash em tenants/{id}.integrations.zap.keyHash.
//
// O POST tem dois donos. `generate` e `revoke` são do admin da academia, logado
// no CRM, e autenticam por verifyRequest (ID token). `match` é do próprio
// Stronizap e autentica pela chave, igual ao GET. O desvio fica na primeira
// linha de handlePost, e os dois caminhos nunca se misturam.
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { withSentry } from './_sentry.js';
import { isTenantAdmin } from './_auth.js';
import { generateZapKey, verifyZapKey } from './_zapAuth.js';
import { zapMatchKey } from './_zapPhone.js';
import { buildZapCard, buildGuardianCard, buildZapWards } from './_zapCard.js';
import { contactOf } from '../src/lib/guardian.js';

const LEADS_PATH = 'stronix_leads';
// Config geral da academia (mesmo doc que PaceSection.jsx grava em
// Configurações → Metas & ritmo). Não importar src/lib/firebase.js aqui pelo
// mesmo motivo do zapStrip com dailyGoal.js: aquele módulo inicializa o SDK
// CLIENTE do Firebase (App Check, IndexedDB) e quebra em runtime de servidor.
const CONFIG_PATH = 'stronix_config';
const CONFIG_GENERAL_ID = 'general';

const MATCH_MAX = 30; // teto do operador `in` do Firestore

// Menores por responsável lidos por consulta. Irmãos de verdade passam longe
// disso; o teto só impede um número muito compartilhado de pesar a rota.
const WARDS_MAX = 10;

// Campos de data que os módulos puros esperam como Date. O Firestore devolve
// Timestamp.
const DATE_FIELDS = [
  'currentContractStartsAt', 'currentContractEndsAt',
  'appointmentScheduledFor', 'nextFollowUp', 'lastInteractionAt',
  'birthDate', 'createdAt'
];

const leadDoDoc = (doc) => {
  const lead = { id: doc.id, ...doc.data() };
  for (const campo of DATE_FIELDS) {
    if (lead[campo]?.toDate) lead[campo] = lead[campo].toDate();
  }
  return lead;
};

// Mesmo formato de identificador que tenant-resolve.js aceita. Validar antes de
// ir ao Firestore impede que "a/b" vire caminho aninhado e que um objeto no
// lugar do texto derrube a função antes da autenticação.
const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const leadsCollection = (tenantId) =>
  adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(LEADS_PATH);

// Integração do tenant, ou null quando o tenant não existe, nunca gerou chave
// (sem keyHash) ou teve a chave revogada.
async function loadZapIntegration(tenantId) {
  const tenantSnap = await adminDb.collection('tenants').doc(tenantId).get();
  const zap = tenantSnap.exists ? tenantSnap.data()?.integrations?.zap : null;
  if (!zap?.keyHash || zap.revokedAt) return null;
  return zap;
}

export default withSentry(async function handler(req, res) {
  if (req.method === 'POST') return handlePost(req, res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const chave = req.headers['x-stronizap-key'];
  const tenantId = req.query.tenant;
  const matchKey = zapMatchKey(req.query.phone);

  if (!chave || !tenantId) {
    res.status(401).json({ error: 'Credencial ausente' });
    return;
  }
  // Mesmo formato do match. Fora dele responde igual a chave errada, e nunca
  // chega ao Firestore: "a/b" viraria caminho aninhado e lançaria erro antes
  // da autenticação.
  if (typeof tenantId !== 'string' || !TENANT_RE.test(tenantId)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }
  if (!matchKey) {
    res.status(400).json({ error: 'Telefone inválido' });
    return;
  }

  // Tenant inexistente responde igual a chave errada: não confirmamos quais
  // academias existem para quem não tem credencial.
  const zap = await loadZapIntegration(tenantId);
  if (!zap || !verifyZapKey(chave, zap.keyHash)) {
    res.status(401).json({ error: 'Credencial inválida' });
    return;
  }

  // O dono do número e os menores que o têm como responsável, juntos. A busca
  // dos menores não pode derrubar o cartão do dono: se ela falhar (índice
  // desligado no console, por exemplo), o cartão sai sem os menores.
  const [achados, menoresSnap] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', '==', matchKey).limit(1).get(),
    leadsCollection(tenantId).where('guardianZapMatchKey', '==', matchKey).limit(WARDS_MAX).get()
      .catch(() => null)
  ]);
  const menoresDocs = menoresSnap ? menoresSnap.docs : [];

  const agora = new Date();
  const dono = achados.empty ? null : leadDoDoc(achados.docs[0]);
  // Só quem ainda tem o responsável como contato (menor, ou que fez 18 sem
  // WhatsApp próprio), e nunca o próprio dono do número.
  const menores = menoresDocs
    .map(leadDoDoc)
    .filter((m) => m.id !== dono?.id && contactOf(m, agora).viaGuardian);

  if (!dono && menores.length === 0) {
    res.status(200).json({ found: false });
    return;
  }

  // Marcos de renovação da academia. Só lê depois de achar alguém: em
  // 'found: false' não há faixa pra montar, então não vale o custo da
  // consulta. Doc inexistente (academia nunca abriu Configurações → Metas &
  // ritmo) ou campo ausente/malformado: buildZapCard/buildZapStrip caem no
  // padrão 90/60/30 sozinhos, não precisa validar aqui.
  const configSnap = await adminDb.collection('artifacts').doc(tenantId)
    .collection('public').doc('data').collection(CONFIG_PATH).doc(CONFIG_GENERAL_ID).get();
  const renewalCheckpoints = configSnap.exists ? configSnap.data()?.renewalCheckpoints : undefined;

  let card;
  if (dono) {
    card = buildZapCard(dono, agora, renewalCheckpoints);
    if (menores.length > 0) card.wards = buildZapWards(menores, agora, renewalCheckpoints);
  } else {
    card = buildGuardianCard(menores, agora, renewalCheckpoints);
  }

  res.setHeader('Cache-Control', 'private, max-age=120');
  res.status(200).json(card);
});

// Gera e revoga a chave de conexão do Stronizap (ação do admin da academia, pela
// tela de Configurações → Integrações) e responde o match em lote (ação do
// próprio Stronizap, autenticada pela chave). Ver o desvio logo abaixo.
async function handlePost(req, res) {
  // A ação match é a única do POST que autentica pela chave do Zap. As outras
  // duas (generate e revoke) são do admin logado e seguem exigindo ID token.
  if (req.body?.action === 'match') return handleMatch(req, res);

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

// Diz quais dos telefones recebidos têm cadastro nesta academia. Devolve os
// telefones NA FORMA EM QUE CHEGARAM, para o Stronizap não precisar recalcular
// a chave de casamento. Nada além disso sai daqui: nem nome, nem id, nem plano.
async function handleMatch(req, res) {
  const chave = req.headers['x-stronizap-key'];
  const tenantId = req.body?.tenant;
  const phones = req.body?.phones;

  if (!chave || !tenantId) {
    return res.status(401).json({ error: 'Credencial ausente' });
  }
  // Identificador fora do formato responde igual a chave errada: não dá pista
  // de quais academias existem.
  if (typeof tenantId !== 'string' || !TENANT_RE.test(tenantId)) {
    return res.status(401).json({ error: 'Credencial inválida' });
  }
  if (!Array.isArray(phones)) {
    return res.status(400).json({ error: 'Envie a lista de telefones em phones.' });
  }
  if (phones.length > MATCH_MAX) {
    return res.status(400).json({ error: `No máximo ${MATCH_MAX} telefones por chamada.` });
  }

  const zap = await loadZapIntegration(tenantId);
  if (!zap || !verifyZapKey(chave, zap.keyHash)) {
    return res.status(401).json({ error: 'Credencial inválida' });
  }

  // Telefone que não vira chave válida (menos de 10 dígitos) fica fora da
  // consulta e volta como não encontrado, sem derrubar o lote. Dois telefones
  // podem cair na mesma chave (com e sem o nono dígito), e os dois voltam.
  const porMatchKey = new Map();
  for (const phone of phones) {
    if (typeof phone !== 'string') continue;
    const matchKey = zapMatchKey(phone);
    if (!matchKey) continue;
    const lista = porMatchKey.get(matchKey) || [];
    lista.push(phone);
    porMatchKey.set(matchKey, lista);
  }
  if (porMatchKey.size === 0) {
    return res.status(200).json({ found: [] });
  }

  const chaves = [...porMatchKey.keys()];
  const [snap, snapMenores] = await Promise.all([
    leadsCollection(tenantId).where('zapMatchKey', 'in', chaves).select('zapMatchKey').get(),
    leadsCollection(tenantId)
      .where('guardianZapMatchKey', 'in', chaves)
      .select('guardianZapMatchKey', 'isMinor', 'guardian', 'birthDate', 'whatsapp')
      .get()
  ]);
  const found = new Set();
  for (const doc of snap.docs) {
    for (const phone of porMatchKey.get(doc.data()?.zapMatchKey) || []) found.add(phone);
  }
  // Responsável conta como cadastro enquanto é o contato do menor.
  const agora = new Date();
  for (const doc of snapMenores.docs) {
    const menor = leadDoDoc(doc);
    if (!contactOf(menor, agora).viaGuardian) continue;
    for (const phone of porMatchKey.get(menor.guardianZapMatchKey) || []) found.add(phone);
  }
  return res.status(200).json({ found: [...found] });
}
