import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DAILY_GOAL_CATEGORIES } from '../lib/leads.js';
import { DG_CATEGORY_META, COLOR_TONES, buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeRitmo, overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS, computeDailyVolume, computeVolumeInRange, volumeTargetFor, volumeBreakdownLabel, listDailyVolumeActions, listVolumeActionsInRange, countMetaDaysInRange, countHitsInRange } from '../lib/dailyGoal.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { cn } from '../lib/utils.js';
import { AlertCircle, AlertTriangle, Ban, CalendarCheck, CalendarClock, CheckCircle, ChevronDown, Dumbbell, Flame, MapPin, MessageSquare, Phone, Shield, Target, Trophy, UserPlus, Users, Zap } from 'lucide-react';

// ============================================================================
// PAINEL DA EQUIPE — "Ranking da Equipe" (visão do GESTOR sobre a meta diária).
// LEITURA apenas: concluir tarefa continua sendo ato do consultor (filosofia
// Meta-only); o gestor acompanha, expande a ficha e cobra com contexto.
//
// Dois modos pelo FILTRO de período (default Hoje):
//  • HOJE — painel completo de agora (tarefas pendentes/concluídas + prospecção
//    + dia perfeito), pois a carteira de tarefas é derivada do estado ATUAL.
//  • Períodos passados (ontem/semana/mês anterior/personalizado) — a carteira
//    não é reconstruível no passado, então o ranking é por PROSPECÇÃO no período
//    + "X de Y dias batidos" (histórico), e a ficha vira a linha do tempo de
//    ações. Tudo client-side (admin já tem leads+interações+histórico de todos).
// ============================================================================

const PERIODS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes_anterior', label: 'Mês anterior' },
  { key: 'personalizado', label: 'Personalizado' },
];

function toInputDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtDM = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

// Resolve o período selecionado num intervalo meia-aberto [from, to). "Semana"
// = segunda → hoje; "Mês anterior" = mês-calendário anterior inteiro.
function computeRange(period, customFrom, customTo) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (period === 'ontem') {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: y, to: today, isToday: false, isSingleDay: true, label: 'ontem' };
  }
  if (period === 'semana') {
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    return { from: mon, to: tomorrow, isToday: false, isSingleDay: false, label: 'esta semana' };
  }
  if (period === 'mes_anterior') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from, to, isToday: false, isSingleDay: false, label: 'mês anterior' };
  }
  if (period === 'personalizado' && customFrom && customTo) {
    const f = new Date(`${customFrom}T00:00:00`);
    const t = new Date(`${customTo}T00:00:00`); t.setDate(t.getDate() + 1);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime()) && t > f) {
      return { from: f, to: t, isToday: false, isSingleDay: (t - f) <= 86400000, label: 'período' };
    }
  }
  return { from: today, to: tomorrow, isToday: period === 'hoje', isSingleDay: true, label: 'hoje' };
}

// Pontuação de ranking (modo HOJE): dia perfeito no topo, depois quem bateu a
// meta, depois por progresso; "sem tarefas hoje" cai para o fim (-1).
function rankScore(r) {
  if (r.totalSlots === 0) return -1;
  let s = r.progress;            // 0..100 — em andamento
  if (r.progress === 100) s += 100;  // bateu a meta
  if (r.perfect) s += 200;           // dia perfeito ⚡
  return s;
}

