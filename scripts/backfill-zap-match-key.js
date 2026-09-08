// Backfill de zapMatchKey nos leads de UMA academia.
//
// A ponte com o Stronizap (api/zap.js) casa o telefone recebido do WhatsApp
// contra o campo indexado `zapMatchKey` do lead (DDD + últimos 8 dígitos —
// api/_zapPhone.js). Esse campo só passou a ser gravado a partir da escrita
// que introduziu buildLeadSearchFields com zapMatchKey (src/lib/leadDerived.js
// e o espelho api/_referral.js); leads criados antes disso não têm o campo, e
// o Stronizap não encontra o cartão de contexto para eles até essa varredura
// rodar uma vez.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-zap-match-key.js <tenantId>
//
// Varre em lotes de 400 (limite de 500 escritas por batch do Firestore, com
// folga). Pula documento sem whatsapp aproveitável (zapMatchKey dá null) e
// documento cujo zapMatchKey já está gravado com o valor correto — só grava o
// que muda.

import process from 'node:process';
import admin from 'firebase-admin';
import { zapMatchKey } from '../api/_zapPhone.js';

const args = process.argv.slice(2);
const TENANT_ID = args.find((a) => !a.startsWith('--')) || '';
const LEADS_PATH = 'stronix_leads';
const BATCH_SIZE = 400;

if (!TENANT_ID) {
  console.error('Uso: node scripts/backfill-zap-match-key.js <tenantId>');
  console.error('O tenant é obrigatório. Não existe default: errar o alvo aqui varre a academia errada.');
  process.exit(1);
}

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

const leadsCol = db
  .collection('artifacts').doc(TENANT_ID)
  .collection('public').doc('data')
  .collection(LEADS_PATH);

async function run() {
  console.log(`Backfill de zapMatchKey — tenant="${TENANT_ID}"\n`);

  let updated = 0;
  let skipped = 0;
  let processed = 0;
  let lastDoc = null;

  for (;;) {
    let query = leadsCol.orderBy('__name__').limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let writesInBatch = 0;

    for (const docSnap of snap.docs) {
      processed++;
      const data = docSnap.data() || {};
      const novaChave = zapMatchKey(data.whatsapp);

      if (novaChave == null || novaChave === data.zapMatchKey) {
        skipped++;
        continue;
      }

      batch.set(docSnap.ref, { zapMatchKey: novaChave }, { merge: true });
      writesInBatch++;
      updated++;
    }

    if (writesInBatch > 0) await batch.commit();

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(`Concluído. Lidos: ${processed} | atualizados: ${updated} | pulados: ${skipped}.`);
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
