// Tela OPERACIONAL (Visão geral · Operacional) — o painel de controle do
// gestor em tempo real, fixo em HOJE, sem seletor de período: barra sutil de
// progresso do dia, a agenda em linha do tempo com o responsável de cada
// horário e um card por consultor mostrando quem está produzindo e quem
// parou. Para o consultor, a mesma tela vira o dia DELE: números de hoje,
// linha do dia e o "Placar do dia" (md- do mockup). Layout aprovado nos
// mockups v2 (Johnny, 2026-07-11): sem índice composto, sem feed global.

import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowRight, Check, Flame, Zap } from 'lucide-react';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../../lib/firebase.js';
import { isAdminUser, isRegistrationNote } from '../../lib/leads.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import {
  buildInteractionsByLead,
  computeDailyGoalSlots,
  slotTotals,
  computeDailyVolume,
  computeVolumeInRange,
  countMetaDaysInMonth,
  volumeTargetFor,
  dgDateKey
} from '../../lib/dailyGoal.js';
import {
  computeDayFunnel,
  computeTodayAgenda,
  computeConsultantDayBoard
} from '../../lib/dashboardMetrics.js';
import { formatHourLabel, humanizeAge } from '../../lib/format.js';
import { cn } from '../../lib/utils.js';
import { DashCard, DashTimeline } from './DashPrimitives.jsx';
import { dashInitials } from './dashTokens.js';
import { useTeamGoals } from './useTeamGoals.js';

// Verbo da "última ação" — mesma leitura do antigo feed de atividade, agora
// por consultor dentro do card.
function actionVerb(i, lead) {
  const txt = String(i.text || '');
  if (i.type === 'daily_goal_done') {
    if (i.appointmentOutcome === 'attended' || /compareceu/i.test(txt)) return 'marcou comparecimento de';
    if (i.appointmentOutcome === 'no_show' || /não veio/i.test(txt)) return 'marcou Não veio de';
    if (i.appointmentOutcome === 'rescheduled' || /remarc/i.test(txt)) return 'remarcou';
    if (i.appointmentOutcome === 'cancelled' || /cancelou/i.test(txt)) return 'cancelou agendamento de';
    return 'concluiu tarefa de';
  }
  if (i.type === 'status_change') {
    if (lead?.status === 'Venda' || /matrícul/i.test(txt)) return 'fechou matrícula de';
    if (lead?.status === 'Perda' || /perd/i.test(txt)) return 'registrou perda de';
    if (/agendou|retorno agendado/i.test(txt)) return 'agendou retorno para';
    return 'atualizou fase de';
  }
  if (i.type === 'note') return isRegistrationNote(txt) ? 'cadastrou' : 'anotou em';
  return 'registrou atividade em';
}

// ---- Barra sutil de progresso do dia (opp- do mockup) ----------------------
function DayPulseCard({ funnel, now }) {
  const stages = [
    { value: funnel.novos, label: 'Novos' },
    { value: funnel.agendados, label: 'Agendados' },
    { value: funnel.compareceram, label: 'Compareceram' },
    { value: funnel.matriculas, label: 'Matrículas', win: true }
  ];
  const pct = funnel.agendaTotal > 0 ? Math.round((funnel.agendaRealizados / funnel.agendaTotal) * 100) : 0;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card px-4 sm:px-5 py-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.11em] text-muted-foreground">
          <span className="relative flex size-[7px]" aria-hidden="true">
            <span className="motion-reduce:hidden absolute inline-flex size-full animate-ping rounded-full bg-success/50" />
            <span className="relative inline-flex size-full rounded-full bg-success" />
          </span>
          Progresso do dia · agora {formatHourLabel(now)}
        </span>
        <span className="text-[12px] text-muted-foreground num">
          {funnel.agendaTotal > 0 ? (
            <>Agenda do dia · <b className="font-display font-bold text-foreground">{funnel.agendaRealizados}</b> de <b className="font-display font-bold text-foreground">{funnel.agendaTotal}</b> já realizados</>
          ) : 'Agenda do dia · sem visitas ou aulas marcadas'}
        </span>
      </div>
      <div className="flex items-stretch mt-3 overflow-x-auto thin-scroll">
        {stages.map((s, i) => (
          <span key={s.label} className="flex items-stretch">
            {i > 0 && (
              <span className="flex items-center text-slate-300 dark:text-white/20 shrink-0" aria-hidden="true">
                <ArrowRight size={16} strokeWidth={2.2} />
              </span>
            )}
            <span className="flex flex-col items-center justify-center px-4 sm:px-5 min-w-[74px]">
              <b className={cn(
                'font-display text-[24px] font-bold leading-none num',
                s.win && s.value > 0 ? 'text-accent-500' : s.value === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-foreground'
              )}>
                {s.value}
              </b>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1.5 whitespace-nowrap">{s.label}</span>
            </span>
          </span>
        ))}
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-3">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

