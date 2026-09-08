// Reparo dos clientes "desfeitos" por mudança de fase ou por Perda.
//
// CONTEXTO: até a regra em src/lib/stageMove.js, tirar um cliente de Venda por
// uma mudança de fase (Mudar fase na ficha, composer de nota, arrasto ou menu
// Mover no Kanban) "desfazia a venda": zerava isConverted/convertedAt e, na
// ficha, lifecycleStage. Marcar Perda num cliente zerava a conversão e o
// pintava como LEAD PERDIDO. O contrato ficava — currentContractId e o doc em
// stronix_contratos seguiam lá —, mas a pessoa virava LEAD: sumia da aba
// Clientes e do mês de matrículas, e a aba Contratos dizia "Ainda não é
// cliente" com o chip em 1. O app já não faz mais isso (cliente não volta a
// ser lead, em hipótese alguma); este script conserta o que JÁ foi gravado.
//
// QUEM É CLIENTE: lifecycleStage 'cliente' OU currentContractId apontado. O
// caminho da ficha zerava lifecycleStage mas não o contrato; o do Kanban e o
// da Perda zeravam a conversão mas não lifecycleStage — os dois sinais juntos
// cobrem todos os casos que deixaram rastro. (Venda antiga sem contrato que
// saiu de Venda pela ficha não deixou rastro nenhum: não há como achar.)
//
// REGRA DE REPARO, por lead que é cliente:
//   - lifecycleStage volta a 'cliente', isConverted a true, lifecycleBucket a
//     'cliente' (o que estiver fora disso).
//   - status em etapa de lead volta a 'Venda'. Etapa com nome de matrícula
//     ("Matriculado"...) é mantida — conta como conversão e sempre contou.
//   - status 'Perda' volta a 'Venda' e grava renewalDeclined=true: é o mesmo
//     "não vai renovar" que a coluna Perda dos funis Renovações e Vencidos
//     grava — a pessoa segue cliente. lossReason/lostAt ficam como histórico.
//   - convertedAt zerado é restaurado do contrato apontado: createdAt do doc
//     (a matrícula grava contrato e convertedAt no mesmo batch, com o mesmo
//     serverTimestamp) ou, na falta, startsAt. Sem contrato ou sem data, as
//     marcas são gravadas mesmo assim e o convertedAt fica vazio (a aba
//     Clientes já trata cliente sem convertedAt).
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/fix-clients-unsold-by-stage-move.js [tenantId ...] [--apply]
//
//   - Sem --apply:  DRY-RUN — só lista o que MUDARIA; não grava nada. (default)
//   - --apply:      grava as correções.
//   - tenantId:     um ou mais; default "stronix-crm-app" (tenant #1).

import process from 'node:process';
import admin from 'firebase-admin';
import { isConvertedStatusName } from '../src/lib/leads.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const TENANTS = args.filter((a) => !a.startsWith('--'));
if (TENANTS.length === 0) TENANTS.push('stronix-crm-app');

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

const dataCol = (tenantId, path) =>
  db.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(path);

const fmt = (ts) => {
  const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  return d ? d.toISOString().slice(0, 10) : '∅';
};

// Planeja o reparo de UM lead. Retorna null (consistente ou não é cliente) ou
// { patch, reason } com os campos a gravar (merge).
async function planFix(tenantId, d) {
  const isClient = d.lifecycleStage === 'cliente' || Boolean(d.currentContractId);
  if (!isClient) return null;

  const patch = {};
  const why = [];
  if (d.lifecycleStage !== 'cliente') { patch.lifecycleStage = 'cliente'; why.push(`lifecycleStage ${d.lifecycleStage ?? '∅'}`); }
  if (d.isConverted !== true) { patch.isConverted = true; why.push(`isConverted ${d.isConverted ?? '∅'}`); }
  if (d.lifecycleBucket !== 'cliente') { patch.lifecycleBucket = 'cliente'; why.push(`bucket ${d.lifecycleBucket ?? '∅'}`); }
  if (d.status === 'Perda') {
    patch.status = 'Venda';
    if (d.renewalDeclined !== true) patch.renewalDeclined = true;
    why.push('status Perda ⇒ Venda + renewalDeclined (não vai renovar)');
  } else if (!isConvertedStatusName(d.status)) {
    patch.status = 'Venda';
    why.push(`status "${d.status ?? '∅'}"`);
  }

  if (!d.convertedAt) {
    if (!d.currentContractId) {
      why.push('convertedAt ∅ sem contrato para restaurar (fica ∅)');
    } else {
      const snap = await dataCol(tenantId, CONTRACTS_PATH).doc(d.currentContractId).get();
      const c = snap.exists ? snap.data() : null;
      const restored = c?.createdAt || c?.startsAt || null;
      if (restored) {
        patch.convertedAt = restored;
        why.push(`convertedAt ∅ ⇒ ${fmt(restored)} (${c.createdAt ? 'createdAt' : 'startsAt'} do contrato)`);
      } else {
        why.push(`convertedAt ∅ e contrato ${d.currentContractId} ${snap.exists ? 'sem createdAt/startsAt' : 'não existe'} (fica ∅)`);
      }
    }
  }

  if (Object.keys(patch).length === 0) return null;
  return { patch, reason: why.join(', ') };
}

// Os dois sinais de cliente, em duas queries, sem duplicar doc. '!=' null só
// devolve docs em que o campo existe e não é null.
async function loadClients(tenantId) {
  const byId = new Map();
  const [byStage, byContract] = await Promise.all([
    dataCol(tenantId, LEADS_PATH).where('lifecycleStage', '==', 'cliente').get(),
    dataCol(tenantId, LEADS_PATH).where('currentContractId', '!=', null).get()
  ]);
  byStage.forEach((doc) => byId.set(doc.id, doc));
  byContract.forEach((doc) => byId.set(doc.id, doc));
  return [...byId.values()];
}

async function sweep(tenantId) {
  const docs = await loadClients(tenantId);
  let scanned = 0, toFix = 0, fixed = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of docs) {
    scanned++;
    const data = doc.data() || {};
    const who = data.name || '—';
    const plan = await planFix(tenantId, data);
    if (!plan) continue;

    toFix++;
    const shown = { ...plan.patch, ...(plan.patch.convertedAt ? { convertedAt: fmt(plan.patch.convertedAt) } : {}) };
    console.log(`  [${APPLY ? 'FIX  ' : 'DRY  '}] ${doc.id} (${who}): ${JSON.stringify(shown)} — ${plan.reason}`);
    if (APPLY) {
      batch.set(doc.ref, plan.patch, { merge: true });
      pending++;
      fixed++;
      if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }
  if (APPLY && pending > 0) await batch.commit();
  return { scanned, toFix, fixed };
}

async function run() {
  console.log(`\nReparo de clientes desfeitos por mudança de fase ou Perda — modo=${APPLY ? 'APLICAR' : 'DRY-RUN'}\n`);
  for (const tenantId of TENANTS) {
    console.log(`— tenant "${tenantId}" —`);
    const r = await sweep(tenantId);
    console.log(`  ${r.scanned} clientes varridos | ${r.toFix} a corrigir${APPLY ? ` | ${r.fixed} corrigidos` : ''}.\n`);
  }
  if (!APPLY) {
    console.log('DRY-RUN: nada foi gravado. Revise a lista acima e rode de novo com --apply para aplicar.');
  } else {
    console.log('Concluído. Quem virou cliente voltou a ser tratado como cliente.');
  }
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
