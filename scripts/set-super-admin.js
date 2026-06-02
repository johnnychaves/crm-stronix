// Bootstrap do super-admin (Fase 3 do multi-tenancy).
//
// Define o custom claim `superAdmin: true` num usuário (raiz de confiança que
// pode provisionar academias). Preserva os claims existentes (ex.: tenantId).
// Rodar UMA vez, fora do app.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... FIREBASE_ADMIN_PRIVATE_KEY="..." \
//     node scripts/set-super-admin.js <email-ou-uid>

import process from 'node:process';
import admin from 'firebase-admin';

const target = process.argv[2];
if (!target) {
  console.error('Uso: node scripts/set-super-admin.js <email-ou-uid>');
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

async function run() {
  const user = target.includes('@')
    ? await auth.getUserByEmail(target.trim().toLowerCase())
    : await auth.getUser(target.trim());

  const current = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, { ...current, superAdmin: true });

  console.log(`superAdmin definido para ${user.email || user.uid}.`);
  console.log('Claims atuais:', { ...current, superAdmin: true });
  console.log('Faça logout/login no CRM para o token pegar o novo claim.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
