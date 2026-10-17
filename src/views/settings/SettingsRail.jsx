// Trilho das Configurações, no desenho do mockup A (17/10/2026): sete blocos,
// cada grupo recolhível, resumo embaixo do nome do grupo e itens que são links
// de verdade. No computador é uma lista ao lado; abaixo de lg vira um seletor
// no topo, agrupado.
//
// O desenho do grupo é o dos Relatórios (src/views/relatorios/RelatoriosRail.jsx),
// copiado de propósito: o RailGroup deles fixa o ícone e o resumo "N relatórios",
// e extraí-lo mexeria numa tela que acabou de ir para produção e no teste que
// cobra o anel de foco dentro do arquivo dela. Mudou o desenho de um, confira o
// outro.
//
// Cada item é um AppLink, então Ctrl+clique, o botão do meio e "Abrir em nova
// aba" funcionam. O clique simples troca de seção pela tela (onSection, que a
// view liga ao goToSub do App, com replace). Item de outra tela (Rotinas, que
// leva `screen`) não tem onNavigate: o clique simples troca de tela pelo
// roteador. Abrir e fechar o grupo é estado da lista, não vai ao endereço.
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { FOCUS_RING } from '../../components/focusRing.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '../../components/ui/select.jsx';
import { EXTERNAL_ICON, SETTINGS_GROUP_ICONS, SETTINGS_ITEM_ICONS } from './settingsRailIcons.js';

const pedeLabel = (n) => `${n} ${n === 1 ? 'pede ação' : 'pedem ação'}`;

// O quadrado do ícone do grupo e o da Visão geral: neutro, e azul claro quando
// o item aceso está dentro.
const groupIconTone = (hasCurrent) => (hasCurrent
  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
  : 'bg-muted text-slate-600 dark:text-slate-300');

