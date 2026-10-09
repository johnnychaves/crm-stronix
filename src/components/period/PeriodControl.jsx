// Seletor de período (spec do período personalizado, 25/09/2026, "A barra"),
// usado primeiro pelos Relatórios: um botão com o texto do período, que abre um
// balão com os atalhos (Hoje, Ontem, Esta semana, Semana passada, Mês) e o
// Personalizado. O Personalizado abre, no mesmo balão, os campos "de" e "até" e
// o botão Aplicar. As datas passam pela mesma regra do endereço
// (intervalRefusal, em src/lib/period.js), e o motivo da recusa aparece
// embaixo dos campos. No modo mês o botão diz "Mês", e as setas e a lista dos
// 12 meses ficam ao lado dele, na barra da tela (MonthControl).
//
// O rascunho das datas mora no PeriodMenu, que só existe com o balão aberto:
// cada abertura começa do período do endereço, sem efeito nenhum. O filtro de
// verdade é o do endereço, e quem escreve nele é a tela (onPeriod, onRange).
import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.jsx';
import { intervalRefusal, oldestDayKey } from '../../lib/period.js';

const OPTIONS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'semana-passada', label: 'Semana passada' },
  { id: 'mes', label: 'Mês' },
  { id: 'intervalo', label: 'Personalizado' }
];

const FIELD = 'h-[34px] rounded-[9px] border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-brand-500';

// Conteúdo do balão: a lista e, no Personalizado, os campos. Exportado para o
// teste renderizar sem abrir o Popover.
export function PeriodMenu({ period, todayKey, onPick, onApply }) {
  const [custom, setCustom] = useState(period.kind === 'intervalo');
  const [draftDe, setDraftDe] = useState(period.de || '');
  const [draftAte, setDraftAte] = useState(period.ate || '');
  const [error, setError] = useState('');

  const apply = () => {
    const motivo = intervalRefusal(draftDe, draftAte, todayKey);
    if (motivo) { setError(motivo); return; }
    onApply(draftDe, draftAte);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {OPTIONS.map((o) => {
        const active = o.id === 'intervalo' ? custom : !custom && period.kind === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => (o.id === 'intervalo' ? setCustom(true) : onPick(o.id))}
            className={cn(
              'flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-[12.5px] font-semibold',
              active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-foreground hover:bg-muted/70'
            )}
          >
            <span className="flex-1">{o.label}</span>
            {active && <Check size={14} strokeWidth={2.2} />}
          </button>
        );
      })}
      {custom && (
        <div className="mt-1.5 flex flex-col gap-2 border-t border-border pt-2.5">
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted-foreground">De</span>
              <input
                type="date"
                value={draftDe}
                min={oldestDayKey(todayKey)}
                max={draftAte || todayKey}
                onChange={(e) => { setDraftDe(e.target.value); setError(''); }}
                className={FIELD}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-muted-foreground">Até</span>
              <input
                type="date"
                value={draftAte}
                min={draftDe || oldestDayKey(todayKey)}
                max={todayKey}
                onChange={(e) => { setDraftAte(e.target.value); setError(''); }}
                className={FIELD}
              />
            </label>
          </div>
          {error && <p role="alert" className="m-0 text-[11px] font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
          <button
            type="button"
            onClick={apply}
            className="h-[34px] self-end rounded-full bg-brand-600 px-[18px] text-[12px] font-bold text-white hover:bg-brand-700"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

// `compact`: ocupa a largura toda da linha do celular.
export function PeriodControl({ period, todayKey, onPeriod, onRange, compact = false }) {
  const [open, setOpen] = useState(false);
  const active = period.kind !== 'mes';
  const pick = (kind) => { setOpen(false); onPeriod(kind); };
  const apply = (de, ate) => { setOpen(false); onRange(de, ate); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Período"
          className={cn(
            'num flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            compact && 'w-full',
            active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-foreground'
          )}
        >
          <CalendarDays size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} />
          <span className={cn('truncate', compact && 'flex-1 text-left')}>{active ? period.label : 'Mês'}</span>
          <ChevronDown size={13} strokeWidth={2.2} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[288px] p-2">
        <PeriodMenu period={period} todayKey={todayKey} onPick={pick} onApply={apply} />
      </PopoverContent>
    </Popover>
  );
}
