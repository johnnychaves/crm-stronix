// Contatos nos marcos de renovação (90/60/30 por padrão, configuráveis pela
// academia). Handoff linhas 485 a 506; lógica de exemplo 1649 a 1662.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';

export function MilestoneBars({ items }) {
  const list = items || [];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card px-[18px] pt-4 pb-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[13.5px] font-semibold">Contatos nos marcos</span>
        <DashHelpTip
          text="Tarefas de renovação feitas ÷ clientes que chegaram a cada marco. A academia pode mudar os marcos em Configurações."
          label='O que é "Contatos nos marcos"?'
        />
      </div>
      <div className="mt-4 flex flex-col gap-3.5">
        {list.map((m) => {
          const hasData = m.pct != null;
          const strong = hasData && m.pct >= 70;
          return (
            <div key={m.days}>
              <div className="flex items-baseline gap-2">
                <span className="num text-[12.5px] font-semibold">{m.days} dias antes</span>
                <div className="flex-1" />
                <span className={cn('num text-[12.5px] font-bold', hasData ? (strong ? 'text-brand-700 dark:text-brand-300' : 'text-amber-700 dark:text-amber-300') : 'text-muted-foreground')}>
                  {hasData ? `${m.pct}%` : '—'}
                </span>
                {/* Marco sem fonte ainda (mês carregando) vem com total null: fica só o "—". */}
                {m.total != null && <span className="num text-[11px] text-muted-foreground">{fmtNum(m.done)} de {fmtNum(m.total)}</span>}
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-muted">
                {hasData && (
                  <ChartMark
                    tip={`Marco de ${m.days} dias: ${fmtNum(m.done)} contatos feitos de ${fmtNum(m.total)} clientes que chegaram ao marco`}
                    className={cn('block h-full rounded-full', strong ? 'bg-brand-600' : 'bg-amber-500')}
                    style={{ width: `${m.pct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
