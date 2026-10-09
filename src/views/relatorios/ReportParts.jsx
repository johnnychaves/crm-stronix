// Peças da tela de Relatórios (spec 2026-10-09), desenhadas com a skill
// frontend-design no molde dos painéis (CrmCard, DeltaPill): o cabeçalho de
// cada submenu, o número grande, os números que filtram a lista, os recortes
// em barras, a lista de nomes, o exportar e o aviso do dado. A marca da tela é
// a lista que repete o número de que veio e o filtro aplicado: cada número e
// cada linha de recorte é um filtro dessa lista. A barra mostra sempre o mesmo
// número que está ao lado dela, e matrícula e conversão são verdes, como nos
// painéis.
import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { CrmCard, DashedNote, DeltaPill } from '../dashboard/CrmParts.jsx';

const TONE_TEXT = Object.freeze({
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
});
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const ROW_ON = 'bg-brand-50 hover:bg-brand-50 dark:bg-brand-500/15 dark:hover:bg-brand-500/15';

// Título do submenu, a pergunta que ele responde e, à direita, o exportar.
export function ReportHeader({ title, question, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 font-display text-[22px] font-bold tracking-[-0.015em]">{title}</h2>
        <p className="mt-1 text-pretty text-[13px] text-muted-foreground">{question}</p>
      </div>
      {action}
    </div>
  );
}

// O número que abre o submenu, com a variação contra o período anterior.
export function HeroNumber({ value, label, delta = null, compareText = null, percent = false, tone = null }) {
  const text = value == null ? 'sem base' : percent ? `${value}%` : fmtNum(value);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
      <span className={cn('num font-display text-[40px] font-bold leading-none tracking-[-0.03em]', TONE_TEXT[tone])}>{text}</span>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      {delta && <DeltaPill delta={delta} />}
      {compareText && <span className="text-[12px] text-muted-foreground">{compareText}</span>}
    </div>
  );
}

// Os números do topo. Cada um é também o filtro da lista: clicar mostra
// embaixo só os nomes dele, e clicar de novo volta para todos. O número sem
// filtro próprio (key null) é o total, aceso quando a lista não tem recorte.
// O número que é melhor quando cai (lowerBetter, como os que perderam) pinta
// a variação ao contrário: subir fica vermelho.
export function NumberTiles({ tiles, cut, onCut }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => {
        const active = t.key === null ? cut === null : cut === t.key;
        return (
          <button
            key={t.name}
            type="button"
            aria-pressed={active}
            onClick={() => onCut(t.key === null || active ? null : t.key)}
            className={cn(
              'flex min-h-[96px] flex-col items-start justify-between gap-2 rounded-2xl border bg-card px-4 py-3.5 text-left shadow-card transition-colors motion-reduce:transition-none',
              FOCUS,
              active ? 'border-brand-600 ring-1 ring-brand-600 dark:border-brand-400 dark:ring-brand-400' : 'border-border hover:border-brand-300 dark:hover:border-brand-500/40'
            )}
          >
            <span className="text-[11.5px] font-semibold text-muted-foreground">{t.name}</span>
            <span className={cn('num font-display text-[28px] font-bold leading-none tracking-[-0.02em]', TONE_TEXT[t.tone])}>{fmtNum(t.value)}</span>
            {t.delta && <DeltaPill delta={t.delta} lowerBetter={t.lowerBetter} />}
          </button>
        );
      })}
    </div>
  );
}

