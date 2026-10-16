import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Printer, Users, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';
import { RELATORIOS_ICONS } from './relatoriosIcons.js';

// Os desenhos da apresentação dos Relatórios, um por passo (mockup
// 2026-10-15-relatorios-apresentacao.html, opção B, escolhida pelo Johnny em
// 15/10/2026). São desenhos: os nomes e os números são inventados, e o pop-up
// os esconde do leitor de tela (aria-hidden no lugar deles). Os rótulos são os
// da tela de verdade (os submenus da lista ao lado, as etapas da Conversão,
// os filtros da barra e os botões Imprimir e Exportar lista).

const MINI = 'w-full rounded-[14px] border border-border bg-card text-left shadow-[0_12px_30px_-14px_rgba(14,26,64,.35)]';

// Passo 1: a lista ao lado, com o grupo Leads aberto e a Conversão acesa.
export function IntroRail() {
  const group = RELATORIOS_RAIL_GROUPS[0];
  return (
    <div className={cn(MINI, 'max-w-[280px] px-2.5 py-2')}>
      <div className="flex items-center gap-2.5 px-1.5 pb-1.5 pt-0.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Users className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-bold">{group.label}</span>
          <span className="block text-[10.5px] text-muted-foreground">{group.items.length} relatórios</span>
        </span>
        <ChevronUp className="ml-auto size-3.5 text-muted-foreground" />
      </div>
      <ul className="ml-[18px] flex flex-col gap-0.5 border-l-2 border-border pl-2">
        {group.items.map((it) => {
          const Icon = RELATORIOS_ICONS[it.id];
          const on = it.id === 'conversao';
          return (
            <li
              key={it.id}
              className={cn(
                'flex items-center gap-2 rounded-[10px] border px-[7px] py-[3px] text-[12px] font-semibold',
                on ? 'border-border bg-card text-foreground shadow-card' : 'border-transparent text-muted-foreground',
              )}
            >
              <span className={cn('grid size-[22px] shrink-0 place-items-center rounded-[7px]', on ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground')}>
                <Icon className="size-[13px]" />
              </span>
              {it.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A pílula de filtro da barra: o nome do filtro e, quando ligado, o valor.
function FilterPill({ label, value }) {
  return (
    <span
      className={cn(
        'inline-flex h-[30px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11.5px]',
        value ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border text-muted-foreground',
      )}
    >
      <span className={cn(value && 'text-muted-foreground')}>{label}</span>
      {value && <span className="font-semibold">{value}</span>}
      <ChevronDown className="size-3" />
    </span>
  );
}

// Passo 2: a barra de cima, com o balão de consultores aberto e o comparado embaixo.
export function IntroFilters() {
  const people = [['Ana Paula', false], ['Bruno Lima', true], ['Carla Souza', false]];
  return (
    <div className={cn(MINI, 'flex max-w-[468px] flex-col gap-2.5 p-2.5')}>
      <div className="flex flex-wrap items-center gap-[5px]">
        <span className="inline-flex h-[30px] items-center gap-0.5 rounded-[10px] border border-border px-1 text-[11.5px] font-semibold">
          <ChevronLeft className="size-[13px] text-muted-foreground" />
          <span className="px-1">Setembro 2026</span>
          <ChevronRight className="size-[13px] text-muted-foreground" />
        </span>
        <FilterPill label="Consultor" value="Bruno Lima" />
        <FilterPill label="Origem" />
        <FilterPill label="Funil" />
      </div>
      <ul className="ml-10 flex w-[168px] flex-col gap-px rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_30px_-14px_rgba(14,26,64,.35)] sm:ml-[124px]">
        {people.map(([name, on]) => (
          <li key={name} className={cn('flex items-center gap-2 rounded-lg px-[7px] py-1.5 text-[12px]', on && 'font-semibold')}>
            <span
              className={cn(
                'grid size-[15px] shrink-0 place-items-center rounded-[4px] border-[1.5px]',
                on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-400 dark:border-white/30',
              )}
            >
              {on && <Check className="size-2.5" strokeWidth={3.2} />}
            </span>
            {name}
          </li>
        ))}
      </ul>
      <p className="pl-0.5 text-[11.5px] text-muted-foreground">vs. Agosto 2026</p>
    </div>
  );
}

// O selo de situação da lista: ponto e texto, nunca só a cor.
function MiniPill({ tone, children }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-[5px] rounded-full px-2 text-[11px] font-semibold',
        tone === 'good' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

// Passo 3: as etapas da Conversão com Vieram aceso, e a lista embaixo
// filtrada por ele. A setinha entre as etapas é a mesma da tela.
export function IntroNumberToNames() {
  const cells = [['Leads da safra', '51'], ['Agendaram', '23'], ['Vieram', '8'], ['Matricularam', '4']];
  const rows = [['Marina Alves', 'Instagram', 'Matriculou', 'good'], ['Rafael Costa', 'Indicação', 'Em aberto']];
  return (
    <div className="flex w-full max-w-[456px] flex-col gap-2.5">
      <div className={cn(MINI, 'grid grid-cols-4')}>
        {cells.map(([label, value], i) => {
          const on = label === 'Vieram';
          return (
            <div
              key={label}
              className={cn(
                'relative flex min-w-0 flex-col justify-between px-2 pb-2.5 pt-3 sm:px-3',
                i > 0 && 'border-l border-border',
                i === 0 && 'rounded-l-[13px]',
                i === cells.length - 1 && 'rounded-r-[13px]',
                on && 'bg-brand-50 shadow-[inset_0_3px_0_var(--color-brand-600)] dark:bg-brand-500/15',
              )}
            >
              <span className={cn('block text-[10px] font-semibold leading-tight sm:text-[10.5px]', on ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')}>{label}</span>
              <span className={cn('num mt-1 block font-display text-[17px] font-bold leading-none sm:text-[20px]', label === 'Matricularam' && 'text-emerald-700 dark:text-emerald-400')}>
                {value}
              </span>
              {i < cells.length - 1 && (
                <span className="absolute -right-[7px] top-1/2 z-10 grid size-[13px] -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                  <ChevronRight className="size-[9px]" strokeWidth={3} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className={cn(MINI, 'overflow-hidden')}>
        <p className="border-b border-border px-3 py-2">
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-brand-50 pl-[9px] pr-1 text-[11.5px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Vieram: 8 dos 51
            <X className="size-[13px]" />
          </span>
        </p>
        <ul>
          {rows.map(([name, origin, status, tone]) => (
            <li key={name} className="flex items-center gap-2.5 border-t border-border px-3 py-[7px] first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold">{name}</span>
                <span className="block text-[11px] text-muted-foreground">{origin}</span>
              </span>
              <MiniPill tone={tone}>{status}</MiniPill>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// O botão de verdade que faz cada saída, em cima do que ele faz.
function OutButton({ icon: Icon, children }) {
  return (
    <span className="inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-[11px] text-[12px] font-semibold">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

// Passo 4: a folha impressa embaixo do Imprimir e a planilha embaixo do
// Exportar lista, na ordem dos botões da tela.
export function IntroOutputs() {
  const rows = [['Marina Alves', 'Instagram'], ['Rafael Costa', 'Indicação'], ['Bia Mendes', 'WhatsApp'], ['Lucas Martins', 'Google']];
  const cell = 'truncate border-b border-r border-border px-[5px] py-1 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0';
  return (
    <div className="grid w-full max-w-[440px] grid-cols-2 items-start gap-2.5 sm:gap-3.5">
      <div className="flex min-w-0 flex-col items-center gap-2.5">
        <OutButton icon={Printer}>Imprimir</OutButton>
        <div className={cn(MINI, 'flex aspect-[210/250] w-[132px] flex-col gap-[5px] overflow-hidden px-[11px] py-2.5')}>
          <span className="text-[8.5px] text-muted-foreground">Sua academia</span>
          <span className="font-display text-[12px] font-bold leading-tight">Conversão</span>
          <span className="border-y border-border py-1 text-[8.5px] leading-snug text-muted-foreground">
            <b className="font-semibold text-foreground">Setembro 2026</b>
            <br />
            Lista filtrada por Vieram, 8 dos 51
          </span>
          {['w-full', 'w-[70%]', 'w-full', 'w-[70%]', 'w-full'].map((w, i) => (
            <span key={i} className={cn('h-1.5 rounded-full bg-muted', w)} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-center gap-2.5">
        <OutButton icon={Download}>Exportar lista</OutButton>
        <div className={cn(MINI, 'p-2')}>
          <div className="grid grid-cols-[1.4fr_1fr] overflow-hidden rounded-md border border-border text-[9.5px]">
            <span className={cn(cell, 'bg-muted font-bold text-muted-foreground')}>Nome</span>
            <span className={cn(cell, 'bg-muted font-bold text-muted-foreground')}>Origem</span>
            {rows.flatMap(([name, origin]) => [
              <span key={`${name}-n`} className={cell}>{name}</span>,
              <span key={`${name}-o`} className={cell}>{origin}</span>,
            ])}
          </div>
        </div>
      </div>
    </div>
  );
}
