// Backfill da separação entre agendamento e próximo contato (PR 1).
//
// Duas passadas, ambas IDEMPOTENTES (rodar de novo é seguro, não duplica):
//
//   (1) CARIMBO: todo doc de stronix_aulas SEM o campo `type` recebe
//       type:'aula'. Documento anterior à separação é aula por definição.
//       Na segunda rodada ninguém mais se encaixa no filtro ("sem o campo").
//
//   (2) REGISTROS FALTANDO: todo lead com compromisso no espelho
//       (appointmentType 'visita' OU 'aula_experimental') e
//       appointmentScheduledFor preenchido que ainda NÃO tenha um doc do MESMO
//       tipo com o MESMO scheduledFor ganha um. A chave de idempotência é a
//       trinca (type, leadId, scheduledFor).
//
// POR QUE A AULA TAMBÉM ENTRA: no PR da virada o espelho passa a ser DERIVADO
// dos registros. Lead com aula no espelho e sem registro teria o compromisso
// zerado no recálculo — apagaria aula de verdade, o mesmo bug que este trabalho
// veio consertar. Não dá para assumir que o backfill-aulas.js cobriu tudo.
// Rodar os dois scripts é seguro: a chave de idempotência protege.
//
// ORDEM DE DEPLOY: rodar DEPOIS do merge do PR 1 em produção. A regra do
// Firestore de stronix_aulas já está publicada desde a entrega do histórico de
// aulas, então não há passo manual novo no console.
//
// Uso — credenciais Admin, escolha UMA:
//   A) RECOMENDADO (sem colar a private key):
//        GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json \
//        node scripts/backfill-appointments.js --tenant=stronix-crm-app
//   B) as 3 vars (mesmas das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-appointments.js [--tenant=stronix-crm-app] [--commit]
//
// Flags:
//   --tenant=<id>   tenant a migrar (default "stronix-crm-app", dados do Johnny)
//   --commit        grava de verdade (default: DRY-RUN — só conta e loga amostra)
//
// Ver plano em docs/superpowers/plans/2026-08-18-agendamentos-separados-pr1.md (Task 5).