// Recorte em barras: cada linha filtra a lista. A barra é o próprio número ao
// lado dela.
export function CountBreakdown({ title, hint, rows, cut, onCut, emptyText = 'Nada no período.' }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <CrmCard title={title} hint={hint}>
      {rows.length === 0 ? (
        <p className="px-[18px] py-4 text-[12.5px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-2">
          {rows.map((r) => {
            const active = cut === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCut(active ? null : r.key)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted/70', FOCUS, active && ROW_ON)}
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                    {r.name}
                    {r.channel && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{r.channel}</span>}
                  </span>
                  <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.count / max) * 100}%` }} />
                  </span>
                  <span className="num w-9 shrink-0 text-right text-[13px] font-semibold">{fmtNum(r.count)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CrmCard>
  );
}

const CONV_GRID = 'grid grid-cols-[minmax(0,1fr)_40px_40px_104px] items-center gap-x-2';

// Recorte da conversão: leads, matrículas e a conversão, com a barra sendo a
// própria conversão, em verde. Cada linha filtra a lista.
export function ConversionBreakdown({ title, hint, rows, cut, onCut }) {
  return (
    <CrmCard title={title} hint={hint}>
      <div className={cn(CONV_GRID, 'px-[18px] pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground')}>
        <span aria-hidden="true" />
        <span className="text-right">Leads</span>
        <span className="text-right">Matr.</span>
        <span className="text-right">Conv.</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 px-2 pb-2">
        {rows.map((r) => {
          const active = cut === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onCut(active ? null : r.key)}
                className={cn(CONV_GRID, 'w-full rounded-lg px-2.5 py-2 text-left hover:bg-muted/70', FOCUS, active && ROW_ON)}
              >
                <span className="truncate text-[12.5px] font-medium">{r.name}</span>
                <span className="num text-right text-[12.5px]">{fmtNum(r.leads)}</span>
                <span className="num text-right text-[12.5px]">{fmtNum(r.enrolled)}</span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-2 w-12 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${r.conv ?? 0}%` }} />
                  </span>
                  <span className="num w-9 text-right text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {r.conv == null ? '' : `${r.conv}%`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </CrmCard>
  );
}

// A lista de nomes por trás dos números. O cabeçalho repete o número que ela
// mostra e o filtro aplicado, com o botão de limpar. Mostra 50 nomes por vez,
// e o exportar leva todos. Ao trocar de filtro, volta aos 50 primeiros: o
// "Mostrar mais" vale para a lista em que foi clicado.
export function ReportList({ total, noun, cutLabel = null, onClearCut, columns, rows, emptyTitle, emptyText, pageSize = 50 }) {
  const sig = `${cutLabel || ''}|${rows.length}|${rows[0]?.id || ''}`;
  const [more, setMore] = useState({ sig, extra: 0 });
  const extra = more.sig === sig ? more.extra : 0;
  const shown = rows.slice(0, pageSize + extra);
  const left = rows.length - shown.length;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-[18px] py-3.5', RULE)}>
        <p className="m-0 flex items-baseline gap-2" aria-live="polite">
          <span className="num font-display text-[24px] font-bold leading-none tracking-[-0.02em]">{fmtNum(total)}</span>
          <span className="text-[13px] font-semibold text-muted-foreground">{noun}</span>
        </p>
        {cutLabel && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 pl-3 pr-1 text-[12px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {cutLabel}
            <button
              type="button"
              onClick={onClearCut}
              aria-label="Limpar filtro da lista"
              className={cn('grid size-5 place-items-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-500/25', FOCUS)}
            >
              <X size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        )}
      </header>
      {rows.length === 0 ? (
        <DashedNote className="m-4" title={emptyTitle} text={emptyText} />
      ) : (
        <>
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn('whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground', c.className)}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={cn('border-t', RULE)}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn('px-4 py-2.5 text-[12.5px]', c.className)}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {left > 0 && (
            <div className={cn('border-t p-3 text-center', RULE)}>
              <button
                type="button"
                onClick={() => setMore({ sig, extra: extra + pageSize })}
                className={cn('h-9 rounded-full border border-border px-4 text-[12.5px] font-semibold hover:bg-muted/70', FOCUS)}
              >
                {`Mostrar mais ${Math.min(pageSize, left)}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ExportButton({ onExport, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className={cn('inline-flex h-9 items-center gap-2 rounded-full bg-brand-600 px-4 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40', FOCUS)}
    >
      <Download size={14} strokeWidth={2.2} aria-hidden="true" />
      Exportar lista
    </button>
  );
}

// Aviso do dado, como o agendamento incompleto antes de setembro de 2026.
export function ReportNotice({ children }) {
  return (
    <p className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-200">
      {children}
    </p>
  );
}
