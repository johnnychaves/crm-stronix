// Gargalo do funil: a etapa em que o lead menos avança. Sai da passagem entre
// etapas (stages.js), a mesma que a tela mostra linha a linha, então o aviso
// nunca diz uma coisa e a tabela outra.
//
// "Parado" é o lead que entrou na etapa neste mês e ainda não saiu dela, nem
// avançando nem perdido. É entered − advanced − lost, nunca gravado.
//
// Etapa com poucas entradas não vira gargalo: com 3 leads, um a mais ou a
// menos muda a taxa em 33 pontos, e o aviso apontaria para o acaso.
export const MIN_STAGE_ENTERED = 5;

export const stuckOf = (r) => Math.max(0, (r?.entered || 0) - (r?.advanced || 0) - (r?.lost || 0));

// Devolve a etapa de menor taxa de avanço, ou null quando nenhuma tem base
// ou quando todas deixam 100% dos leads avançar.
export function stageBottleneck(rows, { minEntered = MIN_STAGE_ENTERED } = {}) {
  let worst = null;
  (rows || []).forEach((r) => {
    if (!(r.entered >= minEntered)) return;
    const rate = r.advanced / r.entered;
    const out = (r.lost || 0) + stuckOf(r);
    if (!worst || rate < worst.rate || (rate === worst.rate && out > worst.out)) worst = { r, rate, out };
  });
  if (!worst || worst.rate >= 1) return null;
  const { r, rate } = worst;
  return {
    name: r.name,
    entered: r.entered,
    advanced: r.advanced,
    lost: r.lost || 0,
    stuck: stuckOf(r),
    advancePct: Math.round(rate * 100),
    medianMin: r.medianMin ?? null
  };
}
