import { randomUUID } from 'node:crypto';
import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { loadPlans } from './_plans.js';
import { logAudit } from './_audit.js';
import { sanitizeProfile } from './_profile.js';

const USERS_PATH = 'stronix_users';
const SOURCES_PATH = 'stronix_sources';
const LOSS_REASONS_PATH = 'stronix_loss_reasons';
const MODALITIES_PATH = 'stronix_modalities';
const CONFIG_PATH = 'stronix_config';
const CONFIG_GENERAL_ID = 'general';

// slug do tenant: minúsculas, números e hífen; 3–40 chars; sem hífen nas pontas.
const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const INVITE_TTL_DAYS = 7;

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

  // POST → provisiona uma organização nova (ou regera o convite de ativação).
  //
  // Dois modos de criação do ADMIN da academia:
  //   • CONVITE (padrão novo, sem adminPassword): cria o tenant SEM usuário e
  //     grava um convite role=admin (mesmo mecanismo da equipe; o aceite em
  //     /api/invite-accept cria a conta com a senha que o DONO escolher e o
  //     promove a primaryAdmin). Devolve o token p/ o link de ativação.
  //   • SENHA (legado, com adminPassword): cria o usuário Auth na hora —
  //     mantido p/ cadastro presencial e retrocompat com o painel antigo.
  //
  // { resendInvite: true, tenantId } → regera o link de ativação de um tenant
  // ainda sem admin (convite expirado/perdido). Convites pendentes anteriores
  // são cancelados.
  if (req.method === 'POST') {
    try {
      const {
        tenantId, displayName, adminEmail, adminPassword, adminName, plan, trialDays,
        city, state, responsiblePhone, internal, monthlyPrice, resendInvite, profile,
      } = req.body || {};

      const slug = String(tenantId || '').trim().toLowerCase();

      // ── Reenvio do link de ativação ─────────────────────────────────────
      if (resendInvite === true) {
        if (!slug) return res.status(400).json({ error: 'Campo obrigatório: tenantId.' });
        const snap = await tenantsCol().doc(slug).get();
        if (!snap.exists) return res.status(404).json({ error: 'Organização não encontrada.' });
        const tData = snap.data() || {};
        const adminsAgg = await usersCollection(slug).where('role', '==', 'admin').count().get();
        if ((adminsAgg.data().count || 0) > 0 || tData.primaryAdminUid) {
          return res.status(409).json({ error: 'Esta organização já tem um gestor ativo — não há ativação pendente.' });
        }
        const email = String(adminEmail || tData.primaryAdminEmail || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-mail do responsável inválido.' });

        // Cancela convites pendentes antigos (1 link válido por vez).
        const invitesCol = tenantsCol().doc(slug).collection('invites');
        const pend = await invitesCol.where('status', '==', 'pending').get();
        if (!pend.empty) {
          const batch = adminDb.batch();
          pend.forEach((d) => batch.set(d.ref, { status: 'cancelled' }, { merge: true }));
          await batch.commit();
        }

        const token = randomUUID();
        await invitesCol.add({
          email, role: 'admin', token, status: 'pending',
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: auth.uid,
        });
        await tenantsCol().doc(slug).update({ primaryAdminEmail: email, activationPending: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await logAudit({ action: 'tenant.invite.resend', tenantId: slug, actorUid: auth.uid, details: { email } });
        return res.status(200).json({ ok: true, tenantId: slug, mode: 'invite', inviteToken: token, inviteEmail: email, expiresInDays: INVITE_TTL_DAYS });
      }

      // ── Provisionamento ─────────────────────────────────────────────────
      const inviteMode = !adminPassword; // sem senha → ativação por convite
      if (!tenantId || !displayName || !adminEmail || (!inviteMode && !adminName)) {
        return res.status(400).json({
          error: inviteMode
            ? 'Campos obrigatórios: tenantId, displayName, adminEmail.'
            : 'Campos obrigatórios: tenantId, displayName, adminEmail, adminPassword, adminName.'
        });
      }
      if (!TENANT_ID_RE.test(slug)) {
        return res.status(400).json({
          error: 'Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).'
        });
      }
      const normalizedEmail = String(adminEmail).trim().toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        return res.status(400).json({ error: 'E-mail do responsável inválido.' });
      }
      if (!inviteMode && String(adminPassword).length < 6) {
        return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
      }

      // Plano validado contra o CATÁLOGO DINÂMICO (plans/), com fallback aos 3
      // chumbados quando a coleção está vazia. Plano informado e inexistente/
      // inativo é ERRO (antes caía silenciosamente em starter); sem plano,
      // usa o padrão do catálogo (isDefault) ou starter.
      const plansMap = await loadPlans();
      let normalizedPlan;
      if (plan) {
        const planDoc = plansMap.get(String(plan));
        if (!planDoc || planDoc.isActive === false) {
          return res.status(400).json({ error: `Plano "${plan}" não existe ou está inativo no catálogo.` });
        }
        normalizedPlan = planDoc.slug || String(plan);
      } else {
        const def = [...plansMap.values()].find((p) => p.isDefault === true && p.isActive !== false);
        normalizedPlan = def?.slug || 'starter';
      }

      const days = Number(trialDays);
      if (trialDays !== undefined && trialDays !== '' && (!Number.isFinite(days) || days < 0 || days > 365)) {
        return res.status(400).json({ error: 'Dias de teste deve ser um número entre 0 e 365.' });
      }
      const useTrial = Number.isFinite(days) && days > 0;
      const status = useTrial ? 'trial' : 'active';
      const trialEndsAt = useTrial
        ? admin.firestore.Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;

      // Preço negociado (opcional): vira o monthlyPrice do tenant (override do
      // catálogo no MRR/assinatura — mesmo campo já usado pelo super-admin).
      const negotiated = monthlyPrice === undefined || monthlyPrice === null || monthlyPrice === ''
        ? null : Number(monthlyPrice);
      if (negotiated !== null && (!Number.isFinite(negotiated) || negotiated < 0)) {
        return res.status(400).json({ error: 'Preço negociado inválido.' });
      }

      const existing = await tenantsCol().doc(slug).get();
      if (existing.exists) {
        return res.status(409).json({ error: `Já existe uma organização com o identificador "${slug}".` });
      }

      const normalizedName = String(adminName || '').trim();

      // 1. modo SENHA: cria o admin no Firebase Auth agora. Modo CONVITE pula
      // (a conta nasce no aceite do link, com a senha escolhida pelo dono).
      let userRecord = null;
      if (!inviteMode) {
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
        // claim de tenant no admin
        await adminAuth.setCustomUserClaims(userRecord.uid, { tenantId: slug });
      }

      // 2. registro do tenant (raiz) — com plano, status e trial.
      // .create() é ATÔMICO: falha se o slug já existir, fechando a corrida
      // (TOCTOU) entre o get() acima e este write quando dois provisionamentos
      // simultâneos usam o mesmo slug.
      const profilePatch = sanitizeProfile(profile);
      try {
        await tenantsCol().doc(slug).create({
          displayName: String(displayName).trim(),
          status,
          plan: normalizedPlan,
          trialEndsAt,
          settings: {
            logoUrl: '',
            city: String(city || '').trim(),
            state: String(state || '').trim().toUpperCase().slice(0, 2),
          },
          ...(profilePatch ? { profile: profilePatch } : {}),
          ...(String(responsiblePhone || '').trim() ? { responsiblePhone: String(responsiblePhone).trim() } : {}),
          ...(internal === true ? { internal: true } : {}),
          ...(negotiated !== null ? { monthlyPrice: negotiated } : {}),
          primaryAdminUid: userRecord ? userRecord.uid : null,
          primaryAdminEmail: normalizedEmail,
          ...(inviteMode ? { activationPending: true } : {}),
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
          if (userRecord) { try { await adminAuth.deleteUser(userRecord.uid); } catch { /* best-effort */ } }
          return res.status(409).json({ error: `Já existe uma organização com o identificador "${slug}".` });
        }
        throw createErr;
      }

      // 3. modo SENHA: doc do admin dentro do tenant.
      if (userRecord) {
        await usersCollection(slug).doc(userRecord.uid).set({
          name: normalizedName,
          email: normalizedEmail,
          authUid: userRecord.uid,
          role: 'admin',
          tenantId: slug,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 4. seed dos catálogos padrão (fontes, motivos de perda, modalidades, config).
      // O funil "Comercial" + etapa "Negociação" são semeados no 1º login do admin
      // (effect idempotente no app).
      try {
        await seedDefaults(slug, String(displayName).trim());
      } catch (seedErr) {
        // Seed é best-effort: a academia já existe e é usável; o admin pode
        // recriar catálogos nas Configurações. Loga sem falhar o provisionamento.
        console.error('provision-tenant seed', seedErr);
      }

      // 5. modo CONVITE: grava o convite de ativação (role admin) e devolve o
      // token p/ o front montar o link /?invite=<token>&t=<slug>.
      let inviteToken = null;
      if (inviteMode) {
        try {
          inviteToken = randomUUID();
          await tenantsCol().doc(slug).collection('invites').add({
            email: normalizedEmail, role: 'admin', token: inviteToken, status: 'pending',
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.uid,
          });
        } catch (invErr) {
          // Tenant já existe e é recuperável: o super-admin regera o link com
          // resendInvite. Não derruba o provisionamento inteiro.
          console.error('provision-tenant invite', invErr);
          inviteToken = null;
        }
      }

      await logAudit({
        action: 'tenant.provision', tenantId: slug, actorUid: auth.uid,
        details: { displayName: String(displayName).trim(), plan: normalizedPlan, status, mode: inviteMode ? 'invite' : 'password', internal: internal === true },
      });

      return res.status(200).json({
        ok: true, tenantId: slug, plan: normalizedPlan, status,
        mode: inviteMode ? 'invite' : 'password',
        ...(userRecord ? { adminUid: userRecord.uid } : {}),
        ...(inviteMode ? { inviteToken, inviteEmail: normalizedEmail, expiresInDays: INVITE_TTL_DAYS } : {}),
      });
    } catch (error) {
      console.error('provision-tenant POST', error);
      return res.status(500).json({ error: 'Erro interno ao provisionar organização.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