import process from 'node:process';
import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Helpers puros — CÓPIA VERBATIM da fonte da verdade no app (scripts admin não
// importam de src/ por convenção; se a regra mudar lá, atualizar aqui):
//   AULA_STATUS / outcomeToAulaStatus / isAulaRecord ..... src/lib/aulas.js
// ---------------------------------------------------------------------------
const AULA_STATUS = { AGENDADA: 'agendada', ATTENDED: 'attended', NO_SHOW: 'no_show', CANCELLED: 'cancelled' };
const APPOINTMENT_RECORD_TYPES = { AULA: 'aula', VISITA: 'visita' };

function outcomeToAulaStatus(outcome) {
  if (outcome === 'attended') return AULA_STATUS.ATTENDED;
  if (outcome === 'no_show') return AULA_STATUS.NO_SHOW;
  if (outcome === 'cancelled') return AULA_STATUS.CANCELLED;
  return null;
}

const isAulaRecord = (rec) =>
  (rec?.type ?? APPOINTMENT_RECORD_TYPES.AULA) !== APPOINTMENT_RECORD_TYPES.VISITA;

// CÓPIA VERBATIM de src/lib/leads.js (isConvertedStatusName + isLeadConverted).
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

// Milissegundos de um valor que pode ser Timestamp do Firestore, Date ou string.
function millisOf(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

// Chave de idempotência da passada 2: um lead não pode ganhar dois registros do
// MESMO tipo para o mesmo horário. O tipo entra na chave porque visita e aula
// podem legitimamente coexistir na mesma data.
const recordKey = (type, leadId, scheduledFor) => `${type}|${leadId}|${millisOf(scheduledFor)}`;

// Campos do registro a partir do bloco `appointment*` do lead. Espelha
// aulaRecordFields de src/lib/aulas.js. Em VISITA, os campos que só fazem
// sentido em aula (professor, modalidade, treino solo, conversão) ficam nulos
// ou false: visita NUNCA leva crédito de conversão nem carimba carteira.
function buildRecord(type, leadId, lead) {
  const isVisita = type === APPOINTMENT_RECORD_TYPES.VISITA;
  const status = outcomeToAulaStatus(lead.appointmentOutcome) || AULA_STATUS.AGENDADA;
  const converted = !isVisita && isLeadConverted(lead) && status === AULA_STATUS.ATTENDED;
  return {
    type,
    unit: isVisita ? (lead.appointmentUnit || null) : null,
    leadId,
    leadName: lead.name || lead.nome || null,
    professorId: isVisita ? null : (lead.appointmentProfessorId || null),
    professorName: isVisita ? null : (lead.appointmentProfessorName || null),
    soloTraining: isVisita ? false : Boolean(lead.appointmentSoloTraining),
    modality: isVisita ? null : (lead.appointmentModality || null),
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

// appointmentType do lead -> type do registro. Qualquer outro valor (null,
// mensagem, ligação) não é compromisso formal e não vira registro.
function recordTypeOf(appointmentType) {
  if (appointmentType === 'visita') return APPOINTMENT_RECORD_TYPES.VISITA;
  if (appointmentType === 'aula_experimental') return APPOINTMENT_RECORD_TYPES.AULA;
  return null;
}

const MAX_SAMPLES = 5;
const BATCH_LIMIT = 400; // Firestore: 500 ops/batch — teto conservador.

async function run() {
  console.log(`Backfill de agendamentos — tenant="${tenant}" | ${commit ? 'GRAVANDO' : 'DRY-RUN (não grava)'}`);

  let batch = commit ? db.batch() : null;
  let pendingOps = 0;
  const flushIfFull = async () => {
    if (!commit || pendingOps < BATCH_LIMIT) return;
    await batch.commit();
    batch = db.batch();
    pendingOps = 0;
  };

  // -------------------------------------------------------------------------
  // Passada 1 — carimbo do `type` e índice das visitas que já existem
  // -------------------------------------------------------------------------
  console.log('Passada 1: varrendo stronix_aulas...');
  let aulasScanned = 0;
  let stamped = 0;
  const existingRecords = new Set();
  const stampSamples = [];

  for await (const doc of aulasCol.stream()) {
    aulasScanned++;
    const rec = doc.data();

    if (rec.type === undefined) {
      stamped++;
      if (stampSamples.length < MAX_SAMPLES) {
        stampSamples.push(`  [${commit ? 'GRAVAR' : 'DRY'}] aula=${doc.id} lead=${rec.leadId || '—'} status=${rec.status || '—'}`);
      }
      if (commit) {
        batch.update(doc.ref, { type: APPOINTMENT_RECORD_TYPES.AULA });
        pendingOps++;
        await flushIfFull();
      }
    }

    if (rec.leadId) {
      const t = isAulaRecord(rec) ? APPOINTMENT_RECORD_TYPES.AULA : APPOINTMENT_RECORD_TYPES.VISITA;
      existingRecords.add(recordKey(t, rec.leadId, rec.scheduledFor));
    }
  }
  console.log(stampSamples.join('\n'));
  console.log(`  Docs varridos: ${aulasScanned} | sem \`type\` (a carimbar como aula): ${stamped} | registros já indexados: ${existingRecords.size}.`);

  // -------------------------------------------------------------------------
  // Passada 2 — visitas do espelho do lead que ainda não têm registro
  // -------------------------------------------------------------------------
  console.log('Passada 2: varrendo leads...');
  let leadsScanned = 0;
  const created = { visita: 0, aula: 0 };
  let skipped = 0;
  const createSamples = [];

  for await (const doc of leadsCol.stream()) {
    leadsScanned++;
    const lead = doc.data();

    const type = recordTypeOf(lead.appointmentType);
    if (!type || !lead.appointmentScheduledFor) continue;

    const key = recordKey(type, doc.id, lead.appointmentScheduledFor);
    if (existingRecords.has(key)) {
      skipped++;
      continue;
    }

    created[type]++;
    const record = buildRecord(type, doc.id, lead);
    if (createSamples.length < MAX_SAMPLES) {
      createSamples.push(`  [${commit ? 'GRAVAR' : 'DRY'}] ${type} lead=${doc.id} (${record.leadName || '—'}) status=${record.status}`);
    }

    if (commit) {
      batch.set(aulasCol.doc(), { ...record, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      pendingOps++;
      await flushIfFull();
    }

    // Marca na memória para o caso raro de dois leads com o mesmo id no stream.
    existingRecords.add(key);

    if (leadsScanned % 500 === 0) console.log(`  ...${leadsScanned} leads varridos (${created.visita + created.aula} registros a criar até aqui)`);
  }

  if (commit && pendingOps > 0) await batch.commit();

  console.log(createSamples.join('\n'));
  console.log('');
  console.log('Resumo:');
  console.log(`  Docs de stronix_aulas carimbados com type='aula': ${stamped}`);
  console.log(`  Visitas criadas: ${created.visita}`);
  console.log(`  AULAS criadas (lead tinha aula no espelho e nenhum registro): ${created.aula}`);
  console.log(`  Leads pulados (já tinham registro): ${skipped}`);
  console.log(`  Leads varridos: ${leadsScanned}`);
  console.log(commit
    ? 'Concluído.'
    : 'DRY-RUN: nada foi gravado. Rode de novo com --commit para gravar.');
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
