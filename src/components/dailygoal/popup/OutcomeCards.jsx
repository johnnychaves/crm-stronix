import { useId } from 'react';
import { cn } from '../../../lib/utils.js';
import { RadioGroup, RadioGroupOption } from '../../ui/radio-group.jsx';
import { PopupLabel } from './PopupShell.jsx';

// Os desfechos como cartões, cada um com uma linha que diz o que acontece. É o
// RadioGroup do shadcn: as setas trocam o desfecho, e o pop-up abre com o foco
// no escolhido. `tone`: ok (verde), no (vermelho) e later (âmbar).
const TONE = {
  ok: { card: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15', icon: 'bg-emerald-500 text-white' },
  no: { card: 'border-rose-500 bg-rose-50 dark:bg-rose-500/15', icon: 'bg-rose-500 text-white' },
  later: { card: 'border-amber-500 bg-amber-50 dark:bg-amber-500/15', icon: 'bg-amber-500 text-white' },
};

export function OutcomeCards({ question, options, value, onChange }) {
  const labelId = useId();
  return (
    <div>
      <PopupLabel id={labelId}>{question}</PopupLabel>
      <RadioGroup value={value} onValueChange={onChange} aria-labelledby={labelId} className={cn('grid gap-2', options.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map(({ id, label, desc, Icon, tone }) => {
          const on = id === value;
          return (
            <RadioGroupOption
              key={id}
              value={id}
              data-autofocus={on ? '' : undefined}
              className={cn(
                'flex flex-col items-start gap-[7px] rounded-[14px] border-[1.5px] p-3 text-left transition',
                on ? TONE[tone].card : 'border-border bg-card hover:border-brand-200 dark:hover:border-brand-500/45'
              )}
            >
              <span className={cn('grid size-7 place-items-center rounded-[9px] transition', on ? TONE[tone].icon : 'bg-muted text-muted-foreground')}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="text-[13.5px] font-semibold leading-tight text-foreground">{label}</span>
              <span className="text-[12px] leading-snug text-muted-foreground">{desc}</span>
            </RadioGroupOption>
          );
        })}
      </RadioGroup>
    </div>
  );
}
