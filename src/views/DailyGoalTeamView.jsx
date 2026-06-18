import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import {
  buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeRitmo,
  overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS, dgDateKey,
  computeDailyVolume, computeVolumeInRange, volumeTargetFor, volumeBreakdownLabel,
} from '../lib/dailyGoal.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { cn } from '../lib/utils.js';
import { ArrowLeft, Check, CheckCircle2, Flame, Shield, Target, TrendingUp, Zap } from 'lucide-react';

// ============================================================================
// PAINEL DA EQUIPE — "tabela executiva" com DUAS metas do dia + gráfico do mês.
//   • META DIÁRIA → tarefas de hoje (computeDailyGoalSlots). "Batida" a 100%.
//   • PROSPECÇÃO  → cota DIÁRIA de AÇÕES (modelo #111: computeDailyVolume =
//       agendamentos volumeKind + lead novo). Alvo por consultor
//       (volumeTargetFor). Gestor → 0 → fora da régua.
//   • "Dia perfeito" ⚡ = zerou a meta E bateu a prospecção.
//   + GRÁFICO "Trajetória do mês" (dado real do histórico). CLICÁVEL: clicar num
//     dia troca a TABELA de baixo para os resultados daquele dia.
//   ⚠️ Em dias PASSADOS a carteira (pendentes/concluídas) não é reconstruível, então
//     a coluna Meta vira "Batida/não bateu/folga" (histórico) e a Prospecção é
//     recalculada real do dia (computeVolumeInRange). HOJE continua completo.
// LEITURA apenas (Meta-only): concluir é ato do consultor.
// ============================================================================

const fmtDM = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtDMY = (d) => `${fmtDM(d)}/${d.getFullYear()}`;
const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

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

// Meta de um dia PASSADO — só o histórico sabe se bateu (doc existe = bateu).
function MetaPastCell({ hitMeta, isMetaDay }) {
  if (hitMeta) return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 size={12} /> Batida</span>;
  if (!isMetaDay) return <span className="text-[11px] text-slate-300 dark:text-slate-600">folga</span>;
  return <span className="text-[11px] text-slate-400">não bateu</span>;
}

