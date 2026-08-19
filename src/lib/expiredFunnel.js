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
export const EXPIRED_ENTRY_NAME = 'Aguardando contato';
// Nome da primeira versão, que chegou a ir para produção em 19/08. A etapa de
// entrada é PROTEGIDA e não pode ser renomeada pela tela, então quem provisionou
// antes ficaria preso nele — o plano abaixo renomeia.
export const EXPIRED_ENTRY_LEGACY_NAME = 'Vencido';
// Etapas do meio, semeadas na criação para o funil não nascer vazio. NÃO são
// protegidas, e o provisionamento NUNCA as recria: ressuscitar uma etapa que a
// academia apagou de propósito seria pior que o vão.
export const EXPIRED_SEED_MIDDLE_NAME = 'Em contato';
// NÃO semeamos etapa de negociação (decisão do Johnny em 18/08): com Venda e
// Perda já sendo colunas do board, o funil ficaria largo demais para o volume
// que costuma ter, e coluna vazia atrapalha mais que ajuda. A academia adiciona
// pela tela se sentir falta — errar para menos custa dez segundos, errar para
// mais deixa uma coluna morta que todo mundo olha todo dia.
//
// ARMADILHA para quem for adicionar: uma etapa chamada exatamente 'Negociação'
// vira PROTEGIDA automaticamente (isSystemStage, em funnels.js), e não dá mais
// para apagar pela tela. Nomear "Em negociação" evita isso.
// NÃO existe etapa "não volta": quem recusou é venda perdida, e o board já tem
// a coluna PERDA de sistema. Nesse funil ela mostra quem tem `renewalDeclined`.
//
// A pessoa NÃO vira lifecycleBucket 'perda' — ela continua CLIENTE, com ficha,
// contratos e histórico, e segue aparecendo na aba Clientes. É um ex-aluno que
// não volta, não um lead descartado (decisão do Johnny em 18/08).

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
    // Aceita o nome legado: academia provisionada em 19/08 que tenha perdido a
    // flag por fora ficaria órfã se olhássemos só o nome novo.
    inFunnel.find((s) => s.isSystem && (sameStageName(s.name, EXPIRED_ENTRY_NAME) || sameStageName(s.name, EXPIRED_ENTRY_LEGACY_NAME))) ||
    inFunnel.reduce((best, s) => ((s.order ?? 99) < (best.order ?? 99) ? s : best))
  );
};

// Plano idempotente do provisionamento. Só as etapas PROTEGIDAS são garantidas.
export const planExpiredSetupOps = ({ funnels, statuses } = {}) => {
  const existing = getExpiredFunnel(funnels);

  if (!existing) {
    return {
      createFunnel: { name: EXPIRED_FUNNEL_NAME, systemKind: EXPIRED_FUNNEL_KIND, order: 99 },
      renameStages: [],
      createStages: [
        { name: EXPIRED_ENTRY_NAME, color: 'slate', order: 0, isSystem: true, isEntry: true },
        { name: EXPIRED_SEED_MIDDLE_NAME, color: 'amber', order: 1 },
      ],
    };
  }

  const inFunnel = (statuses || []).filter((s) => s?.funnelId === existing.id);
  // Só a ENTRADA é garantida: ela é protegida e o funil não funciona sem ela.
  // As do meio são livres e não voltam se a academia apagar.
  const createStages = [];
  const renameStages = [];
  const entrada = inFunnel.find(
    (s) => s.isEntry || sameStageName(s.name, EXPIRED_ENTRY_NAME) || sameStageName(s.name, EXPIRED_ENTRY_LEGACY_NAME)
  );
  if (!entrada) {
    createStages.push({ name: EXPIRED_ENTRY_NAME, color: 'slate', order: 0, funnelId: existing.id, isSystem: true, isEntry: true });
  } else if (sameStageName(entrada.name, EXPIRED_ENTRY_LEGACY_NAME)) {
    // Renomeia em vez de criar outra: a etapa é protegida e ninguém consegue
    // arrumar pela tela.
    renameStages.push({ id: entrada.id, name: EXPIRED_ENTRY_NAME });
  }
  return { createFunnel: null, createStages, renameStages };
};

// Etapa do card. DERIVADA enquanto ninguém arrasta — é o que faz o funil
// funcionar retroativo, sem backfill e sem card órfão. O primeiro arrasto grava
// reactivationStageId e a partir daí ele manda.
export const expiredStageIdOf = (lead, statuses, funnelId) => {
  if (lead?.reactivationStageId) return lead.reactivationStageId;
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

// Divide os vencidos entre as ETAPAS e a coluna PERDA do board.
//
// Quem recusou (`renewalDeclined`) sai das etapas e vai para a coluna Perda, que
// o board já renderiza em todo funil. Ele continua CLIENTE — o que muda é só
// onde o card aparece, nunca o lifecycleBucket.
export const splitExpiredForBoard = (leads, statuses, funnelId) => {
  const all = leads || [];
  const declined = all.filter((l) => l?.renewalDeclined);
  const ativos = all.filter((l) => !l?.renewalDeclined);
  return {
    cards: projectExpiredLeads(ativos, statuses, funnelId),
    // Marcados também, para o drop saber que é card de vencido e não perda real.
    declined: declined.map((l) => ({ ...l, _expiredCard: true })),
  };
};
