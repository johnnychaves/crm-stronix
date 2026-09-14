// Os 3 destaques do mês, só aparecem com o comparativo ligado (a tela decide
// isso; o componente só renderiza o que receber). Handoff linhas 131 a 149.
// Abaixo de 768px vira carrossel horizontal com o pior primeiro.
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

function HighlightCard({ h }) {
  const bad = h.bad;
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border border-border px-[15px] py-[13px]', bad ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10')}>
      <span className={cn('mt-px grid size-[26px] flex-none place-items-center rounded-lg text-white', bad ? 'bg-danger dark:bg-[#E11D48]' : 'bg-success dark:bg-[#0E9F6E]')}>
        {h.up ? <ArrowUp size={14} strokeWidth={2.6} /> : <ArrowDown size={14} strokeWidth={2.6} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-pretty text-[12.5px] font-semibold leading-[1.45]">{h.text}</div>
        <div className="mt-[5px] flex items-center gap-[7px]">
          <span className={cn('num text-[11.5px] font-bold', bad ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300')}>
            {h.up ? '▲' : '▼'} {h.delta}
          </span>
          <span className="size-[3px] flex-none rounded-full bg-muted-foreground" />
          <span className={cn('text-[11.5px]', bad ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300')}>
            {bad ? 'piorou' : 'melhorou'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashHighlights({ items }) {
  const list = items || [];
  if (list.length === 0) return null;
  const mobileOrder = [...list].sort((a, b) => Number(b.bad) - Number(a.bad));
  return (
    <>
      <div className="hidden grid-cols-3 gap-3 md:grid">
        {list.map((h, i) => <HighlightCard key={i} h={h} />)}
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto md:hidden">
        {mobileOrder.map((h, i) => (
          <div key={i} className="w-[260px] flex-none snap-start">
            <HighlightCard h={h} />
          </div>
        ))}
      </div>
    </>
  );
}
