// Backfill dos campos de escala (PR D do plano de escala).
//
// Preenche, nos leads JÁ existentes, os campos que a PR C passou a dual-write
// só nas escritas NOVAS (ficam "adormecidos" até este backfill): campos de
// busca, lifecycleBucket, funnelId (quando ausente), o par de agendamento
// (appointmentType/appointmentScheduledFor), os denormalizados de interação
// (lastInteractionAt/interactionsCount) e convertedAt=createdAt nos clientes
// legados sem ele (alvo `converted`, p/ o dashboard por query do E2a). Depois
// disto as PRs E/F/G podem
// assinar fatias (where lifecycleBucket / campos de busca) em vez da coleção
// inteira. Roda UMA vez por tenant, fora do app, DEPOIS da PR C em produção e
// com os índices já ENABLED. Idempotente: rodar de novo dá o mesmo resultado.
//
// Uso — credenciais Admin, escolha UMA:
//   A) RECOMENDADO (sem colar a private key): baixe o serviceAccount.json
//      (Firebase Console → Config. do projeto → Contas de serviço → Gerar nova
//      chave privada) e aponte:
//        GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json \
//        node scripts/backfill-scale-fields.js --tenant=stronix-crm-app --dry-run --only=converted
//   B) as 3 vars (mesmas das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... \
//   FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/backfill-scale-fields.js [--tenant=stronix-crm-app] [--dry-run] [--only=search,bucket,funnel,appointment,denorm,converted]
//
// Flags:
//   --tenant=<id>   tenant a migrar (default "stronix-crm-app", dados do Johnny)
//   --dry-run       calcula e reporta o que MUDARIA, sem gravar nada
//   --only=a,b,c    roda só os alvos listados (default: todos)
//                   alvos: search | bucket | funnel | appointment | denorm | converted
//
// Ver runbook completo em docs/scale-migration.md.

import process from 'node:process';
import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Helpers puros — CÓPIA VERBATIM da fonte da verdade no app (scripts admin não
// importam de src/ por convenção; se a regra mudar lá, atualizar aqui):
//   onlyDigits/normalize .............. src/lib/globalSearch.js
//   getSafeDateOrNull/normalizeAppointmentType .. src/lib/dates.js
//   isConvertedStatusName/isLeadConverted/isClientLead/getLeadAppointmentType .. src/lib/leads.js
//   deriveLeadBucket/buildLeadSearchFields ...... src/lib/leadDerived.js
// ---------------------------------------------------------------------------
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const getSafeDateOrNull = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const normalizeAppointmentType = (value) => {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  if (raw.includes('aula')) return 'aula_experimental';
  if (raw.includes('visita')) return 'visita';
  return null;
};

const isConvertedStatusName = (statusName) => {
  if (statusName === 'Venda') return true;
  const name = String(statusName || '').toLowerCase();
  return name.includes('convertid') || name.includes('matricul');
};
const isLeadConverted = (lead) => Boolean(lead?.isConverted || isConvertedStatusName(lead?.status));
const isClientLead = (lead) => lead?.lifecycleStage === 'cliente' || isLeadConverted(lead);

// Tipo de agendamento efetivo: campo novo OU derivado do legado nextFollowUpType.
const getLeadAppointmentType = (lead) => lead?.appointmentType || normalizeAppointmentType(lead?.nextFollowUpType);

const deriveLeadBucket = (leadLike) =>
  isClientLead(leadLike) ? 'cliente' : (leadLike?.status === 'Perda' ? 'perda' : 'ativo');

const buildLeadSearchFields = ({ name, whatsapp, cpf } = {}) => {
  const nameLower = normalize(name);
  const nameTokens = nameLower.split(/\s+/).filter(Boolean);
  const whatsappDigits = onlyDigits(whatsapp);
  const cpfDigits = onlyDigits(cpf);
  return {
    nameLower,
    nameTokens,
    whatsappDigits,
    whatsappDigitsRev: whatsappDigits.split('').reverse().join(''),
    cpfDigits,
  };
};

// ---------------------------------------------------------------------------
// Paths (espelham src/lib/firebase.js) e flags
// ---------------------------------------------------------------------------
const LEADS_PATH = 'stronix_leads';
const INTERACTIONS_PATH = 'stronix_interactions';
const FUNNELS_PATH = 'stronix_funnels';

const ALL_TARGETS = ['search', 'bucket', 'funnel', 'appointment', 'denorm', 'converted'];

function parseArgs(argv) {
  let tenant = 'stronix-crm-app';
  let dryRun = false;
  let only = null;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--tenant=')) tenant = a.slice('--tenant='.length);
    else if (a.startsWith('--only=')) only = a.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean);
  }
  const targets = only && only.length ? only : ALL_TARGETS;
  const bad = targets.filter((t) => !ALL_TARGETS.includes(t));
  if (bad.length) {
    console.error(`Alvos --only inválidos: ${bad.join(', ')}. Válidos: ${ALL_TARGETS.join(', ')}`);
    process.exit(1);
  }
  return { tenant, dryRun, targets: new Set(targets) };
}

