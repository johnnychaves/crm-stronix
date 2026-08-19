// Regras puras do funil de sistema VENCIDOS no board (pipeline): discriminador,
// etapa de entrada, plano idempotente do provisionamento e a etapa derivada do
// card. Sem React e sem Firestore — o COMO gravar fica nos callers.
//
// Espelha src/lib/referrals.js, que é o molde de funil de sistema deste repo.
//
// NÃO confundir com src/lib/expiredGoal.js: lá é a TAREFA diária da Meta, que
// cobra o cliente por N dias depois do vencimento e solta. Aqui é a COLUNA do
// board, permanente. Dois funis com nomes parecidos e papéis diferentes.

import { normalize } from './globalSearch.js';

// Discriminador. NUNCA casar por nome: a academia pode ter um funil "Vencidos"
// próprio — os dois convivem e só este flag diferencia.
export const EXPIRED_FUNNEL_KIND = 'expired';
export const EXPIRED_FUNNEL_NAME = 'Vencidos';
// Etapa 1 (fixa). Onde o cliente cai sozinho ao vencer.
export const EXPIRED_ENTRY_NAME = 'Vencido';
// Etapas do meio, semeadas na criação para o funil não nascer vazio. NÃO são
// protegidas, e o provisionamento NUNCA as recria: ressuscitar uma etapa que a
// academia apagou de propósito seria pior que o vão.
export const EXPIRED_SEED_MIDDLE_NAME = 'Em contato';
// Gaveta de quem disse que não volta. Livre como a de cima, mas o card de quem
// recusou na Meta nasce aqui.
export const EXPIRED_DECLINED_NAME = 'Não volta';

// VENDA e PERDA não são etapas deste funil. O board renderiza as duas como
// colunas ESPECIAIS em todo funil, fora do laço das etapas (ver KanbanView) —
// criá-las aqui produziria colunas duplicadas. A coluna Venda especial já abre
// o ContractModal no drop, que é o comportamento pedido.

export const isExpiredFunnel = (f) => f?.systemKind === EXPIRED_FUNNEL_KIND;

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
export const getExpiredFunnel = (funnels) => {
  const list = (funnels || []).filter(isExpiredFunnel);
  if (!list.length) return null;
  return list.reduce((best, f) => (createdAtMs(f) < createdAtMs(best) ? f : best));
};

const sameStageName = (name, target) => normalize(name).trim() === normalize(target).trim();

// Self-heal caso a flag ou a etapa se percam por fora (console):
// isEntry -> isSystem com o nome padrão -> menor order.
export const getExpiredEntryStage = (statuses, funnelId) => {
  if (!funnelId) return null;
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  if (!inFunnel.length) return null;
  return (
    inFunnel.find((s) => s.isEntry) ||
    inFunnel.find((s) => s.isSystem && sameStageName(s.name, EXPIRED_ENTRY_NAME)) ||
    inFunnel.reduce((best, s) => ((s.order ?? 99) < (best.order ?? 99) ? s : best))
  );
};

// Plano idempotente do provisionamento. Só as etapas PROTEGIDAS são garantidas.
export const planExpiredSetupOps = ({ funnels, statuses } = {}) => {
  const existing = getExpiredFunnel(funnels);

  if (!existing) {
    return {
      createFunnel: { name: EXPIRED_FUNNEL_NAME, systemKind: EXPIRED_FUNNEL_KIND, order: 99 },
      createStages: [
        { name: EXPIRED_ENTRY_NAME, color: 'slate', order: 0, isSystem: true, isEntry: true },
        { name: EXPIRED_SEED_MIDDLE_NAME, color: 'amber', order: 1 },
        { name: EXPIRED_DECLINED_NAME, color: 'gray', order: 2 },
      ],
    };
  }

  const inFunnel = (statuses || []).filter((s) => s?.funnelId === existing.id);
  const has = (target, alsoFlag) =>
    inFunnel.some((s) => sameStageName(s.name, target) || (alsoFlag && s[alsoFlag]));

  // Só a ENTRADA é garantida: ela é protegida e o funil não funciona sem ela.
  // As do meio são livres e não voltam se a academia apagar.
  const createStages = [];
  if (!has(EXPIRED_ENTRY_NAME, 'isEntry')) {
    createStages.push({ name: EXPIRED_ENTRY_NAME, color: 'slate', order: 0, funnelId: existing.id, isSystem: true, isEntry: true });
  }
  return { createFunnel: null, createStages };
};

// Etapa do card. DERIVADA enquanto ninguém arrasta — é o que faz o funil
// funcionar retroativo, sem backfill e sem card órfão. O primeiro arrasto grava
// reactivationStageId e a partir daí ele manda.
export const expiredStageIdOf = (lead, statuses, funnelId) => {
  if (lead?.reactivationStageId) return lead.reactivationStageId;
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  // Quem registrou "não vou voltar" na Meta já nasce na gaveta certa. Se a
  // academia apagou essa etapa, cai na entrada como todo mundo.
  if (lead?.renewalDeclined) {
    const naoVolta = inFunnel.find((s) => sameStageName(s.name, EXPIRED_DECLINED_NAME));
    if (naoVolta) return naoVolta.id;
  }
  return getExpiredEntryStage(statuses, funnelId)?.id || null;
};

// Projeta clientes vencidos como cards do board.
//
// As colunas do Kanban casam por NOME e os cards são agrupados por
// `lead.status` (ver partitionLeadsByStatus). Cliente é `status: 'Venda'`, então
// sem projeção todos cairiam na coluna Venda. Aqui o status EXIBIDO vira o nome
// da etapa derivada.
//
// A projeção é SÓ EM MEMÓRIA: o `status` real do documento continua 'Venda', e é
// o que preserva o estado de cliente e a aba Clientes. Quem grava a etapa de
// verdade é o arrastar, em `reactivationStageId`.
//
// `_expiredCard` marca o card projetado — o handler de drop usa para saber que
// precisa gravar reactivationStageId em vez de status.
export const projectExpiredLeads = (leads, statuses, funnelId) => {
  if (!funnelId) return [];
  const inFunnel = (statuses || []).filter((s) => s?.funnelId === funnelId);
  const nameById = new Map(inFunnel.map((s) => [s.id, s.name]));
  return (leads || []).map((lead) => {
    const stageId = expiredStageIdOf(lead, statuses, funnelId);
    const name = stageId ? nameById.get(stageId) : null;
    return name ? { ...lead, status: name, _expiredCard: true } : null;
  }).filter(Boolean);
};
