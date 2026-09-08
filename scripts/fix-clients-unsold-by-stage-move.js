// Reparo dos clientes "desfeitos" por mudança de fase.
//
// CONTEXTO: até a correção em src/lib/stageMove.js, tirar um cliente de Venda
// por uma mudança de fase (Mudar fase na ficha, composer de nota, arrasto ou
// menu Mover no Kanban) "desfazia a venda" sem olhar o contrato: zerava
// isConverted/convertedAt e, na ficha, lifecycleStage. O contrato ficava —
// currentContractId e o doc em stronix_contratos seguiam lá —, mas a pessoa
// virava LEAD carregando um contrato: sumia da aba Clientes e do mês de
// matrículas, e a aba Contratos dizia "Ainda não é cliente" com o chip em 1.
// O app já não faz mais isso; este script conserta o que JÁ foi gravado.
//
// REGRA DE REPARO: quem tem currentContractId é cliente. Para cada lead com
// contrato apontado:
//   - lifecycleStage volta a 'cliente', isConverted a true, lifecycleBucket a
//     'cliente' (o que estiver fora disso).
//   - status em etapa de lead volta a 'Venda'. Etapa com nome de matrícula
//     ("Matriculado"...) é mantida — conta como conversão e sempre contou.
//   - convertedAt zerado é restaurado do contrato apontado: createdAt do doc
//     (a matrícula grava contrato e convertedAt no mesmo batch, com o mesmo
//     serverTimestamp) ou, na falta, startsAt. Sem os dois, reporta.
//   - status 'Perda' com contrato NÃO é mexido: é o fluxo de Perda em cliente,
//     decisão de produto fora deste reparo — só reporta para revisão.
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

// Planeja o reparo de UM lead. Retorna:
//   null                     → consistente (ignora)
//   { patch, reason }        → campos a gravar (merge)
//   { review: true, reason } → precisa de olho humano (não mexe)
async function planFix(tenantId, d) {
  if (!d.currentContractId) return null;

  if (d.status === 'Perda') {
    return { review: true, reason: `status Perda com contrato ${d.currentContractId} (fluxo de Perda em cliente; fora deste reparo)` };
  }

  const patch = {};
  const why = [];
  if (d.lifecycleStage !== 'cliente') { patch.lifecycleStage = 'cliente'; why.push(`lifecycleStage ${d.lifecycleStage ?? '∅'}`); }
  if (d.isConverted !== true) { patch.isConverted = true; why.push(`isConverted ${d.isConverted ?? '∅'}`); }
  if (d.lifecycleBucket !== 'cliente') { patch.lifecycleBucket = 'cliente'; why.push(`bucket ${d.lifecycleBucket ?? '∅'}`); }
  if (!isConvertedStatusName(d.status)) { patch.status = 'Venda'; why.push(`status "${d.status ?? '∅'}"`); }

  if (!d.convertedAt) {
    const snap = await dataCol(tenantId, CONTRACTS_PATH).doc(d.currentContractId).get();
    const c = snap.exists ? snap.data() : null;
    const restored = c?.createdAt || c?.startsAt || null;
    if (!restored) {
      return { review: true, reason: `convertedAt zerado e contrato ${d.currentContractId} ${snap.exists ? 'sem createdAt/startsAt' : 'não existe'} — ${why.join(', ') || 'demais campos ok'}` };
    }
    patch.convertedAt = restored;
    why.push(`convertedAt ∅ ⇒ ${fmt(restored)} (${c.createdAt ? 'createdAt' : 'startsAt'} do contrato)`);
  }

  if (Object.keys(patch).length === 0) return null;
  return { patch, reason: why.join(', ') };
}

async function sweep(tenantId) {
  // '!=' null só devolve docs em que o campo existe e não é null — exatamente
  // "quem tem contrato apontado".
  const snap = await dataCol(tenantId, LEADS_PATH).where('currentContractId', '!=', null).get();
  let scanned = 0, toFix = 0, fixed = 0, review = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data() || {};
    const who = data.name || '—';
    const plan = await planFix(tenantId, data);
    if (!plan) continue;

    if (plan.review) {
      review++;
      console.log(`  [REVISAR] ${doc.id} (${who}): ${plan.reason}`);
      continue;
    }

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
  return { scanned, toFix, fixed, review };
}

async function run() {
  console.log(`\nReparo de clientes desfeitos por mudança de fase — modo=${APPLY ? 'APLICAR' : 'DRY-RUN'}\n`);
  for (const tenantId of TENANTS) {
    console.log(`— tenant "${tenantId}" —`);
    const r = await sweep(tenantId);
    console.log(`  ${r.scanned} leads com contrato | ${r.toFix} a corrigir${APPLY ? ` | ${r.fixed} corrigidos` : ''} | ${r.review} p/ revisar.\n`);
  }
  if (!APPLY) {
    console.log('DRY-RUN: nada foi gravado. Revise a lista acima e rode de novo com --apply para aplicar.');
  } else {
    console.log('Concluído. Clientes com contrato voltaram a ser tratados como clientes.');
  }
  console.log('[REVISAR] = Perda em cliente com contrato, ou convertedAt sem data no contrato para restaurar.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
