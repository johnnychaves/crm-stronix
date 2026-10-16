// Barra dos Relatórios (spec 2026-10-09, "A barra de cima", e o handoff em
// docs/superpowers/specs/handoff-relatorios/, §3): o período numa caixa de
// 38px, com as setas do mês só no modo mês, e os filtros em pílulas
// (consultor, origem e funil). Em Leads parados, que é retrato de agora, o
// período sai e entra no lugar dele o corte "sem registro há mais de", em
// botões de escolha única (showPeriod falso). Tudo vem do endereço e volta
// para ele pela tela (on*). Abaixo de md os controles entram num balão, como na
// barra do Operacional, e só o período fica à vista: por isso o botão do balão
// acende e ganha um ponto quando há consultor, origem ou funil escolhido.
//
// O balão do período reaproveita a lista do seletor de período (PeriodMenu),
// com as regras do intervalo livre, e no modo mês acrescenta a lista dos 12
// meses. Consultor é múltipla escolha (balão com caixas de marcar); Origem e
// Funil são escolha única (menu com opções de rádio).
import { useId, useState } from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Layers, SlidersHorizontal, Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.jsx';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu.jsx';
import { Checkbox } from '../../components/ui/checkbox.jsx';
import { PeriodMenu } from '../../components/period/PeriodControl.jsx';
import { FOCUS_RING } from '../../components/focusRing.js';
import { DIAS_PARADOS } from '../../lib/screenParams.js';

const ON = 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-300';
const TODAS = '__todas__';
// Os balões e menus da barra: borda própria (o app não tem cor de borda base) e a sombra larga do handoff.
const SURFACE = 'rounded-[14px] border-border shadow-card-lg';
const ROW = 'flex h-[34px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[12.5px]';

// Pílula de filtro: ícone, o nome do filtro, o valor escolhido e a setinha,
// acesa quando o filtro está ligado. Recebe do Radix (asChild) o ref, os
// eventos e os atributos do balão ou do menu (aria-haspopup, aria-expanded,
// data-state), que vão para o botão. O nome e a descrição vêm depois do
// `...rest`, para nada que o Radix passe poder apagá-los. O nome é o do filtro
// e o valor ("Bruno Lima") chega como descrição, ligada ao texto visível.
// Exportado para o teste conferir essa ordem.
export function FilterButton({ label, icon: Icon, active, text, compact, ...rest }) {
  const valueId = useId();
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      aria-describedby={valueId}
      className={cn(
        'flex h-9 items-center gap-[7px] rounded-full border px-3 text-[12.5px] whitespace-nowrap',
        'transition-[border-color,background-color] duration-150 hover:border-brand-200 motion-reduce:transition-none dark:hover:border-brand-500/50',
        FOCUS_RING,
        active ? ON : 'border-border bg-card text-foreground',
        compact && 'w-full'
      )}
    >
      <Icon size={14} className={cn('shrink-0', active ? 'text-brand-600 dark:text-brand-300' : 'text-muted-foreground')} aria-hidden="true" />
      <span aria-hidden="true" className="font-medium text-muted-foreground">{label}</span>
      <span id={valueId} className={cn('truncate font-semibold', compact ? 'flex-1 text-left' : 'max-w-[160px]')}>{text}</span>
      <ChevronDown size={12} strokeWidth={2.2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

// O círculo (rádio) ou o quadrado (caixa) de cada opção dos menus, como no handoff.
function Mark({ on, square = false }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-4 shrink-0 place-items-center border-[1.5px] transition-colors duration-150 motion-reduce:transition-none',
        square ? 'rounded-[5px]' : 'rounded-full',
        on ? 'border-brand-600 bg-brand-600' : 'border-border'
      )}
    >
      {on && <Check size={10} strokeWidth={3.6} className="text-white" />}
    </span>
  );
}

