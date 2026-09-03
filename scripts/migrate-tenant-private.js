// Migração: perfil e WhatsApp do responsável saem do doc raiz /tenants/{id}
// e vão para o subdocumento /tenants/{id}/private/profile.
//
// Motivo: a raiz é lida por TODO membro da academia no login (status, trial,
// cobrança), então qualquer consultor conseguia ler o CPF, o CNPJ e o
// nascimento do dono pelo console do navegador. As rules do subdocumento
// limitam a leitura ao admin da academia e ao super-admin.
//
// Ordem de implantação: 1) deploy do código (os endpoints já leem do subdoc
// com fallback para a raiz); 2) este script com --apply; 3) publicar as rules.
// Idempotente: tenant já migrado é pulado. Não sobrescreve um subdocumento que
// já tenha o campo — a raiz, nesse caso, só é limpa.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/migrate-tenant-private.js [--apply] [tenantId]
//
// Sem --apply é simulação: mostra o que faria e não escreve nada.
// Com tenantId, migra só aquela academia; sem, todas.

import process from 'node:process';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = args.find((a) => !a.startsWith('--')) || '';

const PRIVATE_COLLECTION = 'private';
const PRIVATE_DOC = 'profile';
const FIELDS = ['profile', 'responsiblePhone'];

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

async function migrateTenant(docSnap) {
  const data = docSnap.data() || {};
  const present = FIELDS.filter((f) => data[f] !== undefined);
  if (!present.length) return 'ja-migrado';

  const privRef = docSnap.ref.collection(PRIVATE_COLLECTION).doc(PRIVATE_DOC);
  const privSnap = await privRef.get();
  const priv = privSnap.exists ? (privSnap.data() || {}) : {};

  // Copia só o que o subdocumento ainda não tem: uma edição feita depois do
  // deploy já vive lá e é mais nova que a cópia da raiz.
  const toCopy = {};
  for (const f of present) if (priv[f] === undefined) toCopy[f] = data[f];

  const cleanup = {};
  for (const f of present) cleanup[f] = admin.firestore.FieldValue.delete();

  console.log(`  ${docSnap.id}: copiar [${Object.keys(toCopy).join(', ') || 'nada'}] · limpar da raiz [${present.join(', ')}]`);
  if (!APPLY) return 'simulado';

  const batch = db.batch();
  if (Object.keys(toCopy).length) {
    batch.set(privRef, { ...toCopy, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  batch.update(docSnap.ref, cleanup);
  await batch.commit();
  return 'migrado';
}

async function run() {
  console.log(`Migração do perfil privado — modo=${APPLY ? 'APLICAR' : 'SIMULAÇÃO'}${ONLY ? ` · tenant=${ONLY}` : ' · todos os tenants'}\n`);

  let docs;
  if (ONLY) {
    const snap = await db.collection('tenants').doc(ONLY).get();
    if (!snap.exists) { console.error(`Tenant "${ONLY}" não existe.`); process.exit(1); }
    docs = [snap];
  } else {
    docs = (await db.collection('tenants').get()).docs;
  }

  const tally = { migrado: 0, simulado: 0, 'ja-migrado': 0 };
  for (const d of docs) tally[await migrateTenant(d)]++;

  console.log(`\nConcluído. Tenants: ${docs.length} | migrados: ${tally.migrado} | simulados: ${tally.simulado} | já migrados: ${tally['ja-migrado']}.`);
  if (!APPLY) console.log('Simulação: nada foi escrito. Repita com --apply para valer.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
