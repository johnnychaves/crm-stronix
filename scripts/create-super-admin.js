// Cria (ou atualiza) uma conta de SUPER-ADMIN da plataforma e marca o claim.
//
// Diferente do set-super-admin.js (que exige a conta já existir), este:
//  - cria a conta no Firebase Auth se ela não existir (com a senha informada);
//  - se já existir, apenas atualiza a senha;
//  - em ambos os casos, grava o claim superAdmin: true (preservando outros claims).
//
// O super-admin não precisa pertencer a nenhuma academia: ao logar, cai direto
// na tela "Academias" (suporte adicionado no app).
//
// Uso (mesmas credenciais Admin das funções api/):
//   node --env-file=.env.local scripts/create-super-admin.js <email> <senha>
//   (senha: mínimo 6 caracteres)

import process from 'node:process';
import admin from 'firebase-admin';

const email = (process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || '';

if (!email || !password) {
  console.error('Uso: node scripts/create-super-admin.js <email> <senha>');
  process.exit(1);
}
if (password.length < 6) {
  console.error('A senha precisa ter ao menos 6 caracteres.');
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
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password });
    console.log(`Conta já existia — senha atualizada: ${email}`);
  } catch (err) {
    if (err?.errorInfo?.code === 'auth/user-not-found') {
      user = await auth.createUser({ email, password });
      console.log(`Conta criada: ${email}`);
    } else {
      throw err;
    }
  }

  const current = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, { ...current, superAdmin: true });

  console.log('superAdmin: true definido.');
  console.log(`Pronto. Logue no CRM com ${email} + a senha informada → você cai na tela "Academias".`);
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
