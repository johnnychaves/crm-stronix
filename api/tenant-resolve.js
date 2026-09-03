import { adminDb, admin } from './_firebaseAdmin.js';
import { dataCollection } from './_auth.js';
import { checkRateLimit, clientIp } from './_rateLimit.js';
import { withSentry } from './_sentry.js';
import {
  onlyDigits,
  buildLeadSearchFields,
  pickReferralFunnel,
  pickDefaultFunnel,
  pickEntryStage,
  referralIndicadoText,
  referralIndicouText,
  referralLinkAttemptText,
  referralLinkGenericText
} from './_referral.js';

// Resolve PÚBLICO de organização por slug (?slug=ironfit).
// GET (intacto): usado pela tela de login (App.jsx) para mostrar a MARCA da
// academia identificada pela URL. Retorna apenas dados públicos (nome).
//
// FASE 2 das INDICAÇÕES (docs/indicacoes.md): este é o único endpoint 100%
// público do app e a Vercel está no limite de 12 funções, então a página
// /i/{slug} usa DUAS actions POST aqui:
//   { action:'referral-info',   slug, ref } → marca + 1º nome de quem indicou
//   { action:'referral-signup', slug, ref, name, whatsapp, cpf?, modalidade?,
//     website (honeypot) } → cria o lead indicado via Admin SDK: rate limit
//     por IP e por academia, dedupe SILENCIOSO em duas chaves (telefone/CPF —
//     resposta de sucesso igual pra não vazar quem é aluno), funil Indicações
//     → etapa de entrada, consultor herdado do CLIENTE dono do link.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LEADS_PATH = 'stronix_leads';
const INTERACTIONS_PATH = 'stronix_interactions';
const FUNNELS_PATH = 'stronix_funnels';
const STATUSES_PATH = 'stronix_statuses';
const MODALITIES_PATH = 'stronix_modalities';

export default withSentry(async function handler(req, res) {
  if (req.method === 'POST') return handleReferral(req, res);
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Endpoint público — limita enumeração de slugs por IP (limite generoso, é
  // chamado a cada abertura da tela de login). Fail-open se a checagem falhar.
  const rl = await checkRateLimit(`tenant-resolve:${clientIp(req)}`, { limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
  }

  const slug = String(req.query?.slug || '').trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  try {
    const snap = await adminDb.collection('tenants').doc(slug).get();
    if (!snap.exists) {
      return res.status(200).json({ found: false });
    }
    const data = snap.data() || {};
    return res.status(200).json({
      found: true,
      tenantId: snap.id,
      displayName: data.displayName || snap.id
    });
  } catch (err) {
    console.error('tenant-resolve:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao resolver organização.' });
  }
});

// ---------------------------------------------------------------------------
// Fase 2 — actions públicas da página /i/{slug}
// ---------------------------------------------------------------------------

async function handleReferral(req, res) {
  const action = req.body?.action;
  if (action === 'referral-info') return referralInfo(req, res);
  if (action === 'referral-signup') return referralSignup(req, res);
  return res.status(405).json({ error: 'Método não permitido' });
}

const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const fmtCpf = (d) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

// Tenant público: existe e não está suspenso/arquivado (mesmo par de checagens
// do invite-accept/impersonate).
async function loadPublicTenant(slugRaw) {
  const slug = String(slugRaw || '').trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) return { error: [400, 'Link inválido.'] };
  const snap = await adminDb.collection('tenants').doc(slug).get();
  if (!snap.exists) return { error: [404, 'Academia não encontrada — confira o link.'] };
  const tenant = snap.data() || {};
  if (tenant.archived === true || tenant.status === 'suspended') {
    return { error: [403, 'Esta academia está indisponível no momento.'] };
  }
  return { slug, tenant };
}

// Indicador válido = doc existe E é CLIENTE (lifecycleBucket denormalizado).
// Ref inválido não derruba a página: ela degrada pra versão sem personalização.
async function loadReferrer(slug, refId) {
  const id = String(refId || '').trim();
  if (!id || id.length > 64) return null;
  try {
    const snap = await dataCollection(slug, LEADS_PATH).doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    if (d.lifecycleBucket !== 'cliente') return null;
    return { id: snap.id, ...d };
  } catch {
    return null;
  }
}

