// Cabeçalho fixo do CRM (mockup A): o título e a linha do regime à esquerda e,
// à direita, mês, comparativo, pessoa e funil, tudo no mesmo cartão das
// faixas da página (FilterBar). Os três primeiros controles são os do
// Operacional. Abaixo de 768px o mês fica à vista e comparar, pessoa e funil
// entram num painel atrás do botão de filtro, que ganha um ponto quando há
// pessoa ou funil escolhido.
//
// O trigger do Select usa o primitivo Radix direto, pelo mesmo motivo do
// Operacional: o SelectTrigger do shadcn tem dois filhos e quebra o asChild.
import { Select as SelectPrimitive } from 'radix-ui';
import { Filter, ListFilter } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectValue } from '../../components/ui/select.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import { MonthControl, CompareControl, PersonControl } from './OperacionalToolbar.jsx';
import { FilterBar } from './DashFilterBar.jsx';

function FunnelControl({ funnel, funnels, onFunnel }) {
  const active = funnel !== 'all';
  return (
    <Select value={funnel} onValueChange={onFunnel}>
      <SelectPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Funil"
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-foreground'
          )}
        >
          <Filter size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} />
          <SelectValue />
        </button>
      </SelectPrimitive.Trigger>
      <SelectContent position="popper">
        <SelectItem value="all">Todos os funis</SelectItem>
        {(funnels || []).map((f) => (
          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CrmToolbar(props) {
  const { title, subline, person, funnel } = props;
  const filtered = person !== 'all' || funnel !== 'all';
  return (
    <FilterBar title={title} subline={subline}>
      <div className="hidden items-center gap-2.5 md:flex">
        <MonthControl {...props} />
        <CompareControl {...props} />
        <PersonControl {...props} />
        <FunnelControl {...props} />
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        <div className="min-w-0 flex-1">
          <MonthControl {...props} compact />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={filtered ? 'Filtros do CRM, há filtro ativo' : 'Filtros do CRM'}
              className={cn(
                'relative grid h-10 w-11 flex-none place-items-center rounded-xl border',
                filtered ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground'
              )}
            >
              <ListFilter size={17} strokeWidth={2} />
              {filtered && <span className="absolute right-2 top-[7px] size-1.5 rounded-full bg-brand-600" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-auto flex-col gap-2.5">
            <CompareControl {...props} />
            <PersonControl {...props} />
            <FunnelControl {...props} />
          </PopoverContent>
        </Popover>
      </div>
    </FilterBar>
  );
}
