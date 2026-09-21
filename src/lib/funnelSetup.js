// Configuração de funis do primeiro login de gestor (App.jsx), com id FIXO.
// Duas abas, dois computadores ou dois gestores rodando ao mesmo tempo gravam
// no MESMO documento, e o resultado é sempre um funil só. Antes era addDoc, e
// cada aba criava o seu.
//
// Id publicado não muda nunca: trocar um id aqui cria um segundo funil em toda
// academia. Puro: sem React e sem Firestore (a gravação fica em
// funnelSetupWrites.js).

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
  return writes;
}
