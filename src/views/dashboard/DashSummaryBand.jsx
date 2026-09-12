// Faixa de resumo do Operacional: 5 números num card só, divididos por régua
// vertical (README §2 "a divergência deliberada" — não são 5 DashKpiCard
// soltos). Handoff linhas 155 a 188. Abaixo de 768px vira grade de 2 colunas,
// cada célula como card próprio, sem tendência (handoff linhas 729 a 762).
import { cn } from '../../lib/utils.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { DASH_TONES } from './dashTokens.js';
import { Sparkline } from '../../components/charts/Sparkline.jsx';
import { ChartMark } from './ChartMark.jsx';

function SummaryCell({ item: k }) {
  const delta = k.delta;
  const showPill = Boolean(delta && !delta.none);
  const pillTone = !showPill ? null
    : delta.flat ? 'bg-muted text-muted-foreground'
    : delta.up === k.goodUp ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-muted-foreground">{k.label}</span>
          {k.help && <DashHelpTip text={k.help} label={`O que é "${k.label}"?`} />}
        </div>
        {showPill && (
          <span className={cn('num inline-flex h-5 flex-none items-center gap-[3px] whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold', pillTone)}>
            {delta.flat ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`}
          </span>
        )}
      </div>
      <div className="mt-2">
        <span className={cn('num text-[32px] font-semibold leading-none tracking-tight', k.muted && 'text-muted-foreground')}>{k.value}</span>
      </div>
      {k.sub && <div className="num mt-1 truncate text-[11.5px] text-muted-foreground">{k.sub}</div>}
    </>
  );
}

export function DashSummaryBand({ items }) {
  const list = items || [];
  return (
    <>
      <section className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:flex md:items-stretch">
        {list.map((k, i) => (
          <div key={k.key} className={cn('min-w-0 flex-1 px-[18px] py-4', i > 0 && 'border-l border-slate-100 dark:border-white/[0.06]')}>
            <SummaryCell item={k} />
            {k.series && k.series.length > 1 && (
              <>
                <ChartMark as="div" tip={k.seriesLabel} className={cn('mt-3 -mx-1 block [&_svg]:h-[42px] [&_svg]:w-full', DASH_TONES.brand.stroke)}>
                  <Sparkline data={k.series} width={120} height={42} strokeWidth={1.75} />
                </ChartMark>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-[9.5px] text-muted-foreground">{k.seriesFrom}</span>
                  <span className="text-[9.5px] text-muted-foreground">{k.seriesTo}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        {list.map((k) => (
          <div key={k.key} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <SummaryCell item={k} />
          </div>
        ))}
      </section>
    </>
  );
}
