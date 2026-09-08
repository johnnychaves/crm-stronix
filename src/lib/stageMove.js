// Regra ÚNICA do que um lead ou cliente pode fazer no funil: mover para uma
// etapa comum (planStageMove) e marcar Perda (planLoss). Pura: sem React e
// sem SDK. O Kanban (arrasto e menu Mover) e a ficha (Mudar fase, composer de
// nota, botão e modal de Perda) chamam daqui — a regra vivia copiada em vários
// lugares e já tinha divergido.
//
// A REGRA (decisão do Johnny, set/2026): quem virou cliente não volta a ser
// lead, em hipótese alguma. Nem por mudança de fase, nem por Perda, nem com o
// contrato vencido ou cancelado — aí ele é um CLIENTE INATIVO. "Cliente" é o
// mesmo recorte da aba Clientes e do balde (isClientLead): matriculado
// (lifecycleStage), convertido (isConverted) ou em etapa com nome de matrícula.
//
// O bug que motivou o módulo: sair de Venda sempre "desfazia a venda"
// (isConverted/convertedAt/lifecycleStage zerados), regra de quando Venda era
// só um status. Depois que a matrícula passou a gravar contrato, a mesma
// mudança de fase deixava um LEAD carregando um contrato: a aba Contratos
// dizia "Ainda não é cliente" com o chip em 1, e o cliente saía da aba
// Clientes e do mês de matrículas. Perda num cliente fazia o mesmo com a
// conversão e ainda pintava "LEAD PERDIDO" no cabeçalho.
//
// O que sobra de movimento para um cliente: etapa com nome de matrícula
// ("Matriculado", "Convertido") — segue cliente. Encerrar é cancelar o
// contrato (aba Contratos); "não vai renovar" é a coluna Perda dos funis
// Renovações e Vencidos, que grava renewalDeclined e mantém a pessoa cliente.
//
// Retorno de planStageMove:
//   { ok: true, patch, stampConvertedAt } — patch já com lifecycleBucket
//     (withBucket); convertedAt NÃO vem no patch quando stampConvertedAt é
//     true: é serverTimestamp() do SDK, o caller injeta.
//   { ok: false, reason }                 — nada a gravar.
// planLoss devolve { ok: true } ou { ok: false, reason }.

import { isConvertedStatusName, isClientLead } from './leads.js';
import { getSafeDateOrNull } from './dates.js';
import { withBucket } from './leadDerived.js';

export const STAGE_MOVE_BLOCK = {
  CLIENTE_NAO_VOLTA_A_LEAD: 'cliente_nao_volta_a_lead',
  CLIENTE_NAO_VIRA_PERDA: 'cliente_nao_vira_perda'
};

export function planStageMove(lead, targetStatus, { funnelId = null } = {}) {
  const destinoConvertido = isConvertedStatusName(targetStatus);

  if (isClientLead(lead) && !destinoConvertido) {
    return { ok: false, reason: STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD };
  }

  const patch = { status: targetStatus };
  if (funnelId && funnelId !== lead?.funnelId) patch.funnelId = funnelId;
  if (lead?.status === 'Perda') {
    patch.lossReason = null;
    patch.lostAt = null;
  }

  // Etapa com nome de matrícula conta como conversão nas métricas: sem o
  // carimbo, a matrícula caía no mês do CADASTRO do lead, não no do fechamento.
  const stampConvertedAt = destinoConvertido && !getSafeDateOrNull(lead?.convertedAt);

  return { ok: true, patch: withBucket(patch, lead), stampConvertedAt };
}

export function planLoss(lead) {
  if (isClientLead(lead)) return { ok: false, reason: STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA };
  return { ok: true };
}

// Texto do aviso quando o movimento é bloqueado. Um lugar só, para o Kanban e a
// ficha dizerem a mesma coisa.
export function stageMoveBlockMessage(lead, reason) {
  const firstName = String(lead?.name || '').trim().split(/\s+/)[0];
  const quem = firstName || 'Este cliente';
  if (reason === STAGE_MOVE_BLOCK.CLIENTE_NAO_VOLTA_A_LEAD) {
    const como = lead?.currentContractId
      ? ' Para encerrar a matrícula, cancele o contrato na aba Contratos.'
      : '';
    return `${quem} é cliente e não volta a ser lead.${como}`;
  }
  if (reason === STAGE_MOVE_BLOCK.CLIENTE_NAO_VIRA_PERDA) {
    return `${quem} é cliente e não vira lead perdido. Para encerrar, cancele o contrato na aba Contratos ou use a coluna Perda dos funis Renovações e Vencidos.`;
  }
  return 'Não foi possível mover para esta etapa.';
}
