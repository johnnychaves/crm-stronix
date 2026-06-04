import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { logAudit } from './_audit.js';

const USERS_PATH = 'stronix_users';
const SOURCES_PATH = 'stronix_sources';
const LOSS_REASONS_PATH = 'stronix_loss_reasons';
const MODALITIES_PATH = 'stronix_modalities';
const CONFIG_PATH = 'stronix_config';
const CONFIG_GENERAL_ID = 'general';

// slug do tenant: minúsculas, números e hífen; 3–40 chars; sem hífen nas pontas.
const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const PLANS = ['starter', 'pro', 'enterprise'];

// Catálogos padrão semeados em toda nova academia. São listas planas, sem
// lógica especial por nome (diferente de 'Venda'/'Perda', que são sentinelas
// de conversão/perda tratados pelo app). Funil "Comercial" + etapa de sistema
// "Negociação" são semeados pela migração idempotente no 1º login do admin.
const DEFAULT_SOURCES = ['Instagram', 'Facebook', 'Indicação', 'Passeio', 'Google', 'WhatsApp', 'Outros'];
const DEFAULT_LOSS_REASONS = ['Preço', 'Localização', 'Horário', 'Concorrência', 'Sem interesse', 'Sem retorno'];
const DEFAULT_MODALITIES = [
  { name: 'Musculação', color: 'blue' },
  { name: 'Natação', color: 'teal' },
  { name: 'Funcional', color: 'orange' },
  { name: 'Pilates', color: 'purple' },
  { name: 'Crossfit', color: 'red' },
  { name: 'Spinning', color: 'lime' },
  { name: 'Yoga', color: 'indigo' },
  { name: 'Artes Marciais', color: 'pink' }
];

const tenantsCol = () => adminDb.collection('tenants');
const dataCollection = (tenantId, name) =>
  adminDb.collection('artifacts').doc(tenantId).collection('public').doc('data').collection(name);
const usersCollection = (tenantId) => dataCollection(tenantId, USERS_PATH);

// Semeia os catálogos padrão da academia num batch. Idempotente o suficiente
// para uma academia recém-criada (coleções vazias).
async function seedDefaults(tenantId, displayName) {
  const batch = adminDb.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  DEFAULT_SOURCES.forEach((name) => {
    batch.set(dataCollection(tenantId, SOURCES_PATH).doc(), { name, createdAt: now });
  });
  DEFAULT_LOSS_REASONS.forEach((name) => {
    batch.set(dataCollection(tenantId, LOSS_REASONS_PATH).doc(), { name, createdAt: now });
  });
  DEFAULT_MODALITIES.forEach((m, i) => {
    batch.set(dataCollection(tenantId, MODALITIES_PATH).doc(), { name: m.name, color: m.color, order: i, createdAt: now });
  });
  // Config geral (singleton): nome da academia + opções de aulas experimentais.
  batch.set(
    dataCollection(tenantId, CONFIG_PATH).doc(CONFIG_GENERAL_ID),
    { displayName, trialClassOptions: [1, 2, 3], createdAt: now },
    { merge: true }
  );

  await batch.commit();
}

