// Regras puras do sistema de INDICAÇÕES (referral): o funil de sistema, sua
// etapa de entrada, o plano idempotente da migração one-shot e o resumo da aba
// Indicações da ficha. Sem React e sem Firestore — o COMO gravar fica em
// referralsWrites.js (padrão contracts.js / contractsWrites.js).

import { isClientLead } from './leads.js';
import { normalize } from './globalSearch.js';
import { getSafeDateOrNull } from './dates.js';

// Discriminador do funil de sistema. NUNCA casar por nome: o usuário pode ter
// um funil "Indicações" próprio — os dois convivem e só este flag diferencia.
export const REFERRAL_FUNNEL_KIND = 'referral';
export const REFERRAL_FUNNEL_NAME = 'Indicações';
// Nome da etapa 1 (fixa) do funil. Vira o lead.status dos indicados recém-
// criados — contrato semântico, como 'Negociação'.
export const REFERRAL_ENTRY_NAME = 'Aguardando ação';

export const isReferralFunnel = (f) => f?.systemKind === REFERRAL_FUNNEL_KIND;

// createdAt em ms aceitando Timestamp ({toMillis}/{seconds}), Date ou número.
// Sem createdAt → Infinity: perde o desempate para quem tem data real.
const createdAtMs = (f) => {
  const v = f?.createdAt;
  if (!v) return Infinity;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return Infinity;
};

