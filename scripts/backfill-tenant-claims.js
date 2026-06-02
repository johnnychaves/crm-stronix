// Backfill de custom claims de tenant (Fase 1 do multi-tenancy).
//
// Define o custom claim `tenantId` em TODOS os usuários existentes do Firebase
// Auth e grava o campo `tenantId` no doc de cada usuário em stronix_users.
// Idempotente: pula quem já tem o claim correto. Preserva claims existentes
// (ex.: superAdmin). Roda UMA vez, fora do app, antes de subir a Fase 2.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-tenant-claims.js [tenantId]
//
// tenantId default = "stronix-crm-app" (o tenant #1, dados atuais do Johnny).

import process from 'node:process';
import admin from 'firebase-admin';

const TENANT_ID = process.argv[2] || 'stronix-crm-app';
const USERS_PATH = 'stronix_users';

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

const auth = admin.auth();
const db = admin.firestore();

const usersCol = db
  .collection('artifacts').doc(TENANT_ID)
  .collection('public').doc('data')
  .collection(USERS_PATH);

async function run() {
  console.log(`Backfill de claim tenantId="${TENANT_ID}" iniciando...`);
  let processed = 0;
  let claimsSet = 0;
  let docsUpdated = 0;
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      processed++;
      const current = user.customClaims || {};
      if (current.tenantId !== TENANT_ID) {
        // Preserva quaisquer claims existentes (ex.: superAdmin) e só ajusta o tenantId.
        await auth.setCustomUserClaims(user.uid, { ...current, tenantId: TENANT_ID });
        claimsSet++;
        console.log(`  claim set: ${user.email || user.uid}`);
      }
      // Denormaliza tenantId no doc do usuário (match por authUid).
      const snap = await usersCol.where('authUid', '==', user.uid).limit(1).get();
      if (!snap.empty && snap.docs[0].data()?.tenantId !== TENANT_ID) {
        await snap.docs[0].ref.set({ tenantId: TENANT_ID }, { merge: true });
        docsUpdated++;
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`Concluído. Usuários processados: ${processed} | claims novos: ${claimsSet} | docs atualizados: ${docsUpdated}.`);
  console.log('Obs.: usuários logados só verão o claim após o token renovar (~1h) ou no próximo login (o app força refresh quando o claim falta).');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
