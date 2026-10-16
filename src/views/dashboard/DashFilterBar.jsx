// Peças do cabeçalho e da barra de filtros do Gerencial: o cartão fixo com o
// título, a caixa de período com setas, as pílulas de filtro e a lista de
// opções que abre em balão. O README pede que Relatórios use a mesma barra; como a de Relatórios
// ainda vive na própria branch, estas peças ficam aqui para ela adotar depois.
//
// Todo balão fecha ao escolher e ao clicar fora, que é o que o Popover do
// shadcn já faz. A lista de opções é a mesma no balão e no painel do celular.
import { useState } from 'react';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';

// Sem bg-card de propósito: no escuro o card é translúcido, e o balão precisa do fundo opaco do Popover.
const BALLOON = 'w-auto rounded-[14px] border-border p-1.5 shadow-card-lg';
const ARROW = 'grid size-[30px] flex-none place-items-center rounded-[9px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-35';

// Cabeçalho fixo da tela: o título e a linha de apoio à esquerda, os controles
// à direita, tudo num cartão com a mesma borda, raio e sombra das faixas da
// página. Fica alinhado às margens do conteúdo, e o fundo da página por trás
// (bg-page, o mesmo da raiz do App) cobre o que rola por baixo dele. O
// bg-background não serve: no escuro ele é o ink-950 e apareceria como faixa.
export function FilterBar({ title, subline, className, children }) {
  return (
    <div className={cn('sticky -top-4 z-30 bg-page px-4 pb-3 pt-4 md:-top-8 md:px-8 md:pt-5', className)}>
      <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card px-5 py-3.5 shadow-card md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
        <div className="min-w-0">
          <h2 className="m-0 font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h2>
          {subline && <p className="mt-[3px] text-[12.5px] text-muted-foreground">{subline}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

// Lista de opções do balão. `radio` desenha a bolinha dos chips; sem ele, o
// check do período. Uma opção com `ruleBefore` ganha a régua em cima, e `note`
// é o texto pequeno à direita ("em andamento").
export function OptionList({ options, value, onPick, radio = false, label }) {
  return (
    <div role={radio ? 'menu' : undefined} aria-label={label}>
      {(options || []).map((o) => {
        const on = o.key === value;
        return (
          <div key={o.key}>
            {o.ruleBefore && <div className="mx-1.5 my-1 h-px bg-slate-100 dark:bg-white/[0.06]" />}
            <button
              type="button"
              role={radio ? 'menuitemradio' : undefined}
              aria-checked={radio ? on : undefined}
              onClick={() => onPick(o.key)}
              className={cn(
                'flex h-[34px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[12.5px] font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-500/40',
                !radio && on && 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              )}
            >
              {radio ? (
                <span
                  className={cn(
                    'grid size-4 flex-none place-items-center rounded-full border-[1.5px]',
                    on ? 'border-brand-600 bg-brand-600' : 'border-slate-300 dark:border-slate-600'
                  )}
                >
                  {on && <Check size={10} strokeWidth={3.6} className="text-white" />}
                </span>
              ) : (
                <span className="grid w-3.5 flex-none place-items-center">{on && <Check size={13} strokeWidth={2.8} />}</span>
              )}
              <span className={cn('min-w-0 flex-1 whitespace-nowrap', radio && !on && 'font-medium')}>{o.label}</span>
              {o.note && <span className="text-[11px] font-medium text-muted-foreground">{o.note}</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Período: setas e o mês no meio, que abre a lista de meses. `options` é
// [{ key, label, note }]; as setas se desligam nos extremos.
export function PeriodControl({ label, options, value, onPick, canPrev, onPrev, canNext, onNext }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-[38px] items-center gap-0.5 rounded-xl border border-border bg-card p-[3px] shadow-card">
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="Mês anterior" className={ARROW}>
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Mês de competência"
            className="flex h-[30px] items-center gap-2 whitespace-nowrap rounded-[9px] px-2.5 text-[13px] font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <Calendar size={14} strokeWidth={2} className="flex-none text-brand-600" />
            <span className="num">{label}</span>
            <ChevronDown size={13} strokeWidth={2.2} className="flex-none text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className={cn(BALLOON, 'w-60 p-2')}>
          <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Mês</div>
          <OptionList options={options} value={value} onPick={(k) => { setOpen(false); onPick(k); }} />
        </PopoverContent>
      </Popover>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label="Próximo mês" className={ARROW}>
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

// Pílula de filtro. `active` é o filtro fora do padrão: borda e fundo azuis.
export function FilterChip({ icon: Icon, label, valueText, active, options, value, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 items-center gap-[7px] whitespace-nowrap rounded-full border px-3 text-[12.5px] outline-none transition-colors hover:border-brand-200 focus-visible:ring-2 focus-visible:ring-brand-500/40',
            active ? 'border-brand-200 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/15' : 'border-border bg-card'
          )}
        >
          <Icon size={14} strokeWidth={2} className={cn('flex-none', active ? 'text-brand-600' : 'text-muted-foreground')} />
          <span className="font-medium text-muted-foreground">{label}</span>
          <span className={cn('font-semibold', active && 'text-brand-700 dark:text-brand-300')}>{valueText}</span>
          <ChevronDown size={12} strokeWidth={2.2} className="flex-none text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className={cn(BALLOON, 'min-w-[236px]')}>
        <OptionList radio options={options} value={value} label={label} onPick={(k) => { setOpen(false); onPick(k); }} />
      </PopoverContent>
    </Popover>
  );
}
