// Backfill de custom claims de tenant.
//
// Garante o custom claim `tenantId` nos usuários DE UMA academia e grava o campo
// `tenantId` no doc de cada um em stronix_users. Idempotente: pula quem já está
// certo. Preserva claims existentes (ex.: superAdmin).
//
// A versão original deste script varria `auth.listUsers()`, ou seja, TODAS as
// contas do projeto Firebase, e carimbava nelas o tenant recebido por argumento.
// Isso fazia sentido na Fase 1, quando existia uma academia só. Hoje, com várias,
// rodá-lo assim jogaria todo mundo para dentro de um único tenant: cada pessoa
// passaria a enxergar a base de outra academia e perderia a própria. Agora a
// lista de quem recebe o claim sai dos docs DAQUELE tenant, e nunca do projeto.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-tenant-claims.js <tenantId> [--apply] [--force]
//
// Sem --apply é simulação: mostra o que faria e não escreve nada.
// --force é necessário para SOBRESCREVER um claim que já aponta para outro
// tenant, que é sempre sinal de cadastro errado e merece olho humano antes.

import process from 'node:process';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const TENANT_ID = args.find((a) => !a.startsWith('--')) || '';
const USERS_PATH = 'stronix_users';

if (!TENANT_ID) {
  console.error('Uso: node scripts/backfill-tenant-claims.js <tenantId> [--apply] [--force]');
  console.error('O tenant é obrigatório. Não existe mais default: errar o alvo aqui move usuário de academia.');
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

const auth = admin.auth();
const db = admin.firestore();

const usersCol = db
  .collection('artifacts').doc(TENANT_ID)
  .collection('public').doc('data')
  .collection(USERS_PATH);

async function run() {
  console.log(`Backfill de claim tenantId="${TENANT_ID}" — modo=${APPLY ? 'APLICAR' : 'SIMULAÇÃO'}${FORCE ? ' (+force)' : ''}\n`);

  // A fonte da lista é o cadastro DESTA academia. Uma conta que não aparece aqui
  // não é usuária dela e não pode receber o claim dela.
  const docs = (await usersCol.get()).docs;
  if (docs.length === 0) {
    console.error(`Nenhum usuário em artifacts/${TENANT_ID}/public/data/${USERS_PATH}. Tenant errado?`);
    process.exit(1);
  }

  let processed = 0;
  let claimsSet = 0;
  let docsUpdated = 0;
  let skipped = 0;

  for (const docSnap of docs) {
    const data = docSnap.data() || {};
    // O doc pode ser identificado pelo authUid ou pelo próprio id (cadastro
    // criado com id == uid pelo /api/admin-create-user).
    const uid = data.authUid || docSnap.id;
    const label = data.name || data.email || uid;
    processed++;

    let user;
    try {
      user = await auth.getUser(uid);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        console.log(`  pulado (sem conta no Auth): ${label}`);
        skipped++;
        continue;
      }
      throw err;
    }

    const current = user.customClaims || {};
    if (current.tenantId === TENANT_ID) {
      // já está certo
    } else if (current.tenantId && !FORCE) {
      console.log(`  PULADO: ${label} já pertence a "${current.tenantId}". Use --force se a mudança for intencional.`);
      skipped++;
      continue;
    } else {
      // Preserva quaisquer claims existentes (ex.: superAdmin) e só ajusta o tenantId.
      if (APPLY) await auth.setCustomUserClaims(uid, { ...current, tenantId: TENANT_ID });
      claimsSet++;
      console.log(`  claim ${APPLY ? 'set' : 'seria set'}: ${label}${current.tenantId ? ` (era "${current.tenantId}")` : ''}`);
    }

    // Denormaliza tenantId no doc do usuário.
    if (data.tenantId !== TENANT_ID) {
      if (APPLY) await docSnap.ref.set({ tenantId: TENANT_ID }, { merge: true });
      docsUpdated++;
    }
  }

  console.log(`\nConcluído. Cadastros lidos: ${processed} | claims: ${claimsSet} | docs: ${docsUpdated} | pulados: ${skipped}.`);
  if (!APPLY) console.log('Simulação: nada foi escrito. Repita com --apply para valer.');
  else console.log('Obs.: usuários logados só verão o claim após o token renovar (~1h) ou no próximo login (o app força refresh quando o claim falta).');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
