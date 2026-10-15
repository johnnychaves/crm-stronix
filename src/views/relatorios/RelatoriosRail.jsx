// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado", e o
// handoff em docs/superpowers/specs/handoff-relatorios/, §3). No computador,
// cada grupo é recolhível (RailGroup) e abre fechado, com o relatório aberto
// escrito embaixo do título; cada item mostra o nome e o número principal do
// relatório, com os filtros da barra. Abaixo de lg vira um seletor no topo.
//
// Cada item é um link de verdade (AppLink), então Ctrl+clique e o botão do meio
// abrem o relatório em outra aba. O clique simples não navega pelo link: ele
// chama onSection, que a tela liga ao goToSub do App, e o goToSub troca o
// endereço com replace, como toda sub-tela trocada estando na tela.
//
// Abrir e fechar o grupo é estado da lista, não filtro: não vai ao endereço.
import { useId, useState } from 'react';
import { CalendarCheck, ChevronDown, CirclePause, TrendingDown, TrendingUp, UserPlus, Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.jsx';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';
import { FOCUS_RING } from '../../components/focusRing.js';

const ICONS = Object.freeze({
  entrada: UserPlus,
  conversao: TrendingUp,
  'visitas-e-aulas': CalendarCheck,
  perdas: TrendingDown,
  parados: CirclePause,
});

// O número do item. Taxa sem base aparece como travessão, e o leitor de tela
// ouve "sem base".
function RailNumber({ value, active }) {
  if (!value) return null;
  return (
    <span className={cn('num shrink-0 font-display text-[13px] font-bold', active ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')}>
      {value.none ? <><span aria-hidden="true">—</span><span className="sr-only">sem base</span></> : value.text}
    </span>
  );
}

function RailItem({ item, active, href, number, onSection }) {
  const Icon = ICONS[item.id];
  return (
    <AppLink
      to={href}
      aria-current={active ? 'page' : undefined}
      // O clique simples troca de submenu pela tela (replace); o resto fica com o navegador.
      onNavigate={(e) => { e.preventDefault(); onSection(item.id); }}
      className={cn(
        'flex w-full items-center gap-[11px] rounded-[14px] border px-[11px] py-2.5 text-left',
        'transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none',
        FOCUS_RING,
        active
          ? 'border-border bg-card shadow-card hover:border-brand-200 dark:hover:border-brand-500/40'
          : 'border-transparent hover:border-brand-200 hover:bg-card/60 dark:hover:border-brand-500/40'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-[34px] shrink-0 place-items-center rounded-[10px] transition-colors duration-150 motion-reduce:transition-none',
          active ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[13.5px] font-semibold', active ? 'text-foreground' : 'text-slate-700 dark:text-slate-300')}>
        {item.label}
      </span>
      <RailNumber value={number} active={active} />
    </AppLink>
  );
}

// O grupo recolhível. Fechado, o conteúdo encolhe para 0fr e some (opacity), e
// recebe inert, para sair da ordem do Tab e da leitura. As durações caem para
// zero com prefers-reduced-motion.
export function RailGroup({ group, section, hrefOf, numbers, onSection }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const current = group.items.find((it) => it.id === section);
  const summary = open || !current ? `${group.items.length} relatórios` : `Aberto: ${current.label}`;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-[11px] rounded-[14px] px-[11px] py-2.5 text-left transition-colors duration-150 hover:bg-muted motion-reduce:transition-none',
          FOCUS_RING
        )}
      >
        <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Users size={16} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-foreground">{group.label}</span>
          <span className="mt-px block truncate text-[11.5px] text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-[280ms,220ms] ease-[ease] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* O pr e o pb deixam à vista o anel do foco e a sombra do item aceso, que o overflow cortaria. */}
          <div inert={!open} className="mb-0.5 ml-4 mt-1 flex flex-col gap-1 border-l-2 border-border pb-[3px] pl-2.5 pr-[3px]">
            {group.items.map((it) => (
              <RailItem
                key={it.id}
                item={it}
                active={it.id === section}
                href={hrefOf(it.id)}
                number={numbers?.[it.id] ?? null}
                onSection={onSection}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RelatoriosRail({ section, onSection, hrefOf, numbers }) {
  return (
    <>
      <nav aria-label="Relatórios" className="hidden flex-col gap-1 lg:flex">
        {RELATORIOS_RAIL_GROUPS.map((g) => (
          <RailGroup key={g.label} group={g} section={section} hrefOf={hrefOf} numbers={numbers} onSection={onSection} />
        ))}
      </nav>
      <div className="lg:hidden">
        <Select value={section} onValueChange={onSection}>
          {/* O data-[size=default]:h-9 do shadcn tem mais peso que um h-10 solto: a altura tem de vir pela mesma variante. */}
          <SelectTrigger aria-label="Relatório" className="w-full data-[size=default]:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="border-border">
            {RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items.map((it) => (
              <SelectItem key={it.id} value={it.id}>{`${g.label} · ${it.label}`}</SelectItem>
            )))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