const { tenant, dryRun, targets } = parseArgs(process.argv.slice(2));

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
const interactionsCol = dataDoc.collection(INTERACTIONS_PATH);
const funnelsCol = dataDoc.collection(FUNNELS_PATH);

// getDefaultFunnel espelhado de src/lib/funnels.js: isDefault OU o primeiro.
async function resolveDefaultFunnelId() {
  const snap = await funnelsCol.get();
  const funnels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!funnels.length) return null;
  const def = funnels.find((f) => f.isDefault === true) || funnels[0];
  return def?.id || null;
}

// Passo 1: agrega interações por lead (streaming, memória O(nº de leads)).
async function aggregateInteractions() {
  const byLead = new Map(); // leadId -> { count, lastMs }
  let scanned = 0;
  for await (const doc of interactionsCol.stream()) {
    scanned++;
    const i = doc.data();
    if (!i?.leadId) continue;
    const prev = byLead.get(i.leadId) || { count: 0, lastMs: 0 };
    prev.count += 1;
    const at = getSafeDateOrNull(i.createdAt);
    if (at) prev.lastMs = Math.max(prev.lastMs, at.getTime());
    byLead.set(i.leadId, prev);
  }
  return { byLead, scanned };
}

// Monta o patch de UM lead conforme os alvos ativos. Retorna {} se nada muda.
function buildLeadPatch(id, data, defaultFunnelId, interAgg) {
  const patch = {};

  if (targets.has('search')) {
    Object.assign(patch, buildLeadSearchFields({ name: data.name, whatsapp: data.whatsapp, cpf: data.cpf }));
  }

  if (targets.has('bucket')) {
    patch.lifecycleBucket = deriveLeadBucket(data);
  }

  if (targets.has('funnel') && !data.funnelId && defaultFunnelId) {
    patch.funnelId = defaultFunnelId;
  }

  if (targets.has('appointment')) {
    // Materializa o PAR que o índice #5 consulta (appointmentType +
    // appointmentScheduledFor), espelhando o fallback de leitura do app
    // (getLeadAppointmentDate: usa nextFollowUp quando há tipo e não há data).
    const apptType = getLeadAppointmentType(data);
    const scheduled = getSafeDateOrNull(data.appointmentScheduledFor);
    if (apptType) {
      if (!data.appointmentType) patch.appointmentType = apptType;
      if (!scheduled) {
        const fallback = getSafeDateOrNull(data.nextFollowUp);
        if (fallback) patch.appointmentScheduledFor = admin.firestore.Timestamp.fromDate(fallback);
      }
    }
  }

  if (targets.has('denorm')) {
    const agg = interAgg.get(id) || { count: 0, lastMs: 0 };
    patch.interactionsCount = agg.count;
    patch.lastInteractionAt = agg.lastMs ? admin.firestore.Timestamp.fromMillis(agg.lastMs) : null;
  }

  if (targets.has('converted')) {
    // convertedAt = createdAt onde o lead É convertido/matriculado mas está SEM
    // o campo (legado 'Venda' anterior ao rastreio de convertedAt). Espelha o
    // fallback getLeadConversionDate (convertedAt || createdAt) do app, pra que
    // a query do dashboard por janela de convertedAt (índice #7, E2a) não sumir
    // silenciosamente com essas matrículas. Sem createdAt o lead não é datável
    // de qualquer jeito (getLeadConversionDate devolveria null hoje) → pula.
    if (isLeadConverted(data) && !getSafeDateOrNull(data.convertedAt)) {
      const created = getSafeDateOrNull(data.createdAt);
      if (created) patch.convertedAt = admin.firestore.Timestamp.fromDate(created);
    }
  }

  return patch;
}

