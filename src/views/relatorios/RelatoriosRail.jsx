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
import { useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.jsx';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { RailGroup } from '../../components/nav/RailGroup.jsx';
import { railItemClassName } from '../../components/nav/railItem.js';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';
import { RELATORIOS_ICONS, RELATORIOS_TONES } from './relatoriosIcons.js';

function RailItem({ item, active, href, onSection }) {
  const Icon = RELATORIOS_ICONS[item.id];
  return (
    <AppLink
      to={href}
      aria-current={active ? 'page' : undefined}
      // O clique simples troca de submenu pela tela (replace); o resto fica com o navegador.
      onNavigate={(e) => { e.preventDefault(); onSection(item.id); }}
      className={cn(railItemClassName(active), 'gap-2.5 pr-2.5')}
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

// O grupo recolhível, aberto ao entrar (o desenho mora em
// src/components/nav/RailGroup.jsx, dividido com as Configurações). Aberto, o
// resumo diz o período da barra (periodLabel, já em minúsculas); Leads parados
// não tem período, e a tela passa null. Fechado, diz o relatório aberto.
function RelatoriosGroup({ group, section, hrefOf, onSection, periodLabel = null }) {
  const [open, setOpen] = useState(true);
  const current = group.items.find((it) => it.id === section);
  const count = `${group.items.length} relatórios`;
  const summary = open || !current ? (periodLabel ? `${count}, ${periodLabel}` : count) : `Aberto: ${current.label}`;
  return (
    <RailGroup
      label={group.label}
      icon={Users}
      iconClassName="bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgba(43,89,255,.7)]"
      summary={summary}
      open={open}
      onToggle={() => setOpen((v) => !v)}
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
    </RailGroup>
  );
}

// Grupo que ainda não tem relatório (soon, em relatoriosRail.js): o nome e o
// selo "Em breve", sem botão e sem link, para ninguém clicar e cair numa tela
// vazia. O ícone de Clientes é o mesmo do item Clientes do menu.
function SoonGroup({ group }) {
  return (
    <div className="flex items-center gap-[11px] rounded-[14px] px-[11px] py-2.5">
      <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground">
        <GraduationCap size={17} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-sm font-bold leading-tight text-muted-foreground">{group.label}</span>
      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">Em breve</span>
    </div>
  );
}

export function RelatoriosRail({ section, onSection, hrefOf, periodLabel = null }) {
  return (
    <>
      <nav aria-label="Relatórios" className="hidden flex-col gap-1 lg:flex">
        {RELATORIOS_RAIL_GROUPS.map((g) => (g.soon
          ? <SoonGroup key={g.label} group={g} />
          : <RelatoriosGroup key={g.label} group={g} section={section} hrefOf={hrefOf} onSection={onSection} periodLabel={periodLabel} />
        ))}
      </nav>
      <div className="lg:hidden">
        <Select value={section} onValueChange={onSection}>
          {/* O data-[size=default]:h-9 do shadcn tem mais peso que um h-10 solto: a altura tem de vir pela mesma variante. */}
          <SelectTrigger aria-label="Relatório" className="w-full data-[size=default]:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="border-border">
            {RELATORIOS_RAIL_GROUPS.flatMap((g) => (g.soon
              ? [<SelectItem key={g.label} value={`em-breve-${g.label}`} disabled>{`${g.label} · Em breve`}</SelectItem>]
              : g.items.map((it) => (
                <SelectItem key={it.id} value={it.id}>{`${g.label} · ${it.label}`}</SelectItem>
              ))))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
