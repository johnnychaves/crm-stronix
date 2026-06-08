import { AlertCircle, AlertTriangle, BarChart3, Building2, DollarSign, TrendingUp } from 'lucide-react';
import { fmtBRL, fmtNum } from '../../lib/format.js';

function SuperOverviewCards({ overview }) {
  if (!overview) return null;
  const arpu = overview.active > 0 ? Math.round(overview.mrr / overview.active) : 0;
  const kpis = [
    { label: 'MRR estimado', value: fmtBRL(overview.mrr), sub: 'receita recorrente/mês', icon: <TrendingUp size={15} /> },
    { label: 'Clientes ativos', value: fmtNum(overview.active), sub: `${overview.trial} em trial · ${overview.suspended} susp.`, icon: <Building2 size={15} /> },
    { label: 'Ticket médio', value: fmtBRL(arpu), sub: 'por cliente ativo', icon: <DollarSign size={15} /> },
    { label: 'Clientes em risco', value: fmtNum(overview.atRisk), sub: 'sem uso há 14+ dias', icon: <AlertCircle size={15} />, danger: overview.atRisk > 0 },
  ];
  const expiring = overview.trialsExpiring || [];
  const months = overview.newByMonth || [];
  const maxMonth = Math.max(1, ...months.map(m => m.count));
  const newTotal = months.reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="text-brand-600 dark:text-brand-400 shrink-0">{k.icon}</span>
              <span className="truncate">{k.label}</span>
            </div>
            <div className={`num text-[22px] font-semibold tracking-tight mt-1.5 leading-none ${k.danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{k.value}</div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-1 truncate num">{k.sub}</div>
          </div>
        ))}
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.08] px-3.5 py-2.5">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 text-[12px] text-amber-800 dark:text-amber-200">
            <span className="font-semibold">{expiring.length} trial{expiring.length === 1 ? '' : 's'} vencendo em até 7 dias.</span>{' '}
            <span className="text-amber-700/90 dark:text-amber-300/90">
              {expiring.slice(0, 3).map(e => `${e.displayName} (${e.daysLeft <= 0 ? 'hoje' : e.daysLeft + 'd'})`).join(' · ')}
              {expiring.length > 3 ? ` +${expiring.length - 3}` : ''}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <BarChart3 size={15} className="text-brand-600 dark:text-brand-400" /> Novas organizações
          </div>
          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 num">{newTotal} em 6 meses</span>
        </div>
        <div className="mt-2.5 flex items-end gap-1.5 h-12">
          {months.map(m => (
            <div key={m.ym} className="flex-1 flex flex-col items-center justify-end h-full" title={`${m.label}: ${m.count}`}>
              <div className="w-full max-w-[26px] rounded-md bg-brand-500/70 dark:bg-brand-500/60"
                style={{ height: `${Math.max(m.count ? 10 : 2, (m.count / maxMonth) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {months.map(m => (
            <div key={m.ym} className="flex-1 text-center text-[9.5px] text-slate-400 dark:text-slate-500 capitalize">{m.label.replace('.', '')}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { SuperOverviewCards };
