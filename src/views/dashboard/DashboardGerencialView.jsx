// Tela GERENCIAL (Visão geral · Gerencial) — análise de período no layout v2
// aprovado (Gerencial ENXUTO, Johnny 2026-07-10): hero + 4 KPIs em cards,
// cards GÊMEOS de conversão por consultor e por professor (com a conversão
// geral e o comparecimento geral na faixa do topo — saíram o card de funil e
// os dois anéis), desempenho da equipe repaginado (só atividade) e a linha de
// baixo com Motivos de perda + Canais + Aulas por modalidade. Toda a
// matemática vem de lib/dashboardMetrics.js.

import { useState, useMemo } from 'react';
import { Dumbbell, Kanban, Megaphone, TrendingDown } from 'lucide-react';
import { isAdminUser } from '../../lib/leads.js';
import { LEADS_PATH } from '../../lib/firebase.js';
import { useAdminDashboardLeads } from '../../hooks/useAdminDashboardLeads.js';
import { getDefaultFunnel, isItemInFunnel, isAllFunnels } from '../../lib/funnels.js';
import {
  buildPeriodRange,
  buildPreviousRange,
  computeAdminDashboardSpan,
  computeCapturedLeads,
  computeScheduledLeads,
  computeConvertedLeads,
  computeDashboardStats,
  computeAttendance,
  computeTeamMetrics,
  computeFunnelRowMetrics,
  computeFunnelComparisonTotals,
  computeDeltas,
  computeSparklines,
  computeSourceMetrics,
  computeAulasPorModalidade,
  computeProfessorConversion,
  computeLossReasons
} from '../../lib/dashboardMetrics.js';
import { cn } from '../../lib/utils.js';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { FunnelSelector } from '../../components/ui/FunnelSelector.jsx';
import {
  ConversionCard,
  BreakdownCard,
  DashCard,
  DashKpiCard,
  DashPeriodTabs
} from './DashPrimitives.jsx';
import { dashInitials } from './dashTokens.js';
import { useTeamGoals } from './useTeamGoals.js';

