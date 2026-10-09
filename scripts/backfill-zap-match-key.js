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
// Desde 09/10/2026, gerar a chave em Configurações → Integrações faz a mesma
// varredura sozinho, antes de gravar a chave. A regra mora em
// api/_zapMatchKeyFill.js, e este script só a roda numa academia: pula lead
// sem whatsapp aproveitável e lead com a chave certa, só grava o que muda, e
// grava numa transação por lote de 400, que relê cada lead antes.

import process from 'node:process';
import admin from 'firebase-admin';
import { fillZapMatchKeys } from '../api/_zapMatchKeyFill.js';

const args = process.argv.slice(2);
const TENANT_ID = args.find((a) => !a.startsWith('--')) || '';
const LEADS_PATH = 'stronix_leads';

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

// Tenant inexistente varre um caminho vazio e conclui "0 lidos, 0 atualizados"
// como se tivesse dado certo. Já aconteceu: rodaram com `stronix` quando o slug
// real era `stronix-crm-app`, o script disse Concluído, e ninguém percebeu que a
// academia inteira tinha ficado de fora. Recusar antes de varrer.
const tenantDoc = await db.collection('tenants').doc(TENANT_ID).get();
if (!tenantDoc.exists) {
  console.error(`Tenant "${TENANT_ID}" não existe na coleção 'tenants'.`);
  const todos = await db.collection('tenants').listDocuments();
  if (todos.length) {
    console.error('Tenants cadastrados:');
    for (const t of todos) console.error(`  ${t.id}`);
  }
  process.exit(1);
}


async function run() {
  console.log(`Backfill de zapMatchKey — tenant="${TENANT_ID}"\n`);
  const { read, updated } = await fillZapMatchKeys(db, leadsCol);
  console.log(`Concluído. Lidos: ${read} | atualizados: ${updated} | pulados: ${read - updated}.`);
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
