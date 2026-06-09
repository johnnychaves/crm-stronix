import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Building2, DollarSign, Layers, TrendingUp, Users } from 'lucide-react';
import { fmtBRL, fmtNum } from '../../lib/format.js';
import { planLabel } from '../../lib/superadmin.js';
import { Sparkline } from '../../components/charts/Sparkline.jsx';
import { AreaChart } from '../../components/charts/AreaChart.jsx';
import { Donut } from '../../components/charts/Donut.jsx';

const CARD = 'rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-card';
const PLAN_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];

// Variação % vs período anterior; null quando não dá pra comparar (base zero).
const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

function Trend({ pct }) {
  if (pct == null || !Number.isFinite(pct) || Math.abs(pct) < 0.5) return null;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md num ${up ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' : 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10'}`}>
      <Icon size={11} />{up ? '+' : ''}{Math.round(pct)}%
    </span>
  );
}

function Kpi({ icon, label, value, sub, pct, spark, tone, danger }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 min-w-0">
          <span className="text-brand-600 dark:text-brand-400 shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <Trend pct={pct} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={`num text-[24px] font-bold tracking-tight leading-none ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{value}</div>
        {spark && spark.length > 1 && <div className={`w-[82px] h-7 shrink-0 ${tone}`}><Sparkline data={spark} /></div>}
      </div>
      <div className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-1.5 num truncate">{sub}</div>
    </div>
  );
}

function SuperOverviewCards({ overview }) {
  if (!overview) return null;
  const active = overview.active || 0;
  const arpu = active > 0 ? Math.round(overview.mrr / active) : 0;

  const series = Array.isArray(overview.mrrByMonth) ? overview.mrrByMonth : [];
  const last = series[series.length - 1] || {};
  const prev = series[series.length - 2] || {};
  const mrrSpark = series.map((m) => m.mrr || 0);
  const activeSpark = series.map((m) => m.active || 0);
  const ticketSpark = series.map((m) => (m.active > 0 ? Math.round(m.mrr / m.active) : 0));
  const mrrPct = pctChange(last.mrr, prev.mrr);
  const activePct = pctChange(last.active, prev.active);
  const ticketPct = pctChange(last.active > 0 ? last.mrr / last.active : 0, prev.active > 0 ? prev.mrr / prev.active : 0);

  // Donut por plano (contagem de orgs).
  const byPlan = overview.byPlan || {};
  const planEntries = Object.entries(byPlan).sort((a, b) => b[1] - a[1]);
  const planTotal = planEntries.reduce((s, [, n]) => s + n, 0);
  const segments = planEntries.map(([slug, n], i) => ({ label: planLabel(slug), value: n, color: PLAN_COLORS[i % PLAN_COLORS.length] }));

  const months = overview.newByMonth || [];
  const maxMonth = Math.max(1, ...months.map((m) => m.count));
  const newTotal = months.reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-3">
      {/* KPIs com tendência + sparkline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp size={15} />} label="MRR estimado" value={fmtBRL(overview.mrr)} sub="receita recorrente/mês" pct={mrrPct} spark={mrrSpark} tone="text-brand-500 dark:text-brand-400" />
        <Kpi icon={<Building2 size={15} />} label="Clientes ativos" value={fmtNum(active)} sub={`${overview.trial || 0} em trial · ${overview.suspended || 0} susp.`} pct={activePct} spark={activeSpark} tone="text-emerald-500 dark:text-emerald-400" />
        <Kpi icon={<DollarSign size={15} />} label="Ticket médio" value={fmtBRL(arpu)} sub="por cliente ativo" pct={ticketPct} spark={ticketSpark} tone="text-violet-500 dark:text-violet-400" />
        <Kpi icon={<AlertCircle size={15} />} label="Clientes em risco" value={fmtNum(overview.atRisk || 0)} sub="sem uso há 14+ dias" danger={overview.atRisk > 0} />
      </div>

      {/* MRR no tempo + distribuição por plano */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${CARD} p-4 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              <TrendingUp size={15} className="text-brand-600 dark:text-brand-400" /> Evolução do MRR
              <span className="text-[10.5px] font-normal text-slate-400">estimado</span>
            </div>
            <span className="num text-[13px] font-bold text-slate-900 dark:text-white">{fmtBRL(overview.mrr)}</span>
          </div>
          <div className="mt-3">
            <AreaChart data={series.map((m) => ({ label: m.label, value: m.mrr }))} fmt={(v) => fmtBRL(v)} />
          </div>
        </div>

        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
            <Layers size={15} className="text-brand-600 dark:text-brand-400" /> Clientes por plano
          </div>
          {planTotal > 0 ? (
            <div className="mt-2 flex flex-col items-center">
              <Donut segments={segments} centerTop={planTotal} centerBottom="orgs" />
              <div className="mt-3 w-full space-y-1.5">
                {segments.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                    <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{s.label}</span>
                    <span className="num text-slate-500 dark:text-slate-400">{s.value}</span>
                    <span className="num text-slate-400 w-9 text-right">{Math.round((s.value / planTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid place-items-center h-44 text-[12px] text-slate-400 italic">Sem clientes em plano ainda.</div>
          )}
        </div>
      </div>

      {/* Novas organizações + plataforma */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${CARD} p-4 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              <BarChart3 size={15} className="text-brand-600 dark:text-brand-400" /> Novas organizações
            </div>
            <span className="text-[10.5px] text-slate-400 num">{newTotal} em 6 meses</span>
          </div>
          <div className="mt-4 flex items-end gap-2 h-24">
            {months.map((m) => (
              <div key={m.ym} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 group" title={`${m.label}: ${m.count}`}>
                <span className="num text-[10px] font-semibold text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">{m.count || ''}</span>
                <div className="w-full max-w-[34px] rounded-md bg-gradient-to-t from-brand-500/60 to-brand-500 dark:from-brand-500/40 dark:to-brand-400 group-hover:from-brand-500 group-hover:to-brand-400 transition-all"
                  style={{ height: `${Math.max(m.count ? 8 : 3, (m.count / maxMonth) * 100)}%` }} />
                <span className="text-[10px] text-slate-400 capitalize">{m.label.replace('.', '')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${CARD} p-4`}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
            <Users size={15} className="text-brand-600 dark:text-brand-400" /> Plataforma
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-white/[0.06] px-3 py-2.5">
              <span className="text-[12px] text-slate-500 dark:text-slate-400">Leads</span>
              <span className="num text-[18px] font-bold text-slate-900 dark:text-white">{fmtNum(overview.leadsTotal || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-white/[0.06] px-3 py-2.5">
              <span className="text-[12px] text-slate-500 dark:text-slate-400">Usuários</span>
              <span className="num text-[18px] font-bold text-slate-900 dark:text-white">{fmtNum(overview.usersTotal || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SuperOverviewCards };
