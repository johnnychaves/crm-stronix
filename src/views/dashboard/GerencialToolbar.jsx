// Barra fixa do Gerencial (handoff v2, §3): o período com setas e o chip
// "Comparar com". O aviso de que o número é contrato vendido e não caixa
// recebido saiu da barra e mora no "não é caixa" do card Vendido no mês.
//
// Não tem filtro de unidade: o protótipo usava o chip só para demonstrar três
// bases, e em produção cada academia entra pelo próprio login e o contrato não
// guarda unidade.
//
// Abaixo de 768px a barra vira um botão só, que abre um painel com o período e
// a comparação (§4).
import { useState } from 'react';
import { LineChart, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import { cn } from '../../lib/utils.js';
import { FilterBar, FilterChip, OptionList, PeriodControl } from './DashFilterBar.jsx';

const NONE = '__sem-comparacao';
export const NO_COMPARE_LABEL = 'Sem comparação';

// `compareOptions` é [{ key, label }] dos meses anteriores com venda. Sem
// nenhum, a lista só oferece "Sem comparação" (handoff §3).
function compareChoices(compareOptions) {
  const months = (compareOptions || []).map((o) => ({ key: o.key, label: o.label }));
  return [...months, { key: NONE, label: NO_COMPARE_LABEL, ruleBefore: months.length > 0 }];
}

export function GerencialToolbar({
  monthKey, monthOptions, onMonth, canPrev, onPrev, canNext, onNext,
  compareOn, compareKey, compareOptions, onCompare
}) {
  const [panel, setPanel] = useState(false);
  const month = (monthOptions || []).find((o) => o.key === monthKey);
  const choices = compareChoices(compareOptions);
  const comparing = Boolean(compareOn && compareKey && choices.some((c) => c.key === compareKey));
  const picked = comparing ? compareKey : NONE;
  const pickedLabel = choices.find((c) => c.key === picked)?.label || NO_COMPARE_LABEL;
  const pick = (k) => onCompare(k === NONE ? null : k);

  return (
    <FilterBar>
      <div className="hidden items-center gap-2 md:flex">
        <PeriodControl
          label={month?.label || monthKey}
          options={monthOptions}
          value={monthKey}
          onPick={onMonth}
          canPrev={canPrev}
          onPrev={onPrev}
          canNext={canNext}
          onNext={onNext}
        />
        <span className="mx-1 h-[22px] w-px flex-none bg-border" />
        <FilterChip
          icon={LineChart}
          label="Comparar com"
          valueText={pickedLabel}
          active={comparing}
          options={choices}
          value={picked}
          onPick={pick}
        />
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        <Popover open={panel} onOpenChange={setPanel}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Filtros"
              className={cn(
                'flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-3 text-[13px] font-semibold shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                comparing ? 'border-brand-200 dark:border-brand-500/40' : 'border-border'
              )}
            >
              <SlidersHorizontal size={15} strokeWidth={2} className="flex-none text-brand-600" />
              <span className="num min-w-0 flex-1 truncate text-left">{month?.label || monthKey}</span>
              {comparing && <span className="flex-none text-[11.5px] font-medium text-muted-foreground">{`vs. ${pickedLabel}`}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(320px,calc(100vw-32px))] rounded-[14px] border-border p-2 shadow-card-lg"
          >
            <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Mês</div>
            <OptionList options={monthOptions} value={monthKey} onPick={(k) => { setPanel(false); onMonth(k); }} />
            <div className="mx-1.5 my-2 h-px bg-border" />
            <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Comparar com</div>
            <OptionList radio options={choices} value={picked} onPick={(k) => { setPanel(false); pick(k); }} />
          </PopoverContent>
        </Popover>
      </div>
    </FilterBar>
  );
}
