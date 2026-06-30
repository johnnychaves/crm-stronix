// Saneamento de posse de leads — corrige o "split-brain" consultantId × consultantAuthUid.
//
// CONTEXTO: o "Editar cadastro" (EditLeadModal / antigo renderEditDialog)
// reatribuía o consultor gravando só consultantId/consultantName e deixando
// consultantAuthUid (a chave de permissão/atribuição usada pelas regras do
// Firestore, ranking e contrato da matrícula) apontando para o dono ANTIGO.
// O fix no app já não cria mais divergências; este script conserta os dados
// JÁ gravados em produção. Bug pré-existente, então pode haver leads tortos.
//
// REGRA DE REPARO: confia no consultantId (campo que o admin escolheu de
// propósito na reatribuição) e realinha consultantAuthUid a partir do usuário
// cujo doc.id === lead.consultantId. Nenhum fluxo grava authUid sem consultantId,
// então o consultantId é sempre o valor "mais recente/intencional".
//   - Se o consultor pretendido (consultantId) ainda NÃO tem authUid (nunca
//     logou), NÃO zera o authUid atual — apenas reporta p/ revisão manual.
//   - FALLBACK: lead cujo consultantId não resolve p/ nenhum usuário, mas com
//     consultantAuthUid válido → realinha consultantId/Name pelo authUid.
//   - Sem consultantId nem authUid resolvíveis → reporta como ÓRFÃO (resolver
//     em Configurações → Transferir leads, fluxo de "consultor excluído").
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/fix-consultant-ownership.js [tenantId] [--apply] [--contracts]
//
//   - Sem --apply:  DRY-RUN — só lista o que MUDARIA; não grava nada. (default)
//   - --apply:      grava as correções.
//   - --contracts:  também sanea stronix_contratos (histórico de matrículas) com
//                   a mesma regra — corrige atribuição de ranking/comissão.
//   - tenantId default = "stronix-crm-app" (tenant #1, dados atuais do Johnny).

import process from 'node:process';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FIX_CONTRACTS = args.includes('--contracts');
const TENANT_ID = args.find((a) => !a.startsWith('--')) || 'stronix-crm-app';

const USERS_PATH = 'stronix_users';
const LEADS_PATH = 'stronix_leads';
const CONTRACTS_PATH = 'stronix_contratos';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Faltam env vars: FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const db = admin.firestore();

const dataCol = (path) =>
  db.collection('artifacts').doc(TENANT_ID).collection('public').doc('data').collection(path);

// Índices dos usuários do tenant: por doc.id (== consultantId) e por authUid.
async function loadUsers() {
  const snap = await dataCol(USERS_PATH).get();
  const byId = new Map();
  const byAuthUid = new Map();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const rec = { id: doc.id, authUid: d.authUid || null, name: d.name || null };
    byId.set(doc.id, rec);
    if (rec.authUid) byAuthUid.set(rec.authUid, rec);
  });
  return { byId, byAuthUid };
}

let USERS = null;

