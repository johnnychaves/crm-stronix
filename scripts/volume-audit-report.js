// Diagnóstico da SUBCONTAGEM do volume de prospecção (bug do "agendamentos = 0").
//
// CONTEXTO: a Meta de Prospecção (feature #111, 2026-06-19) sempre contou os
// agendamentos comparando i.consultantAuthUid, campo que NENHUMA escrita de
// interação jamais gravou. Resultado: "agendamentos" ficou SEMPRE em zero e o
// volume só refletia leads novos. O fix (interactionOwnerAuthUid) está na
// PR #137. Este script NÃO grava nada — só mede o estrago com o dado que já
// existe (as interações com volumeKind estão todas no banco, com data e dono).
//
// Para cada consultor com alvo de volume > 0, mostra, por MÊS:
//   leads novos (o que o sistema já contava) + agendamentos que NÃO contavam.
// "mostrado" = número que apareceu na tela (buggy). "real" = o correto.
//
// Uso (mesmas credenciais Admin das funções api/):
//   FIREBASE_ADMIN_PROJECT_ID=... FIREBASE_ADMIN_CLIENT_EMAIL=... \
//   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//   node scripts/volume-audit-report.js [tenantId] [--all] [--since=YYYY-MM-DD] [--until=YYYY-MM-DD]
//
//   - tenantId : uma academia (default "stronix-crm-app", a sua).
//   - --all    : varre TODAS as academias (base inteira) em vez de uma só.
//   - --since  : início do período (default 2026-06-19, lançamento da feature).
//   - --until  : fim do período (default = agora).
//   - Só leitura. Nunca grava.

import process from 'node:process';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const getFlag = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};
const TENANT_ARG = args.find((a) => !a.startsWith('--')) || 'stronix-crm-app';
// Lançamento da Meta de Prospecção: antes disso não há interação com volumeKind.
const SINCE = new Date(`${getFlag('since', '2026-06-19')}T00:00:00`);
const UNTIL = getFlag('until', null) ? new Date(`${getFlag('until')}T23:59:59`) : new Date();

const USERS_PATH = 'stronix_users';
const LEADS_PATH = 'stronix_leads';
const INTERACTIONS_PATH = 'stronix_interactions';
const CONFIG_PATH = 'stronix_config';

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

const dataCol = (tenant, path) =>
  db.collection('artifacts').doc(tenant).collection('public').doc('data').collection(path);

// Mesma regra do app (dailyGoal.js:volumeTargetFor): alvo próprio do usuário
// tem precedência; consultor herda o default da academia; admin é opt-in.
function volumeTargetFor(user, academyDefault) {
  if (!user) return 0;
  const own = Math.floor(Number(user.dailyVolumeTarget));
  if (Number.isFinite(own) && own > 0) return Math.min(own, 500);
  if (user.role === 'admin') return 0;
  const def = Math.floor(Number(academyDefault));
  return Number.isFinite(def) && def > 0 ? Math.min(def, 500) : 0;
}

// Mesma regra do fix (dailyGoal.js:interactionOwnerAuthUid): dono da AÇÃO.
const interactionOwnerAuthUid = (i) =>
  i?.actorAuthUid ?? i?.consultantAuthUid ?? i?.leadConsultantAuthUid ?? null;

const toDate = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : (v instanceof Date ? v : null));
const inPeriod = (d) => d instanceof Date && !isNaN(d) && d >= SINCE && d <= UNTIL;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

