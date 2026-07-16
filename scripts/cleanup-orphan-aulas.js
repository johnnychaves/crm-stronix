// Limpeza de aulas órfãs (histórico de aulas — entrega 2, PR-B).
//
// Quando um lead é EXCLUÍDO definitivamente, os docs que ele tinha em
// stronix_aulas ficam órfãos: a regra do Firestore bloqueia delete client-side
// nessa coleção, então eles permanecem e continuam contando no dashboard
// (histórico de aulas por professor). Este script varre stronix_aulas e apaga
// (via Admin SDK, que ignora as regras) qualquer doc cujo `leadId` não aponte
// mais para um lead existente.
//
// Uso — credenciais Admin, escolha UMA:
//   A) RECOMENDADO (sem colar a private key): baixe o serviceAccount.json
//      (Firebase Console → Config. do projeto → Contas de serviço → Gerar nova
//      chave privada) e aponte:
//        GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json \
//        node scripts/cleanup-orphan-aulas.js --tenant=stronix-crm-app
//   B) as 3 vars (mesmas das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/cleanup-orphan-aulas.js [--tenant=stronix-crm-app] [--commit]
//
// Flags:
//   --tenant=<id>   tenant a limpar (default "stronix-crm-app", dados do Johnny)
//   --commit        apaga de verdade (default: DRY-RUN — só conta e loga amostra, não apaga nada)
//
// Segurança: só APAGA aulas cujo lead não existe mais. Nunca mexe em aulas com
// lead vivo, nunca mexe em leads.

import process from 'node:process';
import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Paths (espelham src/lib/firebase.js) e flags
// ---------------------------------------------------------------------------
const LEADS_PATH = 'stronix_leads';
const AULAS_PATH = 'stronix_aulas';

function parseArgs(argv) {
  let tenant = 'stronix-crm-app';
  let commit = false;
  for (const a of argv) {
    if (a === '--commit') commit = true;
    else if (a.startsWith('--tenant=')) tenant = a.slice('--tenant='.length);
  }
  return { tenant, commit };
}

const { tenant, commit } = parseArgs(process.argv.slice(2));

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const hasCertVars = Boolean(projectId && clientEmail && privateKey);
const hasAdc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

if (!hasCertVars && !hasAdc) {
  console.error(
    'Faltam credenciais Admin. Escolha UMA:\n' +
    '  A) GOOGLE_APPLICATION_CREDENTIALS=<caminho do serviceAccount.json>  (recomendado — sem colar a chave)\n' +
    '  B) as 3 vars FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY'
  );
  process.exit(1);
}

if (!admin.apps.length) {
  // Preferir o arquivo JSON (ADC) quando disponível: evita o inferno de aspas/\n
  // da private key colada no shell, causa nº 1 de "16 UNAUTHENTICATED".
  admin.initializeApp(hasAdc
    ? { credential: admin.credential.applicationDefault() }
    : { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const db = admin.firestore();
const dataDoc = db.collection('artifacts').doc(tenant).collection('public').doc('data');
const leadsCol = dataDoc.collection(LEADS_PATH);
const aulasCol = dataDoc.collection(AULAS_PATH);

const MAX_SAMPLES = 20;
const BATCH_LIMIT = 400; // Firestore: 500 ops/batch — teto conservador.

async function loadLeadIds() {
  const ids = new Set();
  console.log('Carregando ids de leads...');
  for await (const doc of leadsCol.select().stream()) {
    ids.add(doc.id);
  }
  return ids;
}

async function run() {
  console.log(`Limpeza de aulas órfãs — tenant="${tenant}" | ${commit ? 'GRAVANDO' : 'DRY-RUN (não grava)'}`);

  const leadIds = await loadLeadIds();
  console.log(`  ...${leadIds.size} lead(s) carregado(s).`);

  let scanned = 0;
  let orphan = 0;
  const samples = [];

  let batch = commit ? db.batch() : null;
  let pendingOps = 0;

  console.log('Varrendo aulas...');
  for await (const doc of aulasCol.stream()) {
    scanned++;
    const aula = doc.data();
    const leadId = aula.leadId;

    const isOrphan = !leadId || !leadIds.has(leadId);
    if (!isOrphan) continue;

    orphan++;

    if (samples.length < MAX_SAMPLES) {
      samples.push(`  [${commit ? 'APAGAR' : 'DRY'}] aula=${doc.id} leadId=${leadId || '—'} leadName=${aula.leadName || '—'} professorName=${aula.professorName || '—'} status=${aula.status || '—'}`);
    }

    if (commit) {
      batch.delete(doc.ref);
      pendingOps += 1;
      if (pendingOps >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        pendingOps = 0;
      }
    }

    if (scanned % 500 === 0) console.log(`  ...${scanned} aulas varridas (${orphan} órfãs até aqui)`);
  }

  if (commit && pendingOps > 0) await batch.commit();

  console.log(samples.join('\n'));
  console.log(`Aulas varridas: ${scanned} | órfãs (sem lead correspondente): ${orphan}${samples.length < orphan ? ` (amostra: ${samples.length})` : ''}.`);
  console.log(commit
    ? `Concluído. ${orphan} aula(s) órfã(s) removida(s) de ${AULAS_PATH}.`
    : `DRY-RUN: nada foi gravado. ${orphan} aula(s) órfã(s) seriam removidas. Rode de novo com --commit para gravar.`);
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
