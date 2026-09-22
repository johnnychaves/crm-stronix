// Configuração de funis do primeiro login de gestor (App.jsx), com id FIXO.
// Duas abas, dois computadores ou dois gestores rodando ao mesmo tempo gravam
// no MESMO documento, e o resultado é sempre um funil só. Antes era addDoc, e
// cada aba criava o seu.
//
// Id publicado não muda nunca: trocar um id aqui cria um segundo funil em toda
// academia. Sem React e sem gravar no Firestore: a gravação fica em
// funnelSetupWrites.js.

import { isSystemFunnel } from './funnels.js';
import { normalize } from './globalSearch.js';

export const DEFAULT_FUNNEL_ID = 'funil-padrao';

export const SYSTEM_FUNNEL_IDS = Object.freeze({
  referral: 'funil-sistema-indicacoes',
  upgrade: 'funil-sistema-upgrade',
  renewal: 'funil-sistema-renovacoes',
  expired: 'funil-sistema-vencidos',
});

export const REFERRAL_SOURCE_ID = 'origem-indicacao';

const slug = (s) => normalize(s).trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Id da etapa, prefixado pelo funil. A entrada tem id próprio, que não muda
// quando ela é renomeada ('Vencido' → 'Aguardando contato'). O prefixo 'etapa-'
// impede que uma etapa chamada 'Entrada' colida com a entrada.
export const setupStageId = (funnelId, stage) =>
  `${funnelId}--${stage?.isEntry ? 'entrada' : `etapa-${slug(stage?.name) || 'sem-nome'}`}`;

// Plano de um funil de sistema (plan*SetupOps) → gravações com id fixo.
// ts é o carimbo de hora de quem executa (serverTimestamp() no app).
// renameStages (Vencidos) fica de fora de propósito: quem chama usa updateDoc,
// que falha se a etapa sumiu. Criar de novo pelo id recriaria a etapa sem
// funnelId, e ela cairia no funil padrão pelo fallback de isItemInFunnel.
export function toSetupWrites(plan, ts) {
  const writes = [];
  let newFunnelId = null;
  if (plan?.createFunnel) {
    newFunnelId = SYSTEM_FUNNEL_IDS[plan.createFunnel.systemKind];
    if (!newFunnelId) throw new Error(`funil de sistema sem id fixo: ${plan.createFunnel.systemKind}`);
    writes.push({
      collection: 'funnels',
      id: newFunnelId,
      data: { ...plan.createFunnel, createdAt: ts, updatedAt: ts },
    });
  }
  for (const stage of plan?.createStages || []) {
    const funnelId = stage.funnelId || newFunnelId;
    if (!funnelId) throw new Error(`etapa sem funil: ${stage.name}`);
    writes.push({ collection: 'statuses', id: setupStageId(funnelId, stage), data: { ...stage, funnelId } });
  }
  if (plan?.createSource) {
    writes.push({ collection: 'sources', id: REFERRAL_SOURCE_ID, data: { ...plan.createSource, createdAt: ts } });
  }

  // Um nome novo que vire o mesmo id de outro fundiria duas etapas num doc só.
  const vistos = new Set();
  for (const w of writes) {
    const chave = `${w.collection}/${w.id}`;
    if (vistos.has(chave)) throw new Error(`id repetido no plano: ${chave}`);
    vistos.add(chave);
  }
  return writes;
}

// createdAt em ms aceitando Timestamp ({toMillis}/{seconds}), Date ou número.
// Sem data → Infinity: perde o desempate para quem tem data real.
const createdAtMs = (f) => {
  const c = f?.createdAt;
  if (!c) return Number.POSITIVE_INFINITY;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (c.seconds) return c.seconds * 1000;
  if (c instanceof Date) return c.getTime();
  return Number(c) || Number.POSITIVE_INFINITY;
};

// Passo 1 da migração de funis: garantir EXATAMENTE um funil padrão.
// - um padrão: mantém;
// - vários: fica o criado primeiro (empate pela menor ordem) e os outros são
//   rebaixados;
// - nenhum: promove o funil PRÓPRIO de menor ordem, porque um funil de sistema
//   como padrão receberia pelo fallback de isItemInFunnel os leads sem funnelId
//   (quando já existe padrão, ele é mantido como está, igual a antes);
// - nenhum funil próprio: cria o Comercial com o id fixo.
export function planDefaultFunnel(funnels) {
  const list = Array.isArray(funnels) ? funnels : [];
  const defaults = list.filter((f) => f?.isDefault === true);

  if (defaults.length === 1) {
    return { defaultId: defaults[0].id, create: null, promoteId: null, demoteIds: [] };
  }
  if (defaults.length > 1) {
    const sorted = [...defaults].sort((a, b) => {
      const ta = createdAtMs(a);
      const tb = createdAtMs(b);
      if (ta !== tb) return ta - tb;
      return (a.order || 0) - (b.order || 0);
    });
    return { defaultId: sorted[0].id, create: null, promoteId: null, demoteIds: sorted.slice(1).map((f) => f.id) };
  }

  const own = list.filter((f) => f?.id && !isSystemFunnel(f));
  if (own.length > 0) {
    const promote = [...own].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    return { defaultId: promote.id, create: null, promoteId: promote.id, demoteIds: [] };
  }

  return {
    defaultId: DEFAULT_FUNNEL_ID,
    create: { name: 'Comercial', order: 0, isDefault: true },
    promoteId: null,
    demoteIds: [],
  };
}

// Passo 4 da migração de funis: a etapa de sistema "Negociação" em todo funil
// PRÓPRIO que não tem. Funil de sistema cuida das próprias etapas (Vencidos e
// Upgrade não têm Negociação por decisão do Johnny), e uma aba atrasada não
// pode enfiar uma Negociação protegida neles. Mesma comparação de nome de antes.
export function planNegociacaoStages({ funnels, statuses } = {}) {
  const byFunnel = new Map();
  for (const s of statuses || []) {
    if (!byFunnel.has(s.funnelId)) byFunnel.set(s.funnelId, []);
    byFunnel.get(s.funnelId).push(s);
  }
  const writes = [];
  for (const f of funnels || []) {
    if (!f?.id || isSystemFunnel(f)) continue;
    const stages = byFunnel.get(f.id) || [];
    const hasNegociacao = stages.some((s) => (s.name || '').trim().toLowerCase() === 'negociação');
    if (hasNegociacao) continue;
    const data = { name: 'Negociação', color: 'purple', order: stages.length, funnelId: f.id, isSystem: true };
    writes.push({ collection: 'statuses', id: setupStageId(f.id, data), data });
  }
  return writes;
}
