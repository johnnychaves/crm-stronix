// A ponte entre o metricsOf e as props dos componentes da tela Gerencial.
//
// Mora aqui, e não dentro da view, porque é onde mora o erro silencioso: um
// campo com nome trocado não quebra nada, só apaga uma linha da tela. Sendo
// função pura, o teste renderiza a tela inteira a partir de contratos de
// mentira e confere o número que aparece (gerencial.dashboard.test.js).
import { fmtMoney } from '../format.js';
import { monthLabel } from '../operacional/month.js';
import { emptyMonth } from './texts.js';

const textOf = ({ title, body }) => ({ title, text: body });

// A pílula do herói mostra a variação em porcentagem e a linha de base diz de
// onde ela saiu. Mês comparado sem venda não vira "infinito por cento": a
// pílula fica "sem base" e a linha de base continua.
export function soldDelta(cur, cmp, { comparing }) {
  if (!comparing || !cmp) return null;
  const cmpName = monthLabel(cmp.monthKey, { capitalized: false, withYear: false });
  const baseline = `${fmtMoney(cmp.sold.sold)} em ${cmp.sold.count} contratos ${cur.running ? `nos mesmos dias de ${cmpName}` : `em ${cmpName}`}`;
  if (!(cmp.sold.sold > 0)) return { none: true, text: 'sem base', baseline };
  const pct = Math.round(((cur.sold.sold - cmp.sold.sold) / cmp.sold.sold) * 100);
  return { up: pct >= 0, text: `${Math.abs(pct)}%`, baseline };
}

// Variação de uma linha contra a mesma linha do mês comparado. `lowerBetter`
// vira o tom: saída que cresce é ruim. Sem base no mês comparado, "novo" (e
// nada, se também não vendeu agora). Sem comparação, null.
export function pctDelta(cur, prev, { lowerBetter = false, baseline } = {}) {
  if (prev == null) return null;
  if (!(prev > 0)) return cur > 0 ? { tone: 'quiet', text: 'novo', baseline } : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { tone: 'quiet', text: 'igual', baseline };
  const up = pct > 0;
  return { up, tone: up !== lowerBetter ? 'good' : 'bad', text: `${Math.abs(pct)}%`, baseline };
}

// Planos e origem entram no gráfico pelo VALOR vendido: a grandeza é dinheiro
// e a contagem de vendas vira a dica da fatia. `prevOf` devolve o valor do
// mesmo nome no mês comparado.
const breakdown = (rows, total, deltaOf) => ({
  items: (rows || []).map((r) => ({ name: r.name, count: r.value, times: r.count, delta: deltaOf ? deltaOf(r) : null })),
  total
});

export function dashboardProps({ cur, cmp, comparing, roleOf = () => null }) {
  const on = Boolean(comparing && cmp);
  // Mês em andamento compara os mesmos dias do outro mês (pró-rata), e a dica
  // de cada linha diz a base com essa frase.
  const cmpName = on ? monthLabel(cmp.monthKey, { capitalized: false, withYear: false }) : '';
  const vs = cur.running ? `nos mesmos dias de ${cmpName}` : `em ${cmpName}`;
  const moneyDelta = (value, prev) => (on ? pctDelta(value, prev ?? 0, { baseline: `${fmtMoney(prev ?? 0)} ${vs}` }) : null);
  const byKey = (rows, key, pick) => new Map((rows || []).map((r) => [r[key], pick(r)]));

  const prevMix = on ? byKey(cmp.sold.mix, 'type', (r) => r.value) : null;
  const prevSellers = on ? byKey(cmp.sellers, 'id', (r) => r.value) : null;
  const prevPlans = on ? byKey(cmp.plans, 'name', (r) => r.value) : null;
  const prevSources = on ? byKey(cmp.sources, 'name', (r) => r.value) : null;
  const prevExits = on ? byKey(cmp.exits.items, 'kind', (r) => r.count) : null;

  return {
    sold: {
      mix: cur.sold.mix.map((m) => ({ ...m, delta: moneyDelta(m.value, prevMix?.get(m.type)) })),
      ticket: cur.sold.ticket,
      discount: { pct: cur.sold.discPct, abs: cur.sold.discAbs, prevPct: on ? cmp.sold.discPct : null },
      clawback: { count: cur.sold.clawCount, value: cur.sold.clawValue },
      delta: soldDelta(cur, cmp, { comparing })
    },
    wallet: {
      count: cur.wallet.count,
      monthly: cur.wallet.monthly,
      ticket: cur.wallet.ticket,
      blind: cur.wallet.blind,
      lockedCount: cur.wallet.lockedCount
    },
    risk: {
      horizon: cur.risk.horizon,
      walletMonthly: cur.wallet.monthly,
      lapsedCount: cur.risk.expired.count
    },
    exits: {
      items: cur.exits.items.map((e) => {
        const prev = prevExits?.get(e.kind) ?? 0;
        return {
          ...e,
          delta: on ? pctDelta(e.count, prev, { lowerBetter: true, baseline: `${prev} ${prev === 1 ? 'contrato' : 'contratos'} ${vs}` }) : null
        };
      })
    },
    sellers: {
      rows: cur.sellers.map((r) => ({ ...r, role: roleOf(r.id), delta: moneyDelta(r.value, prevSellers?.get(r.id)) }))
    },
    plans: breakdown(cur.plans, cur.sold.sold, on ? (r) => moneyDelta(r.value, prevPlans.get(r.name)) : null),
    sources: breakdown(cur.sources, cur.sold.sold, on ? (r) => moneyDelta(r.value, prevSources.get(r.name)) : null),
    flags: cur.flags,
    texts: { emptyMonth: textOf(emptyMonth()) }
  };
}