// Conteúdo do balão de consultores. Exportado para o teste renderizar sem
// abrir o Popover.
export function ConsultoresMenu({ resp, people, onResp }) {
  const toggle = (id) => onResp(resp.includes(id) ? resp.filter((x) => x !== id) : [...resp, id]);
  const toda = resp.length === 0;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-pressed={toda}
        onClick={() => onResp([])}
        className={cn(ROW, FOCUS_RING, 'text-foreground hover:bg-muted', toda ? 'font-semibold' : 'font-medium')}
      >
        <Mark on={toda} />
        Equipe toda
      </button>
      <div className="mx-1.5 my-1 h-px bg-border" aria-hidden="true" />
      {people.map((p) => (
        <label
          key={p.id}
          className={cn(ROW, 'cursor-pointer hover:bg-muted', resp.includes(p.id) ? 'font-semibold' : 'font-medium')}
        >
          <Checkbox checked={resp.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.name} className="rounded-[5px]" />
          <span className="truncate">{p.name}</span>
        </label>
      ))}
    </div>
  );
}

export function ConsultoresControl({ resp, people, onResp, compact = false }) {
  const one = resp.length === 1 ? people.find((p) => p.id === resp[0]) : null;
  const text = resp.length === 0 ? 'Equipe toda' : one ? one.name : `${resp.length} pessoas`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton label="Consultor" icon={Users} active={resp.length > 0} text={text} compact={compact} />
      </PopoverTrigger>
      {/* A lista cabe na tela e rola por dentro: a altura livre é a que o Radix mede
          do lado em que o balão abre. Com muitos consultores, sem isso o topo (Equipe toda)
          ou os últimos nomes ficavam fora da tela. */}
      <PopoverContent align="start" aria-label="Escolher consultores" className={cn('w-[264px] max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-y-contain p-1.5', SURFACE)}>
        <ConsultoresMenu resp={resp} people={people} onResp={onResp} />
      </PopoverContent>
    </Popover>
  );
}