// ---- Card por consultor (opc- do mockup) -----------------------------------
function WorkRow({ label, done, target, tone }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 w-20 text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <span className="flex-1 h-[7px] rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
        <span className={cn('block h-full rounded-full', tone === 'brand' ? 'bg-brand-600 dark:bg-brand-500' : 'bg-accent-500')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('shrink-0 w-10 text-right font-display text-[12.5px] font-bold num', done === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-foreground')}>
        {done}/{target}
      </span>
    </div>
  );
}

function ConsultantCard({ card }) {
  const stopped = card.status === 'parada';
  const chipClass = stopped
    ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-300'
    : 'bg-slate-50 border-slate-100 text-slate-500 dark:bg-white/[0.03] dark:border-white/[0.06] dark:text-slate-400';
  return (
    <article className="relative rounded-2xl border border-border bg-card shadow-card p-4 pl-[18px] overflow-hidden">
      <span aria-hidden="true" className={cn('absolute left-0 inset-y-0 w-1', stopped ? 'bg-danger' : 'bg-success')} />
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 size-10 rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 font-display text-[14px] font-bold flex items-center justify-center tracking-wide">
          {dashInitials(card.name)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight truncate">{card.name}</div>
          <div className="text-[11.5px] text-slate-400 dark:text-slate-500">{card.role}</div>
        </div>
        <span className={cn(
          'shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1 rounded-full',
          stopped
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
        )}>
          <i className={cn('size-[7px] rounded-full', stopped ? 'bg-danger' : 'bg-success')} aria-hidden="true" />
          {stopped ? 'Parada' : 'Em dia'}
        </span>
      </div>

      {card.hasRuler && (
        <div className="mt-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Trabalho de hoje</div>
          <div className="space-y-2">
            {card.volTarget > 0 && <WorkRow label="Prospecção" done={card.volDone} target={card.volTarget} tone="accent" />}
            {card.goalTotal > 0 && <WorkRow label="Meta diária" done={card.goalDone} target={card.goalTotal} tone="brand" />}
          </div>
        </div>
      )}

      <div className="flex mt-3.5 rounded-[11px] overflow-hidden bg-paper-50 border border-slate-100 dark:bg-white/[0.03] dark:border-white/[0.06]">
        {[
          { value: card.funnel.agendou, label: 'Agendou' },
          { value: card.funnel.compareceu, label: 'Compareceu' },
          { value: card.funnel.matriculas, label: 'Matrículas', win: true }
        ].map((t, i) => (
          <div key={t.label} className={cn('flex-1 py-2 text-center', i > 0 && 'border-l border-slate-200/70 dark:border-white/[0.06]')}>
            <b className={cn(
              'block font-display text-[19px] font-bold leading-none num',
              t.value === 0 ? 'text-slate-300 dark:text-slate-600' : t.win ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
            )}>
              {t.value}
            </b>
            <span className="block text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <span className={cn('flex-1 flex items-center gap-2 px-2.5 py-2 rounded-[10px] border text-[11.5px]', chipClass)}>
          <b className={cn('font-display text-[16px] font-bold num', stopped ? 'text-rose-600 dark:text-rose-300' : 'text-foreground')}>{card.backlog.followUps}</b>
          follow-ups atrasados
        </span>
        <span className={cn('flex-1 flex items-center gap-2 px-2.5 py-2 rounded-[10px] border text-[11.5px]', chipClass)}>
          <b className={cn('font-display text-[16px] font-bold num', stopped ? 'text-rose-600 dark:text-rose-300' : 'text-foreground')}>{card.backlog.noShows}</b>
          {card.backlog.noShows === 1 ? 'no-show a reagendar' : 'no-shows a reagendar'}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] text-[11.5px] text-muted-foreground">
        <i className="size-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" aria-hidden="true" />
        {card.last ? (
          <>
            <span className="truncate">Última ação: <b className="text-foreground font-semibold">{card.last.text}</b></span>
            <span className="ml-auto shrink-0 text-slate-400 dark:text-slate-500 num whitespace-nowrap">{card.last.when}</span>
          </>
        ) : (
          <span className="italic text-slate-400">Nenhuma ação registrada ainda</span>
        )}
      </div>
    </article>
  );
}

// ---- Placar do dia (md- do mockup) — visão do próprio consultor ------------
function SegStrip({ done, total, tone }) {
  if (total > 14) {
    const pct = Math.min(100, Math.round((done / total) * 100));
    return (
      <div className="h-2.5 rounded-[3px] bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-2">
        <div className={cn('h-full rounded-[3px]', tone === 'brand' ? 'bg-brand-600' : 'bg-accent-500')} style={{ width: `${pct}%` }} />
      </div>
    );
  }
  return (
    <div className="flex gap-1 mt-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'flex-1 h-2.5 rounded-[3px]',
            i < done ? (tone === 'brand' ? 'bg-brand-600' : 'bg-accent-500') : 'bg-slate-100 dark:bg-white/[0.08]'
          )}
        />
      ))}
    </div>
  );
}

