import { Search } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// A barra do registro: filtros em pílula (o desenho dos painéis), o interruptor
// de Sistema e a busca. Cada pílula se lê "Marcos, 2" (aria-label), porque o
// rótulo e a contagem colados virariam "Marcos2" no leitor de tela; o
// profileOriginMarker.test.js lê esse nome. A contagem não leva opacidade: a
// 65% ela ficava abaixo de 4,5:1.
export function TimelineBar({ filters, counts, filter, onFilter, showSystem, systemHiddenCount, onToggleSystem, query, onQuery }) {
  return (
    <div role="group" aria-label="Filtros do histórico" className="flex flex-wrap items-center gap-2 border-b border-border px-8 py-3.5">
      {filters.map((f) => {
        const on = filter === f.id;
        const n = counts[f.id] || 0;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            aria-label={`${f.label}, ${n}`}
            onClick={() => onFilter(f.id)}
            className={cn(
              'inline-flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition',
              'focus-visible:outline-none focus-visible:anel-foco',
              on
                ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                : 'border-border bg-card text-slate-600 hover:border-brand-200 dark:text-slate-300'
            )}
          >
            {f.label}<span className={cn('num', !on && 'text-muted-foreground')}>{n}</span>
          </button>
        );
      })}

      <div className="flex-1" />

      {/* Interruptor de Sistema: quando desligado, anuncia o que esconde. */}
      {(systemHiddenCount > 0 || showSystem) && (
        <button
          type="button"
          aria-pressed={showSystem}
          onClick={onToggleSystem}
          className={cn(
            'inline-flex h-[34px] items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition',
            'focus-visible:outline-none focus-visible:anel-foco',
            showSystem
              ? 'border-brand-200 text-brand-700 dark:border-brand-500/40 dark:text-brand-300'
              : 'border-border text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          )}
        >
          {/* Chave de verdade (trilho e botão), não um ponto. */}
          <span className={cn('relative h-4 w-7 flex-none rounded-full transition-colors motion-reduce:transition-none', showSystem ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/[0.14]')}>
            <span className={cn('absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-[left] motion-reduce:transition-none', showSystem ? 'left-[14px]' : 'left-0.5')} />
          </span>
          {`Sistema${!showSystem && systemHiddenCount > 0 ? ` +${systemHiddenCount}` : ''}`}
        </button>
      )}

      <label className="relative min-w-[150px] shrink basis-[220px]">
        <span className="sr-only">Buscar no histórico</span>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar no histórico"
          autoComplete="off"
          className="h-[34px] w-full rounded-full border border-border bg-card pl-[34px] pr-3.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus-visible:anel-foco"
        />
      </label>
    </div>
  );
}
