// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado"): o título
// de cada grupo e os submenus, com a pergunta de cada um embaixo do nome. No
// computador é uma coluna ao lado do conteúdo, como o trilho de
// Configurações; abaixo de lg vira um seletor no topo. Trocar de submenu é
// onSection, que a tela liga ao goToSub do App, com a query junto. Desenhada
// com a skill frontend-design.
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.jsx';
import { RELATORIOS_RAIL_GROUPS } from '../../lib/relatoriosRail.js';
import { FOCUS_RING } from '../../components/focusRing.js';

export function RelatoriosRail({ section, onSection }) {
  return (
    <>
      <nav aria-label="Relatórios" className="hidden flex-col gap-5 lg:flex">
        {RELATORIOS_RAIL_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <div className="px-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{g.label}</div>
            {g.items.map((it) => {
              const active = it.id === section;
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSection(it.id)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors motion-reduce:transition-none',
                    FOCUS_RING,
                    active ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-muted/70'
                  )}
                >
                  <span className={cn('text-[13.5px] font-semibold', active ? 'text-brand-700 dark:text-brand-300' : 'text-foreground')}>{it.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{it.hint}</span>
                </button>
              );
            })}
          </div>
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