async function auditTenant(tenant) {
  // Config: alvo default da academia.
  let academyDefault = 0;
  try {
    const cfg = await dataCol(tenant, CONFIG_PATH).doc('general').get();
    academyDefault = Math.floor(Number(cfg.exists ? cfg.data()?.dailyVolumeTarget : 0)) || 0;
  } catch { academyDefault = 0; }

  const usersSnap = await dataCol(tenant, USERS_PATH).get();
  const users = usersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  // Consultores com volume LIGADO (alvo > 0) — o universo afetado.
  const affected = users
    .map((u) => ({ u, target: volumeTargetFor(u, academyDefault) }))
    .filter((x) => x.target > 0 && x.u.authUid);

  if (affected.length === 0) {
    return { tenant, enabled: academyDefault > 0, academyDefault, affected: [], totalUndercount: 0 };
  }

  const byAuthUid = new Map(affected.map((x) => [x.u.authUid, x]));
  // Acumuladores por consultor: mês → { leadsNovos, agendamentos }.
  const acc = new Map(affected.map((x) => [x.u.authUid, { rec: x, months: new Map(), leadsTotal: 0, agTotal: 0 }]));
  const bump = (authUid, mk, field) => {
    const a = acc.get(authUid); if (!a) return;
    let m = a.months.get(mk); if (!m) { m = { leadsNovos: 0, agendamentos: 0 }; a.months.set(mk, m); }
    m[field]++; if (field === 'leadsNovos') a.leadsTotal++; else a.agTotal++;
  };

  // Leads novos por consultor (consultantId → user.id).
  const idToAuth = new Map(affected.map((x) => [x.u.id, x.u.authUid]));
  const leadsSnap = await dataCol(tenant, LEADS_PATH).get();
  leadsSnap.forEach((doc) => {
    const l = doc.data() || {};
    const authUid = idToAuth.get(l.consultantId);
    if (!authUid) return;
    const d = toDate(l.createdAt);
    if (inPeriod(d)) bump(authUid, monthKey(d), 'leadsNovos');
  });

  // Agendamentos (volumeKind) por dono resolvido — o que NÃO era contado.
  const interSnap = await dataCol(tenant, INTERACTIONS_PATH).get();
  interSnap.forEach((doc) => {
    const i = doc.data() || {};
    if (!i.volumeKind) return;
    const owner = interactionOwnerAuthUid(i);
    if (!byAuthUid.has(owner)) return;
    const d = toDate(i.createdAt);
    if (inPeriod(d)) bump(owner, monthKey(d), 'agendamentos');
  });

  let totalUndercount = 0;
  const rows = [...acc.values()].map((a) => {
    totalUndercount += a.agTotal;
    return { name: a.rec.u.name || a.rec.u.id, target: a.rec.target, leadsTotal: a.leadsTotal, agTotal: a.agTotal, months: a.months };
  }).sort((x, y) => y.agTotal - x.agTotal);

  return { tenant, enabled: academyDefault > 0, academyDefault, affected: rows, totalUndercount };
}

async function tenantName(tenant) {
  try { const t = await db.collection('tenants').doc(tenant).get(); return t.exists ? (t.data()?.displayName || t.data()?.name || tenant) : tenant; }
  catch { return tenant; }
}

async function run() {
  const fmtP = (d) => d.toISOString().slice(0, 10);
  console.log(`\nDiagnóstico de subcontagem do VOLUME — período ${fmtP(SINCE)} a ${fmtP(UNTIL)}\n`);

  let tenants;
  if (ALL) {
    const snap = await db.collection('tenants').get();
    tenants = snap.docs.map((d) => d.id);
    if (tenants.length === 0) tenants = [TENANT_ARG]; // base legada sem doc de tenant
  } else {
    tenants = [TENANT_ARG];
  }

  let grandUndercount = 0, affectedTenants = 0, affectedConsultants = 0;

  for (const tenant of tenants) {
    const r = await auditTenant(tenant);
    const nm = await tenantName(tenant);
    if (r.affected.length === 0) {
      if (ALL) console.log(`— ${nm} (${tenant}): volume ${r.enabled ? 'ligado, mas' : 'desligado —'} sem consultor afetado.`);
      continue;
    }
    affectedTenants++;
    affectedConsultants += r.affected.length;
    grandUndercount += r.totalUndercount;

    console.log(`\n════ ${nm} (${tenant}) — alvo default: ${r.academyDefault || 'só por-consultor'} ════`);
    for (const row of r.affected) {
      const meses = [...row.months.entries()].sort().map(([mk, m]) =>
        `${mk}: +${m.agendamentos} ag (mostrado ${m.leadsNovos} → real ${m.leadsNovos + m.agendamentos})`).join('\n      ');
      console.log(`  ${row.name} (alvo ${row.target}/dia) — ${row.agTotal} agendamentos NUNCA contados no período`);
      if (meses) console.log(`      ${meses}`);
    }
    console.log(`  SUBTOTAL ${nm}: ${r.totalUndercount} agendamentos não contados.`);
  }

  console.log(`\n──────── RESUMO ────────`);
  console.log(`Academias com consultor afetado : ${affectedTenants}`);
  console.log(`Consultores afetados            : ${affectedConsultants}`);
  console.log(`Agendamentos NUNCA contados     : ${grandUndercount}`);
  console.log(`\nNada foi gravado (relatório read-only). O número correto passa a valer sozinho`);
  console.log(`assim que a PR #137 (fix do volume) entrar em produção.\n`);
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