export default async function handler(req, res) {
  // Só o super-admin gerencia organizações (claim superAdmin no token verificado).
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode gerenciar organizações.' });
  }

  // GET → lista as organizações (com plano, status, trial e nº de usuários).
  if (req.method === 'GET') {
    try {
      const snap = await tenantsCol().get();
      const tenants = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() || {};
          let userCount = null;
          try {
            const agg = await usersCollection(d.id).count().get();
            userCount = agg.data().count;
          } catch {
            userCount = null; // count pode falhar em tenants legados; não bloqueia a listagem
          }
          return {
            id: d.id,
            displayName: data.displayName || d.id,
            status: data.status || 'active',
            plan: data.plan || 'starter',
            archived: data.archived === true,
            trialEndsAt: data.trialEndsAt ? (data.trialEndsAt.toMillis?.() ?? null) : null,
            createdAt: data.createdAt ? (data.createdAt.toMillis?.() ?? null) : null,
            primaryAdminEmail: data.primaryAdminEmail || null,
            userCount
          };
        })
      );
      tenants.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return res.status(200).json({ tenants });
    } catch (error) {
      console.error('provision-tenant GET', error);
      return res.status(500).json({ error: 'Erro ao listar organizações.' });
    }
  }

  // POST → provisiona uma organização nova.
  if (req.method === 'POST') {
    try {
      const { tenantId, displayName, adminEmail, adminPassword, adminName, plan, trialDays } = req.body || {};

      if (!tenantId || !displayName || !adminEmail || !adminPassword || !adminName) {
        return res.status(400).json({
          error: 'Campos obrigatórios: tenantId, displayName, adminEmail, adminPassword, adminName.'
        });
      }

      const slug = String(tenantId).trim().toLowerCase();
      if (!TENANT_ID_RE.test(slug)) {
        return res.status(400).json({
          error: 'Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).'
        });
      }
      if (String(adminPassword).length < 6) {
        return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
      }

      const normalizedPlan = PLANS.includes(plan) ? plan : 'starter';
      const days = Number(trialDays);
      const useTrial = Number.isFinite(days) && days > 0;
      const status = useTrial ? 'trial' : 'active';
      const trialEndsAt = useTrial
        ? admin.firestore.Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;

      const existing = await tenantsCol().doc(slug).get();
      if (existing.exists) {
        return res.status(409).json({ error: `Já existe uma organização com o identificador "${slug}".` });
      }

      const normalizedEmail = String(adminEmail).trim().toLowerCase();
      const normalizedName = String(adminName).trim();

      // 1. cria o admin no Firebase Auth
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: normalizedEmail,
          password: adminPassword,
          displayName: normalizedName
        });
      } catch (err) {
        if (err?.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Já existe uma conta com esse e-mail no Firebase Auth.' });
        }
        throw err;
      }

      // 2. claim de tenant no admin
      await adminAuth.setCustomUserClaims(userRecord.uid, { tenantId: slug });

      // 3. registro do tenant (raiz) — com plano, status e trial.
      // .create() é ATÔMICO: falha se o slug já existir, fechando a corrida
      // (TOCTOU) entre o get() acima e este write quando dois provisionamentos
      // simultâneos usam o mesmo slug.
      try {
        await tenantsCol().doc(slug).create({
          displayName: String(displayName).trim(),
          status,
          plan: normalizedPlan,
          trialEndsAt,
          settings: { logoUrl: '', city: '', state: '' },
          primaryAdminUid: userRecord.uid,
          primaryAdminEmail: normalizedEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: auth.uid
        });
      } catch (createErr) {
        const already = createErr?.code === 6 || createErr?.code === 'already-exists'
          || /already exists/i.test(String(createErr?.message || ''));
        if (already) {
          // Corrida perdida: outro provisionamento criou o slug. Remove o
          // usuário Auth recém-criado para não deixar conta órfã.
          try { await adminAuth.deleteUser(userRecord.uid); } catch { /* best-effort */ }
          return res.status(409).json({ error: `Já existe uma organização com o identificador "${slug}".` });
        }
        throw createErr;
      }

      // 4. doc do admin dentro do tenant
      await usersCollection(slug).doc(userRecord.uid).set({
        name: normalizedName,
        email: normalizedEmail,
        authUid: userRecord.uid,
        role: 'admin',
        tenantId: slug,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. seed dos catálogos padrão (fontes, motivos de perda, modalidades, config).
      // O funil "Comercial" + etapa "Negociação" são semeados no 1º login do admin
      // (effect idempotente no app).
      try {
        await seedDefaults(slug, String(displayName).trim());
      } catch (seedErr) {
        // Seed é best-effort: a academia já existe e é usável; o admin pode
        // recriar catálogos nas Configurações. Loga sem falhar o provisionamento.
        console.error('provision-tenant seed', seedErr);
      }

      await logAudit({
        action: 'tenant.provision', tenantId: slug, actorUid: auth.uid,
        details: { displayName: String(displayName).trim(), plan: normalizedPlan, status },
      });

      return res.status(200).json({ ok: true, tenantId: slug, adminUid: userRecord.uid, plan: normalizedPlan, status });
    } catch (error) {
      console.error('provision-tenant POST', error);
      return res.status(500).json({ error: 'Erro interno ao provisionar organização.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
