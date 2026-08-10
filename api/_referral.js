// Espelho SERVER-SIDE das regras puras de indicação do front (mesmo pacto do
// _profile.js ↔ gymProfile.js): api/ não importa src/ (fronteira de bundle da
// Vercel), então o que a action pública precisa é duplicado aqui e o teste de
// paridade src/lib/__tests__/referralApiMirror.test.js trava a deriva.
// Puro — sem Firestore/Admin SDK, para caber em teste.

export const REFERRAL_FUNNEL_KIND = 'referral';
export const REFERRAL_ENTRY_NAME = 'Aguardando ação';

// ≡ src/lib/globalSearch.js
export const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// ≡ src/lib/leadDerived.js — campos de busca materializados do lead.
export const buildLeadSearchFields = ({ name, whatsapp, cpf } = {}) => {
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

const createdAtMs = (f) => {
  const v = f?.createdAt;
  if (!v) return Infinity;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return Infinity;
};

const sameStageName = (name, target) => normalize(name).trim() === normalize(target).trim();

// ≡ getReferralFunnel (src/lib/referrals.js): systemKind, nunca nome; duplicata
// resolve pelo createdAt mais antigo.
export const pickReferralFunnel = (funnels) => {
  const refs = (funnels || []).filter((f) => f?.systemKind === REFERRAL_FUNNEL_KIND);
  if (refs.length === 0) return null;
  return refs.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

// ≡ getDefaultFunnel (src/lib/funnels.js).
export const pickDefaultFunnel = (funnels) => {
  if (!Array.isArray(funnels) || funnels.length === 0) return null;
  return funnels.find((f) => f.isDefault === true) || funnels[0] || null;
};

// ≡ getReferralEntryStage (src/lib/referrals.js): isEntry → isSystem+nome →
// menor order. Num funil comum vira "primeira etapa por order" — o mesmo que o
// AddLeadModal usa como fase inicial.
export const pickEntryStage = (statuses, funnelId) => {
  if (!funnelId) return null;
  const inFunnel = (statuses || []).filter((s) => s.funnelId === funnelId);
  return (
    inFunnel.find((s) => s.isEntry) ||
    inFunnel.find((s) => s.isSystem && sameStageName(s.name, REFERRAL_ENTRY_NAME)) ||
    [...inFunnel].sort((a, b) => (a.order || 0) - (b.order || 0))[0] ||
    null
  );
};

// ≡ textos de src/lib/referrals.js (timeline type 'referral').
export const referralIndicadoText = (referrerName) => `🤝 Indicado por ${referrerName}`;
export const referralIndicouText = (leadName) => `🤝 Indicou ${leadName}`;

// Textos exclusivos do caminho público (sem par no front).
export const referralLinkAttemptText = (referrerName) =>
  referrerName
    ? `🤝 Tentou se cadastrar pelo link de indicação de ${referrerName}.`
    : '🤝 Tentou se cadastrar pelo link de indicação.';
export const referralLinkGenericText = () => '🤝 Cadastro pelo link de indicação.';