// Planeja o reparo de UM doc (lead/contrato). Retorna:
//   null                       → já consistente / sem dono (ignora)
//   { patch, reason }          → campos a gravar (merge)
//   { review: true, reason }   → consultor pretendido sem authUid (não mexe)
//   { orphan: true, reason }   → nenhum dono resolvível (transferência manual)
function planFix(d) {
  const cId = d.consultantId || null;
  const cAuth = d.consultantAuthUid || null;
  const cName = d.consultantName || null;

  const uById = cId ? USERS.byId.get(cId) : null;

  if (uById) {
    const expAuth = uById.authUid || null;
    // Consultor pretendido ainda não tem authUid (nunca logou): não dá pra
    // realinhar a posse sem APAGAR o authUid atual — reporta em vez de zerar.
    if (!expAuth && cAuth) {
      return { review: true, reason: `consultantId=${cId} sem authUid (consultor precisa logar); authUid atual=${cAuth}` };
    }
    // Só age quando o authUid diverge (o split-brain). O nome só é ajustado de
    // quebra quando já vamos gravar o doc.
    if (expAuth && cAuth !== expAuth) {
      const patch = { consultantAuthUid: expAuth };
      if (uById.name && cName !== uById.name) patch.consultantName = uById.name;
      return { patch, reason: `consultantId=${cId}: authUid ${cAuth ?? '∅'} ⇒ ${expAuth}` };
    }
    return null; // authUid já bate
  }

  // consultantId não resolve p/ nenhum usuário → tenta pelo authUid.
  const uByAuth = cAuth ? USERS.byAuthUid.get(cAuth) : null;
  if (uByAuth) {
    const patch = {};
    if (cId !== uByAuth.id) patch.consultantId = uByAuth.id;
    if (uByAuth.name && cName !== uByAuth.name) patch.consultantName = uByAuth.name;
    if (Object.keys(patch).length === 0) return null;
    return { patch, reason: `consultantId órfão; realinhado pelo authUid=${cAuth} → ${uByAuth.id}` };
  }

  if (cId || cAuth) return { orphan: true, reason: `sem usuário p/ consultantId=${cId ?? '∅'} nem authUid=${cAuth ?? '∅'}` };
  return null; // lead sem dono (não atribuído) — ignora
}

async function sweep(path) {
  const snap = await dataCol(path).get();
  let scanned = 0, toFix = 0, fixed = 0, review = 0, orphans = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data() || {};
    const who = data.name || data.leadName || '—';
    const plan = planFix(data);
    if (!plan) continue;

    if (plan.orphan) {
      orphans++;
      console.log(`  [ÓRFÃO ] ${path}/${doc.id} (${who}): ${plan.reason}`);
      continue;
    }
    if (plan.review) {
      review++;
      console.log(`  [REVISAR] ${path}/${doc.id} (${who}): ${plan.reason}`);
      continue;
    }

    toFix++;
    console.log(`  [${APPLY ? 'FIX  ' : 'DRY  '}] ${path}/${doc.id} (${who}): ${JSON.stringify(plan.patch)} — ${plan.reason}`);
    if (APPLY) {
      batch.set(doc.ref, plan.patch, { merge: true });
      pending++;
      fixed++;
      if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }
  if (APPLY && pending > 0) await batch.commit();
  return { scanned, toFix, fixed, review, orphans };
}

async function run() {
  console.log(`\nSaneamento de posse — tenant="${TENANT_ID}" — modo=${APPLY ? 'APLICAR' : 'DRY-RUN'}${FIX_CONTRACTS ? ' (+contratos)' : ''}\n`);
  USERS = await loadUsers();
  console.log(`Usuários carregados: ${USERS.byId.size} (com authUid: ${USERS.byAuthUid.size}).\n`);

  console.log('— stronix_leads —');
  const l = await sweep(LEADS_PATH);
  console.log(`  leads: ${l.scanned} varridos | ${l.toFix} divergentes${APPLY ? ` | ${l.fixed} corrigidos` : ''} | ${l.review} p/ revisar | ${l.orphans} órfãos.\n`);

  if (FIX_CONTRACTS) {
    console.log('— stronix_contratos —');
    const c = await sweep(CONTRACTS_PATH);
    console.log(`  contratos: ${c.scanned} varridos | ${c.toFix} divergentes${APPLY ? ` | ${c.fixed} corrigidos` : ''} | ${c.review} p/ revisar | ${c.orphans} órfãos.\n`);
  }

  if (!APPLY) {
    console.log('DRY-RUN: nada foi gravado. Revise a lista acima e rode de novo com --apply para aplicar.');
  } else {
    console.log('Concluído. Divergências de authUid realinhadas.');
  }
  console.log('[REVISAR] = consultor pretendido sem authUid (precisa logar). [ÓRFÃO] = use Configurações → Transferir leads.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
