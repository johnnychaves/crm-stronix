import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import {
  buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeRitmo,
  overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS, dgDateKey,
  computeDailyVolume, volumeTargetFor, volumeBreakdownLabel,
} from '../lib/dailyGoal.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { cn } from '../lib/utils.js';
import { Check, CheckCircle2, Flame, Shield, Target, TrendingUp, Zap } from 'lucide-react';

// ============================================================================
// PAINEL DA EQUIPE — versão "tabela executiva" com DUAS metas do dia:
//   • META DIÁRIA → tarefas de hoje (computeDailyGoalSlots). "Batida" a 100%.
//   • PROSPECÇÃO  → cota DIÁRIA de AÇÕES, REUSANDO o modelo da #111:
//       computeDailyVolume = agendamentos (interações com volumeKind: visita/
//       aula/mensagem/ligação) + lead novo + fechamento (venda/perda do dia).
//       Concluir tarefa SEM uma dessas ações NÃO conta (daily_goal_done puro).
//       Alvo por consultor = volumeTargetFor (dailyVolumeTarget › default da
//       academia, já em Configurações Gerais). Gestor → 0 → fora da régua.
//   + gráfico de TRAJETÓRIA DO MÊS (metas batidas/dia + prospecção batida/dia,
//     ambos DADO REAL do histórico, que já grava date + volumeCount/volumeTarget).
//   • "Dia perfeito" ⚡ = zerou pendências da meta E bateu a prospecção.
//   • Prospecção NÃO trava o "dia batido" (metas independentes).
// LEITURA apenas (Meta-only): concluir é ato do consultor.
// ============================================================================

function MetaDiariaCell({ row }) {
  if (row.totalSlots === 0) return <span className="text-[11px] text-slate-400">sem tarefas</span>;
  if (row.progress === 100) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 size={12} /> Batida</span>
  );
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden min-w-[54px]">
        <div className={cn('h-full rounded-full', row.critical > 0 ? 'bg-rose-500' : 'bg-brand-600')} style={{ width: `${row.progress}%` }} />
      </div>
      <span className="num text-[11.5px] font-bold text-slate-600 dark:text-slate-300 w-9 text-right">{row.doneSlots}/{row.totalSlots}</span>
    </div>
  );
}

function MetaProspCell({ done, target, breakdown }) {
  if (!target) return <span className="text-[11px] text-slate-400">sem alvo</span>;
  const pct = Math.min(100, Math.round((done / target) * 100));
  const hit = done >= target;
  return (
    <div className="flex items-center gap-2" title={breakdown ? `Prospecção de hoje: ${volumeBreakdownLabel(breakdown)}` : undefined}>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden min-w-[54px]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hit ? '#10b981' : '#FF6A2B' }} />
      </div>
      <span className={cn('num text-[11.5px] font-bold w-12 text-right', hit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300')}>{done}/{target}</span>
      {hit && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
    </div>
  );
}

function PerfectPill() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md text-white whitespace-nowrap" style={{ background: 'linear-gradient(90deg,#FF6A2B,#F5B23D)' }}>
      <Zap size={11} /> Dia perfeito
    </span>
  );
}

