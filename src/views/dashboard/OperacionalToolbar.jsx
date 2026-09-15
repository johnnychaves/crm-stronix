// Barra fixa de controles do Operacional: mês de competência, comparativo e
// filtro de pessoa. Porta o handoff (linhas 86 a 129) — usado pela tela
// DashboardOperacionalView (Task 12).
//
// O trigger dos três <Select> usa o primitivo Radix direto
// (SelectPrimitive.Trigger asChild) em vez do SelectTrigger do shadcn: aquele
// injeta um ChevronDownIcon como segundo filho ao lado de {children}, e o
// Slot por trás de asChild exige exatamente UM filho — com dois ele lança
// "React.Slot must have exactly one child" em runtime
// (node_modules/@radix-ui/react-slot: sem Slottable e com
// Children.count(children) !== 1, cai no throw). Select (Root)/SelectContent/
// SelectItem/SelectValue continuam sendo os componentes compartilhados; só o
// Trigger é construído com a peça crua para caber no visual sem borda nem
// chevron do handoff.
//
// Abaixo de 768px os três controles colapsam num botão que abre um Popover
// com os mesmos três controles empilhados (README §5).
import { Select as SelectPrimitive } from 'radix-ui';
import { ChevronLeft, ChevronRight, User, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectValue } from '../../components/ui/select.jsx';
import { Checkbox } from '../../components/ui/checkbox.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';

// Rótulo do mês escolhido sem o " · em andamento", para o botão estreito.
const shortMonthLabel = (options, key) =>
  String((options || []).find((o) => o.key === key)?.label || '').replace(/ · em andamento$/, '');

// `compact`: ocupa a largura toda da linha do celular, com o rótulo curto e
// truncado no botão. Sem ele, o controle de sempre.
export function MonthControl({ monthKey, monthOptions, onMonth, canPrev, canNext, onPrev, onNext, compact = false }) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-xl border border-border bg-card p-[3px]', compact && 'h-10 w-full justify-between')}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Mês anterior"
        className="grid size-[30px] place-items-center rounded-[9px] text-muted-foreground hover:bg-muted/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <Select value={monthKey} onValueChange={onMonth}>
        <SelectPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Mês de competência"
            className={cn(
              'num flex h-[30px]',
              compact ? 'min-w-0 flex-1' : 'min-w-[150px]',
              'items-center justify-center rounded-[9px] px-1.5 text-[13px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40'
            )}
          >
            {compact ? <span className="truncate">{shortMonthLabel(monthOptions, monthKey)}</span> : <SelectValue />}
          </button>
        </SelectPrimitive.Trigger>
        <SelectContent position="popper">
          {(monthOptions || []).map((o) => (
            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Próximo mês"
        className="grid size-[30px] place-items-center rounded-[9px] text-muted-foreground hover:bg-muted/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

export function CompareControl({ compareOn, onCompareOn, compareKey, compareOptions, onCompare }) {
  return (
    <div
      className={cn(
        'flex h-9 items-center overflow-hidden rounded-xl border',
        compareOn ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/15' : 'border-border bg-card'
      )}
    >
      <label className="flex h-full cursor-pointer items-center gap-2 px-3 hover:bg-muted/70">
        <Checkbox
          checked={compareOn}
          onCheckedChange={(v) => onCompareOn(Boolean(v))}
          aria-label="Comparar"
          className="rounded-[5px]"
        />
        <span className={cn('whitespace-nowrap text-[12.5px] font-semibold', compareOn ? 'text-brand-700 dark:text-brand-300' : 'text-foreground/80')}>
          Comparar
        </span>
      </label>
      {compareOn && (
        <>
          <span className="h-5 w-px flex-none bg-border" />
          <Select value={compareKey} onValueChange={onCompare}>
            <SelectPrimitive.Trigger asChild>
              <button
                type="button"
                aria-label="Mês de comparação"
                className="flex h-[34px] items-center px-[11px] text-[12.5px] font-semibold text-brand-700 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300"
              >
                <SelectValue />
              </button>
            </SelectPrimitive.Trigger>
            <SelectContent position="popper">
              {(compareOptions || []).map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}

export function PersonControl({ person, people, onPerson }) {
  const active = person !== 'all';
  return (
    <Select value={person} onValueChange={onPerson}>
      <SelectPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Pessoa"
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-foreground'
          )}
        >
          <User size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} />
          <SelectValue />
        </button>
      </SelectPrimitive.Trigger>
      <SelectContent position="popper">
        <SelectItem value="all">Equipe toda</SelectItem>
        {(people || []).map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OperacionalToolbar(props) {
  const { note } = props;
  // A área que rola no App tem recuo interno (p-4 md:p-8, App.jsx:1666), e o
  // sticky respeita esse recuo: com top-0 a barra grudava 16/32px abaixo do
  // topo e o conteúdo aparecia por cima dela. O top negativo do mesmo tamanho
  // faz a barra encostar no cabeçalho do App.
  return (
    <div className="sticky -top-4 md:-top-8 z-30 flex items-center gap-2.5 border-t border-b border-t-slate-100 border-b-border bg-card px-4 md:px-8 py-2.5 dark:border-t-white/[0.06]">
      <div className="hidden items-center gap-2.5 md:flex">
        <MonthControl {...props} />
        <CompareControl {...props} />
        <PersonControl {...props} />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Filtros do Operacional"
            className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground md:hidden"
          >
            <SlidersHorizontal size={16} strokeWidth={2} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto flex-col gap-2.5">
          <MonthControl {...props} />
          <CompareControl {...props} />
          <PersonControl {...props} />
        </PopoverContent>
      </Popover>

      <div className="flex-1" />
      <span className="num max-w-[420px] truncate text-[11.5px] text-muted-foreground">{note}</span>
    </div>
  );
}