// Só conta como "mudança" quando o valor calculado difere do atual — mantém o
// resumo do dry-run honesto e não infla writes idempotentes.
function patchChangesSomething(data, patch) {
  return Object.keys(patch).some((k) => {
    const cur = data[k];
    const next = patch[k];
    if (next instanceof admin.firestore.Timestamp) {
      const curMs = getSafeDateOrNull(cur)?.getTime() ?? null;
      return curMs !== next.toMillis();
    }
    if (Array.isArray(next)) return JSON.stringify(cur) !== JSON.stringify(next);
    return cur !== next;
  });
}

async function verify() {
  const total = (await leadsCol.count().get()).data().count;
  const bucketed = (await leadsCol.where('lifecycleBucket', 'in', ['ativo', 'perda', 'cliente']).count().get()).data().count;
  return { total, bucketed, semBucket: total - bucketed };
}

async function run() {
  const mode = dryRun ? 'DRY-RUN (não grava)' : 'GRAVANDO';
  console.log(`Backfill de escala — tenant="${tenant}" | alvos=${[...targets].join(',')} | ${mode}`);

  const defaultFunnelId = targets.has('funnel') ? await resolveDefaultFunnelId() : null;
  if (targets.has('funnel')) console.log(`Funil default resolvido: ${defaultFunnelId || '(nenhum — leads sem funnelId ficam como estão)'}`);

  let interAgg = new Map();
  if (targets.has('denorm')) {
    console.log('Agregando interações por lead...');
    const r = await aggregateInteractions();
    interAgg = r.byLead;
    console.log(`  interações lidas: ${r.scanned} | leads com interação: ${interAgg.size}`);
  }

  const writer = dryRun ? null : db.bulkWriter();
  if (writer) {
    writer.onWriteError((err) => {
      // BulkWriter já tenta de novo; loga e desiste após o teto padrão.
      if (err.failedAttempts < 5) return true;
      console.error(`  falha ao gravar ${err.documentRef.id}: ${err.message}`);
      return false;
    });
  }

  let leads = 0;
  let changed = 0;
  console.log('Varrendo leads...');
  for await (const doc of leadsCol.stream()) {
    leads++;
    const data = doc.data();
    const patch = buildLeadPatch(doc.id, data, defaultFunnelId, interAgg);
    if (Object.keys(patch).length === 0) continue;
    if (!patchChangesSomething(data, patch)) continue;
    changed++;
    if (writer) writer.set(doc.ref, patch, { merge: true });
    if (leads % 500 === 0) console.log(`  ...${leads} leads varridos (${changed} c/ mudança)`);
  }

  if (writer) {
    await writer.close();
    console.log('BulkWriter finalizado.');
  }

  console.log(`Leads varridos: ${leads} | ${dryRun ? 'mudariam' : 'gravados'}: ${changed}.`);

  // Verificação: nenhum lead pode ficar sem lifecycleBucket (só faz sentido se
  // o alvo bucket rodou de verdade — no dry-run é só um retrato do estado atual).
  if (targets.has('bucket')) {
    const v = await verify();
    console.log(`Verificação — leads: ${v.total} | com lifecycleBucket: ${v.bucketed} | SEM bucket: ${v.semBucket}`);
    if (!dryRun && v.semBucket !== 0) {
      console.error(`ATENÇÃO: ${v.semBucket} lead(s) sem lifecycleBucket após o backfill. Rode de novo ou investigue.`);
      process.exitCode = 2;
    }
  }
}

run().then(() => process.exit(process.exitCode || 0)).catch((err) => { console.error(err); process.exit(1); });