// Tons reutilizados por chips/ícones de stat. Superfícies neutras usam tokens
// semânticos (bg-card/border-border); os status mantêm os ramps do app.
const TONES = {
  slate: { chip: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300', val: 'text-slate-900 dark:text-white' },
  brand: { chip: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300', val: 'text-slate-900 dark:text-white' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', val: 'text-emerald-700 dark:text-emerald-300' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', val: 'text-amber-700 dark:text-amber-300' },
  rose: { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300', val: 'text-rose-700 dark:text-rose-300' },
};

// Ícone + tom de cada ação da linha do tempo de prospecção (casado por rótulo
// real de listVolumeActionsInRange). daily_goal_done NÃO entra — não é prospecção.
function volumeActionVisual(label) {
  if (label.includes('Visita')) return { Icon: MapPin, tone: 'brand' };
  if (label.includes('Aula')) return { Icon: Dumbbell, tone: 'brand' };
  if (label.includes('Mensagem')) return { Icon: MessageSquare, tone: 'slate' };
  if (label.includes('Ligação')) return { Icon: Phone, tone: 'slate' };
  if (label.includes('Lead')) return { Icon: UserPlus, tone: 'brand' };
  if (label.includes('Venda')) return { Icon: Trophy, tone: 'emerald' };
  if (label.includes('Perda')) return { Icon: Ban, tone: 'rose' };
  return { Icon: CalendarClock, tone: 'slate' };
}

// Mesmo glyph da tela da Meta (DailyGoalView) — duplicado de propósito para
// não mexer naquele arquivo aqui; extrair p/ components/ui se ganhar 3º uso.
function WhatsappGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-3.2-6.4L20 4l-1.4 3.2A8 8 0 0 1 20 12z" />
      <path d="M8.5 9.5c0 3 2 5 5 5l1.5-1.5-2-1-1 1c-1 0-2-1-2-2l1-1-1-2L9 7c-.5 1-.5 2-.5 2.5z" />
    </svg>
  );
}

function TeamStat({ icon, label, value, tone = 'slate' }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className={cn('size-9 rounded-lg grid place-items-center', t.chip)}>{icon}</span>
      <div className="min-w-0">
        <div className="num text-[17px] font-bold text-slate-900 dark:text-white leading-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// Stat compacto por pessoa (pílulas do líder + mini-stats da ficha).
function PersonStat({ icon, label, value, tone = 'slate' }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <span className={cn('size-7 rounded-lg grid place-items-center shrink-0', t.chip)}>{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className={cn('num text-[13.5px] font-bold', t.val)}>{value}</div>
        <div className="text-[10.5px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}

function PendingCatChip({ slug, count }) {
  const m = DG_CATEGORY_META[slug];
  if (!m || !count) return null;
  const t = COLOR_TONES[m.color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
      {count} {m.short.toLowerCase()}
    </span>
  );
}

// Posição no ranking: troféu de destaque p/ o líder, número neutro p/ o resto.
function RankBadge({ position, leader }) {
  if (leader) {
    return (
      <span className="size-10 rounded-xl grid place-items-center bg-brand-600 text-white shadow-sm shrink-0">
        <Trophy size={19} />
      </span>
    );
  }
  return (
    <span className="num size-7 rounded-lg grid place-items-center bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 text-[12.5px] font-bold shrink-0">
      {position ?? '·'}
    </span>
  );
}

function StreakTag({ streak }) {
  if (!streak || streak <= 0) {
    return <span className="text-[11px] text-muted-foreground">sem sequência</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
      <Flame size={12} /> {streak} {streak === 1 ? 'dia' : 'dias'}
    </span>
  );
}

function CriticalChip({ count, days }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap bg-rose-600 text-white">
      <AlertTriangle size={10} /> {count} há {days}+ dias
    </span>
  );
}

// Régua dos últimos 14 dias (mesmo código de cores do "Ritmo do mês" pessoal:
// verde=batida, claro=não batida, apagado=fora da meta, anel=hoje).
function Ruler14({ history14 }) {
  return (
    <div className="flex gap-[3px]">
      {history14.map((day, i) => (
        <div
          key={i}
          className={cn('w-[10px] h-3.5 rounded-[2px]',
            day.isToday ? 'bg-brand-600/20 ring-1 ring-brand-500'
              : day.hit ? 'bg-emerald-500/80'
                : day.active ? 'bg-slate-100 dark:bg-white/[0.05]'
                  : 'bg-slate-50 dark:bg-white/[0.02]')}
          title={`${day.label}${day.hit ? ' · meta batida' : day.active ? ' · não batida' : ' · fora da meta'}`}
        />
      ))}
    </div>
  );
}

function statusBadge(row) {
  if (row.totalSlots === 0) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">Sem tarefas hoje</span>;
  }
  if (row.perfect) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white"><Zap size={11} /> Dia perfeito</span>;
  }
  if (row.progress === 100) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle size={11} /> Meta batida</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Em andamento</span>;
}

// Linha do tempo de ações de prospecção (reusada por Hoje e pelos períodos).
function ActionTimeline({ actions, withDate, leads, onOpenLead }) {
  return (
    <ol className="flex flex-col gap-1 border-l border-border pl-3 ml-1">
      {actions.map((a, i) => {
        const { Icon, tone } = volumeActionVisual(a.label);
        const t = TONES[tone] || TONES.slate;
        const hhmm = a.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return (
          <li key={`${a.leadId}-${i}`}>
            <button
              type="button"
              onClick={() => { const ld = (leads || []).find(l => l.id === a.leadId); if (ld) onOpenLead?.(ld); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-card border border-transparent hover:border-border transition text-left"
            >
              <span className="num text-[11px] text-muted-foreground w-16 shrink-0">{withDate ? `${fmtDM(a.at)} ${hhmm}` : hhmm}</span>
              <span className={cn('size-6 rounded-md grid place-items-center shrink-0', t.chip)}><Icon size={13} /></span>
              <span className="text-[12.5px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{a.label}</span>
              <span className="text-[12.5px] text-muted-foreground truncate">— {a.leadName}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function DailyGoalTeamView({ leads, interactions, usersList, metaWeekdays, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, db, appUser, onOpenLead }) {
  const [expandedId, setExpandedId] = useState(null);
  const [teamHistory, setTeamHistory] = useState([]);
  const [period, setPeriod] = useState('hoje');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));

  // Histórico de metas batidas da EQUIPE inteira (sem filtro de consultor —
  // a regra publicada permite o admin ler todos; consultor lê só o próprio).
  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => setTeamHistory(snap.docs.map(d => d.data())),
      (e) => console.error('team history', e)
    );
    return () => unsub();
  }, [db]);

  const range = useMemo(() => computeRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const historyByConsultant = useMemo(() => {
    const m = new Map();
    teamHistory.forEach(h => {
      if (!h?.consultantId) return;
      const arr = m.get(h.consultantId);
      if (arr) arr.push(h); else m.set(h.consultantId, [h]);
    });
    return m;
  }, [teamHistory]);

  // ── Modo HOJE: slots da meta + prospecção do dia + ritmo ──────────────────
  const rows = useMemo(() => {
    const byLead = buildInteractionsByLead(interactions);
    return (usersList || [])
      .map(u => {
        const processed = computeDailyGoalSlots(leads, byLead, u.id);
        const { totalSlots, doneSlots, progress } = slotTotals(processed);
        const pendingByCat = {};
        processed.forEach(l => l.categorySlugs.forEach(s => {
          if (!l.categoryStatus?.[s]) pendingByCat[s] = (pendingByCat[s] || 0) + 1;
        }));
        // SLA: atrasados pendentes com idade >= limiar viram "críticos".
        const critical = processed.filter(l =>
          l.categorySlugs.includes(DAILY_GOAL_CATEGORIES.ATRASADO) &&
          !l.categoryStatus?.[DAILY_GOAL_CATEGORIES.ATRASADO] &&
          overdueDaysOf(l) >= slaOverdueDays
        ).length;
        // Meta por VOLUME: alvo próprio do consultor > default da academia
        // (gestor fica fora). Dia perfeito ⚡ = pendências zeradas + volume.
        const volumeTarget = volumeTargetFor(u);
        const volume = volumeTarget > 0 ? computeDailyVolume(leads, interactions, u.id, u.authUid) : null;
        const volTotal = volume?.total || 0;
        const perfect = totalSlots > 0 && progress === 100 && volumeTarget > 0 && volTotal >= volumeTarget;
        const ritmo = computeRitmo(historyByConsultant.get(u.id) || [], metaWeekdays);
        return { user: u, processed, totalSlots, doneSlots, progress, pendingByCat, critical, volume, volTotal, volumeTarget, perfect, ritmo };
      })
      // Ranking motivacional: dia perfeito > meta batida > maior progresso;
      // desempate por mais prospecção, depois sequência; "sem tarefas" no fim.
      .sort((a, b) => {
        const sa = rankScore(a), sb = rankScore(b);
        if (sa !== sb) return sb - sa;
        if (b.volTotal !== a.volTotal) return b.volTotal - a.volTotal;
        if (b.ritmo.streak !== a.ritmo.streak) return b.ritmo.streak - a.ritmo.streak;
        return (a.user.name || '').localeCompare(b.user.name || '');
      });
  }, [leads, interactions, usersList, historyByConsultant, metaWeekdays, slaOverdueDays]);

  const team = useMemo(() => {
    const withTasks = rows.filter(r => r.totalSlots > 0);
    const totalSlots = withTasks.reduce((s, r) => s + r.totalSlots, 0);
    const doneSlots = withTasks.reduce((s, r) => s + r.doneSlots, 0);
    const overdue = rows.reduce((s, r) => s + (r.pendingByCat[DAILY_GOAL_CATEGORIES.ATRASADO] || 0), 0);
    const hit = withTasks.filter(r => r.progress === 100).length;
    const volumeTracked = rows.filter(r => r.volumeTarget > 0).length;
    const volumeOk = rows.filter(r => r.volumeTarget > 0 && r.volTotal >= r.volumeTarget).length;
    return {
      totalSlots, doneSlots, overdue, hit, volumeTracked, volumeOk,
      withTasks: withTasks.length,
      progress: totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 100,
    };
  }, [rows]);

  // Posição no ranking só para quem tem tarefas hoje (1 = líder do dia).
  const posOf = useMemo(() => {
    const m = new Map();
    rows.filter(r => r.totalSlots > 0).forEach((r, i) => m.set(r.user.id, i + 1));
    return m;
  }, [rows]);

  // ── Modo PERÍODO PASSADO: prospecção no intervalo + dias batidos ──────────
  const pastRows = useMemo(() => {
    if (range.isToday) return [];
    const metaDays = countMetaDaysInRange(metaWeekdays, range.from, range.to);
    return (usersList || [])
      .map(u => {
        const volumeTarget = volumeTargetFor(u);
        const volume = computeVolumeInRange(leads, interactions, u.id, u.authUid, range.from, range.to, metaWeekdays);
        const hitDays = countHitsInRange(historyByConsultant.get(u.id) || [], metaWeekdays, range.from, range.to);
        return { user: u, volume, volTotal: volume.total, metaDays, hitDays, volumeTarget };
      })
      // Mostra consultores (têm régua) + qualquer um que tenha prospectado;
      // gestor sem ações fica fora. Ordena por prospecção, depois dias batidos.
      .filter(r => r.volumeTarget > 0 || r.volTotal > 0)
      .sort((a, b) => (b.volTotal - a.volTotal) || (b.hitDays - a.hitDays) || (a.user.name || '').localeCompare(b.user.name || ''));
  }, [range, leads, interactions, usersList, historyByConsultant, metaWeekdays]);

  const pastTeam = useMemo(() => ({
    totalActions: pastRows.reduce((s, r) => s + r.volTotal, 0),
    metaDays: range.isToday ? 0 : countMetaDaysInRange(metaWeekdays, range.from, range.to),
    active: pastRows.filter(r => r.volTotal > 0).length,
    people: pastRows.length,
  }), [pastRows, range, metaWeekdays]);

  const rangeDatesLabel = range.isSingleDay
    ? fmtDM(range.from)
    : `${fmtDM(range.from)} – ${fmtDM(new Date(range.to.getTime() - 86400000))}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro de período */}
      <div className="rounded-2xl border border-border bg-card shadow-card px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">Período</span>
        {PERIODS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setPeriod(p.key); setExpandedId(null); }}
            className={cn('text-[12.5px] font-medium px-3 py-1.5 rounded-lg border transition',
              period === p.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-card border-border text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/10')}
          >
            {p.label}
          </button>
        ))}
        {period === 'personalizado' && (
          <span className="inline-flex items-center gap-2 ml-1">
            <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
              className="num text-[12px] px-2 py-1.5 rounded-lg border border-border bg-card text-slate-700 dark:text-slate-200" />
            <span className="text-[12px] text-muted-foreground">até</span>
            <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
              className="num text-[12px] px-2 py-1.5 rounded-lg border border-border bg-card text-slate-700 dark:text-slate-200" />
          </span>
        )}
      </div>

      {range.isToday ? (
        <>
          {/* ===================== MODO HOJE ===================== */}
          {/* Resumo do time */}
          <div className="rounded-2xl border border-border bg-card shadow-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display tracking-tight text-[16px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
                  <Users size={17} className="text-brand-600" /> Ranking da equipe — hoje
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Acompanhamento em tempo real. Concluir tarefa é ato do consultor — aqui você acompanha e cobra.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="num text-[22px] font-bold text-slate-900 dark:text-white leading-none">{team.progress}%</div>
                  <div className="text-[11px] text-muted-foreground">{team.doneSlots} de {team.totalSlots} tarefas</div>
                </div>
                <div className="w-28 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${team.progress === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${team.progress}%`, transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <TeamStat icon={<Target size={16} />} tone="brand" value={`${team.doneSlots}/${team.totalSlots}`} label="tarefas do dia" />
              <TeamStat icon={<Trophy size={16} />} tone="emerald" value={`${team.hit} de ${team.withTasks}`} label="bateram a meta" />
              <TeamStat icon={<AlertCircle size={16} />} tone={team.overdue > 0 ? 'rose' : 'slate'} value={team.overdue} label="leads atrasados" />
              {team.volumeTracked > 0 ? (
                <TeamStat icon={<Zap size={16} />} tone={team.volumeOk === team.volumeTracked ? 'emerald' : 'slate'} value={`${team.volumeOk} de ${team.volumeTracked}`} label="no piso de prospecção" />
              ) : (
                <TeamStat icon={<Users size={16} />} tone="slate" value={rows.length} label="pessoas na equipe" />
              )}
            </div>
          </div>

          {/* Ranking: um card por pessoa, líder do dia em destaque */}
          <div className="flex flex-col gap-3">
            {rows.map((r) => {
              const u = r.user;
              const expanded = expandedId === u.id;
              const position = posOf.get(u.id);
              const isLeader = position === 1;
              const volHit = r.volumeTarget > 0 && r.volTotal >= r.volumeTarget;

              // Slots pendentes com a idade do atraso (SLA); os mais críticos primeiro.
              const pendingSlots = r.processed
                .flatMap(l => l.categorySlugs.filter(s => !l.categoryStatus?.[s]).map(s => ({
                  lead: l, slug: s,
                  overdue: s === DAILY_GOAL_CATEGORIES.ATRASADO ? overdueDaysOf(l) : 0,
                })))
                .sort((a, b) => b.overdue - a.overdue);
              const doneSlotsList = r.processed
                .flatMap(l => l.categorySlugs.filter(s => l.categoryStatus?.[s]).map(s => ({ lead: l, slug: s })));

              return (
                <div
                  key={u.id}
                  className={cn('rounded-2xl bg-card shadow-card overflow-hidden transition',
                    isLeader
                      ? 'border-2 border-brand-500/60 dark:border-brand-500/40 bg-gradient-to-br from-brand-50/40 to-transparent dark:from-brand-500/[0.05]'
                      : 'border border-border')}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : u.id)}
                    aria-expanded={expanded}
                    className="w-full text-left hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition"
                  >
                    {isLeader ? (
                      /* ---- Líder do dia: card maior com pílulas de números ---- */
                      <div className="px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <RankBadge leader />
                          <Avatar name={u.name} size={52} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400 mb-0.5">Líder do dia</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[16px] font-bold text-slate-900 dark:text-white truncate">
                                {u.name}{u.id === appUser?.id ? ' (você)' : ''}
                              </span>
                              {u.role === 'admin' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><Shield size={10} /> Gestor</span>
                              )}
                              {statusBadge(r)}
                              {r.critical > 0 && <CriticalChip count={r.critical} days={slaOverdueDays} />}
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1 max-w-[320px] h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                                <div className={cn('h-full rounded-full', r.progress === 100 ? 'bg-emerald-500' : 'bg-brand-600')} style={{ width: `${r.progress}%`, transition: 'width .6s' }} />
                              </div>
                              <span className="num text-[12px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.doneSlots} de {r.totalSlots}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-stretch gap-2 shrink-0">
                          <div className="flex flex-wrap gap-2 flex-1 lg:flex-none">
                            <div className="min-w-[110px] flex-1"><PersonStat icon={<Target size={14} />} tone="brand" value={`${r.doneSlots}/${r.totalSlots}`} label="meta do dia" /></div>
                            {r.volumeTarget > 0 && (
                              <div className="min-w-[110px] flex-1"><PersonStat icon={<Zap size={14} />} tone={volHit ? 'emerald' : 'amber'} value={`${r.volTotal}/${r.volumeTarget}`} label="prospecção" /></div>
                            )}
                            <div className="min-w-[110px] flex-1"><PersonStat icon={<Flame size={14} />} tone={r.ritmo.streak > 0 ? 'amber' : 'slate'} value={r.ritmo.streak > 0 ? `${r.ritmo.streak} ${r.ritmo.streak === 1 ? 'dia' : 'dias'}` : '—'} label="sequência" /></div>
                          </div>
                          <ChevronDown size={18} className={cn('text-slate-400 shrink-0 self-center transition-transform', expanded && 'rotate-180')} />
                        </div>
                      </div>
                    ) : (
                      /* ---- Demais posições: linha compacta numerada ---- */
                      <div className="px-4 py-3 flex items-center gap-3">
                        <RankBadge position={position} />
                        <Avatar name={u.name} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">
                              {u.name}{u.id === appUser?.id ? ' (você)' : ''}
                            </span>
                            {u.role === 'admin' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><Shield size={10} /> Gestor</span>
                            )}
                            {statusBadge(r)}
                            {r.critical > 0 && <CriticalChip count={r.critical} days={slaOverdueDays} />}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <div className="flex-1 max-w-[240px] h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                              <div className={cn('h-full rounded-full', r.totalSlots === 0 ? 'bg-slate-300 dark:bg-white/[0.12]' : r.progress === 100 ? 'bg-emerald-500' : 'bg-brand-600')} style={{ width: `${r.totalSlots === 0 ? 100 : r.progress}%`, transition: 'width .6s' }} />
                            </div>
                            <span className="num text-[12px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {r.totalSlots === 0 ? '—' : `${r.doneSlots} de ${r.totalSlots}`}
                            </span>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 min-w-[92px]">
                          {r.volumeTarget > 0 && (
                            <span className={cn('inline-flex items-center gap-1 text-[11.5px] num font-semibold', volHit ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')} title={`Prospecção do dia: ${volumeBreakdownLabel(r.volume)}`}>
                              <Zap size={11} /> {r.volTotal}/{r.volumeTarget}
                            </span>
                          )}
                          <StreakTag streak={r.ritmo.streak} />
                        </div>
                        <ChevronDown size={16} className={cn('text-slate-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
                      </div>
                    )}
                  </button>

                  {/* ---------- FICHA DE DETALHE (hoje) ---------- */}
                  {expanded && (
                    <div className="border-t border-border px-5 py-4 bg-muted/50 flex flex-col gap-5">
                      {/* Mini-stats do dia */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <PersonStat icon={<Target size={14} />} tone="brand" value={r.totalSlots === 0 ? '—' : `${r.doneSlots}/${r.totalSlots}`} label="meta diária" />
                        {r.volumeTarget > 0 && (
                          <PersonStat icon={<Zap size={14} />} tone={volHit ? 'emerald' : 'amber'} value={`${r.volTotal}/${r.volumeTarget}`} label="prospecção" />
                        )}
                        <PersonStat icon={<CalendarCheck size={14} />} tone="slate" value={`${r.ritmo.monthHits}/${r.ritmo.monthTarget}`} label="ritmo do mês" />
                        <PersonStat icon={<Flame size={14} />} tone={r.ritmo.streak > 0 ? 'amber' : 'slate'} value={r.ritmo.streak > 0 ? `${r.ritmo.streak} ${r.ritmo.streak === 1 ? 'dia' : 'dias'}` : '—'} label="sequência" />
                      </div>

                      {/* Régua de 14 dias */}
                      <div>
                        <div className="text-[10.5px] text-muted-foreground mb-1.5">Últimos 14 dias</div>
                        <Ruler14 history14={r.ritmo.history14} />
                      </div>

                      {/* ESFORÇO — linha do tempo de prospecção do dia */}
                      {r.volumeTarget > 0 && (() => {
                        const actions = listDailyVolumeActions(leads, interactions, u.id, u.authUid);
                        return (
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                              <Zap size={12} className="text-amber-500" /> O que foi feito hoje · {r.volTotal} de {r.volumeTarget}
                            </div>
                            {actions.length === 0 ? (
                              <p className="text-[12.5px] text-muted-foreground">Nenhuma ação de prospecção hoje (agendamento, lead novo ou fechamento).</p>
                            ) : (
                              <ActionTimeline actions={actions} withDate={false} leads={leads} onOpenLead={onOpenLead} />
                            )}
                          </div>
                        );
                      })()}

                      {/* CARTEIRA — tarefas da meta (pendentes x concluídas) */}
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                          <Target size={12} className="text-brand-500" /> Tarefas da meta
                        </div>
                        {r.totalSlots === 0 ? (
                          <p className="text-[12.5px] text-muted-foreground">Nenhuma tarefa na meta de hoje.</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div>
                              <div className="text-[11px] font-semibold text-muted-foreground mb-2">Pendentes ({pendingSlots.length})</div>
                              {pendingSlots.length === 0 ? (
                                <p className="text-[12.5px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5"><CheckCircle size={13} /> Tudo concluído.</p>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {pendingSlots.map(({ lead, slug, overdue }) => {
                                    const waNum = String(lead.whatsapp || '').replace(/\D/g, '');
                                    const isCritical = overdue >= slaOverdueDays;
                                    return (
                                      <div
                                        key={`${lead.id}-${slug}`}
                                        className={cn('flex items-center gap-2 px-3 py-2 rounded-lg bg-card border transition',
                                          isCritical
                                            ? 'border-rose-300 dark:border-rose-500/40 hover:border-rose-400 dark:hover:border-rose-500/60'
                                            : 'border-border hover:border-slate-300 dark:hover:border-white/10')}
                                      >
                                        <button type="button" onClick={() => onOpenLead?.(lead)} className="flex-1 min-w-0 text-left">
                                          <span className="block text-[12.5px] font-medium text-slate-800 dark:text-slate-100 truncate">{lead.name}</span>
                                        </button>
                                        {overdue > 0 && (
                                          <span className={cn('num text-[11px] font-semibold whitespace-nowrap', isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                                            há {overdue} {overdue === 1 ? 'dia' : 'dias'}
                                          </span>
                                        )}
                                        <PendingCatChip slug={slug} count={1} />
                                        {waNum && (
                                          <button
                                            type="button"
                                            title="Chamar no WhatsApp"
                                            onClick={() => window.open(`https://wa.me/${waNum}`, '_blank', 'noopener,noreferrer')}
                                            className="size-7 grid place-items-center rounded-md shrink-0 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
                                          >
                                            <WhatsappGlyph size={15} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-muted-foreground mb-2">Concluídas ({doneSlotsList.length})</div>
                              {doneSlotsList.length === 0 ? (
                                <p className="text-[12.5px] text-muted-foreground">Nada concluído ainda.</p>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {doneSlotsList.map(({ lead, slug }) => (
                                    <button
                                      key={`${lead.id}-${slug}`}
                                      type="button"
                                      onClick={() => onOpenLead?.(lead)}
                                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card border border-border hover:border-slate-300 dark:hover:border-white/10 transition text-left opacity-80"
                                    >
                                      <span className="text-[12.5px] font-medium text-slate-600 dark:text-slate-300 truncate inline-flex items-center gap-1.5">
                                        <CheckCircle size={13} className="text-emerald-500 shrink-0" /> {lead.name}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{DG_CATEGORY_META[slug]?.short}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="py-14 grid place-items-center text-muted-foreground rounded-2xl border border-border">
                <p className="text-[13px]">Nenhum usuário na equipe ainda.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ===================== MODO PERÍODO PASSADO ===================== */}
          {/* Resumo da prospecção no período */}
          <div className="rounded-2xl border border-border bg-card shadow-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display tracking-tight text-[16px] font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
                  <Users size={17} className="text-brand-600" /> Prospecção da equipe — {range.label}
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {rangeDatesLabel} · {pastTeam.metaDays} {pastTeam.metaDays === 1 ? 'dia programado' : 'dias programados'} · a carteira de tarefas aparece só em “Hoje”.
                </p>
              </div>
              <div className="text-right">
                <div className="num text-[22px] font-bold text-slate-900 dark:text-white leading-none">{pastTeam.totalActions}</div>
                <div className="text-[11px] text-muted-foreground">{pastTeam.totalActions === 1 ? 'ação' : 'ações'} · {pastTeam.active} de {pastTeam.people} prospectaram</div>
              </div>
            </div>
          </div>

          {/* Ranking por prospecção no período */}
          <div className="flex flex-col gap-3">
            {pastRows.map((r, idx) => {
              const u = r.user;
              const expanded = expandedId === u.id;
              const isLeader = idx === 0 && r.volTotal > 0;
              const pct = r.metaDays > 0 ? Math.round((r.hitDays / r.metaDays) * 100) : 0;
              const hitAll = r.metaDays > 0 && r.hitDays >= r.metaDays;
              return (
                <div
                  key={u.id}
                  className={cn('rounded-2xl bg-card shadow-card overflow-hidden transition',
                    isLeader
                      ? 'border-2 border-brand-500/60 dark:border-brand-500/40 bg-gradient-to-br from-brand-50/40 to-transparent dark:from-brand-500/[0.05]'
                      : 'border border-border')}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : u.id)}
                    aria-expanded={expanded}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition"
                  >
                    <RankBadge leader={isLeader} position={idx + 1} />
                    <Avatar name={u.name} size={isLeader ? 44 : 38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLeader && <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">Top prospecção</span>}
                        <span className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">
                          {u.name}{u.id === appUser?.id ? ' (você)' : ''}
                        </span>
                        {u.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><Shield size={10} /> Gestor</span>
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        <span className="num font-semibold text-slate-700 dark:text-slate-200">{r.volTotal}</span> {r.volTotal === 1 ? 'ação' : 'ações'}
                        {r.metaDays > 0 && (
                          <> · <span className="num">{r.hitDays}</span> de <span className="num">{r.metaDays}</span> dias batidos</>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-28">
                      <span className="num text-[13px] font-bold text-slate-900 dark:text-white">{r.volTotal} {r.volTotal === 1 ? 'ação' : 'ações'}</span>
                      {r.metaDays > 0 && (
                        <>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                            <div className={cn('h-full rounded-full', hitAll ? 'bg-emerald-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="num text-[10.5px] text-muted-foreground">{r.hitDays}/{r.metaDays} dias batidos</span>
                        </>
                      )}
                    </div>
                    <ChevronDown size={16} className={cn('text-slate-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
                  </button>

                  {/* ---------- FICHA DE DETALHE (período) ---------- */}
                  {expanded && (
                    <div className="border-t border-border px-5 py-4 bg-muted/50 flex flex-col gap-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <PersonStat icon={<Zap size={14} />} tone="amber" value={r.volTotal} label={r.volTotal === 1 ? 'ação no período' : 'ações no período'} />
                        <PersonStat icon={<CalendarCheck size={14} />} tone={hitAll ? 'emerald' : 'slate'} value={`${r.hitDays}/${r.metaDays}`} label="dias batidos" />
                        <PersonStat icon={<Target size={14} />} tone="brand" value={`${r.volumeTarget || 0}/dia`} label="alvo de prospecção" />
                      </div>

                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                          <Zap size={12} className="text-amber-500" /> Ações do período{r.volume ? ` · ${volumeBreakdownLabel(r.volume)}` : ''}
                        </div>
                        {(() => {
                          const actions = listVolumeActionsInRange(leads, interactions, u.id, u.authUid, range.from, range.to, metaWeekdays);
                          return actions.length === 0 ? (
                            <p className="text-[12.5px] text-muted-foreground">Nenhuma ação de prospecção no período.</p>
                          ) : (
                            <ActionTimeline actions={actions} withDate={!range.isSingleDay} leads={leads} onOpenLead={onOpenLead} />
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {pastRows.length === 0 && (
              <div className="py-14 grid place-items-center text-muted-foreground rounded-2xl border border-border">
                <p className="text-[13px]">Ninguém com prospecção registrada no período.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { DailyGoalTeamView };