// Régua de 14 dias (mesma leitura da visão pessoal).
function Rail({ history14 }) {
  return (
    <div className="flex gap-[3px] justify-center">
      {history14.map((day, i) => (
        <div key={i} className={cn('w-[6px] h-3 rounded-[2px]',
          day.isToday ? 'bg-brand-600/20 ring-1 ring-brand-500'
            : day.hit ? 'bg-emerald-500/80'
              : day.active ? 'bg-slate-200 dark:bg-white/[0.06]'
                : 'bg-slate-100 dark:bg-white/[0.02]')} title={day.label} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAJETÓRIA DO MÊS — DADO REAL do DAILY_GOAL_HISTORY_PATH (1 doc por consultor/
// dia que zerou a meta; grava `date` 'YYYY-MM-DD' + volumeCount/volumeTarget).
//   • metas batidas/dia  = nº de docs naquele dia (consultores que zeraram).
//   • prospecção batida/dia = nº de docs com volumeCount >= volumeTarget (>0).
// ─────────────────────────────────────────────────────────────────────────────
function MonthTrajectory({ teamHistory }) {
  const data = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const hitsByDay = {}, prospByDay = {};
    (teamHistory || []).forEach(h => {
      const key = h?.date;
      if (!key) return;
      hitsByDay[key] = (hitsByDay[key] || 0) + 1;
      if (h.volumeTarget > 0 && (h.volumeCount || 0) >= h.volumeTarget) prospByDay[key] = (prospByDay[key] || 0) + 1;
    });
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dgDateKey(new Date(year, month, d));
      arr.push({ d, hits: hitsByDay[key] || 0, prosp: prospByDay[key] || 0, isToday: d === today, future: d > today });
    }
    return arr;
  }, [teamHistory]);

  const W = 620, H = 150, padL = 8, padR = 8, padT = 12, padB = 18;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxY = Math.max(4, ...data.map(x => x.hits), ...data.map(x => x.prosp));
  const bw = innerW / data.length;
  const past = data.filter(x => !x.future);
  const hitDays = past.filter(x => x.hits > 0).length;
  const prospDays = past.filter(x => x.prosp > 0).length;
  const cx = (i) => padL + i * bw + bw / 2;
  const cy = (v) => padT + innerH - (v / maxY) * innerH;
  const prospLine = past.map((x, i) => `${cx(i)},${cy(x.prosp)}`).join(' ');

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="font-display tracking-tight text-[13px] font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5"><Target size={14} className="text-brand-600" /> Trajetória do mês</h3>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600"></span>metas batidas/dia</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FF6A2B' }}></span>prospecção batida/dia</span>
          </div>
        </div>
        <div className="flex gap-5 text-right">
          <div><div className="num text-[19px] font-display font-bold text-brand-600 leading-none">{hitDays}</div><div className="text-[10.5px] text-slate-400 mt-1">dias c/ meta batida</div></div>
          <div><div className="num text-[19px] font-display font-bold leading-none" style={{ color: '#FF6A2B' }}>{prospDays}</div><div className="text-[10.5px] text-slate-400 mt-1">dias c/ prospecção</div></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, .25, .5, .75, 1].map((g, i) => <line key={i} x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} stroke="currentColor" className="text-slate-100 dark:text-white/[0.05]" strokeWidth="1" />)}
        {data.map((x, i) => {
          if (x.future) return null;
          const h = (x.hits / maxY) * innerH; const bx = padL + i * bw + bw * 0.2; const by = padT + innerH - h;
          return <rect key={i} x={bx} y={by} width={bw * 0.6} height={Math.max(0, h)} rx="2" fill={x.isToday ? '#1E40FF' : '#2B59FF'} opacity={x.isToday ? 1 : 0.85} />;
        })}
        {past.length > 1 && <polyline points={prospLine} fill="none" stroke="#FF6A2B" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {past.map((x, i) => <circle key={i} cx={cx(i)} cy={cy(x.prosp)} r={x.isToday ? 3.5 : 2.5} fill="#FF6A2B" />)}
        {data.map((x, i) => (x.d % 5 === 0 || x.isToday) ? <text key={i} x={cx(i)} y={H - 5} textAnchor="middle" fontSize="9" fill={x.isToday ? '#FF6A2B' : '#8A93B0'} fontWeight={x.isToday ? 700 : 400}>{x.isToday ? 'hoje' : x.d}</text> : null)}
      </svg>
    </div>
  );
}

