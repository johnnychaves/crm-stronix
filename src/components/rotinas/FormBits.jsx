import { cn } from '@/lib/utils';
import { DAY_LONG, DAY_SHORT, WEEK_ORDER } from '../../lib/rotinas.js';

// Peças dos painéis das rotinas: a escolha segmentada e os dias da semana.
export function Segmented({ label, value, options, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-0.5 self-start rounded-[10px] bg-slate-100 p-[3px] dark:bg-white/[0.05]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-lg px-3 text-[12.5px] font-medium text-muted-foreground transition', value === o.value && 'bg-card text-foreground shadow-card')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DayChips({ days, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEK_ORDER.map((d) => {
        const on = days.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={DAY_LONG[d]}
            onClick={() => onToggle(d)}
            className={cn('h-[34px] w-11 rounded-[9px] border text-[12.5px] font-medium', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-border text-muted-foreground')}
          >
            {DAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

export function FieldError({ children }) {
  return children ? <p className="text-[11.5px] text-rose-600 dark:text-rose-300">{children}</p> : null;
}
