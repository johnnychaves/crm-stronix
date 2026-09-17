// Regras de recorte do Gerencial. A lista chega normalizada por
// normalizeContracts (src/lib/operacional/base.js): datas viram Date, a pausa
// do trancamento já está montada e o importado vem marcado.

export const SALE_TYPES = { NOVA: 'nova', RENOVACAO: 'renovacao', UPGRADE: 'upgrade', RETORNO: 'retorno' };

// A venda conta no instante em que o contrato foi fechado. Contrato antigo sem
// createdAt cai no início da vigência, igual ao Operacional.
export const saleMoment = (c) => c?.createdAt || c?.startsAt || null;

// Contrato importado veio sem valor (494 na STRONIX). Ele é gente de verdade e
// entra na contagem, mas nunca na soma de dinheiro nem no denominador do ticket.
export const hasValue = (c) => Number(c?.value) > 0;

// Quanto o contrato vale por mês. Plano sem duração gravada vale por um mês, que
// é o pior caso e não infla a carteira.
export const monthlyTicket = (c) => {
  const value = Number(c?.value) || 0;
  const months = Number(c?.durationMonths) || 0;
  return months > 0 ? value / months : value;
};

// Cada contrato entra em um tipo só, nesta ordem. Renovação ganha do upgrade
// porque o mesmo contrato pode ser os dois, e é uma venda só.
export function saleTypeOf(c, byPerson) {
  if (c?.renewedFromId) return SALE_TYPES.RENOVACAO;
  if (c?.closedFromUpgrade) return SALE_TYPES.UPGRADE;
  const t = saleMoment(c);
  const earlier = (byPerson?.get(c?.personKey) || []).some((o) => {
    const ot = saleMoment(o);
    return o !== c && ot && t && ot < t;
  });
  return earlier ? SALE_TYPES.RETORNO : SALE_TYPES.NOVA;
}

export const inWindow = (d, start, end) => Boolean(d) && d >= start && d < end;
