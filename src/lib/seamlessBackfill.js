// Plano do scripts/backfill-contract-seamless.js: quais contratos e quais leads
// ganham a marca de emendado (seamless). Puro, para caber em teste.
//
// Desde 28/09/2026, a renovação que começa no dia seguinte ao fim do contrato
// renovado é gravada com seamless: true no contrato e
// currentContractSeamless: true no lead, e não aparece como agendada. As
// renovações gravadas antes não têm a marca. Recebem a marca:
//   - a renovação (renewedFromId) que ainda não a tem, que chegou a valer
//     (neverTookEffect) e cujo contrato renovado está na lista, quando começa
//     no dia seguinte ao fim previsto dele (originalEndsAt, se ele foi
//     encurtado; senão endsAt) ou quando foi ela que o encurtou
//     (shortenedById), porque aí começa no dia seguinte ao fim novo dele;
//   - o lead cujo contrato atual tem a marca, gravada agora ou antes, e que
//     ainda não tem currentContractSeamless: true.
// Só marca true: sem a marca já quer dizer "não emendado", e nada é gravado
// como false. Sobreposição antiga não é encurtada (decisão do Johnny,
// 28/09/2026). Quem já tem a marca não entra, então rodar de novo é seguro.

import { isSeamlessStart, neverTookEffect } from './contracts.js';

export function planSeamlessBackfill(contracts, leads) {
  const list = (Array.isArray(contracts) ? contracts : []).filter(Boolean);
  const byId = new Map(list.map((c) => [c.id, c]));

  const contractIds = list
    .filter((c) => {
      if (!c.renewedFromId || c.seamless === true || neverTookEffect(c)) return false;
      const prev = byId.get(c.renewedFromId);
      if (!prev) return false;
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
