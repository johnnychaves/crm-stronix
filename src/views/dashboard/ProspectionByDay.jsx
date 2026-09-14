// Colunas de prospecção por dia + linha de alvo. Handoff linhas 199 a 227;
// lógica de exemplo 1320 a 1332 e 1497 a 1512. Alvo 0 não é alvo pequeno: o
// card inteiro sai da tela (README §5 "Prospecção desligada").
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';

export function ProspectionByDay({ days, values, dailyTarget }) {
  if (!dailyTarget) return null;
  const list = days || [];
  const vals = values || [];
  const max = Math.max(...vals, dailyTarget, 1);
  const barH = (v) => `${Math.max(Math.round((v / max) * 108), 3)}px`;
  const targetBottom = `${Math.round((dailyTarget / max) * 108)}px`;
  const showValues = list.length <= 14;
  const gap = list.length > 14 ? 'gap-[3px]' : 'gap-1.5';
  const tone = (v, isToday) => (isToday ? 'bg-accent-50 dark:bg-accent-500/15'
    : v >= dailyTarget ? 'bg-accent-500 dark:bg-accent-600' : 'bg-brand-200 dark:bg-brand-500/40');
  const labelTone = (v, isToday) => (!isToday && v >= dailyTarget ? 'text-accent-600 dark:text-accent-400' : 'text-muted-foreground');
  const tip = (d, v) => `Dia ${d.day}: ${fmtNum(v)} ações${d.state === 'today' ? ' até agora (hoje)' : ''} · alvo ${fmtNum(dailyTarget)}`;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card px-[18px] pt-4 pb-3.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold">Prospecção por dia</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
          <span className="h-0.5 w-3.5 bg-foreground/80" />
          alvo {fmtNum(dailyTarget)}/dia
        </span>
      </div>

      <div className="relative mt-4 h-[132px]">
        <span className="absolute inset-x-0 h-0.5 bg-foreground/80 opacity-55" style={{ bottom: targetBottom }} />
        <div className={cn('absolute inset-0 flex items-end', gap)}>
          {list.map((d, i) => {
            const v = vals[i] || 0;
            const isToday = d.state === 'today';
            return (
              <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-[5px]">
                {showValues && (
                  <span className={cn('num text-[10px] font-semibold max-md:hidden', labelTone(v, isToday))}>{fmtNum(v)}</span>
                )}
                <ChartMark
                  tip={tip(d, v)}
                  className={cn('w-full max-w-6 rounded-t', tone(v, isToday))}
                  style={{ height: barH(v) }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn('mt-[7px] flex border-t border-slate-100 pt-[7px] dark:border-white/[0.06]', gap)}>
        {list.map((d) => (
          <span key={d.key} className={cn('num min-w-0 flex-1 text-center text-[9.5px]', d.state === 'today' ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')}>
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}
