import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { ensurePlansSeeded, PLANS_COLLECTION } from './_plans.js';

// CRUD de planos (coleção raiz `plans/`) — SUPER-ADMIN only.
// GET semeia os 3 planos atuais na 1ª abertura (idempotente). DELETE/edição de
// slug são bloqueados se houver organizações usando o slug (integridade: o
// campo `plan` dos tenants referencia o slug). Vercel serverless function.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; // minúsculas, números e hífen interno

const toNumOrNull = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const money = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// Normaliza/valida o corpo de um plano. Retorna { value } ou { error }.
function sanitizePlan(body) {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'Nome do plano é obrigatório.' };

  const slug = String(body?.slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { error: 'Slug inválido: use apenas minúsculas, números e hífen (ex.: pro-anual).' };

  // Vagas por papel (modelo gestor + consultores). null = ilimitado.
  // Payload legado (só maxUsers, ex.: form antigo) deriva 1 gestor +
  // (maxUsers-1) consultores — mesma conta total de antes.
  let maxManagers, maxConsultants;
  if (body?.maxManagers !== undefined || body?.maxConsultants !== undefined) {
    maxManagers = body?.maxManagers == null ? null : Math.max(1, Math.floor(toNumOrNull(body.maxManagers) ?? 1));
    maxConsultants = body?.maxConsultants == null ? null : Math.max(0, Math.floor(toNumOrNull(body.maxConsultants) ?? 0));
  } else {
    const unlimited = body?.maxUsers === null || body?.maxUsers === undefined || body?.unlimited === true;
    const maxUsersNum = toNumOrNull(body?.maxUsers);
    const total = unlimited ? null : Math.max(1, Math.floor(maxUsersNum ?? 1));
    maxManagers = total == null ? null : 1;
    maxConsultants = total == null ? null : Math.max(0, total - 1);
  }
  // maxUsers derivado mantém compatibilidade com leitores antigos do doc.
  const maxUsers = maxManagers == null || maxConsultants == null ? null : maxManagers + maxConsultants;

  return {
    value: {
      name,
      slug,
      maxManagers,    // null = ilimitado
      maxConsultants, // null = ilimitado (consultores INCLUSOS no preço)
      maxUsers,       // derivado (gestores+consultores) — retrocompat
      priceMonthly: money(body?.priceMonthly),
      priceAnnual: body?.priceAnnual == null || body?.priceAnnual === '' ? null : money(body?.priceAnnual),
      extraUserPrice: body?.extraUserPrice == null || body?.extraUserPrice === '' ? null : money(body?.extraUserPrice),
      maxExtraUsers: body?.maxExtraUsers == null || body?.maxExtraUsers === '' ? null : Math.max(0, Math.floor(toNumOrNull(body?.maxExtraUsers) ?? 0)),
      isActive: body?.isActive !== false,
      isDefault: body?.isDefault === true,
      order: Number.isFinite(Number(body?.order)) ? Math.floor(Number(body?.order)) : 0,
      features: Array.isArray(body?.features) ? body.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 50) : [],
    },
  };
}

// Quantos tenants usam um slug de plano (bloqueia delete/rename de slug em uso).
async function slugInUseCount(slug) {
  const agg = await adminDb.collection('tenants').where('plan', '==', slug).count().get();
  return agg.data().count || 0;
}

// Só UM plano pode ser padrão: limpa isDefault dos demais.
async function clearOtherDefaults(col, exceptId) {
  const snap = await col.where('isDefault', '==', true).get();
  const batch = adminDb.batch();
  let touched = false;
  snap.forEach((d) => { if (d.id !== exceptId) { batch.update(d.ref, { isDefault: false }); touched = true; } });
  if (touched) await batch.commit();
}

export default async function handler(req, res) {
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode gerenciar planos.' });
  }

  const col = adminDb.collection(PLANS_COLLECTION);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    // GET — lista planos (+ nº de orgs usando cada slug). Semeia se vazio.
    if (req.method === 'GET') {
      await ensurePlansSeeded();
      const [plansSnap, tenantsSnap] = await Promise.all([col.get(), adminDb.collection('tenants').get()]);
      const usage = {};
      tenantsSnap.forEach((d) => { const p = d.data()?.plan || 'starter'; usage[p] = (usage[p] || 0) + 1; });
      const plans = plansSnap.docs
        .map((d) => {
          const data = d.data() || {};
          return {
            id: d.id, ...data,
            tenantCount: usage[data.slug] || 0,
            createdAt: data.createdAt?.toMillis?.() ?? null,
            updatedAt: data.updatedAt?.toMillis?.() ?? null,
          };
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name)));
      return res.status(200).json({ plans });
    }

    // POST — cria plano. Slug único.
    if (req.method === 'POST') {
      const { value, error } = sanitizePlan(req.body || {});
      if (error) return res.status(400).json({ error });
      const dup = await col.where('slug', '==', value.slug).limit(1).get();
      if (!dup.empty) return res.status(409).json({ error: `Já existe um plano com o slug "${value.slug}".` });
      const ref = await col.add({ ...value, createdAt: now, updatedAt: now });
      if (value.isDefault) await clearOtherDefaults(col, ref.id);
      return res.status(200).json({ ok: true, id: ref.id });
    }

    // PUT — edita plano por planId. Rename de slug bloqueado se em uso.
    if (req.method === 'PUT') {
      const { planId, ...rest } = req.body || {};
      if (!planId) return res.status(400).json({ error: 'planId é obrigatório.' });
      const ref = col.doc(planId);
      const cur = await ref.get();
      if (!cur.exists) return res.status(404).json({ error: 'Plano não encontrado.' });

      // Form legado manda só maxUsers: derruba os campos por papel do doc p/
      // o total novo prevalecer (senão o merge ignoraria o maxUsers editado).
      const merged = { ...cur.data(), ...rest };
      if (rest.maxUsers !== undefined && rest.maxManagers === undefined && rest.maxConsultants === undefined) {
        delete merged.maxManagers; delete merged.maxConsultants;
      }
      const { value, error } = sanitizePlan(merged);
      if (error) return res.status(400).json({ error });

      const oldSlug = cur.data()?.slug;
      if (value.slug !== oldSlug) {
        const inUse = await slugInUseCount(oldSlug);
        if (inUse > 0) {
          return res.status(409).json({ error: `Não dá para mudar o slug: ${inUse} organização(ões) usam "${oldSlug}". Migre-as antes.` });
        }
        const dup = await col.where('slug', '==', value.slug).limit(1).get();
        if (!dup.empty) return res.status(409).json({ error: `Já existe um plano com o slug "${value.slug}".` });
      }

      await ref.update({ ...value, updatedAt: now });
      if (value.isDefault) await clearOtherDefaults(col, planId);
      return res.status(200).json({ ok: true });
    }

    // DELETE — exclui plano por planId. Bloqueado se houver tenants usando o slug.
    if (req.method === 'DELETE') {
      const planId = req.body?.planId || req.query?.planId;
      if (!planId) return res.status(400).json({ error: 'planId é obrigatório.' });
      const ref = col.doc(planId);
      const cur = await ref.get();
      if (!cur.exists) return res.status(404).json({ error: 'Plano não encontrado.' });
      const slug = cur.data()?.slug;
      const inUse = await slugInUseCount(slug);
      if (inUse > 0) {
        return res.status(409).json({ error: `Não é possível excluir: ${inUse} organização(ões) usam o plano "${slug}". Migre-as para outro plano antes.` });
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('plans', error);
    return res.status(500).json({ error: 'Erro ao processar planos.' });
  }
}
