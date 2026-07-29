import { Check } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { cn } from '../../lib/utils.js';

// Cartão 1 do handoff: as duas réguas do MÊS crescendo em direções opostas a
// partir do nome. Barra curta de um lado só diz o assunto da conversa — quem
// falha na carteira e quem falha na cota são dois problemas diferentes e duas
// conversas diferentes. Mede só dias ENCERRADOS: hoje vive na régua e na tabela.
function Wing({ pct, label, tone, side, hasCota = true }) {
  const low = pct != null && pct < 60;
  const barTone = low ? 'bg-danger' : tone === 'brand' ? 'bg-brand-600' : 'bg-accent-500';
  const labelTone = !hasCota
    ? 'text-slate-400 dark:text-slate-500'
    : low ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300';
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', side === 'right' && 'flex-row-reverse')}>
      <span className={cn('shrink-0 text-[11px] font-semibold num whitespace-nowrap', labelTone)}>{label}</span>
      {/* Alvo 0 não é 0%: a trilha some em vez de mostrar barra vazia. */}
      <div className={cn(
        'flex-1 h-[18px] rounded-md overflow-hidden flex',
        hasCota ? 'bg-slate-100 dark:bg-white/[0.06]' : 'bg-transparent',
        side === 'left' && 'justify-end'
      )}>
        {hasCota && pct != null && (
          <span className={cn('h-full rounded-md', barTone)} style={{ width: `${Math.min(100, pct)}%` }} />
        )}
      </div>
    </div>
  );
}

function TeamWings({ rows, closedDays }) {
  return (
    <section className="px-5 pt-4 pb-3">
      <div className="grid grid-cols-[1fr_150px_1fr] gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="text-right">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-brand-700 dark:text-brand-300 whitespace-nowrap">Meta diária</div>
          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">dias batidos de {closedDays} encerrados</div>
        </div>
        <div className="text-center">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Consultor</div>
          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap inline-flex items-center gap-1">
            <i className="size-1.5 rounded-full bg-success" aria-hidden="true" /> dia perfeito hoje
          </div>
        </div>
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-accent-600 dark:text-accent-400 whitespace-nowrap">Prospecção</div>
          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap">ações do mês sobre a cota acumulada</div>
        </div>
      </div>

      <ul>
        {rows.map((r) => (
          <li
            key={r.user.id}
            className={cn(
              'grid grid-cols-1 sm:grid-cols-[1fr_150px_1fr] gap-2 sm:gap-3 items-center py-2.5',
              r.perfect && 'bg-emerald-50/60 dark:bg-emerald-500/[0.07] rounded-lg'
            )}
          >
            {/* No celular o nome vira cabeçalho e as barras empilham: o
                espelhamento é a primeira coisa que quebra em tela estreita. */}
            <div className="order-2 sm:order-1">
              <Wing
                side="left"
                tone="brand"
                pct={r.metaPct}
                label={`${r.metaHits}/${r.closedDays} · ${r.metaPct == null ? '—' : `${r.metaPct}%`}`}
              />
            </div>

            <div className="order-1 sm:order-2 flex items-center justify-start sm:justify-center gap-2 min-w-0">
              <span className="relative shrink-0">
                <Avatar name={r.user.name} size={30} />
                {r.perfect && (
                  <span className="absolute -right-0.5 -bottom-0.5 size-[13px] rounded-full bg-success grid place-items-center ring-2 ring-card">
                    <Check size={8} strokeWidth={3.5} className="text-white" />
                  </span>
                )}
              </span>
              <span className={cn('text-[12.5px] font-semibold truncate', r.perfect ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
                {(r.user.name || '').split(' ')[0]}
              </span>
            </div>

            <div className="order-3">
              <Wing
                side="right"
                tone="accent"
                hasCota={r.hasCota}
                pct={r.prospPct}
                label={r.hasCota ? `${r.prospMes}/${r.prospAlvoMes} · ${r.prospPct == null ? '—' : `${r.prospPct}%`}` : 'sem cota'}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { TeamWings };
