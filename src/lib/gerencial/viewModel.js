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

// Planos e origem entram no gráfico pelo VALOR vendido: a grandeza é dinheiro
// e a contagem de vendas vira a dica da fatia.
const breakdown = (rows, total) => ({
  items: (rows || []).map((r) => ({ name: r.name, count: r.value, times: r.count })),
  total
});

export function dashboardProps({ cur, cmp, comparing, roleOf = () => null }) {
  return {
    sold: {
      mix: cur.sold.mix,
      ticket: cur.sold.ticket,
      discount: { pct: cur.sold.discPct, abs: cur.sold.discAbs },
      clawback: { count: cur.sold.clawCount, value: cur.sold.clawValue },
      delta: soldDelta(cur, cmp, { comparing })
    },
    wallet: {
      count: cur.wallet.count,
      monthly: cur.wallet.monthly,
      lockedCount: cur.wallet.lockedCount
    },
    risk: {
      horizon: cur.risk.horizon,
      walletMonthly: cur.wallet.monthly,
      lapsedCount: cur.risk.expired.count
    },
    exits: { items: cur.exits.items },
    sellers: { rows: cur.sellers.map((r) => ({ ...r, role: roleOf(r.id) })) },
    plans: breakdown(cur.plans, cur.sold.sold),
    sources: breakdown(cur.sources, cur.sold.sold),
    flags: cur.flags,
    texts: { emptyMonth: textOf(emptyMonth()) }
  };
}
