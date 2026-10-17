// Seletor de funil do Pipeline: o nome do funil é o título da barra, e o
// clique abre a lista dos funis, separados em leads e clientes, cada um com o
// total e a barrinha das etapas. Desenho escolhido pelo Johnny em 16/10/2026
// (mockup 2026-10-16-pipeline-seletor-de-funil, opção 1). Todos os leads
// continua com as abas (FunnelTabs).
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isClientFunnel } from '../../lib/crm/scope.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.jsx';

// Os funis de clientes não têm etapa contada no navegador (cada um carrega o
// próprio quadro só quando abre), então o menu diz o que cada um reúne.
const CLIENT_NOTES = {
  upgrade: 'Clientes para um plano maior',
  renewal: 'Contratos perto de vencer',
  expired: 'Contratos vencidos',
};

// Barrinha das etapas: cada etapa na cor da coluna, no tamanho do que tem.
// Decorativa: o número e o texto ao lado dizem o mesmo para o leitor de tela.
export function StageBar({ parts, className }) {
  const total = (parts || []).reduce((sum, p) => sum + p.count, 0);
  return (
    <span aria-hidden="true" className={cn('flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted', className)}>
      {total > 0 && parts.map((p) => p.count > 0 && (
        <span
          key={p.name}
          title={`${p.name}: ${p.count}`}
          className="block h-full min-w-1 rounded-full"
          style={{ flexGrow: p.count, background: p.color }}
        />
      ))}
    </span>
  );
}

// `counts`: Map (ou objeto) id → total, o mesmo número que as abas mostravam.
// Ausente não é zero: é "ainda não sei" (Renovações fora da aba), e aí não
// aparece número. `partsOf(id)` devolve as etapas de um funil de leads.
export function FunnelSwitcher({ funnels, selectedId, counts, partsOf, onSelect }) {
  const [open, setOpen] = useState(false);
  const list = funnels || [];
  const current = list.find((f) => f.id === selectedId) || list[0];
  const countOf = (id) => (counts && typeof counts.get === 'function' ? counts.get(id) : counts?.[id]);
  const groups = [
    ['Funis de leads', list.filter((f) => !isClientFunnel(f))],
    ['Funis de clientes', list.filter(isClientFunnel)],
  ].filter(([, items]) => items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          title="Trocar de funil"
          className="-ml-2 inline-flex max-w-full items-center gap-1.5 rounded-[10px] px-2 py-0.5 text-left outline-none transition-colors hover:bg-muted focus-visible:anel-foco data-[state=open]:bg-muted"
        >
          <span className="truncate">{current?.name || 'Pipeline'}</span>
          <ChevronDown className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-32px))] max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-y-contain rounded-[16px] border-border p-2 shadow-card-lg"
      >
        <div role="menu" aria-label="Funis">
          {groups.map(([title, items], gi) => (
            <div key={title} className={cn(gi > 0 && 'mt-1.5 border-t border-border pt-1.5')}>
              <div className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-muted-foreground">{title}</div>
              {items.map((f) => {
                const on = f.id === current?.id;
                const n = countOf(f.id);
                const client = isClientFunnel(f);
                const parts = client ? null : (partsOf?.(f.id) || []);
                const top = parts?.reduce((best, p) => (p.count > best.count ? p : best), parts[0]);
                const note = client
                  ? CLIENT_NOTES[f.systemKind] || 'Clientes'
                  : n > 0 && top?.count > 0
                    ? `${parts.length} ${parts.length === 1 ? 'etapa' : 'etapas'}, mais cheia: ${top.name}`
                    : 'Nenhum lead em aberto';
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => { setOpen(false); onSelect(f.id); }}
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-[11px] px-2.5 py-2.5 text-left outline-none transition-colors focus-visible:anel-foco',
                      on ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-muted'
                    )}
                  >
                    <span className={cn(
                      'truncate text-[13.5px] font-semibold',
                      on ? 'text-brand-700 dark:text-brand-300' : n === 0 ? 'text-muted-foreground' : 'text-foreground'
                    )}>
                      {f.name}
                    </span>
                    <span className={cn('font-display text-[13px] font-bold tabular-nums', on ? 'text-brand-700 dark:text-brand-300' : 'text-muted-foreground')}>
                      {n > 0 ? n : ''}
                    </span>
                    {parts && <StageBar parts={parts} className="col-span-2" />}
                    <span className="col-span-2 truncate text-[11.5px] text-muted-foreground">{note}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
