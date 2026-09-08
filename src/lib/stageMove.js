// Regra ÚNICA de "mover para uma etapa comum" (não Venda, não Perda). Pura:
// sem React e sem SDK. O Kanban (arrasto e menu Mover) e a ficha (Mudar fase
// e o composer de nota) chamam daqui — a regra vivia copiada nos três e já
// tinha divergido: o Kanban não zerava lifecycleStage, o composer não
// carimbava convertedAt, e nenhum deles olhava o CONTRATO.
//
// O bug que motivou o módulo: sair de Venda sempre "desfazia a venda"
// (isConverted/convertedAt/lifecycleStage zerados), regra de quando Venda era
// só um status. Depois que a matrícula passou a gravar um contrato
// (stronix_contratos + currentContract* no lead), a mesma mudança de fase
// deixava um LEAD carregando um contrato: a aba Contratos dizia "Ainda não é
// cliente" enquanto o chip de contagem seguia em 1, e o cliente saía da aba
// Clientes e do mês de matrículas. O contrato é o fato; a fase não o apaga.
//
// Regras:
//   - Etapa comum → etapa comum: só status (+ funil, se mudou).
//   - Saindo de Perda: limpa lossReason/lostAt.
//   - Destino com nome de matrícula ("Matriculado", "Convertido"): conta como
//     conversão; se falta convertedAt, o caller carimba (sinal stampConvertedAt).
//   - Saindo de Venda para etapa comum:
//       * COM contrato (currentContractId): BLOQUEIA. Cliente não volta para
//         etapa de lead; desfazer a matrícula é cancelar o contrato na aba
//         Contratos. Vale para contrato cancelado/vencido também — a pessoa
//         segue cliente (inativo/cancelado), com histórico.
//       * SEM contrato (Venda legada ou importado sem vigência): desfaz a venda
//         por inteiro — volta a ser lead, como sempre foi.
//
// Retorno:
//   { ok: true, patch, undoesSale, stampConvertedAt }  — patch já com
//     lifecycleBucket (withBucket); convertedAt NÃO vem no patch quando
//     stampConvertedAt é true: é serverTimestamp() do SDK, o caller injeta.
//   { ok: false, reason }                              — nada a gravar.

import { isConvertedStatusName } from './leads.js';
import { getSafeDateOrNull } from './dates.js';
import { withBucket } from './leadDerived.js';

export const STAGE_MOVE_BLOCK = {
  CLIENTE_COM_CONTRATO: 'cliente_com_contrato'
};

export function planStageMove(lead, targetStatus, { funnelId = null } = {}) {
  const destinoConvertido = isConvertedStatusName(targetStatus);
  const leavingVenda = lead?.status === 'Venda' && !destinoConvertido;

  if (leavingVenda && lead?.currentContractId) {
    return { ok: false, reason: STAGE_MOVE_BLOCK.CLIENTE_COM_CONTRATO };
  }

  const patch = { status: targetStatus };
  if (funnelId && funnelId !== lead?.funnelId) patch.funnelId = funnelId;

  if (leavingVenda) {
    patch.isConverted = false;
    patch.convertedAt = null;
    // Sem isto a pessoa ficava presa como 'cliente' (fora do Kanban, header de
    // cliente) numa etapa de lead — ver commit 3749e8b.
    patch.lifecycleStage = null;
  }
  if (lead?.status === 'Perda') {
    patch.lossReason = null;
    patch.lostAt = null;
  }

  const stampConvertedAt = destinoConvertido && !getSafeDateOrNull(lead?.convertedAt);

  return {
    ok: true,
    patch: withBucket(patch, lead),
    undoesSale: leavingVenda,
    stampConvertedAt
  };
}

// Texto do aviso quando o movimento é bloqueado. Um lugar só, para o Kanban e a
// ficha dizerem a mesma coisa.
export function stageMoveBlockMessage(lead, reason) {
  const firstName = String(lead?.name || '').trim().split(/\s+/)[0];
  if (reason === STAGE_MOVE_BLOCK.CLIENTE_COM_CONTRATO) {
    const quem = firstName || 'Este cliente';
    return `${quem} tem contrato e continua cliente. Para desfazer a matrícula, cancele o contrato na aba Contratos.`;
  }
  return 'Não foi possível mover para esta etapa.';
}
