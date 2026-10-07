import { cn } from '@/lib/utils';
import { DAY_LONG, DAY_SHORT, WEEK_ORDER } from '../../lib/rotinas.js';

// Peças dos painéis das rotinas: a escolha segmentada e os dias da semana.
// A escolha segmentada é um grupo de botões de alternar (aria-pressed), e não
// um radiogroup: radiogroup promete navegação por setas, e aqui cada opção é
// um botão comum, alcançado pelo Tab.
export function Segmented({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 self-start rounded-[10px] bg-muted p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
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

// O texto do erro fica em rose-600 (rose-300 no escuro), e não no token
// `text-destructive`: o token é o rose-500 nos dois temas, que no fundo branco
// fica abaixo do contraste mínimo para texto deste tamanho.
export function FieldError({ id, children }) {
  return children ? <p id={id} className="text-[11.5px] text-rose-600 dark:text-rose-300">{children}</p> : null;
}
