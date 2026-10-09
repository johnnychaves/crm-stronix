// Barra dos Relatórios (spec 2026-10-09, "A barra de cima"): o período e, no
// modo mês, as setas e a lista dos 12 meses; os consultores, a origem e o
// funil. Tudo vem do endereço e volta para ele pela tela (on*). Abaixo de md
// os controles entram num balão, como na barra do Operacional. Desenhada com
// a skill frontend-design, no molde dos controles do Operacional e do CRM.
//
// O trigger dos Select usa o primitivo Radix direto (SelectPrimitive.Trigger
// asChild), pelo mesmo motivo explicado no topo do OperacionalToolbar.jsx: o
// SelectTrigger do shadcn põe um segundo filho e o Slot exige um só.
import { useId } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { ChevronDown, Filter, Layers, SlidersHorizontal, Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import { Select, SelectContent, SelectItem } from '../../components/ui/select.jsx';
import { Checkbox } from '../../components/ui/checkbox.jsx';
import { PeriodControl } from '../../components/period/PeriodControl.jsx';
import { MonthControl } from '../dashboard/OperacionalToolbar.jsx';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';
const IDLE = 'border-border bg-card text-foreground';
const ON = 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';
const TODAS = '__todas__';

// Botão de filtro: ícone, texto e a setinha, aceso quando o filtro está
// ligado. Recebe do Radix (asChild) o ref, os eventos e os atributos de
// popover ou de combobox (aria-haspopup, aria-expanded, role, data-state), que
// vão para o botão. O nome e a descrição vêm depois do `...rest`, para nada
// que o Radix passe poder apagá-los: o aria-label troca o texto do botão, então
// o leitor de tela ouve só "Consultores", e o valor escolhido ("Bruno Lima")
// chega como descrição, ligada ao texto visível. Mesma ligação do PeriodControl.
function FilterButton({ label, icon: Icon, active, text, compact, ...rest }) {
  const valueId = useId();
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      aria-describedby={valueId}
      className={cn('flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold', FOCUS, active ? ON : IDLE, compact && 'w-full')}
    >
      <Icon size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} aria-hidden="true" />
      <span id={valueId} className={cn('truncate', compact ? 'flex-1 text-left' : 'max-w-[160px]')}>{text}</span>
      <ChevronDown size={13} strokeWidth={2.2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

// Conteúdo do balão de consultores. Exportado para o teste renderizar sem
// abrir o Popover.
export function ConsultoresMenu({ resp, people, onResp }) {
  const toggle = (id) => onResp(resp.includes(id) ? resp.filter((x) => x !== id) : [...resp, id]);
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-pressed={resp.length === 0}
        onClick={() => onResp([])}
        className={cn(
          'flex h-8 items-center rounded-lg px-2.5 text-left text-[12.5px] font-semibold',
          FOCUS,
          resp.length === 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-foreground hover:bg-muted/70'
        )}
      >
        Equipe toda
      </button>
      <div className="my-1 h-px bg-border" aria-hidden="true" />
      {people.map((p) => (
        <label key={p.id} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] hover:bg-muted/70">
          <Checkbox checked={resp.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.name} />
          <span className="truncate">{p.name}</span>
        </label>
      ))}
    </div>
  );
}

export function ConsultoresControl({ resp, people, onResp, compact = false }) {
  const one = resp.length === 1 ? people.find((p) => p.id === resp[0]) : null;
  const text = resp.length === 0 ? 'Equipe toda' : one ? one.name : `${resp.length} consultores`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton label="Consultores" icon={Users} active={resp.length > 0} text={text} compact={compact} />
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Escolher consultores" className="w-[264px] border-border p-2">
        <ConsultoresMenu resp={resp} people={people} onResp={onResp} />
      </PopoverContent>
    </Popover>
  );
}

export function OrigemControl({ origem, origens, onOrigem, compact = false }) {
  return (
    <Select value={origem || TODAS} onValueChange={(v) => onOrigem(v === TODAS ? null : v)}>
      <SelectPrimitive.Trigger asChild>
        <FilterButton label="Origem" icon={Filter} active={Boolean(origem)} text={origem || 'Todas as origens'} compact={compact} />
      </SelectPrimitive.Trigger>
      <SelectContent position="popper" className="border-border">
        <SelectItem value={TODAS}>Todas as origens</SelectItem>
        {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function FunilControl({ funnel, funnels, onFunnel, compact = false }) {
  const chosen = funnel !== 'all' ? funnels.find((f) => f.id === funnel) : null;
  return (
    <Select value={funnel} onValueChange={onFunnel}>
      <SelectPrimitive.Trigger asChild>
        <FilterButton label="Funil" icon={Layers} active={Boolean(chosen)} text={chosen ? chosen.name : 'Todos os funis'} compact={compact} />
      </SelectPrimitive.Trigger>
      <SelectContent position="popper" className="border-border">
        <SelectItem value="all">Todos os funis</SelectItem>
        {funnels.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function RelatoriosToolbar(props) {
  const { period } = props;
  const controls = (compact) => (
    <>
      <PeriodControl period={period} todayKey={props.todayKey} onPeriod={props.onPeriod} onRange={props.onRange} compact={compact} />
      {period.kind === 'mes' && (
        <MonthControl
          monthKey={props.monthKey}
          monthOptions={props.monthOptions}
          onMonth={props.onMonth}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          compact={compact}
        />
      )}
      <ConsultoresControl resp={props.resp} people={props.people} onResp={props.onResp} compact={compact} />
      <OrigemControl origem={props.origem} origens={props.origens} onOrigem={props.onOrigem} compact={compact} />
      <FunilControl funnel={props.funnel} funnels={props.funnels} onFunnel={props.onFunnel} compact={compact} />
    </>
  );
  // A área que rola no App tem recuo (p-4 md:p-8), e o top negativo do mesmo
  // tamanho faz a barra encostar no cabeçalho ao rolar, como a do Operacional.
  return (
    <div className="sticky -top-4 z-30 -mx-4 mb-6 flex items-center gap-2.5 border-b border-border bg-background px-4 py-2.5 md:-top-8 md:mx-0 md:px-0">
      <div className="hidden flex-wrap items-center gap-2.5 md:flex">{controls(false)}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Filtros dos relatórios"
            className={cn('grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground md:hidden', FOCUS)}
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label="Filtros" className="flex w-[288px] flex-col gap-2.5 border-border">{controls(true)}</PopoverContent>
      </Popover>
      <span className="num min-w-0 truncate text-[12.5px] font-semibold text-muted-foreground md:hidden">{period.label}</span>
    </div>
  );
}