function RailItem({ item, active, href, count, onSection }) {
  const Icon = SETTINGS_ITEM_ICONS[item.id];
  return (
    <AppLink
      to={href}
      aria-current={active ? 'page' : undefined}
      // O clique simples troca de seção pela tela (replace); o resto fica com o navegador.
      onNavigate={item.screen ? undefined : (e) => { e.preventDefault(); onSection(item.id); }}
      className={cn(
        'relative flex w-full items-center gap-2 rounded-xl border py-[7px] pl-[7px] pr-2 text-left',
        'transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none',
        FOCUS_RING,
        active
          // O before é o traço azul em cima da linha que liga os itens ao grupo: 13px é o pl-3 da lista mais a borda do item.
          ? 'border-border bg-card shadow-[0_1px_0_rgba(15,23,42,.04),0_10px_24px_-12px_rgba(15,23,42,.22)] before:absolute before:inset-y-[9px] before:-left-[13px] before:w-0.5 before:rounded-full before:bg-brand-600 dark:shadow-[0_14px_30px_-14px_rgba(0,0,0,.7)]'
          : 'border-transparent hover:bg-muted'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-lg',
          active
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'bg-card text-muted-foreground ring-1 ring-inset ring-border'
        )}
      >
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', active ? 'font-semibold text-foreground' : 'font-medium text-slate-700 dark:text-slate-300')}>
        {item.label}
      </span>
      {item.screen && <EXTERNAL_ICON size={13} strokeWidth={2} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
      {count > 0 && (
        <em
          aria-label={pedeLabel(count)}
          className="num inline-grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-amber-50 px-[7px] font-display text-xs font-bold not-italic leading-none text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        >
          {count}
        </em>
      )}
    </AppLink>
  );
}

// O grupo recolhível. Fechado, o conteúdo encolhe para 0fr e some (opacity), e
// recebe inert, para sair da ordem do Tab e da leitura. As durações caem para
// zero com prefers-reduced-motion. Fechado com o item aceso dentro, o resumo
// diz qual está aberto, como nos Relatórios.
function RailGroup({ group, open, onToggle, section, summary, counts, hrefOf, onSection }) {
  const panelId = useId();
  const GroupIcon = SETTINGS_GROUP_ICONS[group.id];
  const current = group.items.find((it) => it.id === section);
  const text = open || !current ? summary.text : `Aberto: ${current.label}`;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-[11px] rounded-[14px] px-[11px] py-2.5 text-left transition-colors duration-150 hover:bg-muted motion-reduce:transition-none',
          FOCUS_RING
        )}
      >
        <span aria-hidden="true" className={cn('grid size-[34px] shrink-0 place-items-center rounded-[10px]', groupIconTone(Boolean(current)))}>
          <GroupIcon size={17} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold leading-tight text-foreground">{group.label}</span>
          <span className={cn('mt-0.5 block text-[11.5px]', summary.pede && text === summary.text ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
            {text}
          </span>
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
                href={hrefOf(it)}
                count={counts[it.id] || 0}
                onSection={onSection}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// A Visão geral não tem grupo: é um link de uma linha só, no tamanho do
// cabeçalho dos grupos.
function OverviewLink({ item, active, href, onSection }) {
  const Icon = SETTINGS_ITEM_ICONS[item.id];
  return (
    <AppLink
      to={href}
      aria-current={active ? 'page' : undefined}
      onNavigate={(e) => { e.preventDefault(); onSection(item.id); }}
      className={cn(
        'flex w-full items-center gap-[11px] rounded-[14px] px-[11px] py-2.5 text-left font-display text-sm font-bold text-foreground',
        'transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none',
        FOCUS_RING,
        active
          ? 'bg-card shadow-[0_1px_0_rgba(15,23,42,.04),0_10px_24px_-12px_rgba(15,23,42,.22)] dark:shadow-[0_14px_30px_-14px_rgba(0,0,0,.7)]'
          : 'hover:bg-muted'
      )}
    >
      <span aria-hidden="true" className={cn('grid size-[34px] shrink-0 place-items-center rounded-[10px]', groupIconTone(active))}>
        <Icon size={17} strokeWidth={2} />
      </span>
      {item.label}
    </AppLink>
  );
}

// `groups` é o trilho desta sessão (settingsRailGroups), `summaries` vem de
// railSummaries e `counts` de railCounts, os dois em src/lib/settingsSetup.js.
// `hrefOf(item)` monta o endereço do item, de seção ou de outra tela.
export function SettingsRail({ groups, section, summaries, counts, hrefOf, onSection }) {
  const navigate = useNavigate();
  // Grupos que a pessoa fechou. Chegar a um item de um grupo fechado (pelo link
  // ou pelo "Resolver" da Visão geral) o abre: o item aceso nunca fica dentro de
  // um grupo fechado depois de uma navegação. Acerto de estado no render, como
  // o React documenta, e não num effect.
  const [closed, setClosed] = useState(() => new Set());
  const [seen, setSeen] = useState(section);
  if (seen !== section) {
    setSeen(section);
    const owner = groups.find((g) => g.items.some((it) => it.id === section));
    if (owner && closed.has(owner.id)) {
      setClosed((prev) => { const next = new Set(prev); next.delete(owner.id); return next; });
    }
  }
  const toggle = (id) => setClosed((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const itemOf = (id) => groups.flatMap((g) => g.items).find((it) => it.id === id);
  const pick = (id) => {
    const it = itemOf(id);
    if (it?.screen) navigate(hrefOf(it));
    else onSection(id);
  };

  return (
    <>
      <nav aria-label="Seções das Configurações" className="hidden flex-col gap-1 lg:flex">
        {groups.map((g) => (g.label == null
          ? <OverviewLink key={g.id} item={g.items[0]} active={section === g.items[0].id} href={hrefOf(g.items[0])} onSection={onSection} />
          : (
            <RailGroup
              key={g.id}
              group={g}
              open={!closed.has(g.id)}
              onToggle={() => toggle(g.id)}
              section={section}
              summary={summaries[g.id]}
              counts={counts}
              hrefOf={hrefOf}
              onSection={onSection}
            />
          )))}
      </nav>
      <div className="lg:hidden">
        <Select value={section} onValueChange={pick}>
          {/* O data-[size=default]:h-9 do shadcn tem mais peso que um h-10 solto: a altura tem de vir pela mesma variante. */}
          <SelectTrigger aria-label="Seção das Configurações" className="w-full data-[size=default]:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="border-border">
            {groups.map((g) => (g.label == null
              ? g.items.map((it) => <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>)
              : (
                <SelectGroup key={g.id}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.items.map((it) => <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>)}
                </SelectGroup>
              )))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