function MetaProspCell({ done, target, breakdown }) {
  if (!target) return <span className="text-[11px] text-slate-400">sem alvo</span>;
  const pct = Math.min(100, Math.round((done / target) * 100));
  const hit = done >= target;
  return (
    <div className="flex items-center gap-2" title={breakdown ? `Prospecção do dia: ${volumeBreakdownLabel(breakdown)}` : undefined}>
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
// dia que zerou a meta; grava `date` + volumeCount/volumeTarget). CLICÁVEL: cada
// coluna é um dia; clicar troca a tabela de baixo (selectedDay no pai).
// ─────────────────────────────────────────────────────────────────────────────
function MonthTrajectory({ teamHistory, prospByDay, selectedDay, todayNum, onPickDay }) {
  const data = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const hitsByDay = {};
    (teamHistory || []).forEach(h => { if (h?.date) hitsByDay[h.date] = (hitsByDay[h.date] || 0) + 1; });
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dgDateKey(new Date(year, month, d));
      arr.push({ d, hits: hitsByDay[key] || 0, prosp: (prospByDay && prospByDay[key]) || 0, isToday: d === todayNum, future: d > todayNum });
    }
    return arr;
  }, [teamHistory, prospByDay, todayNum]);

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
  const selDay = selectedDay ?? todayNum;
  const selIdx = selDay - 1;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-4">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="font-display tracking-tight text-[13px] font-bold text-slate-800 dark:text-white inline-flex items-center gap-1.5"><Target size={14} className="text-brand-600" /> Trajetória do mês</h3>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600"></span>metas batidas/dia</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FF6A2B' }}></span>prospecção batida/dia</span>
            <span className="text-slate-300 dark:text-slate-600">· clique num dia pra ver a tabela</span>
          </div>
        </div>
        <div className="flex gap-5 text-right">
          <div><div className="num text-[19px] font-display font-bold text-brand-600 leading-none">{hitDays}</div><div className="text-[10.5px] text-slate-400 mt-1">dias c/ meta batida</div></div>
          <div><div className="num text-[19px] font-display font-bold leading-none" style={{ color: '#FF6A2B' }}>{prospDays}</div><div className="text-[10.5px] text-slate-400 mt-1">dias c/ prospecção</div></div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {selIdx >= 0 && <rect x={padL + selIdx * bw} y={padT} width={bw} height={innerH} rx="3" className="fill-brand-500/10 dark:fill-brand-500/[0.14]" />}
        {[0, .25, .5, .75, 1].map((g, i) => <line key={i} x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} stroke="currentColor" className="text-slate-100 dark:text-white/[0.05]" strokeWidth="1" />)}
        {data.map((x, i) => {
          if (x.future) return null;
          const h = (x.hits / maxY) * innerH; const bx = padL + i * bw + bw * 0.2; const by = padT + innerH - h;
          return <rect key={i} x={bx} y={by} width={bw * 0.6} height={Math.max(0, h)} rx="2" fill={x.d === selDay ? '#1E40FF' : '#2B59FF'} opacity={x.d === selDay ? 1 : 0.8} />;
        })}
        {past.length > 1 && <polyline points={prospLine} fill="none" stroke="#FF6A2B" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {past.map((x, i) => <circle key={i} cx={cx(i)} cy={cy(x.prosp)} r={x.d === selDay ? 4 : 2.5} fill="#FF6A2B" />)}
        {data.map((x, i) => (x.d % 5 === 0 || x.isToday) ? <text key={i} x={cx(i)} y={H - 5} textAnchor="middle" fontSize="9" fill={x.isToday ? '#FF6A2B' : '#8A93B0'} fontWeight={x.isToday ? 700 : 400}>{x.isToday ? 'hoje' : x.d}</text> : null)}
        {data.map((x, i) => x.future ? null : (
          <rect key={`hit-${i}`} x={padL + i * bw} y={padT} width={bw} height={innerH} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onPickDay(x.d)}>
            <title>{`dia ${x.d}${x.isToday ? ' (hoje)' : ''} — ${x.hits} meta(s), ${x.prosp} prospecção`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

function DailyGoalTeamView({ leads, interactions, usersList, metaWeekdays, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, dailyVolumeTarget = 0, db, appUser }) {
  const [teamHistory, setTeamHistory] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); // null = hoje; senão dia-do-mês

  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(ref, (snap) => setTeamHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error('team history', e));
    return () => unsub();
  }, [db]);

  const todayNum = new Date().getDate();

  // Dia em foco (clicado no gráfico) → intervalo + rótulos.
  const sel = useMemo(() => {
    const now = new Date();
    const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
    const isToday = selectedDay == null || selectedDay === todayNum;
    const dayNum = isToday ? todayNum : selectedDay;
    const d0 = isToday ? t0 : new Date(now.getFullYear(), now.getMonth(), dayNum);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    return {
      isToday, dayNum, dateKey: dgDateKey(d0), from: d0, to: d1,
      isMetaDay: (metaWeekdays || []).includes(d0.getDay()),
      label: isToday ? 'hoje' : `${WEEKDAY[d0.getDay()]}, ${fmtDMY(d0)}`,
      dayLabel: isToday ? 'hoje' : fmtDM(d0),
    };
  }, [selectedDay, todayNum, metaWeekdays]);

  const rows = useMemo(() => {
    const byLead = buildInteractionsByLead(interactions);
    const historyByConsultant = new Map();
    teamHistory.forEach(h => {
      if (!h?.consultantId) return;
      const arr = historyByConsultant.get(h.consultantId);
      if (arr) arr.push(h); else historyByConsultant.set(h.consultantId, [h]);
    });

    const base = (usersList || []).map(u => {
      const isManager = u.role === 'admin';
      const ritmo = computeRitmo(historyByConsultant.get(u.id) || [], metaWeekdays);
      const prospTarget = volumeTargetFor(u, dailyVolumeTarget);

      if (sel.isToday) {
        const processed = computeDailyGoalSlots(leads, byLead, u.id);
        const { totalSlots, doneSlots, progress } = slotTotals(processed);
        const pendingByCat = {};
        processed.forEach(l => l.categorySlugs.forEach(s => { if (!l.categoryStatus?.[s]) pendingByCat[s] = (pendingByCat[s] || 0) + 1; }));
        const critical = processed.filter(l =>
          l.categorySlugs.includes(DAILY_GOAL_CATEGORIES.ATRASADO) &&
          !l.categoryStatus?.[DAILY_GOAL_CATEGORIES.ATRASADO] &&
          overdueDaysOf(l) >= slaOverdueDays
        ).length;
        const prospVol = prospTarget > 0 ? computeDailyVolume(leads, interactions, u.id, u.authUid) : null;
        const prospDone = prospVol?.total || 0;
        const prospHit = prospTarget > 0 && prospDone >= prospTarget;
        const dailyHit = totalSlots > 0 && progress === 100;
        return { user: u, isPast: false, totalSlots, doneSlots, progress, pendingByCat, critical, ritmo, prospDone, prospTarget, prospVol, prospHit, isManager, dailyHit, perfect: !isManager && dailyHit && prospHit };
      }

      // Dia passado: meta vem do histórico (bateu = doc existe); prospecção
      // recalculada do dia. Carteira de tarefas NÃO é reconstruível.
      const hitMeta = (historyByConsultant.get(u.id) || []).some(h => h.date === sel.dateKey);
      const prospVol = prospTarget > 0 ? computeVolumeInRange(leads, interactions, u.id, u.authUid, sel.from, sel.to) : null;
      const prospDone = prospVol?.total || 0;
      const prospHit = prospTarget > 0 && prospDone >= prospTarget;
      return { user: u, isPast: true, hitMeta, ritmo, prospDone, prospTarget, prospVol, prospHit, isManager, dailyHit: hitMeta, perfect: !isManager && hitMeta && prospHit };
    });

    return base.sort((a, b) => {
      if (a.isManager !== b.isManager) return a.isManager ? 1 : -1; // gestor ao fim
      if (sel.isToday) {
        const aEmpty = a.totalSlots === 0, bEmpty = b.totalSlots === 0;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        return a.progress - b.progress; // quem precisa de atenção primeiro
      }
      return (Number(b.hitMeta) - Number(a.hitMeta)) || (b.prospDone - a.prospDone) || (a.user.name || '').localeCompare(b.user.name || '');
    });
  }, [sel, leads, interactions, usersList, teamHistory, metaWeekdays, slaOverdueDays, dailyVolumeTarget]);

  // Linha de prospecção do gráfico = DADO BRUTO (não o volumeCount do histórico,
  // que só grava se o consultor abrir a Meta): por dia do mês, quantos consultores
  // fizeram >= alvo de ações (agendamentos volumeKind + lead novo).
  const prospByDay = useMemo(() => {
    const now = new Date(); const year = now.getFullYear(), month = now.getMonth();
    const monthStart = new Date(year, month, 1);
    const nextMonth = new Date(year, month + 1, 1);
    const inMonth = (d) => d instanceof Date && d >= monthStart && d < nextMonth;
    const byAuthDay = new Map();
    (interactions || []).forEach(i => { if (i.volumeKind && inMonth(i.createdAt)) { const k = `${i.consultantAuthUid}|${dgDateKey(i.createdAt)}`; byAuthDay.set(k, (byAuthDay.get(k) || 0) + 1); } });
    const byConsDay = new Map();
    (leads || []).forEach(l => { if (inMonth(l.createdAt)) { const k = `${l.consultantId}|${dgDateKey(l.createdAt)}`; byConsDay.set(k, (byConsDay.get(k) || 0) + 1); } });
    const counts = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    (usersList || []).forEach(u => {
      const t = volumeTargetFor(u, dailyVolumeTarget);
      if (t <= 0) return;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = dgDateKey(new Date(year, month, d));
        const actions = (byAuthDay.get(`${u.authUid}|${dk}`) || 0) + (byConsDay.get(`${u.id}|${dk}`) || 0);
        if (actions >= t) counts[dk] = (counts[dk] || 0) + 1;
      }
    });
    return counts;
  }, [interactions, leads, usersList, dailyVolumeTarget]);

  const measured = rows.filter(r => !r.isManager);
  const dailyHitCount = measured.filter(r => r.dailyHit).length;
  const dailyWith = sel.isToday ? measured.filter(r => r.totalSlots > 0).length : measured.length;
  const perfectCount = measured.filter(r => r.perfect).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="font-display tracking-tight text-[16px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2"><Target size={17} className="text-brand-600" /> Meta da equipe — {sel.isToday ? 'diária & prospecção' : sel.label}</h2>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
            {sel.isToday
              ? <>Prospecção conta <b>ações</b> (agendar/reagendar, ligação, mensagem, lead novo). {dailyHitCount}/{dailyWith} bateram a diária · {perfectCount} dia perfeito ⚡</>
              : <>{dailyHitCount} de {dailyWith} bateram a meta · {perfectCount} dia perfeito ⚡ · prospecção recalculada do dia (carteira de tarefas só existe em &quot;Hoje&quot;)</>}
          </p>
        </div>
        {!sel.isToday && (
          <button type="button" onClick={() => setSelectedDay(null)} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/10 transition">
            <ArrowLeft size={13} /> Voltar pra hoje
          </button>
        )}
      </div>

      <MonthTrajectory teamHistory={teamHistory} prospByDay={prospByDay} selectedDay={selectedDay} todayNum={todayNum} onPickDay={(d) => setSelectedDay(d === todayNum ? null : d)} />

      <div className="rounded-2xl border border-border bg-card shadow-card overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th rowSpan={2} className="text-left px-3 py-2 align-bottom bg-slate-50/70 dark:bg-white/[0.02]">Consultor</th>
              <th colSpan={2} className="px-3 pt-2.5 pb-1 text-center bg-brand-50/50 dark:bg-brand-500/[0.06] border-l border-border"><span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300"><Target size={11} /> Meta diária · {sel.dayLabel}</span></th>
              <th colSpan={2} className="px-3 pt-2.5 pb-1 text-center bg-accent-50/50 dark:bg-accent-500/[0.06] border-l border-border"><span className="inline-flex items-center gap-1 text-accent-600 dark:text-accent-400"><TrendingUp size={11} /> Prospecção · {sel.dayLabel}</span></th>
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
              const pendCount = r.isPast ? 0 : Object.values(r.pendingByCat).reduce((s, n) => s + n, 0);
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
                  <td className="px-3 py-2.5 border-l border-border bg-brand-50/20 dark:bg-brand-500/[0.03]">{r.isPast ? <MetaPastCell hitMeta={r.hitMeta} isMetaDay={sel.isMetaDay} /> : <MetaDiariaCell row={r} />}</td>
                  <td className="px-3 py-2.5 bg-brand-50/20 dark:bg-brand-500/[0.03] text-center">
                    {r.isPast ? <span className="text-slate-300 dark:text-slate-600" title="Pendências de dias passados não são guardadas">—</span>
                      : pendCount > 0 ? <span className={cn('num text-[11.5px] font-bold', r.critical > 0 ? 'text-rose-600' : 'text-slate-500')}>{pendCount}{r.critical > 0 ? '!' : ''}</span>
                        : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><Check size={11} /></span>}
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
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-accent-500"></span> Prospecção = ações (agendar/reagendar, ligação, mensagem, lead novo)</span>
        <span className="inline-flex items-center gap-1.5"><Zap size={12} className="text-accent-500" /> Dia perfeito = zerou pendências + bateu prospecção</span>
      </div>
    </div>
  );
}

export { DailyGoalTeamView };