function DailyGoalTeamView({ leads, interactions, usersList, metaWeekdays, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, db, appUser }) {
  const [teamHistory, setTeamHistory] = useState([]);

  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(ref, (snap) => setTeamHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error('team history', e));
    return () => unsub();
  }, [db]);

  const rows = useMemo(() => {
    const byLead = buildInteractionsByLead(interactions);
    const historyByConsultant = new Map();
    teamHistory.forEach(h => {
      if (!h?.consultantId) return;
      const arr = historyByConsultant.get(h.consultantId);
      if (arr) arr.push(h); else historyByConsultant.set(h.consultantId, [h]);
    });
    return (usersList || [])
      .map(u => {
        const processed = computeDailyGoalSlots(leads, byLead, u.id);
        const { totalSlots, doneSlots, progress } = slotTotals(processed);
        const pendingByCat = {};
        processed.forEach(l => l.categorySlugs.forEach(s => { if (!l.categoryStatus?.[s]) pendingByCat[s] = (pendingByCat[s] || 0) + 1; }));
        const critical = processed.filter(l =>
          l.categorySlugs.includes(DAILY_GOAL_CATEGORIES.ATRASADO) &&
          !l.categoryStatus?.[DAILY_GOAL_CATEGORIES.ATRASADO] &&
          overdueDaysOf(l) >= slaOverdueDays
        ).length;
        const ritmo = computeRitmo(historyByConsultant.get(u.id) || [], metaWeekdays);
        // Prospecção do dia — modelo da #111 (volumeKind + lead novo + fechamento).
        const isManager = u.role === 'admin';
        const prospTarget = volumeTargetFor(u);
        const prospVol = prospTarget > 0 ? computeDailyVolume(leads, interactions, u.id, u.authUid) : null;
        const prospDone = prospVol?.total || 0;
        const prospHit = prospTarget > 0 && prospDone >= prospTarget;
        const dailyHit = totalSlots > 0 && progress === 100;
        const perfect = !isManager && dailyHit && prospHit;
        return { user: u, totalSlots, doneSlots, progress, pendingByCat, critical, ritmo, prospDone, prospTarget, prospVol, prospHit, isManager, dailyHit, perfect };
      })
      .sort((a, b) => {
        if (a.isManager !== b.isManager) return a.isManager ? 1 : -1; // gestor ao fim
        const aEmpty = a.totalSlots === 0, bEmpty = b.totalSlots === 0;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        return a.progress - b.progress; // quem precisa de atenção primeiro
      });
  }, [leads, interactions, usersList, teamHistory, metaWeekdays, slaOverdueDays]);

  const measured = rows.filter(r => !r.isManager);
  const dailyHitCount = measured.filter(r => r.dailyHit).length;
  const dailyWith = measured.filter(r => r.totalSlots > 0).length;
  const perfectCount = measured.filter(r => r.perfect).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="font-display tracking-tight text-[16px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2"><Target size={17} className="text-brand-600" /> Meta da equipe — diária &amp; prospecção</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">Prospecção conta <b>ações</b> (agendar/reagendar, ligação, mensagem, lead novo, fechamento). {dailyHitCount}/{dailyWith} bateram a diária · {perfectCount} dia perfeito ⚡</p>
        </div>
      </div>

      <MonthTrajectory teamHistory={teamHistory} />

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th rowSpan={2} className="text-left px-3 py-2 align-bottom bg-slate-50/70 dark:bg-white/[0.02]">Consultor</th>
              <th colSpan={2} className="px-3 pt-2.5 pb-1 text-center bg-brand-50/50 dark:bg-brand-500/[0.06] border-l border-border"><span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300"><Target size={11} /> Meta diária · hoje</span></th>
              <th colSpan={2} className="px-3 pt-2.5 pb-1 text-center bg-accent-50/50 dark:bg-accent-500/[0.06] border-l border-border"><span className="inline-flex items-center gap-1 text-accent-600 dark:text-accent-400"><TrendingUp size={11} /> Prospecção · hoje</span></th>
              <th rowSpan={2} className="px-2 py-2 align-bottom text-center bg-slate-50/70 dark:bg-white/[0.02] border-l border-border w-[110px]">Dia</th>
              <th rowSpan={2} className="px-2 py-2 align-bottom text-center bg-slate-50/70 dark:bg-white/[0.02] border-l border-border">Ritmo</th>
              <th rowSpan={2} className="px-2 py-2 align-bottom text-center bg-slate-50/70 dark:bg-white/[0.02] border-l border-border w-[44px]">Batida</th>
            </tr>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="text-left px-3 py-1.5 bg-brand-50/30 dark:bg-brand-500/[0.04] border-l border-border w-[110px]">Status</th>
              <th className="text-left px-3 py-1.5 bg-brand-50/30 dark:bg-brand-500/[0.04] w-[54px]">Pend.</th>
              <th className="text-left px-3 py-1.5 bg-accent-50/30 dark:bg-accent-500/[0.04] border-l border-border w-[140px]">Ações</th>
              <th className="text-left px-3 py-1.5 bg-accent-50/30 dark:bg-accent-500/[0.04] w-[40px]">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const u = r.user;
              const pendCount = Object.values(r.pendingByCat).reduce((s, n) => s + n, 0);
              const pPct = r.prospTarget > 0 ? Math.min(100, Math.round((r.prospDone / r.prospTarget) * 100)) : 0;

              if (r.isManager) {
                return (
                  <tr key={u.id} className="border-t border-border bg-slate-50/40 dark:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 opacity-80">
                        <Avatar name={u.name} size={30} />
                        <div className="min-w-0"><div className="flex items-center gap-1"><span className="text-[12.5px] font-semibold whitespace-nowrap">{(u.name || '').split(' ')[0]}</span><Shield size={10} className="text-brand-600" /></div><div className="text-[10.5px] text-slate-400">Gestor</div></div>
                      </div>
                    </td>
                    <td colSpan={4} className="px-3 py-2.5 border-l border-border text-center"><span className="inline-flex items-center text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-md">Fora da régua — acompanha, não é medido</span></td>
                    <td className="px-2 py-2.5 border-l border-border text-center text-slate-300">—</td>
                    <td className="px-2 py-2.5 border-l border-border"><div className="opacity-50"><Rail history14={r.ritmo.history14} /></div></td>
                    <td className="px-2 py-2.5 border-l border-border text-center text-slate-300">—</td>
                  </tr>
                );
              }

              return (
                <tr key={u.id} className={cn('border-t border-border', r.perfect ? 'bg-amber-50/40 dark:bg-amber-500/[0.05]' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]')}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size={30} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[12.5px] font-semibold whitespace-nowrap">{(u.name || '').split(' ')[0]}{u.id === appUser?.id ? ' (você)' : ''}</span>
                          {r.ritmo.streak > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600"><Flame size={9} />{r.ritmo.streak}</span>}
                        </div>
                        <div className="num text-[10.5px] text-slate-400">{r.ritmo.monthHits}/{r.ritmo.monthTarget} metas no mês</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 border-l border-border bg-brand-50/20 dark:bg-brand-500/[0.03]"><MetaDiariaCell row={r} /></td>
                  <td className="px-3 py-2.5 bg-brand-50/20 dark:bg-brand-500/[0.03] text-center">
                    {pendCount > 0 ? <span className={cn('num text-[11.5px] font-bold', r.critical > 0 ? 'text-rose-600' : 'text-slate-500')}>{pendCount}{r.critical > 0 ? '!' : ''}</span> : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><Check size={11} /></span>}
                  </td>
                  <td className="px-3 py-2.5 border-l border-border bg-accent-50/20 dark:bg-accent-500/[0.03]"><MetaProspCell done={r.prospDone} target={r.prospTarget} breakdown={r.prospVol} /></td>
                  <td className="px-3 py-2.5 bg-accent-50/20 dark:bg-accent-500/[0.03]">{r.prospTarget > 0 ? <span className={cn('num text-[11.5px] font-bold', r.prospHit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>{pPct}%</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-2.5 border-l border-border text-center">{r.perfect ? <PerfectPill /> : <span className="text-slate-300">·</span>}</td>
                  <td className="px-2 py-2.5 border-l border-border"><Rail history14={r.ritmo.history14} /></td>
                  <td className="px-2 py-2.5 border-l border-border text-center">
                    {r.dailyHit ? <CheckCircle2 size={17} className="text-emerald-500 inline" /> : <span className="text-slate-200 dark:text-slate-600">·</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-14 text-center text-[13px] text-slate-400">Nenhum usuário na equipe ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-400 flex-wrap">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-brand-600"></span> Meta diária (tarefas de hoje)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-accent-500"></span> Prospecção = ações (agendar/reagendar, ligação, mensagem, lead novo, fechamento)</span>
        <span className="inline-flex items-center gap-1.5"><Zap size={12} className="text-accent-500" /> Dia perfeito = zerou pendências + bateu prospecção</span>
      </div>
    </div>
  );
}

export { DailyGoalTeamView };
