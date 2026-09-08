// Regras puras do funil de sistema UPGRADE no board (pipeline): discriminador,
// etapa de entrada, plano idempotente do provisionamento e a projeção do card.
// Sem React e sem Firestore — o COMO gravar fica nos callers.
//
// Espelha src/lib/expiredFunnel.js, o molde de funil de sistema deste repo,
// com uma diferença: lá o card é DERIVADO do vencimento e ninguém precisa criar
// nada; aqui a entrada é decisão do consultor, então o card só existe depois
// que alguém grava `upgradeStageId` (ficha, "Mudar fase"). Não há retroativo.
//
// O que este funil respeita (PR #197): cliente não volta a ser lead. Mover
// aqui grava só upgradeStageId; sair zera só ele; fechar é o modal de contrato
// de sempre. `status`, `funnelId`, `lifecycleStage` e `isConverted` não são
// tocados por nada deste módulo.

import { normalize } from './globalSearch.js';

// Discriminador. NUNCA casar por nome: a academia pode ter um funil "Upgrade"
// próprio — os dois convivem e só este flag diferencia.
export const UPGRADE_FUNNEL_KIND = 'upgrade';
export const UPGRADE_FUNNEL_NAME = 'Upgrade';
// Entre Indicações e Renovações (98) na barra de funis.
export const UPGRADE_FUNNEL_ORDER = 97;
// Etapa 1 (fixa). A ÚNICA semeada: as demais a academia decide (decisão do
// Johnny, 08/09/2026).
export const UPGRADE_ENTRY_NAME = 'Aguardando contato';

// VENDA e PERDA não são etapas deste funil. O board renderiza as duas como
// colunas ESPECIAIS em todo funil — criá-las aqui produziria colunas duplicadas.

export const isUpgradeFunnel = (f) => f?.systemKind === UPGRADE_FUNNEL_KIND;

// createdAt em ms aceitando Timestamp ({toMillis}/{seconds}), Date ou número.
const createdAtMs = (f) => {
  const v = f?.createdAt;
  if (!v) return Infinity;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return Infinity;
};

// Duplicata (corrida do provisionamento em duas abas de admin) resolve
// determinístico: vence o createdAt mais antigo.
export const getUpgradeFunnel = (funnels) => {
  const list = (funnels || []).filter(isUpgradeFunnel);
  if (!list.length) return null;
  return list.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

const sameStageName = (name, target) => normalize(name).trim() === normalize(target).trim();

// Self-heal caso a flag ou a etapa se percam por fora (console):
// isEntry -> isSystem com o nome padrão -> menor order.
export const getUpgradeEntryStage = (statuses, funnelId) => {
  if (!funnelId) return null;
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (!inFunnel.length) return null;
  return (
    inFunnel.find((s) => s.isEntry) ||
    inFunnel.find((s) => s.isSystem && sameStageName(s.name, UPGRADE_ENTRY_NAME)) ||
    inFunnel.reduce((best, s) => ((s.order ?? 99) < (best.order ?? 99) ? s : best))
  );
};

// Plano idempotente do provisionamento. Só a ENTRADA é garantida: ela é
// protegida e o funil não funciona sem ela. Nada mais é semeado, e nada volta
// se a academia apagar.
export const planUpgradeSetupOps = ({ funnels, statuses } = {}) => {
  const existing = getUpgradeFunnel(funnels);
  const entrada = { name: UPGRADE_ENTRY_NAME, color: 'slate', order: 0, isSystem: true, isEntry: true };

  if (!existing) {
    return {
      createFunnel: { name: UPGRADE_FUNNEL_NAME, systemKind: UPGRADE_FUNNEL_KIND, order: UPGRADE_FUNNEL_ORDER },
      createStages: [entrada],
    };
  }

  const inFunnel = (statuses || []).filter((s) => s?.funnelId === existing.id);
  const temEntrada = inFunnel.some((s) => s.isEntry || sameStageName(s.name, UPGRADE_ENTRY_NAME));
  return {
    createFunnel: null,
    createStages: temEntrada ? [] : [{ ...entrada, funnelId: existing.id }],
  };
};

// Etapa do card. É o campo gravado; se ele aponta para uma etapa que a
// academia apagou em Configurações, o card cai na entrada (o primeiro arrasto
// corrige o campo).
export const upgradeStageIdOf = (lead, statuses, funnelId) => {
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (lead?.upgradeStageId && inFunnel.some((s) => s.id === lead.upgradeStageId)) return lead.upgradeStageId;
  return getUpgradeEntryStage(statuses, funnelId)?.id || null;
};

// Projeta clientes do funil como cards do board.
//
// As colunas do Kanban casam por NOME e os cards são agrupados por
// `lead.status` (ver partitionLeadsByStatus). Cliente é `status: 'Venda'`, então
// sem projeção todos cairiam na coluna Venda. Aqui o status EXIBIDO vira o nome
// da etapa. A projeção é SÓ EM MEMÓRIA: o `status` real continua 'Venda'.
//
// `_upgradeCard` marca o card projetado — os handlers usam para saber que
// precisam gravar upgradeStageId em vez de status.
export const projectUpgradeLeads = (leads, statuses, funnelId) => {
  if (!funnelId) return [];
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  const nameById = new Map(inFunnel.map((s) => [s.id, s.name]));
  return (leads || []).map((lead) => {
    const stageId = upgradeStageIdOf(lead, statuses, funnelId);
    const name = stageId ? nameById.get(stageId) : null;
    return name ? { ...lead, status: name, _upgradeCard: true } : null;
  }).filter(Boolean);
};