// Marca da academia + primeiro nome do indicador + modalidades pros chips.
// Só dados público-inofensivos: nunca o nome completo do cliente, nunca
// telefone/consultor.
async function referralInfo(req, res) {
  const rl = await checkRateLimit(`referral-info:${clientIp(req)}`, { limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });

  try {
    const loaded = await loadPublicTenant(req.body?.slug);
    if (loaded.error) return res.status(loaded.error[0]).json({ error: loaded.error[1] });
    const { slug, tenant } = loaded;

    const referrer = await loadReferrer(slug, req.body?.ref);

    let modalities = [];
    try {
      const ms = await dataCollection(slug, MODALITIES_PATH).get();
      modalities = ms.docs
        .map((d) => ({ order: d.data()?.order || 0, name: d.data()?.name }))
        .filter((m) => m.name)
        .sort((a, b) => a.order - b.order)
        .map((m) => m.name)
        .slice(0, 12);
    } catch {
      modalities = [];
    }

    return res.status(200).json({
      found: true,
      displayName: tenant.displayName || slug,
      logoUrl: tenant.settings?.logoUrl || null,
      referrerFirstName: referrer ? firstNameOf(referrer.name) : null,
      modalities
    });
  } catch (err) {
    console.error('referral-info:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao carregar a página. Tente de novo.' });
  }
}

