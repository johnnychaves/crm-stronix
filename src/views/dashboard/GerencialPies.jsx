// Os gráficos de pizza da tela Gerencial (handoff v2, §2 L2 e L4): a rosca das
// vendas por tipo, a pizza cheia dos planos e a meia-rosca da origem.
//
// O desenho é SVG puro (círculos com stroke-dasharray), no molde do Donut do
// app: o projeto não tem Recharts, e três gráficos de um card cada não pagam
// uma dependência. Cada fatia é uma ChartMark, então tem dica no hover e no
// foco do teclado (§5). Entre as fatias há um vão de 2px, que é o "separador
// na cor do card" do handoff.
//
// Toda porcentagem sai do valor das próprias fatias: nada de número pronto.
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { HELP } from '../../lib/gerencial/texts.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';
import { ItemDelta } from './ItemDelta.jsx';
import { BREAKDOWN_PALETTE, fmtMoney, fmtMoneyShort } from './dashTokens.js';

const CARD = 'rounded-2xl border border-border bg-card px-[22px] py-5 shadow-card';
const TITLE = 'm-0 font-display text-[15px] font-bold tracking-[-0.01em]';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GAP = 2;

// Os quatro tipos de venda do handoff §6. Rótulo e cor são apresentação: o mix
// chega só com o tipo, a contagem e o valor.
const TYPES = {
  nova: { label: 'Matrícula nova', stroke: 'stroke-brand-600 dark:stroke-brand-500', swatch: 'bg-brand-600 dark:bg-brand-500' },
  renovacao: { label: 'Renovação', stroke: 'stroke-success dark:stroke-[#0E9F6E]', swatch: 'bg-success dark:bg-[#0E9F6E]' },
  upgrade: { label: 'Upgrade', stroke: 'stroke-violet-500', swatch: 'bg-violet-500' },
  retorno: { label: 'Retorno de ex-cliente', stroke: 'stroke-slate-400 dark:stroke-slate-500', swatch: 'bg-slate-400 dark:bg-slate-500' }
};

// Mesma ordem de BREAKDOWN_PALETTE (dashTokens.js), em stroke para o SVG.
const BREAKDOWN_STROKES = [
  'stroke-accent-500',
  'stroke-brand-600 dark:stroke-brand-500',
  'stroke-ink-900 dark:stroke-slate-400',
  'stroke-slate-400 dark:stroke-slate-600',
  'stroke-success'
];

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const pctOf = (v, total) => (total > 0 ? Math.round(((Number(v) || 0) / total) * 100) : 0);

