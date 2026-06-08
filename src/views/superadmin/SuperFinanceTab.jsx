import { AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { planLabel } from '../../lib/superadmin.js';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';

function SuperFinanceTab({ overview, tenants, onPatch, busy }) {
  const o = overview || {};
  const fmt = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');
  const overdue = (tenants || []).filter(t => !t.archived && !t.internal && t.paymentStatus === 'overdue');
  const upcoming = o.upcomingBilling || [];
  const byPlanRev = {};
  (tenants || []).forEach(t => { if (!t.archived && !t.internal && t.status === 'active') byPlanRev[t.plan] = (byPlanRev[t.plan] || 0) + (t.price || 0); });
  const planRows = Object.entries(byPlanRev).sort((a, b) => b[1] - a[1]);
  const maxRev = planRows.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  const kpi = (label, value, sub, tone) => {
    const tones = { brand: 'text-brand-700 dark:text-brand-300', emerald: 'text-emerald-700 dark:text-emerald-300', rose: 'text-rose-700 dark:text-rose-300', amber: 'text-amber-700 dark:text-amber-300', slate: 'text-slate-900 dark:text-white' };
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
        <div className={`num text-[22px] font-bold tracking-tight mt-1 ${tones[tone] || tones.slate}`}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpi('MRR', fmt(o.mrr), 'receita recorrente', 'brand')}
        {kpi('ARR', fmt(o.arr), 'anualizado (MRR×12)', 'emerald')}
        {kpi('MRR potencial', fmt(o.mrrPotential), 'se os trials converterem', 'slate')}
        {kpi('Churn (30d)', o.churn30d ?? 0, 'suspensos/arquivados', 'rose')}
        {kpi('Inadimplentes', o.overdueCount ?? overdue.length, 'pagamento atrasado', 'amber')}
      </div>

      <SettingsCard title="Inadimplentes" hint="Marcados como pagamento atrasado" icon={<AlertCircle size={16} />}>
        {overdue.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-8">Ninguém em atraso 🎉</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {overdue.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{t.displayName}</div>
                  <div className="text-[11.5px] text-slate-500 num">{fmt(t.price)}/mês · {t.id}</div>
                </div>
                <button disabled={!!busy} onClick={() => onPatch(t.id, { paymentStatus: 'paid', lastPaymentAt: Date.now() }, 'Pagamento marcado como pago.', 'pay')}
                  className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 disabled:opacity-50 transition whitespace-nowrap">Marcar pago</button>
                {t.status !== 'suspended' && (
                  <button disabled={!!busy} onClick={() => onPatch(t.id, { status: 'suspended' }, 'Organização suspensa.', 'status')}
                    className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 disabled:opacity-50 transition whitespace-nowrap">Suspender</button>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Próximos vencimentos" hint="Cobranças nos próximos 30 dias" icon={<Calendar size={16} />}>
        {upcoming.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-8">Nenhum vencimento nos próximos 30 dias.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {upcoming.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-1 py-2.5">
                <div className="min-w-0 flex-1 text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{u.displayName}</div>
                <span className="text-[11.5px] num text-slate-500">{new Date(u.nextBillingAt).toLocaleDateString('pt-BR')}</span>
                <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${u.daysLeft <= 3 ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}>{u.daysLeft <= 0 ? 'hoje' : `${u.daysLeft}d`}</span>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Receita por plano" hint="Clientes ativos — estimativa pelo plano/valor negociado" icon={<TrendingUp size={16} />}>
        {planRows.length === 0 ? (
          <div className="text-center text-[12.5px] text-slate-400 italic py-8">Sem receita registrada ainda.</div>
        ) : (
          <div className="space-y-2.5">
            {planRows.map(([plan, rev]) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 w-28 truncate">{planLabel(plan)}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.round((rev / maxRev) * 100)}%` }} />
                </div>
                <span className="num text-[12px] font-semibold text-slate-700 dark:text-slate-200 w-24 text-right">{fmt(rev)}</span>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
export { SuperFinanceTab };
