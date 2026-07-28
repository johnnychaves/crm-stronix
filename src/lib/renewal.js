// Aritmética da RENOVAÇÃO — funções puras, sem React e sem SDK do Firestore.
// Compartilhada pelo modal de matrícula/renovação (src/modals/ContractModal.jsx) e pelo
// card do contrato vigente na aba Contratos da ficha.
//
// A regra de QUANDO o cliente entra na Meta Diária de renovação continua em
// renewalGoal.js; aqui mora o que a tela precisa calcular: onde o novo
// contrato encosta no atual, quanto de desconto foi dado e onde cada marco
// cai na régua de vigência.

import { addDays, daysBetween, getSafeDateOrNull } from './dates.js';
import { parseValorBRL } from './format.js';
import { normalize } from './globalSearch.js';
import { activeRenewalCheckpoint, DEFAULT_RENEWAL_CHECKPOINTS } from './renewalGoal.js';

const DAY_MS = 86400000;

// Moram em dates.js (contracts.js também precisa deles e importar daqui
// fecharia um ciclo). Reexportados para quem já consome a matemática daqui.
export { addDays, daysBetween };

const fmtDate = (d) => {
  const date = getSafeDateOrNull(d);
  return date ? date.toLocaleDateString('pt-BR') : '';
};

// ---------------------------------------------------------------------------
// Encaixe da vigência nova na atual
// ---------------------------------------------------------------------------

export const SEAM_KIND = {
  EMENDA: 'emenda',
  LACUNA: 'lacuna',
  SOBREPOSICAO: 'sobreposicao'
};

// Início recomendado: o dia seguinte ao término do contrato atual. É o padrão
// do modal — o antigo `new Date()` criava contrato sobreposto sempre que a
// renovação era fechada antes do vencimento.
export const seamStart = (currentEndsAt) => addDays(currentEndsAt, 1);

// Lacuna e sobreposição são contas diferentes: emendar (início = fim + 1) é
// lacuna ZERO, por isso o -1; a sobreposição é a cobertura perdida, sem o -1.
export function computeSeam(currentEndsAt, startsAt) {
  const rawGap = daysBetween(currentEndsAt, startsAt);
  if (rawGap == null) return null;
  const gapDays = rawGap > 0 ? rawGap - 1 : rawGap;
  return {
    gapDays,
    overlapDays: gapDays < 0 ? Math.abs(gapDays) : 0,
    kind: gapDays === 0
      ? SEAM_KIND.EMENDA
      : gapDays > 0 ? SEAM_KIND.LACUNA : SEAM_KIND.SOBREPOSICAO
  };
}

// Leitura curta do encaixe, para o recibo do modal.
export function seamLabel(seam) {
  if (!seam) return '';
  if (seam.kind === SEAM_KIND.EMENDA) return 'Emenda perfeita — nenhum dia sem contrato.';
  if (seam.kind === SEAM_KIND.LACUNA) {
    return `${seam.gapDays} ${seam.gapDays === 1 ? 'dia' : 'dias'} sem contrato entre os dois.`;
  }
  return `Sobreposição de ${seam.overlapDays} ${seam.overlapDays === 1 ? 'dia' : 'dias'} com o contrato atual.`;
}

// Aviso do que se perde ao não emendar. Null quando a vigência encaixa.
export function seamWarning(seam, startsAt) {
  if (!seam || seam.kind === SEAM_KIND.EMENDA) return null;
  if (seam.kind === SEAM_KIND.SOBREPOSICAO) {
    const lastDay = fmtDate(addDays(startsAt, -1));
    return `O contrato atual será encerrado em ${lastDay}, ${seam.overlapDays} dias antes do previsto — os dias já pagos se perdem. Considere emendar no fim do atual ou dar o período como bônus no desconto.`;
  }
  return `Ficam ${seam.gapDays} ${seam.gapDays === 1 ? 'dia' : 'dias'} sem contrato ativo. Nesse intervalo o cliente conta como inativo e sai dos relatórios de clientes ativos.`;
}

// ---------------------------------------------------------------------------
// Desconto
// ---------------------------------------------------------------------------

// O desconto deixou de ser "apagar o valor da tabela e digitar outro": o modo
// é escolhido antes, então o registro sabe se foi 10% ou R$ 150.
export const DISCOUNT_MODES = {
  NENHUM: 'nenhum',
  PERCENT: 'percent',
  REAIS: 'reais',
  FINAL: 'final'
};