// ---- Desempenho da equipe (te- do mockup): só atividade e execução ---------
function TeamActivityCard({ rows, goals, totalLeads }) {
  const maxLeads = Math.max(...rows.map((r) => r.total), 1);
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card p-5">
      <div className="flex items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] font-bold tracking-tight">Desempenho da equipe</h3>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Atividade e execução no período · a conversão fica nos cards de cima</p>
        </div>
        <span className="shrink-0 text-[11.5px] font-semibold text-muted-foreground bg-paper-50 border border-slate-100 dark:bg-white/[0.03] dark:border-white/[0.06] px-3 py-1.5 rounded-full whitespace-nowrap num">
          {rows.length} {rows.length === 1 ? 'consultor' : 'consultores'} · {totalLeads} {totalLeads === 1 ? 'lead' : 'leads'}
        </span>
      </div>
      <div className="overflow-x-auto thin-scroll">
        <ul className="min-w-[640px]">
          {rows.map((r) => {
            const g = goals?.[r.consultantId] || null;
            return (
              <li key={r.consultantId} className="flex items-center gap-4 py-4 border-t border-slate-100 dark:border-white/[0.05]">
                <span className="shrink-0 size-11 rounded-[13px] bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 font-display text-[15px] font-bold flex items-center justify-center tracking-wide">
                  {dashInitials(r.name)}
                </span>
                <div className="shrink-0 w-44 min-w-0">
                  <div className="text-[14.5px] font-semibold truncate">{r.name}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 num">
                    <b className="font-display text-[15px] font-bold text-foreground">{r.total}</b> {r.total === 1 ? 'lead captado' : 'leads captados'}
                  </div>
                  <div className="h-[5px] rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-1.5 max-w-[150px]">
                    <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${Math.round((r.total / maxLeads) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-[64px_64px_1fr_1fr] gap-4 items-start">
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Visitas</div>
                    <div className={cn('font-display text-[19px] font-bold mt-1 num', r.agendadosVisita === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-foreground')}>
                      {r.agendadosVisita}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Aulas exp.</div>
                    <div className={cn('font-display text-[19px] font-bold mt-1 num', r.agendadosAula === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-foreground')}>
                      {r.agendadosAula}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Meta diária</div>
                    {g && g.goalTotal > 0 ? (
                      <>
                        <div className="text-[13px] mt-1 num">
                          <b className="font-display font-bold">{g.goalDone}</b> de {g.goalTotal}
                          {g.monthDays > 0 && <span className="text-slate-400 dark:text-slate-500 text-[11px]"> · mês {g.monthHits}/{g.monthDays}</span>}
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-1.5 max-w-[120px]">
                          <div className="h-full rounded-full bg-brand-600 dark:bg-brand-500" style={{ width: `${Math.min(100, Math.round((g.goalDone / g.goalTotal) * 100))}%` }} />
                        </div>
                      </>
                    ) : (
                      <div className="text-[12px] text-muted-foreground mt-1" title="Sem tarefas na meta de hoje">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Prospecção</div>
                    {g && g.volTarget > 0 ? (
                      <>
                        <div className="text-[13px] mt-1 num">
                          <b className="font-display font-bold">{g.volTotal}</b> de {g.volTarget}
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]"> · mês {g.monthVol}/{g.monthVolTarget}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-1.5 max-w-[120px]">
                          <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.min(100, Math.round((g.volTotal / g.volTarget) * 100))}%` }} />
                        </div>
                      </>
                    ) : (
                      <div className="text-[12px] text-muted-foreground mt-1" title="Meta de prospecção desligada para este usuário">—</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function DashboardGerencialView({ leads, interactions, appUser, usersList, db, funnels, selectedFunnelId, setSelectedFunnelId, onNavigate }) {
  const [periodPreset, setPeriodPreset] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const isAdmin = isAdminUser(appUser);

  const defaultFunnelId = useMemo(() => getDefaultFunnel(funnels)?.id || null, [funnels]);
  const hasFunnels = (funnels || []).length > 0;

  // Toda a matemática vive em lib/dashboardMetrics.js (fonte única, testada).
  // Aqui só orquestração de memos + UI. Período + período anterior (deltas)
  // vêm ANTES da fonte de leads porque o span da query admin depende deles.
  const periodRange = useMemo(
    () => buildPeriodRange(periodPreset, { customStart: customStartDate, customEnd: customEndDate }),
    [periodPreset, customStartDate, customEndDate]
  );
  const previousRange = useMemo(
    () => buildPreviousRange(periodPreset, periodRange),
    [periodPreset, periodRange]
  );

  // Fonte das MÉTRICAS DE PERÍODO:
  //   • admin    → união de janelas de campo (createdAt/convertedAt/
  //                appointmentScheduledFor/lostAt) sobre o span período+anterior+
  //                sparkline, por query própria (G1c) — não agrega mais o prop
  //                global. Não é ao vivo: rebusca ao trocar o período.
  //   • consultor → o prop `leads` (o E2a já entrega os PRÓPRIOS leads por query).
  // A Meta diária por consultor (useTeamGoals) NÃO usa a janela de período: segue
  // lendo a base CRUA `leads` (categorias sem janela, ex.: follow-up atrasado) —
  // migra no G1d.
  const dashSpan = useMemo(
    () => computeAdminDashboardSpan(periodRange, previousRange),
    [periodRange, previousRange]
  );
  const { leads: adminWindowLeads } = useAdminDashboardLeads({
    db,
    path: LEADS_PATH,
    startMs: isAdmin && dashSpan ? dashSpan.startMs : null,
    endMs: isAdmin && dashSpan ? dashSpan.endMs : null,
    enabled: isAdmin,
  });
  const periodMetricsLeads = useMemo(
    () => (isAdmin ? adminWindowLeads : (leads || [])),
    [isAdmin, adminWindowLeads, leads]
  );

  const funnelLeads = useMemo(() => {
    if (isAllFunnels(selectedFunnelId)) return periodMetricsLeads || [];
    return (periodMetricsLeads || []).filter(l => isItemInFunnel(l, selectedFunnelId, defaultFunnelId));
  }, [periodMetricsLeads, selectedFunnelId, defaultFunnelId]);

  const capturedLeads = useMemo(() => computeCapturedLeads(funnelLeads, periodRange), [funnelLeads, periodRange]);
  const scheduledLeads = useMemo(() => computeScheduledLeads(funnelLeads, periodRange), [funnelLeads, periodRange]);
  const convertedLeads = useMemo(() => computeConvertedLeads(funnelLeads, periodRange), [funnelLeads, periodRange]);

  const stats = useMemo(
    () => computeDashboardStats({ capturedLeads, scheduledLeads, convertedLeads }),
    [capturedLeads, scheduledLeads, convertedLeads]
  );

  const teamMetrics = useMemo(
    () => computeTeamMetrics({ capturedLeads, scheduledLeads, convertedLeads }),
    [capturedLeads, scheduledLeads, convertedLeads]
  );

  // Meta de HOJE por consultor: usa a base CRUA `leads` (não a janela de
  // período) de propósito — categorias sem janela (follow-up atrasado, etc.).
  // Segue no prop global até o G1d migrar a fonte da Meta.
  const goalByConsultant = useTeamGoals({ db, appUser, usersList, leads, interactions });

  // Taxa de comparecimento (módulo): só agendamentos cuja data já passou.
  const { compareceram, apptPassados } = useMemo(
    () => computeAttendance({ scheduledLeads }),
    [scheduledLeads]
  );
  const taxaComp = apptPassados > 0 ? Math.round((compareceram / apptPassados) * 100) : 0;

  const sparklines = useMemo(
    () => computeSparklines({ leads: funnelLeads, range: periodRange }),
    [funnelLeads, periodRange]
  );

  const deltas = useMemo(
    () => computeDeltas({ leads: funnelLeads, range: periodRange, previousRange }),
    [funnelLeads, periodRange, previousRange]
  );

  const comparisonLabel = previousRange?.partial
    ? 'vs. mesmo ponto do período anterior'
    : 'vs. período anterior';

  const sourceMetrics = useMemo(() => computeSourceMetrics(capturedLeads), [capturedLeads]);
  const aulasPorModalidade = useMemo(() => computeAulasPorModalidade(scheduledLeads), [scheduledLeads]);
  const lossReasons = useMemo(() => computeLossReasons(funnelLeads, periodRange), [funnelLeads, periodRange]);

  // Conversão por professor: respeita o PERÍODO selecionado (as datas do
  // Gerencial mexem em todos os resultados), mas NÃO o funil — olha todas as
  // aulas experimentais da academia (decisão do Johnny, 2026-07-12: professor
  // não é recorte de funil). Filtra pela data da aula dentro do período, só
  // aulas já realizadas.
  const professorConv = useMemo(() => computeProfessorConversion(periodMetricsLeads, { range: periodRange }), [periodMetricsLeads, periodRange]);

  // --- TABELA "MÉTRICAS POR FUNIL" (modo Todos os funis) ---
  const funnelComparisonRows = useMemo(() => {
    if (!isAllFunnels(selectedFunnelId)) return [];
    if (!Array.isArray(funnels) || funnels.length === 0) return [];
    const rows = funnels.map(funnel => {
      const scope = (periodMetricsLeads || []).filter(l => isItemInFunnel(l, funnel.id, defaultFunnelId));
      return { funnel, ...computeFunnelRowMetrics(scope, periodRange) };
    });
    rows.sort((a, b) => {
      if (b.converted !== a.converted) return b.converted - a.converted;
      if (b.captured !== a.captured) return b.captured - a.captured;
      return (a.funnel.order || 0) - (b.funnel.order || 0);
    });
    return rows;
  }, [selectedFunnelId, periodMetricsLeads, funnels, defaultFunnelId, periodRange]);

  const funnelComparisonTotals = useMemo(
    () => computeFunnelComparisonTotals(funnelComparisonRows),
    [funnelComparisonRows]
  );

  const periodLabel = useMemo(() => {
    if (!periodRange) return '—';
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const sameDay = periodRange.start.toDateString() === periodRange.end.toDateString();
    if (sameDay) return periodRange.start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    return `${fmt(periodRange.start)} – ${fmt(periodRange.end)}`;
  }, [periodRange]);

  // ---- Linhas do card "Conversão por consultor" (cf-) ----
  const consultorRows = useMemo(() => {
    const sorted = [...teamMetrics].sort((a, b) => {
      const ca = a.txConversaoGlobal == null ? -1 : a.txConversaoGlobal;
      const cb = b.txConversaoGlobal == null ? -1 : b.txConversaoGlobal;
      return cb - ca || b.total - a.total;
    });
    const maxTotal = Math.max(...sorted.map(m => m.total), 1);
    return sorted.map((m, i) => {
      const emJogo = Math.max(0, m.total - m.coorteConvertidos - (m.coortePerdidos || 0));
      const diff = m.txConversaoGlobal != null ? m.txConversaoGlobal - stats.txConv : null;
      return {
        key: m.consultantId,
        rank: i + 1,
        initials: dashInitials(m.name),
        name: m.name,
        hot: i === 0 && (m.txConversaoGlobal || 0) > 0,
        barScale: m.total / maxTotal,
        trackTitle: `${m.coorteConvertidos} dos ${m.total} captados já ${m.coorteConvertidos === 1 ? 'virou' : 'viraram'} matrícula. ${emJogo} ${emJogo === 1 ? 'segue' : 'seguem'} em jogo, ${m.coortePerdidos || 0} ${(m.coortePerdidos || 0) === 1 ? 'perdido' : 'perdidos'}.`,
        segments: m.total > 0 ? [
          { tone: 'accent', frac: m.coorteConvertidos / m.total },
          { tone: 'brand', frac: emJogo / m.total },
          { tone: 'slate', frac: (m.coortePerdidos || 0) / m.total }
        ] : [],
        stats: `${m.total} ${m.total === 1 ? 'captado' : 'captados'} · ${emJogo} em jogo · ${m.coorteConvertidos} ${m.coorteConvertidos === 1 ? 'matrícula' : 'matrículas'}`,
        pct: m.txConversaoGlobal == null ? '—' : `${m.txConversaoGlobal}%`,
        zero: (m.txConversaoGlobal || 0) === 0,
        den: `${m.coorteConvertidos} de ${m.total}`,
        delta: diff != null ? `${diff >= 0 ? '+' : ''}${diff} vs. média` : null
      };
    });
  }, [teamMetrics, stats.txConv]);

  // ---- Linhas do card "Conversão por professor" (pf-) ----
  const { professorRows, professorReference } = useMemo(() => {
    const all = professorConv.solo ? [...professorConv.rows, professorConv.solo] : professorConv.rows;
    const maxAulas = Math.max(...all.map(r => r.aulas), 1);
    const toRow = (r, i) => ({
      key: r.professorId || 'solo',
      rank: i + 1,
      reference: r.isSolo,
      muted: r.isSolo,
      initials: dashInitials(r.name),
      name: r.name,
      hot: !r.isSolo && i === 0 && (r.convPct || 0) > 0,
      tags: [
        ...(r.isSolo ? ['sem professor'] : []),
        ...(r.basePequena ? ['base pequena'] : [])
      ],
      barScale: r.aulas / maxAulas,
      trackTitle: `${r.matriculas} ${r.matriculas === 1 ? 'da' : 'das'} ${r.compareceram} que compareceram ${r.matriculas === 1 ? 'virou' : 'viraram'} matrícula. ${r.aulas - r.compareceram} ${r.aulas - r.compareceram === 1 ? 'faltou' : 'faltaram'}.`,
      segments: r.aulas > 0 ? [
        { tone: 'accent', frac: r.matriculas / r.aulas },
        { tone: 'brand', frac: (r.compareceram - r.matriculas) / r.aulas },
        { tone: 'slate', frac: (r.aulas - r.compareceram) / r.aulas }
      ] : [],
      stats: `${r.aulas} ${r.aulas === 1 ? 'aula' : 'aulas'} · ${r.compareceram} compareceram · ${r.matriculas} ${r.matriculas === 1 ? 'matrícula' : 'matrículas'}`,
      pct: r.convPct == null ? '—' : `${r.convPct}%`,
      zero: (r.convPct || 0) === 0,
      den: `${r.matriculas} de ${r.compareceram}`,
      delta: !r.isSolo && r.deltaVsSolo != null ? `${r.deltaVsSolo >= 0 ? '+' : ''}${r.deltaVsSolo} vs. sem prof` : null,
      refLabel: r.isSolo ? 'base' : null
    });
    return {
      professorRows: professorConv.rows.map(toRow),
      professorReference: professorConv.solo ? toRow(professorConv.solo, 0) : null
    };
  }, [professorConv]);

  const lossLeader = lossReasons.rows[0] || null;
  const sourceLeader = sourceMetrics[0] || null;
  const modalidadeLeader = aulasPorModalidade[0] || null;
  const totalAulasModalidade = aulasPorModalidade.reduce((s, x) => s + x.count, 0);
  const sourceLeaderPct = sourceLeader && stats.total > 0 ? Math.round((sourceLeader.count / stats.total) * 100) : 0;
  const lossLeaderPct = lossLeader && lossReasons.total > 0 ? Math.round((lossLeader.count / lossReasons.total) * 100) : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4 animate-fade-in font-sans">
        {/* ---- Hero ---- */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dashboard · Gerencial
            </div>
            <h2 className="mt-1 font-display text-[26px] font-semibold tracking-tight leading-tight">
              Panorama do período <span className="text-slate-500 dark:text-slate-400 font-medium">· {periodLabel}</span>
            </h2>
            <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400 num">
              <b className="font-semibold text-slate-700 dark:text-slate-200">{stats.total}</b> {stats.total === 1 ? 'lead' : 'leads'} · conversão geral{' '}
              <b className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.txConv}%</b> · comparecimento{' '}
              <b className="font-semibold text-slate-700 dark:text-slate-200">{taxaComp}%</b>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {hasFunnels && (
              <FunnelSelector
                funnels={funnels}
                value={selectedFunnelId}
                onChange={setSelectedFunnelId}
                allowAll={true}
                className="w-full sm:w-[220px]"
              />
            )}
            <DashPeriodTabs value={periodPreset} onChange={setPeriodPreset} />
          </div>
        </section>

        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-card">
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Período personalizado</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[13px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <span className="text-slate-400 text-[12.5px] font-medium">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[13px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            {!periodRange && (
              <span className="text-[11.5px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                Preencha início e fim para ver os resultados.
              </span>
            )}
          </div>
        )}

        {/* ---- KPIs ---- */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <DashKpiCard
            label="Leads captados"
            value={stats.total}
            delta={deltas.leads}
            accent="brand"
            series={sparklines.leads}
            sub={comparisonLabel}
            help="Leads novos que chegaram no período, contados pelo dia em que foram cadastrados. A seta compara com o mesmo trecho já decorrido do período anterior. O gráfico mostra a evolução dia a dia."
          />
          <DashKpiCard
            label="Visitas agendadas"
            value={stats.agendadosVisita}
            delta={deltas.visitas}
            accent="amber"
            series={sparklines.visitas}
            sub={`${stats.visitasRealizadas} ${stats.visitasRealizadas === 1 ? 'realizada' : 'realizadas'} · ${stats.visitasFuturas} ${stats.visitasFuturas === 1 ? 'futura' : 'futuras'}`}
            help="Visitas com data marcada dentro do período, mesmo de leads que chegaram antes. Realizadas são as que a data já passou; futuras ainda vão acontecer."
          />
          <DashKpiCard
            label="Aulas experimentais"
            value={stats.agendadosAula}
            delta={deltas.aulas}
            accent="violet"
            series={sparklines.aulas}
            sub={`${stats.aulasRealizadas} ${stats.aulasRealizadas === 1 ? 'realizada' : 'realizadas'} · ${stats.aulasFuturas} ${stats.aulasFuturas === 1 ? 'futura' : 'futuras'}`}
            help="Aulas experimentais com data marcada dentro do período, mesmo de leads que chegaram antes. Realizadas são as que a data já passou; futuras ainda vão acontecer."
          />
          <DashKpiCard
            label="Matrículas no período"
            value={stats.convertidos}
            delta={deltas.matriculas}
            accent="emerald"
            series={sparklines.matriculas}
            sub={`${stats.convertidosDaSafra} de leads do período · ${stats.convertidosAntigos} de leads antigos`}
            help="Contratos fechados dentro do período, mesmo de leads que chegaram antes — é o número que casa com o caixa. O aproveitamento dos leads novos é a 'Conversão geral' no card de conversão por consultor."
          />
        </div>

        {/* ---- Conversão por consultor (admin) ---- */}
        {isAdmin && (
          <ConversionCard
            title="Conversão por consultor"
            subtitle="Leads captados que viraram matrícula"
            windowLabel="No período"
            general={[
              { label: 'Conversão geral', value: `${stats.txConv}%`, accent: true, den: `${stats.coorteConvertidos} de ${stats.total} leads captados` },
              { label: 'Comparecimento geral', value: `${taxaComp}%`, den: `${compareceram} de ${apptPassados} visitas e aulas já realizadas` }
            ]}
            sectionLabel="Resultado por consultor"
            legend={[
              { label: 'Matrícula', tone: 'accent' },
              { label: 'Em jogo', tone: 'brand' },
              { label: 'Perdido', tone: 'slate' }
            ]}
            rows={consultorRows}
            footnote="Conversão = matrículas ÷ leads que o consultor captou no período (a safra do período). A conversão geral no topo é a média da equipe; o comparecimento geral vale para toda a academia."
            emptyText="Sem leads captados no período."
          />
        )}

        {/* ---- Conversão por professor ---- */}
        <ConversionCard
          title="Conversão por professor"
          subtitle="Aula experimental que virou matrícula"
          windowLabel="No período"
          general={[
            { label: 'Conversão geral', value: professorConv.totals.convPct == null ? '—' : `${professorConv.totals.convPct}%`, accent: true, den: `${professorConv.totals.matriculas} de ${professorConv.totals.compareceram} que compareceram` },
            { label: 'Comparecimento das aulas', value: professorConv.totals.attendancePct == null ? '—' : `${professorConv.totals.attendancePct}%`, den: `${professorConv.totals.compareceram} de ${professorConv.totals.aulas} aulas marcadas` }
          ]}
          sectionLabel="Resultado por professor"
          legend={[
            { label: 'Matrícula', tone: 'accent' },
            { label: 'Compareceu, não fechou', tone: 'brand' },
            { label: 'Faltou', tone: 'slate' }
          ]}
          rows={professorRows}
          reference={professorReference}
          referenceLabel="Sem professor · referência"
          footnote="Todas as aulas experimentais da academia no período, independente do funil selecionado — só entram aulas cuja data já passou. Atribuição pelo professor do último agendamento de cada lead, então é aproximada. Conversão = matrículas ÷ quem compareceu."
          emptyText="Nenhuma aula experimental realizada no período."
        />

        {/* ---- Desempenho da equipe (admin) ---- */}
        {isAdmin && teamMetrics.length > 0 && (
          <TeamActivityCard rows={teamMetrics} goals={goalByConsultant} totalLeads={stats.total} />
        )}

        {/* ---- Métricas por funil (modo Todos os funis) ---- */}
        {isAdmin && isAllFunnels(selectedFunnelId) && funnels.length > 1 && (
          <DashCard
            title="Métricas por funil"
            hint="Comparativo no período selecionado"
            icon={<Kanban size={14} />}
            padded={false}
          >
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-left min-w-[640px]">
                <thead>
                  <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="py-2.5 pl-5 pr-3 font-semibold">Funil</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Leads</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Visitas</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Aulas</th>
                    <th className="py-2.5 px-3 font-semibold text-center" title="Matrículas fechadas no período, de qualquer safra">Matr.</th>
                    <th className="py-2.5 pr-5 pl-3 font-semibold text-right" title="Dos leads captados no período neste funil, % que já virou matrícula">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelComparisonRows.map((row) => {
                    const rateTone = row.rate >= 20 ? 'text-emerald-600 dark:text-emerald-400' : row.rate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
                    return (
                      <tr key={row.funnel.id} className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition">
                        <td className="py-3 pl-5 pr-3">
                          <button
                            type="button"
                            onClick={() => setSelectedFunnelId(row.funnel.id)}
                            className="text-[13px] font-semibold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition flex items-center gap-1.5 text-left whitespace-nowrap"
                            title={`Ver o Gerencial apenas do funil ${row.funnel.name}`}
                          >
                            {row.funnel.name}
                            {row.funnel.isDefault && (
                              <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Padrão</span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.captured}</td>
                        <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.visits}</td>
                        <td className="py-3 px-3 num text-[13px] text-center text-slate-700 dark:text-slate-200">{row.classes}</td>
                        <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{row.converted}</td>
                        <td className={cn('py-3 pr-5 pl-3 num text-[13px] text-right font-semibold', rateTone)}>{row.rate}%</td>
                      </tr>
                    );
                  })}
                  {funnelComparisonRows.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-[12px] text-slate-400 italic">Sem dados no período</td>
                    </tr>
                  )}
                </tbody>
                {funnelComparisonTotals && funnelComparisonRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td className="py-3 pl-5 pr-3 text-[12px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Total</td>
                      <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.captured}</td>
                      <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.visits}</td>
                      <td className="py-3 px-3 num text-[13px] text-center font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.classes}</td>
                      <td className="py-3 px-3 num text-[13px] text-center font-semibold text-emerald-600 dark:text-emerald-400">{funnelComparisonTotals.converted}</td>
                      <td className="py-3 pr-5 pl-3 num text-[13px] text-right font-semibold text-slate-900 dark:text-white">{funnelComparisonTotals.rate}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </DashCard>
        )}

        {/* ---- Linha de baixo: perda · canais · modalidade ---- */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          <BreakdownCard
            icon={TrendingDown}
            title="Motivos de perda"
            sub={`${lossReasons.total} no período`}
            help="Agrupamos os leads perdidos no período pelo motivo registrado. Quem foi perdido sem motivo entra em Sem motivo."
            eyebrow="Principal motivo"
            items={lossReasons.rows}
            total={lossReasons.total}
            footText={lossLeader ? (
              lossLeaderPct >= 60
                ? `${lossLeader.name} concentra a maior parte das saídas.`
                : lossLeaderPct >= 40
                  ? `${lossLeader.name} puxa quase metade das saídas.`
                  : `${lossLeader.name} lidera as perdas do período.`
            ) : null}
            ctaLabel="Ver leads perdidos"
            onCta={onNavigate ? () => onNavigate('leads') : null}
            emptyText="Nenhuma perda registrada no período."
          />
          <BreakdownCard
            icon={Megaphone}
            title="Canais de aquisição"
            sub={`${stats.total} ${stats.total === 1 ? 'lead' : 'leads'} no período`}
            help="Leads captados no período agrupados pela origem registrada no cadastro."
            eyebrow="Principal canal"
            items={sourceMetrics}
            total={stats.total}
            footText={sourceLeader ? (sourceLeaderPct >= 30 ? `${Math.round(sourceLeaderPct / 10)} de cada 10 leads vêm de ${sourceLeader.name}.` : `${sourceLeader.name} lidera a captação do período.`) : null}
            emptyText="Nenhum lead captado no período."
          />
          <BreakdownCard
            icon={Dumbbell}
            title="Aulas por modalidade"
            sub={`${totalAulasModalidade} ${totalAulasModalidade === 1 ? 'aula' : 'aulas'} no período`}
            help="Aulas experimentais agendadas no período, agrupadas por modalidade."
            eyebrow="Modalidade líder"
            items={aulasPorModalidade}
            total={totalAulasModalidade}
            footText={modalidadeLeader ? `${modalidadeLeader.name} puxa a procura no período.` : null}
            ctaLabel="Abrir agenda"
            onCta={onNavigate ? () => onNavigate('aulas') : null}
            emptyText="Nenhuma aula experimental no período."
          />
        </div>

        <footer className="pt-1 pb-2 text-center text-[11.5px] text-slate-400 whitespace-nowrap">
          Atualizado agora · Período: {periodLabel}
        </footer>
      </div>
    </TooltipProvider>
  );
}

export { DashboardGerencialView };
