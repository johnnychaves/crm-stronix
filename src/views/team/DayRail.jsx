import { cn } from '../../lib/utils.js';

// O seletor de dia da TABELA. Vive DENTRO do cartão da tabela, não no rodapé
// das asas: as asas são do mês e não reagem a ele, e a régua colada nelas dava
// a entender que filtrava as duas coisas.
// Um botão por dia PROGRAMADO — folga não é célula vazia, é ausência, senão
// aparece um vão falso no meio de toda semana. O rótulo da esquerda é
// obrigatório: sem ele a régua não se explica.
function DayRail({ rail, teamSize, onPick }) {
  return (
    <div className="flex items-stretch gap-3 px-5 py-3 border-b border-border">
      <div className="shrink-0 self-center">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 whitespace-nowrap">Dia do mês</div>
        <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">quantos bateram, de {teamSize}</div>
      </div>
      <div className="flex-1 flex gap-1 overflow-x-auto thin-scroll snap-x">
        {rail.map((d) => {
          const fill = d.n <= 2 ? 'bg-danger' : d.n >= 4 ? 'bg-success' : 'bg-brand-200 dark:bg-brand-500/50';
          return (
            <button
              key={d.day}
              type="button"
              title={d.title}
              onClick={() => onPick(d.day)}
              className={cn(
                'flex-1 min-w-[26px] h-[38px] rounded-lg flex flex-col items-center justify-center gap-1 snap-start transition',
                d.selected
                  ? 'bg-brand-600'
                  : d.isToday
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.05]'
              )}
            >
              <span className={cn(
                'text-[11px] num leading-none',
                d.selected
                  ? 'text-white font-bold'
                  : d.isToday
                    ? 'text-brand-700 dark:text-brand-300 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
              )}>
                {d.day}
              </span>
              <span className={cn('w-[22px] h-[4px] rounded-full overflow-hidden', d.selected ? 'bg-white/35' : 'bg-slate-200 dark:bg-white/[0.10]')}>
                <span
                  className={cn('block h-full rounded-full', d.selected ? 'bg-white' : fill)}
                  style={{ width: `${teamSize > 0 ? Math.round((d.n / teamSize) * 100) : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DayRail };