export const DISCOUNT_REASONS = ['Fidelidade', 'Indicação', 'Campanha', 'Retorno', 'Outro'];

const round2 = (n) => Math.round(n * 100) / 100;

export function computeDiscount({ listValue, mode = DISCOUNT_MODES.NENHUM, input = '' } = {}) {
  const list = Number(listValue);
  const base = Number.isFinite(list) && list > 0 ? list : 0;
  const parsed = parseValorBRL(input);
  const n = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;

  let finalValue = base;
  if (mode === DISCOUNT_MODES.PERCENT) finalValue = base * (1 - Math.min(n, 100) / 100);
  else if (mode === DISCOUNT_MODES.REAIS) finalValue = Math.max(base - n, 0);
  else if (mode === DISCOUNT_MODES.FINAL) finalValue = parsed == null ? base : n;

  finalValue = round2(finalValue);
  const discountValue = Math.max(round2(base - finalValue), 0);
  return {
    finalValue,
    discountValue,
    discountPct: base > 0 ? Math.round((discountValue / base) * 100) : 0,
    hasDiscount: discountValue > 0.005
  };
}

// ---------------------------------------------------------------------------
// Planos: os três mais vendidos + busca no catálogo ativo
// ---------------------------------------------------------------------------

// A contagem de vendas sai dos contratos já gravados (stronix_contratos) —
// nenhum campo novo no catálogo.
export function plansWithSales(plans, contracts) {
  const counts = new Map();
  (Array.isArray(contracts) ? contracts : []).forEach(c => {
    if (!c?.planId) return;
    counts.set(c.planId, (counts.get(c.planId) || 0) + 1);
  });
  return (Array.isArray(plans) ? plans : []).map(p => ({ ...p, sold: counts.get(p.id) || 0 }));
}

// Mais vendidos primeiro; empate cai na ordem do catálogo.
export function topSellingPlans(plans, limit = 3) {
  return [...(Array.isArray(plans) ? plans : [])]
    .sort((a, b) => (b.sold || 0) - (a.sold || 0) || (a.order || 0) - (b.order || 0))
    .slice(0, limit);
}

export function searchPlans(plans, query) {
  const q = normalize(String(query || '').trim());
  if (!q) return [];
  return (Array.isArray(plans) ? plans : []).filter(p => normalize(p.name).includes(q));
}

// ---------------------------------------------------------------------------
// Régua de vigência do contrato vigente
// ---------------------------------------------------------------------------

// Percentual decorrido, dias restantes e a posição de cada marco de renovação
// na régua: (total - marco) / total. Os marcos vêm de Configurações → Metas &
// ritmo; marco maior que a própria vigência não cabe na régua e é descartado.
export function contractVigencia({
  startsAt,
  endsAt,
  checkpoints = DEFAULT_RENEWAL_CHECKPOINTS,
  handled = [],
  now = new Date()
} = {}) {
  const start = getSafeDateOrNull(startsAt);
  const end = getSafeDateOrNull(endsAt);
  if (!start || !end) return null;

  const ref = getSafeDateOrNull(now) || new Date();
  const totalDays = Math.max(daysBetween(start, end), 1);
  const elapsed = daysBetween(start, ref);
  const elapsedPct = Math.max(0, Math.min(100, Math.round((elapsed / totalDays) * 100)));
  const daysLeft = Math.ceil((end.getTime() - ref.getTime()) / DAY_MS);

  const handledList = (Array.isArray(handled) ? handled : []).map(Number);
  const valid = (Array.isArray(checkpoints) ? checkpoints : [])
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0 && n < totalDays)
    .sort((a, b) => b - a);
  const active = activeRenewalCheckpoint(daysLeft, valid);

  const marks = valid.map(days => ({
    days,
    pos: ((totalDays - days) / totalDays) * 100,
    date: addDays(end, -days),
    passed: daysLeft < days,
    handled: handledList.includes(days),
    active: days === active
  }));

  return {
    totalDays,
    elapsedPct,
    daysLeft,
    marks,
    missedCount: marks.filter(m => m.passed && !m.handled).length
  };
}

// "2 marcos de renovação passaram sem contato" — o que o gráfico não dizia.
export function missedCheckpointsLabel(missedCount) {
  const n = Number(missedCount) || 0;
  if (n <= 0) return null;
  return n === 1
    ? '1 marco de renovação passou sem contato'
    : `${n} marcos de renovação passaram sem contato`;
}