// Resolve O funil de indicações. Duplicata (corrida da migração em duas abas
// de admin) resolve determinístico: vence o createdAt mais antigo.
export const getReferralFunnel = (funnels) => {
  const refs = (funnels || []).filter(isReferralFunnel);
  if (refs.length === 0) return null;
  return refs.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

const sameStageName = (name, target) => normalize(name).trim() === normalize(target).trim();

// Etapa de entrada do funil, com self-heal caso a flag/etapa se perca por fora
// (console): isEntry → isSystem com o nome padrão → menor order.
export const getReferralEntryStage = (statuses, funnelId) => {
  if (!funnelId) return null;
  const inFunnel = (statuses || []).filter((s) => s.funnelId === funnelId);
  return (
    inFunnel.find((s) => s.isEntry) ||
    inFunnel.find((s) => s.isSystem && sameStageName(s.name, REFERRAL_ENTRY_NAME)) ||
    [...inFunnel].sort((a, b) => (a.order || 0) - (b.order || 0))[0] ||
    null
  );
};

// Reordena mantendo qualquer etapa de entrada no topo. Fecha o furo do reorder
// da FunnelsSection: soltar outra etapa na posição 0 empurrava a etapa de
// sistema para order 1 mesmo com o drag dela desabilitado.
export const pinEntryFirst = (stages) => {
  const list = Array.isArray(stages) ? stages : [];
  return [...list.filter((s) => s?.isEntry), ...list.filter((s) => !s?.isEntry)];
};

// Plano IDEMPOTENTE da migração one-shot (App.jsx): o que falta criar neste
// tenant. Puro e testável — o effect só executa as ops.
// - createFunnel: doc do funil (sem createdAt — o executor carimba serverTimestamp)
// - createStages: etapas faltantes; sem funnelId quando o funil ainda vai
//   nascer (o executor injeta o id devolvido pelo addDoc do funil)
// - createSource: origem 'Indicação' quando nenhuma do catálogo casa /indica/
export const planReferralSetupOps = ({ funnels, statuses, sources } = {}) => {
  const existing = getReferralFunnel(funnels);
  const createFunnel = existing
    ? null
    : {
        name: REFERRAL_FUNNEL_NAME,
        systemKind: REFERRAL_FUNNEL_KIND,
        // NUNCA default: o fallback legado de isItemInFunnel despejaria os
        // leads sem funnelId dentro do funil de indicações.
        isDefault: false,
        order: (funnels || []).length
      };

  const stagesInFunnel = existing
    ? (statuses || []).filter((s) => s.funnelId === existing.id)
    : [];
  const hasEntry = stagesInFunnel.some(
    (s) => s.isEntry || (s.isSystem && sameStageName(s.name, REFERRAL_ENTRY_NAME))
  );
  const hasNegociacao = stagesInFunnel.some((s) => sameStageName(s.name, 'Negociação'));

  const createStages = [];
  if (!existing) {
    createStages.push(
      { name: REFERRAL_ENTRY_NAME, color: 'teal', order: 0, isSystem: true, isEntry: true },
      { name: 'Negociação', color: 'purple', order: 1, isSystem: true }
    );
  } else {
    if (!hasEntry) {
      createStages.push({
        name: REFERRAL_ENTRY_NAME, color: 'teal', order: 0,
        funnelId: existing.id, isSystem: true, isEntry: true
      });
    }
    if (!hasNegociacao) {
      createStages.push({
        name: 'Negociação', color: 'purple',
        order: stagesInFunnel.length + (hasEntry ? 0 : 1),
        funnelId: existing.id, isSystem: true
      });
    }
  }

  const hasIndicaSource = (sources || []).some((s) => normalize(s?.name).includes('indica'));
  const createSource = hasIndicaSource ? null : { name: 'Indicação' };

  return { createFunnel, createStages, createSource };
};

// Resumo da aba Indicações. Precedência espelha deriveLeadBucket: convertido
// que depois virou Perda continua contando como aluno.
export const summarizeReferrals = (leads) => {
  const list = Array.isArray(leads) ? leads : [];
  let alunos = 0;
  let perdidos = 0;
  list.forEach((l) => {
    if (isClientLead(l)) alunos += 1;
    else if (l?.status === 'Perda') perdidos += 1;
  });
  return { total: list.length, alunos, andamento: list.length - alunos - perdidos, perdidos };
};

const referredAtMs = (l) => {
  const d = getSafeDateOrNull(l?.referredAt) || getSafeDateOrNull(l?.createdAt);
  return d ? d.getTime() : 0;
};

// Lista da aba: vínculo mais recente primeiro (createdAt cobre o cadastro
// normal, referredAt cobre o vínculo retroativo feito depois).
export const sortReferrals = (leads) =>
  [...(leads || [])].sort((a, b) => referredAtMs(b) - referredAtMs(a));

// Indicações antigas SEM dono: entraram com origem "Indicação" antes da
// feature existir, então não têm indicador. Alimenta a ferramenta de
// Configurações que pergunta quem indicou cada uma.
// - casa qualquer grafia da origem ('Indicacao', 'Indicação de aluno'…)
// - vale para todos os estados (ativo, cliente e perda)
// - `referrerUnknown` é o "já checamos, ninguém sabe" — sai da fila sem inventar
//   vínculo (sem ele a lista nunca esvaziaria)
export const pendingReferralOwners = (leads) =>
  (leads || [])
    .filter((l) => normalize(l?.source).includes('indica') && !l?.referredById && !l?.referrerUnknown)
    .sort((a, b) => (getSafeDateOrNull(b?.createdAt)?.getTime() || 0) - (getSafeDateOrNull(a?.createdAt)?.getTime() || 0));

// Textos dos eventos de timeline (type 'referral') — fonte única para
// referralsWrites, contracts e testes.
export const referralIndicadoText = (referrerName) => `🤝 Indicado por ${referrerName}`;
export const referralIndicouText = (leadName) => `🤝 Indicou ${leadName}`;
export const referralConvertedText = (leadName) => `🎉 ${leadName} que você indicou fechou matrícula`;

// --- Fase 2: link compartilhável -------------------------------------------

// URL pública da página de indicação de um cliente. O slug do tenant É o appId
// (id do doc em /tenants) e o ref é o id do doc do cliente. O segmento /i/ é
// reservado no roteamento do App (1 letra nunca colide com slug real, 3+).
export const buildReferralShareLink = (origin, slug, leadId) =>
  `${String(origin || '').replace(/\/+$/, '')}/i/${slug}?ref=${encodeURIComponent(String(leadId || ''))}`;

// Mensagem pronta pro consultor mandar o link PRO PRÓPRIO CLIENTE repassar.
export const buildReferralWhatsAppText = ({ firstName, link }) =>
  `Oi${firstName ? ` ${firstName}` : ''}! Esse é o seu link de indicação 🤝\n` +
  `Manda pros amigos que querem treinar: quando alguém se cadastrar por ele, a indicação entra no seu nome.\n${link}`;
