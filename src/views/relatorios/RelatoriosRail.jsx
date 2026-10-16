// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado", e o desenho
// C do mockup docs/superpowers/specs/mockups/2026-10-15-relatorios-menu-lateral.html,
// escolhido pelo Johnny em 15/10/2026). No computador, cada grupo é recolhível
// (RailGroup) e já entra aberto; fechado, diz embaixo do título o relatório
// aberto. Cada item mostra o ícone na cor do que o relatório mede e o nome, sem
// número (decisão do Johnny, 15/10/2026). Abaixo de lg vira um seletor no topo.
//
// Cada item é um link de verdade (AppLink), então Ctrl+clique e o botão do meio
// abrem o relatório em outra aba. O clique simples não navega pelo link: ele
// chama onSection, que a tela liga ao goToSub do App, e o goToSub troca o
// endereço com replace, como toda sub-tela trocada estando na tela.
//
// Abrir e fechar o grupo é estado da lista, não filtro: não vai ao endereço.
import { useId, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.jsx';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';
import { FOCUS_RING } from '../../components/focusRing.js';
import { RELATORIOS_ICONS, RELATORIOS_TONES } from './relatoriosIcons.js';

function RailItem({ item, active, href, onSection }) {
  const Icon = RELATORIOS_ICONS[item.id];
  return (
    <AppLink
      to={href}
      aria-current={active ? 'page' : undefined}
      // O clique simples troca de submenu pela tela (replace); o resto fica com o navegador.
      onNavigate={(e) => { e.preventDefault(); onSection(item.id); }}
      className={cn(
        'relative flex w-full items-center gap-2.5 rounded-xl border py-[7px] pl-[7px] pr-2.5 text-left',
        'transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none',
        FOCUS_RING,
        active
          // O before é o traço azul em cima da linha que liga os itens ao grupo: 13px é o pl-3 da lista mais a borda do item.
          ? 'border-border bg-card shadow-[0_1px_0_rgba(15,23,42,.04),0_10px_24px_-12px_rgba(15,23,42,.22)] before:absolute before:inset-y-[9px] before:-left-[13px] before:w-0.5 before:rounded-full before:bg-brand-600 dark:shadow-[0_14px_30px_-14px_rgba(0,0,0,.7)]'
          : 'border-transparent hover:bg-muted'
      )}
    >
      <span aria-hidden="true" className={cn('grid size-[30px] shrink-0 place-items-center rounded-[9px]', RELATORIOS_TONES[item.id])}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', active ? 'font-semibold text-foreground' : 'font-medium text-slate-700 dark:text-slate-300')}>
        {item.label}
      </span>
    </AppLink>
  );
}

// O grupo recolhível, aberto ao entrar. Fechado, o conteúdo encolhe para 0fr e
// some (opacity), e recebe inert, para sair da ordem do Tab e da leitura. As
// durações caem para zero com prefers-reduced-motion. Aberto, o resumo diz o
// período da barra (periodLabel, já em minúsculas); Leads parados não tem
// período, e a tela passa null.
export function RailGroup({ group, section, hrefOf, onSection, periodLabel = null }) {
  const [open, setOpen] = useState(true);
  const panelId = useId();
  const current = group.items.find((it) => it.id === section);
  const count = `${group.items.length} relatórios`;
  const summary = open || !current ? (periodLabel ? `${count}, ${periodLabel}` : count) : `Aberto: ${current.label}`;
  return (
    <div className="flex flex-col">
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
        <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgba(43,89,255,.7)]">
          <Users size={17} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold leading-tight text-foreground">{group.label}</span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-[280ms] motion-reduce:transition-none', !open && '-rotate-90')}
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
          {/* O before é a linha que liga os itens ao grupo. O pr e o pb deixam à vista o anel do foco, que o overflow cortaria. */}
          <div
            inert={!open}
            className="relative mb-0.5 ml-[27px] mt-1.5 flex flex-col gap-[3px] pb-[3px] pl-3 pr-[3px] pt-0.5 before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border"
          >
            {group.items.map((it) => (
              <RailItem
                key={it.id}
                item={it}
                active={it.id === section}
                href={hrefOf(it.id)}
                onSection={onSection}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RelatoriosRail({ section, onSection, hrefOf, periodLabel = null }) {
  return (
    <>
      <nav aria-label="Relatórios" className="hidden flex-col gap-1 lg:flex">
        {RELATORIOS_RAIL_GROUPS.map((g) => (
          <RailGroup key={g.label} group={g} section={section} hrefOf={hrefOf} onSection={onSection} periodLabel={periodLabel} />
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
