// Backfill do histórico de aulas (entrega 2 — histórico de aulas por professor, PR-A).
//
// Cria, para cada lead com agendamento de aula experimental JÁ existente e
// ainda SEM `currentAulaId`, UM doc em stronix_aulas espelhando o estado atual
// do agendamento/desfecho do lead, e grava `currentAulaId` no lead apontando
// pro novo doc. Dali em diante os wrappers dual-write (src/lib/aulasWrites.js)
// continuam o histórico nas escritas novas (agendar/reagendar, marcar
// presença, converter). Idempotente: leads que já têm currentAulaId são
// pulados — rodar de novo é seguro e não duplica.
//
// ORDEM DE DEPLOY: rodar DEPOIS que a regra do Firestore de stronix_aulas
// estiver publicada manualmente em produção (sem a regra, os writes falham
// com permission-denied) e depois do código desta PR estar em prod.
//
// Uso — credenciais Admin, escolha UMA:
//   A) RECOMENDADO (sem colar a private key): baixe o serviceAccount.json
//      (Firebase Console → Config. do projeto → Contas de serviço → Gerar nova
//      chave privada) e aponte:
//        GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json \
//        node scripts/backfill-aulas.js --tenant=stronix-crm-app
//   B) as 3 vars (mesmas das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-aulas.js [--tenant=stronix-crm-app] [--commit]
//
// Flags:
//   --tenant=<id>   tenant a migrar (default "stronix-crm-app", dados do Johnny)
//   --commit        grava de verdade (default: DRY-RUN — só conta e loga amostra, não grava nada)
//
// Ver plano completo em docs/superpowers/plans/2026-07-16-historico-aulas-pr-a.md (Task 6).

import process from 'node:process';
import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Helpers puros — CÓPIA VERBATIM da fonte da verdade no app (scripts admin não
// importam de src/ por convenção; se a regra mudar lá, atualizar aqui):
//   outcomeToAulaStatus/AULA_STATUS ............ src/lib/aulas.js
//   isConvertedStatusName/isLeadConverted ....... src/lib/leads.js
// ---------------------------------------------------------------------------
const AULA_STATUS = { AGENDADA: 'agendada', ATTENDED: 'attended', NO_SHOW: 'no_show', CANCELLED: 'cancelled' };

function outcomeToAulaStatus(outcome) {
  if (outcome === 'attended') return AULA_STATUS.ATTENDED;
  if (outcome === 'no_show') return AULA_STATUS.NO_SHOW;
  if (outcome === 'cancelled') return AULA_STATUS.CANCELLED;
  return null;
}

function isLeadConverted(lead) {
  if (lead?.isConverted === true) return true;
  if (lead?.status === 'Venda') return true;
  return /convertid|matricul/i.test(lead?.status || '');
}

// ---------------------------------------------------------------------------
// Paths (espelham src/lib/firebase.js) e flags
// ---------------------------------------------------------------------------
const LEADS_PATH = 'stronix_leads';
const AULAS_PATH = 'stronix_aulas';

function parseArgs(argv) {
  let tenant = 'stronix-crm-app';
  let commit = false;
  for (const a of argv) {
    if (a === '--commit') commit = true;
    else if (a.startsWith('--tenant=')) tenant = a.slice('--tenant='.length);
  }
  return { tenant, commit };
}

const { tenant, commit } = parseArgs(process.argv.slice(2));

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const hasCertVars = Boolean(projectId && clientEmail && privateKey);
const hasAdc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

if (!hasCertVars && !hasAdc) {
  console.error(
    'Faltam credenciais Admin. Escolha UMA:\n' +
    '  A) GOOGLE_APPLICATION_CREDENTIALS=<caminho do serviceAccount.json>  (recomendado — sem colar a chave)\n' +
    '  B) as 3 vars FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY'
  );
  process.exit(1);
}

if (!admin.apps.length) {
  // Preferir o arquivo JSON (ADC) quando disponível: evita o inferno de aspas/\n
  // da private key colada no shell, causa nº 1 de "16 UNAUTHENTICATED".
  admin.initializeApp(hasAdc
    ? { credential: admin.credential.applicationDefault() }
    : { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const db = admin.firestore();
const dataDoc = db.collection('artifacts').doc(tenant).collection('public').doc('data');
const leadsCol = dataDoc.collection(LEADS_PATH);
const aulasCol = dataDoc.collection(AULAS_PATH);

// Monta os campos do registro de aula a partir do bloco de agendamento
// gravado no lead (espelha aulaRecordFields de src/lib/aulas.js, mas lendo os
// campos denormalizados `appointment*` do lead em vez de receber args soltos).
function buildAulaRecord(leadId, lead) {
  const status = outcomeToAulaStatus(lead.appointmentOutcome) || AULA_STATUS.AGENDADA;
  const converted = isLeadConverted(lead) && status === AULA_STATUS.ATTENDED;
  return {
    leadId,
    leadName: lead.name || lead.nome || null,
    professorId: lead.appointmentProfessorId || null,
    professorName: lead.appointmentProfessorName || null,
    soloTraining: Boolean(lead.appointmentSoloTraining),
    modality: lead.appointmentModality || null,
    scheduledFor: lead.appointmentScheduledFor || null,
    status,
    outcomeAt: lead.appointmentOutcomeAt || null,
    converted,
    convertedAt: converted ? (lead.convertedAt || null) : null,
    consultantId: lead.consultantId || null,
    consultantAuthUid: lead.consultantAuthUid || null,
    consultantName: lead.consultantName || null,
  };
}

const MAX_SAMPLES = 20;
const BATCH_LIMIT = 400; // Firestore: 500 ops/batch — cada lead usa 2 (aula + lead); teto conservador.

async function run() {
  console.log(`Backfill de aulas — tenant="${tenant}" | ${commit ? 'GRAVANDO' : 'DRY-RUN (não grava)'}`);

  let scanned = 0;
  let eligible = 0;
  const samples = [];

  let batch = commit ? db.batch() : null;
  let pendingOps = 0;

  console.log('Varrendo leads...');
  for await (const doc of leadsCol.stream()) {
    scanned++;
    const lead = doc.data();

    // Já backfilled (ou já dual-write pela PR-A em produção) — idempotente, pula.
    if (lead.appointmentType !== 'aula_experimental' || lead.currentAulaId) continue;

    eligible++;
    const record = buildAulaRecord(doc.id, lead);

    if (samples.length < MAX_SAMPLES) {
      samples.push(`  [${commit ? 'GRAVAR' : 'DRY'}] lead=${doc.id} (${record.leadName || '—'}) status=${record.status} converted=${record.converted}`);
    }

    if (commit) {
      const aulaRef = aulasCol.doc();
      batch.set(aulaRef, { ...record, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      batch.update(doc.ref, { currentAulaId: aulaRef.id });
      pendingOps += 2;
      if (pendingOps >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        pendingOps = 0;
      }
    }

    if (scanned % 500 === 0) console.log(`  ...${scanned} leads varridos (${eligible} elegíveis até aqui)`);
  }

  if (commit && pendingOps > 0) await batch.commit();

  console.log(samples.join('\n'));
  console.log(`Leads varridos: ${scanned} | elegíveis (aula_experimental sem currentAulaId): ${eligible}${samples.length < eligible ? ` (amostra: ${samples.length})` : ''}.`);
  console.log(commit
    ? `Concluído. ${eligible} doc(s) criado(s) em ${AULAS_PATH} + currentAulaId gravado no lead correspondente.`
    : 'DRY-RUN: nada foi gravado. Rode de novo com --commit para gravar (depois da regra do Firestore publicada em produção).');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
