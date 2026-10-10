// Barra dos Relatórios (spec 2026-10-09, "A barra de cima"): o período e, no
// modo mês, as setas e a lista dos 12 meses; os consultores, a origem e o
// funil. Tudo vem do endereço e volta para ele pela tela (on*). Abaixo de md
// os controles entram num balão, como na barra do Operacional, e só o período
// fica à vista: por isso o botão do balão acende e ganha um ponto quando há
// consultor, origem ou funil escolhido, como o botão de filtros do CRM.
// Desenhada com a skill frontend-design, no molde dos controles do Operacional
// e do CRM.
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
import { FOCUS_RING } from '../../components/focusRing.js';
import { MonthControl } from '../dashboard/OperacionalToolbar.jsx';

const IDLE = 'border-border bg-card text-foreground';
const ON = 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';
const TODAS = '__todas__';

// Botão de filtro: ícone, texto e a setinha, aceso quando o filtro está
// ligado. Recebe do Radix (asChild) o ref, os eventos e os atributos de
// popover ou de combobox (aria-haspopup, aria-expanded, role, data-state), que
// vão para o botão. O nome e a descrição vêm depois do `...rest`, para nada
// que o Radix passe poder apagá-los. O aria-label troca o texto do botão, então
// num botão comum (Consultores) o leitor de tela ouviria só "Consultores": com
// `describeValue`, o valor escolhido ("Bruno Lima") chega como descrição, ligada
// ao texto visível, como no PeriodControl. O combobox do Select (Origem e Funil)
// já expõe o próprio texto como valor, e a descrição o faria ser lido duas
// vezes, então eles não ligam. Exportado para o teste conferir essa ordem.
export function FilterButton({ label, icon: Icon, active, text, compact, describeValue = false, ...rest }) {
  const valueId = useId();
  const described = describeValue ? { 'aria-describedby': valueId } : null;
  return (
    <button
      type="button"
      {...rest}
      {...described}
      aria-label={label}
      className={cn('flex h-9 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold', FOCUS_RING, active ? ON : IDLE, compact && 'w-full')}
    >
      <Icon size={14} className={cn('shrink-0', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')} aria-hidden="true" />
      <span id={describeValue ? valueId : undefined} className={cn('truncate', compact ? 'flex-1 text-left' : 'max-w-[160px]')}>{text}</span>
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
          FOCUS_RING,
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
        <FilterButton label="Consultores" icon={Users} active={resp.length > 0} text={text} compact={compact} describeValue />
      </PopoverTrigger>
      {/* A lista cabe na tela e rola por dentro: a altura livre é a que o Radix mede
          do lado em que o balão abre. Com muitos consultores, sem isso o topo (Equipe toda)
          ou os últimos nomes ficavam fora da tela. */}
      <PopoverContent align="start" aria-label="Escolher consultores" className="w-[264px] max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-y-contain border-border p-2">
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
  // No celular só o período fica à vista: com consultor, origem ou funil
  // escolhido, o botão do balão acende e ganha um ponto, e o nome diz que há
  // filtro ativo (o CrmToolbar faz o mesmo).
  const filtered = props.resp.length > 0 || Boolean(props.origem) || props.funnel !== 'all';
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
  // O fundo tem de ser o da raiz do App (bg-paper-50 dark:bg-neutral-950, em
  // App.jsx), que é o que fica atrás da barra: o bg-background do escuro é
  // azul-marinho e aparece como uma faixa. Mudou o fundo da raiz, mude aqui.
  // No computador a barra passa 8px para cada lado do conteúdo (md:-mx-2 e
  // md:px-2, que deixam os controles onde estavam): sem isso, o anel do número
  // aceso e a sombra dos cartões que rolam por baixo apareciam como um fio
  // cortado nas bordas da barra. No celular, nada muda (-mx-4 e px-4).
  // No computador os controles ficam a 8px um do outro (gap-2). Com 10px, a barra
  // padrão do mês em andamento media 881px e a 1280px só tinha 880px: o funil caía
  // sozinho para uma segunda linha, e o conteúdo pulava 46px ao trocar para um mês
  // fechado, de rótulo mais curto. Com 8px ela mede 873px. Com um consultor
  // escolhido, ou com a barra de rolagem fixa do Windows, ela ainda pode quebrar a
  // 1280px, e quebra como antes (flex-wrap).
  return (
    <div className="sticky -top-4 z-30 -mx-4 mb-6 flex items-center gap-2.5 border-b border-border bg-paper-50 px-4 py-2.5 dark:bg-neutral-950 md:-top-8 md:-mx-2 md:px-2">
      <div className="hidden flex-wrap items-center gap-2 md:flex">{controls(false)}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={filtered ? 'Filtros dos relatórios, há filtro ativo' : 'Filtros dos relatórios'}
            className={cn(
              'relative grid size-9 place-items-center rounded-xl border md:hidden',
              FOCUS_RING,
              filtered ? ON : 'border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
            {filtered && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-600" />}
          </button>
        </PopoverTrigger>
        {/* Coluna flex com altura máxima encolhe os filhos antes de rolar (os
            botões de 36px ficavam com 25px num celular deitado): o shrink-0 faz o
            balão rolar por dentro, com cada controle no tamanho de sempre. */}
        <PopoverContent align="start" aria-label="Filtros" className="flex w-[288px] max-h-(--radix-popover-content-available-height) flex-col gap-2.5 overflow-y-auto overscroll-y-contain border-border [&>*]:shrink-0">{controls(true)}</PopoverContent>
      </Popover>
      <span className="num min-w-0 truncate text-[12.5px] font-semibold text-muted-foreground md:hidden">{period.label}</span>
    </div>
  );
}
