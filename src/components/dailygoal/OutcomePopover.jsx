import { useState } from 'react';
import { ArrowLeftRight, Ban, CalendarClock, Check, ChevronDown, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.jsx';
import { outcomeMenuItems, outcomeTriggerLabel } from '../../lib/outcomeMenu.js';

// Botão "Marcar desfecho" da Meta Diária, com o balão de Compareceu e Não
// compareceu. Depois de marcado, o botão mostra o desfecho e o mesmo balão
// corrige. Só apresenta: quem grava é a tela, pelo onPick(id), com os ids de
// outcomeMenuItems ('attended', 'no_show', 'rescheduled', 'cancelled', 'undo').
// Substituiu o switch de presença, cujo gesto de segurar para desmarcar
// ninguém descobria. O mesmo componente serve a Agenda de hoje, o card
// "A fazer", o Próximo compromisso e o "Feitos hoje".
//
// `compact` é para a Agenda de hoje, onde a coluna é estreita e o botão
// largo cortava o nome da pessoa: sem desfecho o botão diz só "Marcar", e com
// desfecho mostra só o ícone verde ou vermelho. O texto inteiro continua no
// aria-label e na dica do mouse.

const TRIGGER_TONE = {
  attended: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500/15',
  no_show: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30 dark:hover:bg-rose-500/15',
  none: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.04] dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/[0.08]',
};

const ITEM_TONE = {
  success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15',
  danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15',
  neutral: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]',
};

const ITEM_ICON = { attended: Check, no_show: X, rescheduled: CalendarClock, cancelled: Ban, undo: Undo2 };

export function OutcomePopover({
  outcome = null,
  title = null,
  withMore = false,
  canUndo = false,
  saving = false,
  size = 'md',
  compact = false,
  className,
  onPick,
}) {
  const [open, setOpen] = useState(false);
  const marked = outcome === 'attended' || outcome === 'no_show' ? outcome : null;
  const items = outcomeMenuItems({ outcome: marked, withMore, canUndo });
  const label = outcomeTriggerLabel(marked);
  const shownLabel = compact ? (marked ? null : 'Marcar') : label;

  const pick = (id) => {
    setOpen(false);
    if (onPick) onPick(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={saving}
        // Com o título, o leitor de tela diferencia um botão do outro na lista.
        aria-label={marked ? `${label}. Abrir para corrigir` : (title ? `Marcar desfecho: ${title}` : 'Marcar desfecho')}
        title={compact ? (marked ? label : 'Marcar desfecho') : undefined}
        className={cn(
          'inline-flex items-center rounded-lg border font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-60 disabled:cursor-default',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
          compact
            ? 'h-7 px-1.5 gap-1 text-[11.5px]'
            : size === 'sm' ? 'h-7 px-2 gap-1.5 text-[11.5px]' : 'h-8 px-3 gap-1.5 text-[12px]',
          TRIGGER_TONE[marked || 'none'],
          className
        )}
      >
        {marked === 'attended' && <Check size={13} />}
        {marked === 'no_show' && <X size={13} />}
        {shownLabel && <span>{shownLabel}</span>}
        <ChevronDown size={13} className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} aria-label={title || 'Desfecho'} className="w-56 p-2 rounded-xl border-border">
        {title && (
          <div className="px-1.5 pb-1.5 text-[11.5px] text-muted-foreground truncate">{title}</div>
        )}
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            // Com desfecho marcado, a opção colorida é a troca.
            const Icon = marked && (item.id === 'attended' || item.id === 'no_show') ? ArrowLeftRight : ITEM_ICON[item.id];
            return (
              <button
                key={item.id}
                type="button"
                data-outcome-item={item.id}
                onClick={() => pick(item.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-semibold text-left transition',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
                  ITEM_TONE[item.tone]
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
