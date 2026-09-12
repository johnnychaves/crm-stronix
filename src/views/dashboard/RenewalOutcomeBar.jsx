// Barra de desfecho da renovação + bloco "Quando renovou". Handoff linhas 441
// a 483; lógica de exemplo 1351 a 1354 e 1632 a 1648.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';
import { DashHelpTip } from './DashPrimitives.jsx';

const OUTCOME_META = [
  { key: 'renew', label: 'Renovou', bg: 'bg-success dark:bg-[#0E9F6E]', fg: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'wont', label: 'Não vai renovar', bg: 'bg-amber-500 dark:bg-amber-600', fg: 'text-amber-700 dark:text-amber-300' },
  { key: 'lapsed', label: 'Venceu sem renovar', bg: 'bg-danger dark:bg-[#E11D48]', fg: 'text-rose-700 dark:text-rose-300' },
  { key: 'pending', label: 'Ainda vai vencer', bg: 'bg-slate-400 dark:bg-slate-500', fg: 'text-muted-foreground' }
];

const WHEN_META = [
  { key: 'antes', label: 'Antes de vencer' },
  { key: 'no', label: 'No vencimento' },
  { key: 'depois', label: 'Depois, na tolerância' }
];

// Mesmo helper do handoff: largura relativa ao maior valor, com piso de 2%
// para a barra nunca ficar realmente invisível.
const pctBar = (v, max) => (max > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0);

export function RenewalOutcomeBar({ counts, when, running, summary }) {
  const keys = running ? OUTCOME_META : OUTCOME_META.filter((o) => o.key !== 'pending');
  const rows = keys.map((o) => ({ ...o, n: counts?.[o.key] || 0 }));
  const total = rows.reduce((a, r) => a + r.n, 0);
  const whenMax = Math.max(...WHEN_META.map((w) => when?.[w.key] || 0), 1);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card px-[18px] pt-4 pb-4">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold">Contratos vencendo no mês</span>
        <DashHelpTip
          text="Renovados ÷ vencendo. No mês em andamento, renovados ÷ contratos que já tiveram desfecho."
          label='O que é "Contratos vencendo no mês"?'
        />
        <div className="flex-1" />
        {summary && <span className="num text-[12.5px] text-muted-foreground">{summary}</span>}
      </div>

      <div className="mt-3.5 flex h-[26px] gap-0.5 overflow-hidden rounded-md">
        {rows.map((r) => {
          const w = total > 0 ? (r.n / total) * 100 : 0;
          return (
            <ChartMark
              key={r.key}
              tip={`${r.label}: ${fmtNum(r.n)} de ${fmtNum(total)} contratos`}
              className={cn('grid place-items-center rounded', r.bg)}
              style={{ width: `${w}%` }}
            >
              {w >= 10 && <span className="num text-[11px] font-bold text-white">{fmtNum(r.n)}</span>}
            </ChartMark>
          );
        })}
      </div>

      <div className="mt-[11px] flex flex-wrap gap-3.5">
        {rows.map((r) => (
          <span key={r.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn('size-[9px] rounded-[3px]', r.bg)} />
            <span className="text-[11.5px] text-foreground/80">{r.label}</span>
            <span className={cn('num text-[11.5px] font-bold', r.fg)}>{fmtNum(r.n)}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3.5 dark:border-white/[0.06]">
        <div className="mb-[11px] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Quando renovou</div>
        <div className="flex flex-col gap-2">
          {WHEN_META.map((w) => {
            const n = when?.[w.key] || 0;
            const pct = pctBar(n, whenMax);
            return (
              <div key={w.key} className="flex items-center gap-[11px]">
                <span className="w-[170px] flex-none truncate text-[12px] text-foreground/80">{w.label}</span>
                <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded bg-muted">
                  <ChartMark
                    tip={`${w.label}: ${fmtNum(n)} renovações`}
                    className="block h-full rounded bg-success dark:bg-[#0E9F6E]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="num w-5 flex-none text-right text-[12.5px] font-semibold">{fmtNum(n)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!running && (
        <div className="mt-3 text-[10.5px] text-muted-foreground">
          O número de um mês fechado ainda pode subir enquanto houver contrato dentro da tolerância.
        </div>
      )}
    </div>
  );
}
