// A ponte entre o metricsOf e as props dos componentes da tela Gerencial.
//
// Mora aqui, e não dentro da view, porque é onde mora o erro silencioso: um
// campo com nome trocado não quebra nada, só apaga uma linha da tela. Sendo
// função pura, o teste renderiza a tela inteira a partir de contratos de
// mentira e confere o número que aparece (gerencial.dashboard.test.js).
import { fmtMoney } from '../format.js';
import { monthLabel } from '../operacional/month.js';
import {
  clawbackNote, overlapNote, blindNote, expiredNote, exitsNote,
  plansNote, sourcesNote, emptyMonth, emptyRanking
} from './texts.js';

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

// A leitura do rodapé do ranking aponta em texto o que a coluna de ticket
// mensal mostra em número, para não depender da leitura da coluna.
export function sellersRead(rows) {
  if ((rows || []).length < 2) return '';
  const byMonthly = [...rows].sort((a, b) => b.monthly - a.monthly);
  const best = byMonthly[0];
  const worst = byMonthly[byMonthly.length - 1];
  if (!best?.monthly || best === worst) return '';
  const firstName = (n) => String(n || '').split(' ')[0];
  return `O total premia quem atende mais. No ticket mensal, ${firstName(best.name)} fecha a ${fmtMoney(best.monthly)} por mês de contrato e ${firstName(worst.name)} a ${fmtMoney(worst.monthly)}.`;
}

function walletProps(wallet) {
  return {
    items: [
      {
        key: 'count',
        label: 'Contratos vigentes',
        value: wallet.count,
        sub: wallet.blind
          ? `${wallet.blind} deles importados sem valor`
          : `inclui os ${wallet.lockedCount} trancados`,
        help: 'Contratos com vigência em curso hoje. A carteira soma contrato, não pessoa: quem tem dois contratos vigentes conta duas vezes.'
      },
      {
        key: 'monthly',
        label: 'Valor por mês',
        value: wallet.monthly,
        money: true,
        unit: '/mês',
        sub: 'soma dos tickets mensais vigentes',
        help: 'Soma do ticket mensal de cada contrato vigente. Não é caixa recebido nem previsão de recebimento: é o que os contratos valem por mês.'
      },
      {
        key: 'ticket',
        label: 'Ticket mensal médio',
        value: wallet.ticket,
        money: true,
        unit: '/mês',
        sub: 'valor por mês ÷ contratos com valor'
      },
      {
        key: 'locked',
        label: 'Trancados',
        value: wallet.lockedCount,
        tone: 'amber',
        sub: `${fmtMoney(wallet.lockedMonthly)}/mês · contam na carteira`,
        help: 'Contrato trancado segue vigente e continua na carteira, porque volta a valer quando o cliente destranca. A contagem fica à parte para não parecer receita ativa.'
      }
    ],
    notes: [overlapNote({ count: wallet.overlap }), blindNote({ count: wallet.blind })].filter(Boolean)
  };
}

// Planos e origem entram no BreakdownCard pelo VALOR vendido: a grandeza da
// barra é dinheiro e a contagem de vendas vira a coluna "11x".
const breakdown = (rows, total, { eyebrow, title, footText }) => ({
  title,
  eyebrow,
  footText,
  sub: 'por valor vendido no mês',
  items: (rows || []).map((r) => ({ name: r.name, count: r.value, times: r.count })),
  total
});

export function dashboardProps({ cur, cmp, comparing, roleOf = () => null }) {
  return {
    sold: {
      mix: cur.sold.mix,
      ticket: cur.sold.ticket,
      discount: { pct: cur.sold.discPct, abs: cur.sold.discAbs },
      clawback: clawbackNote({ count: cur.sold.clawCount, value: cur.sold.clawValue }),
      delta: soldDelta(cur, cmp, { comparing })
    },
    wallet: walletProps(cur.wallet),
    risk: {
      horizon: cur.risk.horizon,
      walletMonthly: cur.wallet.monthly,
      lapsedCount: cur.risk.expired.count,
      lapsedNote: expiredNote({ count: cur.risk.expired.count })
    },
    exits: { items: cur.exits.items, note: exitsNote() },
    sellers: {
      rows: cur.sellers.map((r) => ({ ...r, role: roleOf(r.id) })),
      read: sellersRead(cur.sellers)
    },
    plans: breakdown(cur.plans, cur.sold.sold, {
      eyebrow: 'Plano que mais trouxe', title: 'Planos mais vendidos', footText: plansNote()
    }),
    sources: breakdown(cur.sources, cur.sold.sold, {
      eyebrow: 'Canal que mais trouxe', title: 'Origem do lead que fechou', footText: sourcesNote()
    }),
    flags: cur.flags,
    texts: { emptyMonth: textOf(emptyMonth()), emptyRanking: textOf(emptyRanking()) }
  };
}
