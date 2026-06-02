// Registra um tenant EXISTENTE na coleção `tenants` (pra aparecer na tela
// "Academias" do super-admin).
//
// Útil pro tenant legado "stronix-crm-app", que já tem dados em
// artifacts/stronix-crm-app/... mas nunca teve doc no registro `tenants`
// (ele é anterior ao multi-tenant). Não cria/mexe em dados da academia —
// só grava o registro. Idempotente (merge).
//
// Uso (mesmas credenciais Admin das funções api/):
//   node --env-file=.env.local scripts/register-tenant.js <tenantId> <displayName> [primaryAdminEmail]
// Ex.:
//   node --env-file=.env.local scripts/register-tenant.js stronix-crm-app "Stronix"

import process from 'node:process';
import admin from 'firebase-admin';

const tenantId = (process.argv[2] || '').trim();
const displayName = (process.argv[3] || '').trim();
const primaryAdminEmail = (process.argv[4] || '').trim().toLowerCase();

if (!tenantId || !displayName) {
  console.error('Uso: node scripts/register-tenant.js <tenantId> <displayName> [primaryAdminEmail]');
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

async function run() {
  const ref = db.collection('tenants').doc(tenantId);
  const existing = await ref.get();

  const data = {
    displayName,
    status: 'active',
    registeredManually: true
  };
  if (primaryAdminEmail) data.primaryAdminEmail = primaryAdminEmail;
  if (!existing.exists) data.createdAt = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(data, { merge: true });

  console.log(`${existing.exists ? 'Atualizado' : 'Registrado'}: tenants/${tenantId} → "${displayName}" (status: active).`);
  console.log('Recarregue a tela "Academias" no CRM — a academia deve aparecer na lista.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