// Menu de escolha única (Origem e Funil): a primeira opção limpa o filtro, e
// uma régua a separa das outras.
function RadioMenu({ label, icon, active, text, value, onValue, first, options, compact }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterButton label={label} icon={icon} active={active} text={text} compact={compact} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={label} className={cn('min-w-[236px] p-1.5', SURFACE)}>
        <DropdownMenuRadioGroup value={value} onValueChange={onValue}>
          {[first, ...options].map((o, i) => (
            <div key={o.value}>
              {i === 1 && <DropdownMenuSeparator className="mx-1.5 my-1" />}
              <DropdownMenuPrimitive.RadioItem
                value={o.value}
                className={cn(ROW, 'group cursor-default select-none font-medium text-foreground outline-none data-[highlighted]:bg-muted data-[state=checked]:font-semibold')}
              >
                <span
                  aria-hidden="true"
                  className="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-border transition-colors duration-150 group-data-[state=checked]:border-brand-600 group-data-[state=checked]:bg-brand-600 motion-reduce:transition-none"
                >
                  <Check size={10} strokeWidth={3.6} className="hidden text-white group-data-[state=checked]:block" />
                </span>
                <span className="truncate">{o.label}</span>
              </DropdownMenuPrimitive.RadioItem>
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrigemControl({ origem, origens, onOrigem, compact = false }) {
  return (
    <RadioMenu
      label="Origem"
      icon={Filter}
      active={Boolean(origem)}
      text={origem || 'Todas'}
      value={origem || TODAS}
      onValue={(v) => onOrigem(v === TODAS ? null : v)}
      first={{ value: TODAS, label: 'Todas as origens' }}
      options={origens.map((o) => ({ value: o, label: o }))}
      compact={compact}
    />
  );
}

export function FunilControl({ funnel, funnels, onFunnel, compact = false }) {
  const chosen = funnel !== 'all' ? funnels.find((f) => f.id === funnel) : null;
  return (
    <RadioMenu
      label="Funil"
      icon={Layers}
      active={Boolean(chosen)}
      text={chosen ? chosen.name : 'Todos'}
      value={funnel}
      onValue={onFunnel}
      first={{ value: 'all', label: 'Todos os funis' }}
      options={funnels.map((f) => ({ value: f.id, label: f.name }))}
      compact={compact}
    />
  );
}

const ARROW = cn(
  'grid size-[30px] shrink-0 place-items-center rounded-[9px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none',
  FOCUS_RING
);

// O período na caixa de 38px: no modo mês, as setas dos dois lados do botão, e
// no balão a lista dos 12 meses embaixo dos atalhos. Toda escolha fecha o
// balão; escolher de novo o que já vale só fecha (no mês, o onPeriod('mes')
// devolveria quem olha agosto ao mês atual).
export function PeriodBox({
  period, todayKey, onPeriod, onRange, monthKey, monthOptions, onMonth, canPrev, canNext, onPrev, onNext, compact = false,
}) {
  const [open, setOpen] = useState(false);
  const valueId = useId();
  const isMonth = period.kind === 'mes';
  const pick = (kind) => { setOpen(false); if (kind !== period.kind) onPeriod(kind); };
  const apply = (de, ate) => { setOpen(false); onRange(de, ate); };
  const chooseMonth = (k) => { setOpen(false); if (k !== monthKey) onMonth(k); };
  return (
    <div className={cn('flex h-[38px] items-center gap-0.5 rounded-xl border border-border bg-card p-[3px] shadow-card', compact && 'w-full')}>
      {isMonth && (
        <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="Mês anterior" className={ARROW}>
          <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* 12,5px e folgas de 6 e 8px: com o "de" no mês ("Outubro de 2026 · em
              andamento"), a 13px a barra passava da largura a 1280px e o funil caía de linha. */}
          <button
            type="button"
            aria-label="Período"
            aria-describedby={valueId}
            className={cn(
              'num flex h-[30px] min-w-0 items-center gap-1.5 rounded-[9px] px-2 text-[12.5px] font-semibold whitespace-nowrap text-foreground transition-colors duration-150 hover:bg-muted motion-reduce:transition-none',
              FOCUS_RING,
              compact && 'flex-1'
            )}
          >
            <CalendarDays size={14} className="shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
            <span id={valueId} className={cn('truncate', compact && 'flex-1 text-left')}>{period.label}</span>
            <ChevronDown size={13} strokeWidth={2.2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label="Escolher período"
          className={cn('w-[318px] max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-y-contain p-2', SURFACE)}
        >
          <PeriodMenu period={period} todayKey={todayKey} onPick={pick} onApply={apply} />
          {isMonth && (
            <div className="mt-2 border-t border-border pt-2">
              <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">Mês</div>
              {(monthOptions || []).map((o) => {
                const on = o.key === monthKey;
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => chooseMonth(o.key)}
                    className={cn(ROW, 'gap-[9px] font-semibold', FOCUS_RING, on ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-foreground hover:bg-muted')}
                  >
                    <span className="grid w-3.5 shrink-0 place-items-center" aria-hidden="true">{on && <Check size={13} strokeWidth={2.8} />}</span>
                    <span className="num truncate">{o.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {isMonth && (
        <button type="button" onClick={onNext} disabled={!canNext} aria-label="Próximo mês" className={ARROW}>
          <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// O corte de Leads parados: "Sem registro há mais de 3 · 7 · 15 · 30 dias", um
// grupo de escolha única. As setas andam e escolhem, Home e End vão às pontas,
// e só a opção escolhida fica na ordem do Tab. Cada opção se chama "N dias".
// Os dias saem da mesma lista do endereço (DIAS_PARADOS). Exportado para o teste.
const diasText = (d) => `${d} dias`;
const STEP = Object.freeze({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 });
export function DiasControl({ dias, onDias, compact = false }) {
  const labelId = useId();
  const last = DIAS_PARADOS.length - 1;
  const onKey = (e, i) => {
    const j = e.key in STEP ? (i + STEP[e.key] + DIAS_PARADOS.length) % DIAS_PARADOS.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (j === null) return;
    e.preventDefault();
    e.currentTarget.parentElement.children[j].focus();
    if (DIAS_PARADOS[j] !== dias) onDias(DIAS_PARADOS[j]);
  };
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-border bg-card shadow-card',
        compact ? 'w-full flex-col items-stretch gap-1.5 p-2' : 'h-[38px] py-[3px] pl-2.5 pr-[3px]'
      )}
    >
      <span id={labelId} className="whitespace-nowrap text-[12px] font-semibold text-muted-foreground">Sem registro há mais de</span>
      <div className="flex items-center gap-1.5">
        <div role="radiogroup" aria-labelledby={labelId} className={cn('flex gap-0.5 rounded-[9px] bg-muted p-0.5', compact && 'flex-1')}>
          {DIAS_PARADOS.map((d, i) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === dias}
              aria-label={diasText(d)}
              tabIndex={d === dias ? 0 : -1}
              onClick={() => { if (d !== dias) onDias(d); }}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'num h-[26px] min-w-[30px] rounded-[7px] px-2 text-[12px] font-semibold transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
                FOCUS_RING,
                compact && 'flex-1',
                d === dias ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <span aria-hidden="true" className="pr-1.5 text-[12px] font-semibold text-muted-foreground">dias</span>
      </div>
    </div>
  );
}

export function RelatoriosToolbar(props) {
  const { period, showPeriod = true } = props;
  // No celular só o período fica à vista: com consultor, origem ou funil
  // escolhido, o botão do balão acende e ganha um ponto, e o nome diz que há
  // filtro ativo (o CrmToolbar faz o mesmo).
  const filtered = props.resp.length > 0 || Boolean(props.origem) || props.funnel !== 'all';
  const controls = (compact) => (
    <>
      {showPeriod ? (
        <PeriodBox
          period={period}
          todayKey={props.todayKey}
          onPeriod={props.onPeriod}
          onRange={props.onRange}
          monthKey={props.monthKey}
          monthOptions={props.monthOptions}
          onMonth={props.onMonth}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          compact={compact}
        />
      ) : (
        <DiasControl dias={props.dias} onDias={props.onDias} compact={compact} />
      )}
      {!compact && <span aria-hidden="true" className="h-[22px] w-px shrink-0 bg-border" />}
      <ConsultoresControl resp={props.resp} people={props.people} onResp={props.onResp} compact={compact} />
      <OrigemControl origem={props.origem} origens={props.origens} onOrigem={props.onOrigem} compact={compact} />
      <FunilControl funnel={props.funnel} funnels={props.funnels} onFunnel={props.onFunnel} compact={compact} />
    </>
  );
  // A área que rola no App tem recuo (p-4 md:p-8), e o top negativo do mesmo
  // tamanho faz a barra encostar no cabeçalho ao rolar, como a do Operacional:
  // é o "top-0" do handoff dentro da área com recuo. O fundo tem de ser o da raiz
  // do App (bg-paper-50 dark:bg-neutral-950, em App.jsx), que é o que fica atrás
  // da barra: o bg-background do escuro é azul-marinho e aparece como uma faixa.
  // Mudou o fundo da raiz, mude aqui. No computador a barra passa 8px para cada
  // lado do conteúdo (md:-mx-2 e md:px-2, que deixam os controles onde estavam):
  // sem isso, o anel do número aceso e a sombra dos cartões que rolam por baixo
  // apareciam como um fio cortado nas bordas da barra. No celular, -mx-4 e px-4.
  // No computador os controles ficam a 8px um do outro (gap-2) e quebram linha
  // quando não cabem (flex-wrap).
  return (
    <div className="sticky -top-4 z-30 -mx-4 mb-[22px] flex items-center gap-2.5 border-b border-border bg-page px-4 pb-3.5 pt-2.5 md:-top-8 md:-mx-2 md:px-2">
      <div className="hidden flex-wrap items-center gap-2 md:flex">{controls(false)}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={filtered ? 'Filtros dos relatórios, há filtro ativo' : 'Filtros dos relatórios'}
            className={cn(
              'relative grid size-9 place-items-center rounded-xl border md:hidden',
              FOCUS_RING,
              filtered ? ON : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
            {filtered && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-600" />}
          </button>
        </PopoverTrigger>
        {/* Coluna flex com altura máxima encolhe os filhos antes de rolar (os
            botões de 36px ficavam com 25px num celular deitado): o shrink-0 faz o
            balão rolar por dentro, com cada controle no tamanho de sempre. */}
        <PopoverContent align="start" aria-label="Filtros" className={cn('flex w-[288px] max-h-(--radix-popover-content-available-height) flex-col gap-2.5 overflow-y-auto overscroll-y-contain [&>*]:shrink-0', SURFACE)}>{controls(true)}</PopoverContent>
      </Popover>
      <span className="num min-w-0 truncate text-[12.5px] font-semibold text-muted-foreground md:hidden">
        {showPeriod ? period.label : `Sem registro há mais de ${diasText(props.dias)}`}
      </span>
    </div>
  );
}