// Anel, pizza (thickness = metade do tamanho) ou meia-rosca. `slices` é
// [{ key, value, tip, stroke }]; `children` é o que fica no centro.
function Ring({ slices, size, thickness, half = false, label, children }) {
  const total = slices.reduce((s, x) => s + (Number(x.value) || 0), 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const sweep = half ? 0.5 : 1;
  const many = slices.filter((s) => Number(s.value) > 0).length > 1;
  const rotate = `rotate(${half ? -180 : -90} ${c} ${c})`;
  let acc = 0;
  const arcs = total > 0
    ? slices.filter((s) => Number(s.value) > 0).map((s) => {
        const frac = Number(s.value) / total;
        const len = frac * circ * sweep;
        const arc = {
          ...s,
          dash: `${Math.max(len - (many ? GAP : 0), 0.5).toFixed(2)} ${circ.toFixed(2)}`,
          offset: (-acc * circ * sweep).toFixed(2)
        };
        acc += frac;
        return arc;
      })
    : [];
  const h = half ? size / 2 : size;
  return (
    <div className="relative flex-none" style={{ width: size, height: h }} role="img" aria-label={label}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="overflow-visible">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={half ? `${(circ / 2).toFixed(2)} ${circ.toFixed(2)}` : undefined}
          transform={rotate}
          className="stroke-muted"
        />
        {arcs.map((a) => (
          <ChartMark
            key={a.key}
            as="circle"
            tip={a.tip}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={thickness}
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            transform={rotate}
            className={a.stroke}
          />
        ))}
      </svg>
      {children}
    </div>
  );
}

// Linha da legenda: amostra, rótulo, participação, variação contra o mês
// comparado (quando há) e valor, com régua em cima. `showDelta` reserva a
// coluna da variação para todas as linhas da legenda, as que não têm também.
function LegendRow({ swatch, round, label, pct, value, tight, delta, showDelta }) {
  return (
    <div className={cn('flex items-center gap-2.5 border-t', RULE, tight ? 'py-[7px]' : 'py-2')}>
      <span className={cn('block size-[9px] flex-none', round ? 'rounded-full' : 'rounded-[3px]', swatch)} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
      <span className="num w-9 flex-none text-right text-[12px] text-muted-foreground">{`${pct}%`}</span>
      {showDelta && <span className="hidden w-[54px] flex-none text-right sm:block"><ItemDelta delta={delta} /></span>}
      <span className="num w-20 flex-none text-right font-display text-[13.5px] font-bold">{value}</span>
    </div>
  );
}

// Props:
//   mix       [{ type, count, value }] — nova, renovacao, upgrade e retorno
//   discount  { pct, abs }
//   clawback  { count, value } — vendas do mês que já foram canceladas
export function SalesTypeCard({ mix, discount, clawback }) {
  const list = (mix || []).map((m) => ({ ...m, ...(TYPES[m.type] || TYPES.retorno), label: TYPES[m.type]?.label || m.type }));
  const sold = list.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const count = list.reduce((s, m) => s + (Number(m.count) || 0), 0);
  const pct = Number(discount?.pct) || 0;
  const slices = list.map((m) => ({
    key: m.type,
    value: m.value,
    stroke: m.stroke,
    tip: `${m.label}: ${plural(m.count, 'contrato', 'contratos')} · ${fmtMoney(m.value)} · ${pctOf(m.value, sold)}% do vendido`
  }));

  return (
    <section className={CARD}>
      <div className="flex items-baseline gap-2.5">
        <h3 className={TITLE}>Vendas por tipo</h3>
        <DashHelpTip text={HELP.mix} label='O que é "Vendas por tipo"?' />
        <div className="flex-1" />
        <span
          className="num text-[12px] text-muted-foreground"
          title={discount?.prevPct != null ? `Mês comparado: ${fmtNum(discount.prevPct)}%` : undefined}
        >
          {'desconto '}
          <b className={cn('font-bold text-foreground', pct >= 12 && 'text-amber-700 dark:text-amber-300')}>{`${fmtNum(pct)}%`}</b>
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
        <Ring
          slices={slices}
          size={148}
          thickness={22}
          label={`Vendas por tipo: ${list.map((m) => `${m.label} ${pctOf(m.value, sold)}%`).join(', ')}`}
        >
          <div className="pointer-events-none absolute inset-[22px] flex flex-col items-center justify-center">
            <span className="num font-display text-[22px] font-bold leading-none tracking-[-0.02em]">{fmtNum(count)}</span>
            <span className="mt-1 text-[11px] text-muted-foreground">contratos</span>
          </div>
        </Ring>
        <div className="flex w-full min-w-0 flex-1 flex-col">
          {list.map((m) => (
            <LegendRow
              key={m.type}
              swatch={m.swatch}
              label={m.label}
              pct={pctOf(m.value, sold)}
              value={fmtMoneyShort(m.value)}
              delta={m.delta}
              showDelta={list.some((x) => x.delta)}
            />
          ))}
        </div>
      </div>

      {clawback?.count > 0 && (
        <div className={cn('num mt-1.5 flex items-center gap-2 border-t pt-3 text-[12px] text-rose-700 dark:text-rose-300', RULE)}>
          <RotateCcw size={14} strokeWidth={2.1} className="flex-none" />
          {`${plural(clawback.count, 'venda já cancelada', 'vendas já canceladas')} · ${fmtMoney(clawback.value)}`}
        </div>
      )}
    </section>
  );
}

// Planos (pizza cheia) ou origem das vendas (meia-rosca). Grandeza é valor
// vendido; `times` é o número de vendas e entra só na dica.
//
// Props:
//   title, variant ('pie' | 'half'), total
//   items  [{ name, count (valor), times }] — já ordenados, o líder primeiro
export function PieCard({ title, variant = 'pie', items, total }) {
  const list = (items || []).map((it, i) => ({
    ...it,
    stroke: BREAKDOWN_STROKES[i % BREAKDOWN_STROKES.length],
    swatch: BREAKDOWN_PALETTE[i % BREAKDOWN_PALETTE.length]
  }));
  const slices = list.map((it) => ({
    key: it.name,
    value: it.count,
    stroke: it.stroke,
    tip: `${it.name}: ${fmtMoney(it.count)} em ${plural(it.times, 'venda', 'vendas')} · ${pctOf(it.count, total)}% do vendido`
  }));
  const leader = list[0];
  const half = variant === 'half';

  return (
    <section className={CARD}>
      <div className="flex items-center gap-2">
        <h3 className={TITLE}>{title}</h3>
        <DashHelpTip text={half ? HELP.sources : HELP.plans} label={`O que é "${title}"?`} />
      </div>
      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
        <Ring
          slices={slices}
          size={half ? 180 : 140}
          thickness={half ? 30 : 70}
          half={half}
          label={`${title}: ${list.map((it) => `${it.name} ${pctOf(it.count, total)}%`).join(', ')}`}
        >
          {half && leader && (
            <div className="pointer-events-none absolute inset-x-[30px] bottom-0 text-center">
              <div className="num font-display text-[18px] font-bold leading-none">{`${pctOf(leader.count, total)}%`}</div>
              <div className="mt-[3px] truncate text-[10.5px] text-muted-foreground">{leader.name}</div>
            </div>
          )}
        </Ring>
        <div className="flex w-full min-w-0 flex-1 flex-col">
          {list.length === 0 && <span className="text-[13px] text-muted-foreground">Nenhuma venda no mês.</span>}
          {list.map((it) => (
            <LegendRow
              key={it.name}
              round
              tight
              swatch={it.swatch}
              label={it.name}
              pct={pctOf(it.count, total)}
              value={fmtMoneyShort(it.count)}
              delta={it.delta}
              showDelta={list.some((x) => x.delta)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
