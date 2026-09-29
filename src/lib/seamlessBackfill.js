// Plano do scripts/backfill-contract-seamless.js: quais contratos e quais leads
// ganham a marca de emendado (seamless). Puro, para caber em teste.
//
// Desde 28/09/2026, a renovação que começa no dia seguinte ao fim do contrato
// renovado é gravada com seamless: true no contrato e
// currentContractSeamless: true no lead, e não aparece como agendada. As
// renovações gravadas antes não têm a marca. Recebem a marca:
//   - a renovação (renewedFromId) que ainda não a tem, que chegou a valer
//     (neverTookEffect) e cujo contrato renovado está na lista e valeu até o
//     fim previsto (stoppedEarly), quando começa no dia seguinte ao fim
//     previsto dele (originalEndsAt, se ele foi encurtado; senão endsAt) ou
//     quando foi ela que o encurtou (shortenedById), porque aí começa no dia
//     seguinte ao fim novo dele;
//   - o lead cujo contrato atual tem a marca, gravada agora ou antes, e que
//     ainda não tem currentContractSeamless: true.
// Só marca true: sem a marca já quer dizer "não emendado", e nada é gravado
// como false. Sobreposição antiga não é encurtada (decisão do Johnny,
// 28/09/2026). Quem já tem a marca não entra, então rodar de novo é seguro.

import { CONTRACT_STATUS, isSeamlessStart, neverTookEffect } from './contracts.js';
import { getSafeDateOrNull } from './dates.js';

// O contrato renovado não valeu até o fim previsto, então a renovação dele não
// é emendada: trancado, porque o fim ainda anda na reativação, ou cancelado
// antes do fim previsto (originalEndsAt, se foi encurtado; senão endsAt). O
// cancelado sem data e o cancelado ainda trancado também ficam de fora. Sem a
// data não dá para saber se ele valeu até o fim, e o cancelado ainda trancado
// parou no trancamento, como no fim efetivo (contractEndOf, em
// contractHistory.js). Na dúvida não marca: sem a marca, a renovação só
// aparece agendada até começar.
const stoppedEarly = (prev) => {
  if (prev.status === CONTRACT_STATUS.TRANCADO) return true;
  if (prev.status !== CONTRACT_STATUS.CANCELADO) return false;
  const cancelled = getSafeDateOrNull(prev.cancelledAt);
  const planned = getSafeDateOrNull(prev.originalEndsAt) || getSafeDateOrNull(prev.endsAt);
  if (!cancelled || !planned || getSafeDateOrNull(prev.pausedAt)) return true;
  return cancelled.getTime() < planned.getTime();
};

export function planSeamlessBackfill(contracts, leads) {
  const list = (Array.isArray(contracts) ? contracts : []).filter(Boolean);
  const byId = new Map(list.map((c) => [c.id, c]));

  const contractIds = list
    .filter((c) => {
      if (!c.renewedFromId || c.seamless === true || neverTookEffect(c)) return false;
      const prev = byId.get(c.renewedFromId);
      if (!prev || stoppedEarly(prev)) return false;
      const shortenedByThis = Boolean(prev.shortenedById && prev.shortenedById === c.id);
      return shortenedByThis || isSeamlessStart(prev.originalEndsAt || prev.endsAt, c.startsAt);
    })
    .map((c) => c.id);

  const marked = new Set(contractIds);
  const isSeamless = (id) => marked.has(id) || byId.get(id)?.seamless === true;
  const leadIds = (Array.isArray(leads) ? leads : [])
    .filter((l) => l?.currentContractId && l.currentContractSeamless !== true && isSeamless(l.currentContractId))
    .map((l) => l.id);

  return { contractIds, leadIds };
}