async function referralSignup(req, res) {
  // Duas chaves: por IP (spam de formulário) e por academia (flood distribuído).
  const slugKey = String(req.body?.slug || '').slice(0, 64);
  const [rlIp, rlSlug] = await Promise.all([
    checkRateLimit(`referral-signup:${clientIp(req)}`, { limit: 8, windowMs: 10 * 60 * 1000 }),
    checkRateLimit(`referral-signup:slug:${slugKey}`, { limit: 120, windowMs: 60 * 60 * 1000 })
  ]);
  if (!rlIp.ok || !rlSlug.ok) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  }

  try {
    const loaded = await loadPublicTenant(req.body?.slug);
    if (loaded.error) return res.status(loaded.error[0]).json({ error: loaded.error[1] });
    const { slug } = loaded;

    // Honeypot: bot preencheu o campo invisível → sucesso silencioso, zero writes.
    if (String(req.body?.website || '').trim()) {
      return res.status(200).json({ ok: true, firstName: firstNameOf(req.body?.name) });
    }

    const name = String(req.body?.name || '').trim().slice(0, 120);
    const whatsapp = String(req.body?.whatsapp || '').trim().slice(0, 30);
    const whatsappDigits = onlyDigits(whatsapp);
    const cpfDigits = onlyDigits(String(req.body?.cpf || '').slice(0, 20));
    const modalidade = String(req.body?.modalidade || '').trim().slice(0, 60) || null;

    if (name.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
    if (whatsappDigits.length < 10) return res.status(400).json({ error: 'Informe um WhatsApp válido, com DDD.' });
    if (cpfDigits && cpfDigits.length !== 11) {
      return res.status(400).json({ error: 'CPF incompleto — confira os 11 dígitos ou deixe em branco.' });
    }

    const leadsCol = dataCollection(slug, LEADS_PATH);
    const interactionsCol = dataCollection(slug, INTERACTIONS_PATH);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const referrer = await loadReferrer(slug, req.body?.ref);

    // SEM INDICADOR VÁLIDO NÃO GRAVA NADA. Este endpoint é público: qualquer
    // pessoa na internet alcança ele com o slug da academia, que é descobrível.
    // Enquanto o cadastro sem `ref` era aceito, o lead caía no funil padrão —
    // o mesmo que o time trabalha todo dia — e o formulário virava um canal
    // aberto de injeção em qualquer academia. O link compartilhado sempre leva
    // o ref, então quem chega aqui sem ele editou a URL ou veio de um cliente
    // que foi apagado. A página segue abrindo sem personalização (referral-info
    // continua degradando); só o envio é que exige o indicador.
    if (!referrer) {
      return res.status(403).json({ error: 'Este link de indicação não é mais válido. Peça um novo a quem indicou você.' });
    }

    // Dedupe em DUAS chaves (telefone sempre; CPF quando veio). Cadastro já
    // existente → MESMA resposta de sucesso (não vazar quem é aluno) + evento
    // na timeline do existente pro time decidir — sem auto-vínculo nem mudança
    // de funil (decisões de 2026-08-07, docs/indicacoes.md).
    const [byPhone, byCpf] = await Promise.all([
      leadsCol.where('whatsappDigits', '==', whatsappDigits).limit(1).get(),
      cpfDigits ? leadsCol.where('cpfDigits', '==', cpfDigits).limit(1).get() : Promise.resolve(null)
    ]);
    const dupDoc = (!byPhone.empty && byPhone.docs[0]) || (byCpf && !byCpf.empty && byCpf.docs[0]) || null;

    if (dupDoc) {
      const dup = dupDoc.data() || {};
      await interactionsCol.add({
        leadId: dupDoc.id,
        leadName: dup.name || null,
        consultantName: null,
        leadConsultantId: dup.consultantId ?? null,
        leadConsultantAuthUid: dup.consultantAuthUid ?? null,
        actorId: null,
        actorAuthUid: null,
        text: referralLinkAttemptText(referrer?.name),
        type: 'referral',
        createdAt: now
      });
      return res.status(200).json({ ok: true, firstName: firstNameOf(name) });
    }

    // Funil de destino: com indicador válido, o de Indicações (systemKind);
    // sem indicador (ref inválido/apagado) ou sem o funil de sistema, cai no
    // default — o coorte do funil de Indicações fica 100% vinculado.
    const funnelsSnap = await dataCollection(slug, FUNNELS_PATH).get();
    const funnels = funnelsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const withReferrer = Boolean(referrer);
    const referralFunnel = withReferrer ? pickReferralFunnel(funnels) : null;
    const targetFunnel = referralFunnel || pickDefaultFunnel(funnels);
    if (!targetFunnel) {
      return res.status(503).json({ error: 'A academia ainda está configurando o sistema. Tente de novo mais tarde.' });
    }
    const statusesSnap = await dataCollection(slug, STATUSES_PATH).where('funnelId', '==', targetFunnel.id).get();
    const entry = pickEntryStage(statusesSnap.docs.map((d) => ({ id: d.id, ...d.data() })), targetFunnel.id);
    const statusName = entry?.name || '';

    // Mesmo shape do AddLeadModal (dor fica null — o formulário público não
    // pergunta). Consultor HERDADO do cliente dono do link; sem indicador o
    // lead entra sem dono e o admin distribui.
    const batch = adminDb.batch();
    const leadRef = leadsCol.doc();
    batch.set(leadRef, {
      name,
      whatsapp,
      source: 'Indicação',
      funnelId: targetFunnel.id,
      status: statusName,
      tags: [],
      birthDate: null,
      cpf: cpfDigits ? fmtCpf(cpfDigits) : null,
      email: null,
      sexo: null,
      dor: null,
      modalidade,
      referredById: withReferrer ? referrer.id : null,
      referredByName: withReferrer ? (referrer.name || null) : null,
      referredAt: withReferrer ? now : null,
      // Marca de origem do cadastro. É o que o sino do header usa para avisar
      // "entrou uma indicação pelo link" sem confundir com o cadastro manual.
      referralVia: 'link',
      consultantId: withReferrer ? (referrer.consultantId ?? null) : null,
      consultantName: withReferrer ? (referrer.consultantName ?? null) : null,
      consultantAuthUid: withReferrer ? (referrer.consultantAuthUid ?? null) : null,
      ...buildLeadSearchFields({ name, whatsapp, cpf: cpfDigits }),
      lifecycleBucket: 'ativo',
      lastInteractionAt: now,
      interactionsCount: 1,
      createdAt: now,
      nextFollowUp: null,
      nextFollowUpType: null,
      appointmentType: null,
      appointmentScheduledFor: null
    });

    const secFields = {
      leadConsultantId: withReferrer ? (referrer.consultantId ?? null) : null,
      leadConsultantAuthUid: withReferrer ? (referrer.consultantAuthUid ?? null) : null
    };

    // Evento no INDICADO (conta no interactionsCount: 1 acima).
    batch.set(interactionsCol.doc(), {
      leadId: leadRef.id,
      leadName: name,
      consultantName: null,
      ...secFields,
      actorId: null,
      actorAuthUid: null,
      text: withReferrer ? referralIndicadoText(referrer.name || 'cliente') : referralLinkGenericText(),
      type: 'referral',
      createdAt: now
    });

    // Evento no INDICADOR — sem patch no doc dele (indicação não é contato
    // real; mesma decisão do fluxo manual).
    if (withReferrer) {
      batch.set(interactionsCol.doc(), {
        leadId: referrer.id,
        leadName: referrer.name || null,
        consultantName: null,
        ...secFields,
        actorId: null,
        actorAuthUid: null,
        text: referralIndicouText(name),
        type: 'referral',
        createdAt: now
      });
    }

    await batch.commit();
    return res.status(200).json({ ok: true, firstName: firstNameOf(name) });
  } catch (err) {
    console.error('referral-signup:', err?.message || err);
    return res.status(500).json({ error: 'Não foi possível concluir o cadastro. Tente de novo.' });
  }
}