function PlacarDoDia({ leads, interactions, appUser, db, onNavigate, now }) {
  const { metaWeekdays = [1, 2, 3, 4, 5], dailyVolumeTarget = 0, contractThresholdDays = 30 } = useGeneralConfig();

  // Histórico PRÓPRIO de metas batidas (1 doc por dia batido) — mesma leitura
  // da tela Meta Diária.
  const [ownHistory, setOwnHistory] = useState([]);
  useEffect(() => {
    if (!appUser?.authUid) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      query(ref, where('consultantAuthUid', '==', appUser.authUid)),
      (snap) => setOwnHistory(snap.docs.map(d => d.data())),
      () => { /* regras ainda não publicadas → mantém vazio sem quebrar a UI */ }
    );
    return () => unsub();
  }, [db, appUser]);

  const { goalDone, goalTotal, volDone, volTarget, monthVol, monthVolTarget, monthDots, monthHits } = useMemo(() => {
    const byLead = buildInteractionsByLead(interactions);
    const { totalSlots, doneSlots } = slotTotals(computeDailyGoalSlots(leads, byLead, appUser.id, contractThresholdDays));
    const target = volumeTargetFor(appUser, dailyVolumeTarget);
    const vol = target > 0 ? computeDailyVolume(leads, interactions, appUser.id, appUser.authUid) : null;
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const mVol = target > 0 ? computeVolumeInRange(leads, interactions, appUser.id, appUser.authUid, monthStart, null, metaWeekdays) : null;

    // Dias de meta do mês até hoje: batido / perdido / hoje (pulsando).
    const hits = new Set(ownHistory.map(h => h.date).filter(Boolean));
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const dots = [];
    for (let day = 1; day <= today.getDate(); day++) {
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      if (!(metaWeekdays || []).includes(d.getDay())) continue;
      dots.push({ key: dgDateKey(d), hit: hits.has(dgDateKey(d)), isToday: d.getTime() === today.getTime() });
    }
    return {
      goalDone: doneSlots,
      goalTotal: totalSlots,
      volDone: vol?.total || 0,
      volTarget: target,
      monthVol: mVol?.total || 0,
      monthVolTarget: target * countMetaDaysInMonth(metaWeekdays, now),
      monthDots: dots,
      monthHits: dots.filter(d => d.hit).length
    };
  }, [leads, interactions, appUser, contractThresholdDays, dailyVolumeTarget, metaWeekdays, ownHistory, now]);

  const goalOk = goalTotal > 0 && goalDone >= goalTotal;
  const volOk = volTarget === 0 || volDone >= volTarget;
  const pill = goalOk && volOk && (goalTotal > 0 || volTarget > 0)
    ? { label: 'Dia fechado', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-300', icon: <Check size={12} strokeWidth={3} /> }
    : goalDone > 0 || volDone > 0
      ? { label: 'No ritmo', cls: 'bg-accent-50 border-accent-100 text-accent-600 dark:bg-accent-500/10 dark:border-accent-500/25 dark:text-accent-400', icon: <Flame size={12} className="fill-accent-500 text-accent-500" /> }
      : { label: 'Hora de começar', cls: 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/[0.04] dark:border-white/10 dark:text-slate-400', icon: null };

  const faltamTarefas = Math.max(0, goalTotal - goalDone);
  const faltamAcoes = volTarget > 0 ? Math.max(0, volTarget - volDone) : 0;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card p-[18px] font-display">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.12em] text-slate-400 dark:text-slate-500">META DO DIA</div>
          <div className="text-[16px] font-bold tracking-tight mt-0.5 leading-tight">Seu placar de hoje</div>
        </div>
        <span className={cn('shrink-0 inline-flex items-center gap-1.5 border text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap', pill.cls)}>
          {pill.icon}
          {pill.label}
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-[26px] rounded-lg bg-brand-50 dark:bg-brand-500/15 grid place-items-center shrink-0" aria-hidden="true">
              <Check size={15} strokeWidth={2.6} className="text-brand-600 dark:text-brand-300" />
            </span>
            <span className="flex-1 text-[13px] font-semibold">Tarefas da meta</span>
            <span className="font-bold text-[20px] leading-none tracking-tight num">
              {goalDone}<small className="text-[12.5px] font-semibold text-slate-400">/{goalTotal}</small>
            </span>
          </div>
          {goalTotal > 0 ? (
            <>
              <SegStrip done={goalDone} total={goalTotal} tone="brand" />
              <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-right num">
                {faltamTarefas > 0 ? `faltam ${faltamTarefas}` : 'meta batida'}
              </div>
            </>
          ) : (
            <div className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">Nenhuma tarefa na meta de hoje.</div>
          )}
        </div>

        {volTarget > 0 && (
          <div>
            <div className="flex items-center gap-2">
              <span className="size-[26px] rounded-lg bg-accent-50 dark:bg-accent-500/15 grid place-items-center shrink-0" aria-hidden="true">
                <Zap size={15} className="fill-accent-500 text-accent-500" />
              </span>
              <span className="flex-1 text-[13px] font-semibold">Prospecção</span>
              <span className="font-bold text-[20px] leading-none tracking-tight num">
                {volDone}<small className="text-[12.5px] font-semibold text-slate-400">/{volTarget}</small>
              </span>
            </div>
            <SegStrip done={volDone} total={volTarget} tone="accent" />
            <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-right num">
              {faltamAcoes > 0 ? `faltam ${faltamAcoes}` : 'alvo batido'}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3 rounded-xl bg-paper-50 border border-slate-100 dark:bg-white/[0.03] dark:border-white/[0.06] p-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Ritmo do mês</div>
          <div className="flex gap-1 mt-2">
            {monthDots.map((d) => (
              <span
                key={d.key}
                title={d.isToday ? 'hoje' : d.key}
                className={cn(
                  'flex-1 aspect-square max-w-4 rounded-full',
                  d.hit
                    ? 'bg-accent-500 shadow-[0_1px_3px_rgba(255,106,43,.4)]'
                    : d.isToday
                      ? 'bg-card border-2 border-dashed border-accent-400 motion-safe:animate-pulse'
                      : 'bg-card border-[1.5px] border-dashed border-slate-300 dark:border-white/20'
                )}
              />
            ))}
          </div>
          <div className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight num">
            {monthHits} de {monthDots.length} {monthDots.length === 1 ? 'dia' : 'dias'} com a meta batida
          </div>
        </div>
        {volTarget > 0 && (
          <div className="flex-1 min-w-0 border-l border-slate-200 dark:border-white/[0.08] pl-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Prospecção no mês</div>
            <div className="font-bold text-[19px] tracking-tight mt-1.5 num">
              {monthVol}<small className="text-[12px] font-semibold text-slate-400">/{monthVolTarget}</small>
            </div>
            <div className="h-[7px] rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden mt-2">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${monthVolTarget > 0 ? Math.min(100, Math.round((monthVol / monthVolTarget) * 100)) : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3.5 text-[11.5px] text-slate-600 dark:text-slate-300 text-center leading-snug font-sans">
        {faltamTarefas === 0 && faltamAcoes === 0 ? (
          <>Dia fechado — <b className="font-bold text-foreground">meta e prospecção completas</b>.</>
        ) : (
          <>
            Faltam{' '}
            {faltamTarefas > 0 && <b className="font-bold text-foreground num">{faltamTarefas} {faltamTarefas === 1 ? 'tarefa' : 'tarefas'}</b>}
            {faltamTarefas > 0 && faltamAcoes > 0 && ' e '}
            {faltamAcoes > 0 && <b className="font-bold text-foreground num">{faltamAcoes} {faltamAcoes === 1 ? 'ação' : 'ações'}</b>}
            {' '}pra fechar o dia
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate && onNavigate('dailyGoal')}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-[14px] tracking-tight py-3 shadow-[0_8px_18px_-8px_rgba(255,106,43,.6)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
      >
        Trabalhar a meta
        <ArrowRight size={16} strokeWidth={2.4} />
      </button>
    </section>
  );
}

// ---- View -------------------------------------------------------------------
function DashboardOperacionalView({ leads, interactions, appUser, usersList, db, onNavigate }) {
  const { openProfile } = useLeadProfile();
  const isAdmin = isAdminUser(appUser);

  // Relógio da tela (tempo real): atualiza por minuto — move o marcador
  // "agora", o funil do dia e os cards sem depender de reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dayFunnel = useMemo(() => computeDayFunnel(leads, now), [leads, now]);
  const agenda = useMemo(() => computeTodayAgenda(leads, now), [leads, now]);
  const board = useMemo(() => computeConsultantDayBoard(leads, { now }), [leads, now]);
  const goals = useTeamGoals({ db, appUser, usersList, leads, interactions });

  // Última ação de cada consultor (autoria pela interaction, como no antigo
  // feed): a mais recente, com verbo legível.
  const lastActionByUser = useMemo(() => {
    if (!isAdmin) return {};
    const leadById = new Map((leads || []).map(l => [l.id, l]));
    const sorted = (interactions || [])
      .filter(i => i.createdAt instanceof Date)
      .sort((a, b) => b.createdAt - a.createdAt);
    const map = {};
    (usersList || []).forEach((u) => {
      const hit = sorted.find(i =>
        (i.consultantAuthUid && u.authUid && i.consultantAuthUid === u.authUid) ||
        (i.consultantName && i.consultantName === u.name)
      );
      if (!hit) return;
      const lead = leadById.get(hit.leadId);
      map[u.id] = {
        text: `${actionVerb(hit, lead)} ${lead?.name || 'lead'}`,
        when: humanizeAge(hit.createdAt, now)
      };
    });
    return map;
  }, [isAdmin, interactions, usersList, leads, now]);

  // Cards "Time agora": um por consultor com régua de meta OU movimento no
  // dia; ordenado por atenção (parada primeiro, backlog maior primeiro).
  const consultantCards = useMemo(() => {
    if (!isAdmin) return [];
    return (usersList || [])
      .map((u) => {
        const g = goals[u.id] || null;
        const b = board[u.id] || null;
        const goalTotal = g?.goalTotal || 0;
        const goalDone = g?.goalDone || 0;
        const volTarget = g?.volTarget || 0;
        const volDone = g?.volTotal || 0;
        const hasRuler = goalTotal > 0 || volTarget > 0;
        const hasBoard = Boolean(b && (b.agendou || b.matriculas || b.followUpsAtrasados || b.noShows));
        if (!hasRuler && !hasBoard) return null; // sem meta e sem movimento: card não informa nada
        const stopped = hasRuler && goalDone === 0 && volDone === 0;
        return {
          key: u.id,
          name: u.name || 'Consultor',
          role: u.role === 'admin' ? 'gestor' : 'consultor',
          status: stopped ? 'parada' : 'ok',
          hasRuler,
          goalDone, goalTotal, volDone, volTarget,
          funnel: {
            agendou: b?.agendou || 0,
            compareceu: b?.compareceu || 0,
            matriculas: b?.matriculas || 0
          },
          backlog: {
            followUps: b?.followUpsAtrasados || 0,
            noShows: b?.noShows || 0
          },
          last: lastActionByUser[u.id] || null
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if ((a.status === 'parada') !== (b.status === 'parada')) return a.status === 'parada' ? -1 : 1;
        const backlogA = a.backlog.followUps + a.backlog.noShows;
        const backlogB = b.backlog.followUps + b.backlog.noShows;
        return backlogB - backlogA || a.name.localeCompare(b.name);
      });
  }, [isAdmin, usersList, goals, board, lastActionByUser]);

  const eyebrowDate = now
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    .replace(', ', ' · ');

  return (
    <div className="space-y-4 animate-fade-in font-sans">
      {/* ---- Hero ---- */}
      <section className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{eyebrowDate}</div>
        <h2 className="mt-1 font-display text-[26px] font-semibold tracking-tight leading-tight">
          {isAdmin ? 'Painel do dia' : 'Seu dia de trabalho'}
        </h2>
      </section>

      {isAdmin ? (
        <DayPulseCard funnel={dayFunnel} now={now} />
      ) : (
        <div className="flex items-baseline gap-4 flex-wrap rounded-2xl bg-card border border-border shadow-card px-5 py-3">
          {[
            { value: dayFunnel.novos, label: dayFunnel.novos === 1 ? 'lead hoje' : 'leads hoje' },
            { value: dayFunnel.agendados, label: dayFunnel.agendados === 1 ? 'agendamento' : 'agendamentos' },
            { value: dayFunnel.matriculas, label: dayFunnel.matriculas === 1 ? 'matrícula' : 'matrículas', win: true }
          ].map((it, i) => (
            <span key={it.label} className="flex items-baseline gap-4">
              {i > 0 && <span aria-hidden="true" className="w-px h-6 self-center bg-border" />}
              <span className="flex items-baseline gap-2">
                <span className={cn('num font-display text-[22px] font-bold leading-none', it.win && it.value > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>{it.value}</span>
                <span className="text-[10.5px] font-semibold text-muted-foreground whitespace-nowrap">{it.label}</span>
              </span>
            </span>
          ))}
        </div>
      )}

      <div className={cn('grid gap-4', !isAdmin && 'lg:grid-cols-[minmax(0,1fr)_340px] items-start')}>
        <DashCard
          title="Linha do dia"
          hint={isAdmin
            ? 'visitas e aulas de hoje, na ordem do relógio · com o consultor responsável'
            : 'suas visitas e aulas de hoje, na ordem do relógio'}
          action={
            <span className="text-[11.5px] font-medium text-muted-foreground num whitespace-nowrap">
              {agenda.length === 1 ? '1 agendamento' : `${agenda.length} agendamentos`}
            </span>
          }
        >
          <DashTimeline
            events={agenda}
            now={now}
            showConsultant={isAdmin}
            onEventClick={(lead) => openProfile(lead.id)}
          />
        </DashCard>

        {!isAdmin && (
          <PlacarDoDia
            leads={leads}
            interactions={interactions}
            appUser={appUser}
            db={db}
            onNavigate={onNavigate}
            now={now}
          />
        )}
      </div>

      {isAdmin && (
        <section>
          <div className="flex items-baseline gap-2.5 mb-3 px-0.5">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Time agora</h3>
            <span className="text-[12px] text-slate-400 dark:text-slate-500">quem está produzindo e quem parou · ordenado por atenção</span>
          </div>
          {consultantCards.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {consultantCards.map((card) => <ConsultantCard key={card.key} card={card} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-card py-8 text-center text-[12.5px] text-slate-400 italic">
              Nenhum consultor com meta configurada ou movimento hoje.
            </div>
          )}
        </section>
      )}

      <footer className="pt-1 pb-2 text-center text-[11.5px] text-slate-400 whitespace-nowrap">
        Atualizado agora · fixo em hoje
      </footer>
    </div>
  );
}

export { DashboardOperacionalView };
