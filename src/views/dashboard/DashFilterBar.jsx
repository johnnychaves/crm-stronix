// Peças do cabeçalho e da barra de filtros do Gerencial: o cartão fixo com o
// título, a caixa de período com setas, as pílulas de filtro e a lista de
// opções que abre em balão. O README pede que Relatórios use a mesma barra; como a de Relatórios
// ainda vive na própria branch, estas peças ficam aqui para ela adotar depois.
//
// Todo balão fecha ao escolher e ao clicar fora, que é o que o Popover do
// shadcn já faz. A lista de opções é a mesma no balão e no painel do celular.
import { useState } from 'react';
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, LineChart, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';

// Sem bg-card de propósito: no escuro o card é translúcido, e o balão precisa do fundo opaco do Popover.
const BALLOON = 'w-auto rounded-[14px] border-border p-1.5 shadow-card-lg';
const ARROW = 'grid size-[30px] flex-none place-items-center rounded-[9px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-35';

// Cabeçalho fixo da tela: o título e a linha de apoio à esquerda, os controles
// à direita, tudo num cartão com a mesma borda, raio e sombra das faixas da
// página. Fica alinhado às margens do conteúdo, e o fundo da página por trás
// cobre o que rola por baixo dele.
export function FilterBar({ title, subline, className, children }) {
  // O texto e os controles dividem a linha só quando cabem os dois. Sem
  // espaço, os controles descem para uma linha própria, abaixo do título,
  // em vez de encolher: um chip espremido corta o rótulo e quebra o texto.
  return (
    <div className={cn('sticky -top-4 z-30 bg-background px-4 pb-3 pt-4 md:-top-8 md:px-8 md:pt-5', className)}>
      <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-card px-5 py-3.5 shadow-card md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:gap-y-3 md:px-6">
        <div className="min-w-0 md:flex-1 md:basis-[360px]">
          <h2 className="m-0 font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h2>
          {subline && <p className="mt-[3px] text-[12.5px] text-muted-foreground">{subline}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:flex-none">{children}</div>
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

export const NO_COMPARE_LABEL = 'Sem comparação';
const NONE = '__sem-comparacao';

// As opções do chip de comparação: os meses comparáveis e, no fim, "Sem
// comparação". Sem mês nenhum, a lista só oferece essa última.
function compareChoices(options) {
  const months = (options || []).map((o) => ({ key: o.key, label: o.label }));
  return [...months, { key: NONE, label: NO_COMPARE_LABEL, ruleBefore: months.length > 0 }];
}

// A barra única dos três dashboards (Gerencial, CRM e Operacional): período com
// setas, chip "Comparar com" e, depois, os filtros de cada tela (pessoa, funil).
// Cada tela só diz quais filtros tem; o desenho, o balão e o painel do celular
// são os mesmos, então os três filtros nunca mais ficam diferentes entre si.
//
// month    { key, options: [{ key, label, note }], onChange, canPrev, canNext, onPrev, onNext }
// compare  { on, key, options: [{ key, label }], onChange(chave | null) }
// filters  [{ id, icon, label, value, defaultValue, options: [{ key, label }], onChange(chave) }]
//
// Abaixo de 768px a barra vira um botão só, que abre um painel com o mês, a
// comparação e cada filtro. O botão ganha um ponto quando há filtro fora do
// padrão.
export function DashToolbar({ title, subline, month, compare, filters = [] }) {
  const [panel, setPanel] = useState(false);
  const current = (month.options || []).find((o) => o.key === month.key);
  const choices = compareChoices(compare.options);
  const comparing = Boolean(compare.on && compare.key && choices.some((c) => c.key === compare.key));
  const picked = comparing ? compare.key : NONE;
  const pickedLabel = choices.find((c) => c.key === picked)?.label || NO_COMPARE_LABEL;
  const pickCompare = (k) => compare.onChange(k === NONE ? null : k);
  const chip = (f) => ({
    ...f,
    valueText: (f.options || []).find((o) => o.key === f.value)?.label || '',
    active: f.value !== f.defaultValue
  });
  const chips = filters.map(chip);
  const filtered = chips.some((f) => f.active);
  const sectionTitle = 'px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground';

  return (
    <FilterBar title={title} subline={subline}>
      <div className="hidden items-center gap-2 md:flex md:flex-wrap [&>*]:shrink-0">
        <PeriodControl
          label={current?.label || month.key}
          options={month.options}
          value={month.key}
          onPick={month.onChange}
          canPrev={month.canPrev}
          onPrev={month.onPrev}
          canNext={month.canNext}
          onNext={month.onNext}
        />
        <span className="mx-1 h-[22px] w-px flex-none bg-border" />
        <FilterChip icon={LineChart} label="Comparar com" valueText={pickedLabel} active={comparing} options={choices} value={picked} onPick={pickCompare} />
        {chips.map((f) => (
          <FilterChip key={f.id} icon={f.icon} label={f.label} valueText={f.valueText} active={f.active} options={f.options} value={f.value} onPick={f.onChange} />
        ))}
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        <Popover open={panel} onOpenChange={setPanel}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={filtered ? 'Filtros, há filtro ativo' : 'Filtros'}
              className={cn(
                'relative flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-3 text-[13px] font-semibold shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                comparing || filtered ? 'border-brand-200 dark:border-brand-500/40' : 'border-border'
              )}
            >
              <SlidersHorizontal size={15} strokeWidth={2} className="flex-none text-brand-600" />
              <span className="num min-w-0 flex-1 truncate text-left">{current?.label || month.key}</span>
              {comparing && <span className="flex-none text-[11.5px] font-medium text-muted-foreground">{`vs. ${pickedLabel}`}</span>}
              {filtered && <span className="size-1.5 flex-none rounded-full bg-brand-600" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="max-h-[70vh] w-[min(320px,calc(100vw-32px))] overflow-y-auto overscroll-y-contain rounded-[14px] border-border p-2 shadow-card-lg">
            <div className={sectionTitle}>Mês</div>
            <OptionList options={month.options} value={month.key} onPick={(k) => { setPanel(false); month.onChange(k); }} />
            <div className="mx-1.5 my-2 h-px bg-border" />
            <div className={sectionTitle}>Comparar com</div>
            <OptionList radio options={choices} value={picked} onPick={(k) => { setPanel(false); pickCompare(k); }} />
            {chips.map((f) => (
              <div key={f.id}>
                <div className="mx-1.5 my-2 h-px bg-border" />
                <div className={sectionTitle}>{f.label}</div>
                <OptionList radio options={f.options} value={f.value} onPick={(k) => { setPanel(false); f.onChange(k); }} />
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </FilterBar>
  );
}
