// Faixa de resumo: 5 números num card só, divididos por régua vertical (README
// §2 do Operacional, "a divergência deliberada": não são 5 DashKpiCard
// soltos). Abaixo de 768px vira grade de 2 colunas, cada célula como card
// próprio, sem tendência. Usada pelo Operacional e pelo CRM.
//
// Célula: key, label, help, value, sub, delta ({ up, flat, none, text }),
// goodUp, muted, series, seriesFrom, seriesTo, seriesLabel. Opcionais do CRM
// (handoff do CRM, linhas 180 a 217): tone (cor da tendência, chave de
// DASH_TONES; padrão brand), flag (etiqueta âmbar ao lado do valor),
// emptySeries (texto do cartão tracejado quando não há tendência) e showNone
// (mostra a pílula cinza "sem base"; sem ela, delta sem base some). Com flag,
// a linha do valor quebra para a etiqueta não vazar da célula; sem flag, é a
// linha de antes.
//
// Prop opcional da faixa, do CRM: stackPillsOnMobile. Nas células do celular,
// o rótulo ocupa a linha sozinho e a pílula desce para baixo do valor.
import { cn } from '../../lib/utils.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { DASH_TONES } from './dashTokens.js';
import { Sparkline } from '../../components/charts/Sparkline.jsx';
import { ChartMark } from './ChartMark.jsx';

function SummaryCell({ item: k, stacked = false }) {
  const delta = k.delta;
  const showPill = Boolean(delta && (!delta.none || k.showNone));
  const quiet = showPill && Boolean(delta.none || delta.flat);
  const pillTone = !showPill ? null
    : quiet ? 'bg-muted text-muted-foreground'
    : delta.up === k.goodUp ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  const pill = showPill && (
    <span className={cn('num inline-flex h-5 flex-none items-center gap-[3px] whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold', pillTone)}>
      {quiet ? delta.text : `${delta.up ? '▲' : '▼'} ${delta.text}`}
    </span>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-muted-foreground">{k.label}</span>
          {k.help && <DashHelpTip text={k.help} label={`O que é "${k.label}"?`} />}
        </div>
        {!stacked && pill}
      </div>
      <div className={cn('mt-2', k.flag && 'flex flex-wrap items-baseline gap-x-1.5 gap-y-1')}>
        <span className={cn('num text-[32px] font-semibold leading-none tracking-tight', k.muted && 'text-muted-foreground')}>{k.value}</span>
        {k.flag && (
          <span className="rounded-[5px] bg-amber-500/[0.12] px-[5px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {k.flag}
          </span>
        )}
      </div>
      {stacked && pill && <div className="mt-1.5 flex">{pill}</div>}
      {k.sub && <div className="num mt-1 truncate text-[11.5px] text-muted-foreground">{k.sub}</div>}
    </>
  );
}

export function DashSummaryBand({ items, stackPillsOnMobile = false }) {
  const list = items || [];
  return (
    <>
      <section className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:flex md:items-stretch">
        {list.map((k, i) => (
          <div key={k.key} className={cn('min-w-0 flex-1 px-[18px] py-4', i > 0 && 'border-l border-slate-100 dark:border-white/[0.06]')}>
            <SummaryCell item={k} />
            {k.series && k.series.length > 1 ? (
              <>
                <ChartMark as="div" tip={k.seriesLabel} className={cn('mt-3 -mx-1 block [&_svg]:h-[42px] [&_svg]:w-full', (DASH_TONES[k.tone] || DASH_TONES.brand).stroke)}>
                  <Sparkline data={k.series} width={120} height={42} strokeWidth={1.75} />
                </ChartMark>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-[9.5px] text-muted-foreground">{k.seriesFrom}</span>
                  <span className="text-[9.5px] text-muted-foreground">{k.seriesTo}</span>
                </div>
              </>
            ) : k.emptySeries ? (
              <div className="mt-3 grid h-[52px] place-items-center rounded-[9px] border border-dashed border-border px-2">
                <span className="text-center text-[10.5px] leading-[1.35] text-muted-foreground">{k.emptySeries}</span>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        {list.map((k) => (
          <div key={k.key} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <SummaryCell item={k} stacked={stackPillsOnMobile} />
          </div>
        ))}
      </section>
    </>
  );
}
