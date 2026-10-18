import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { collection, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { recordGoalHit as recordGoalHitDoc } from '../lib/dailyGoalHistory.js';
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL, APPOINTMENT_OUTCOMES, getAppointmentOutcomeMeta, getLeadAppointmentType, getLeadAppointmentDate, hasGoalDoneTodayFor, appointmentTaskOwnerId, goalOwnerFields, isClientLead, outcomeAppliesToAula } from '../lib/leads.js';
import { isMetaParticipant } from '../lib/acesso.js';
import { logInteraction } from '../lib/interactions.js';
import { withBucket } from '../lib/leadDerived.js';
import { stageChangeFields } from '../lib/stageMove.js';
import { DG_CATEGORY_META, DG_CATEGORY_ORDER, COLOR_TONES, dgDateKey, buildInteractionsByLead, computeDailyGoalSlots, computeRitmo, overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS, computeDailyVolume, computeVolumeInRange, countMetaDaysInMonth, volumeTargetFor, volumeBreakdownLabel, tomorrowAppointmentsOf, slotTotals, newLeadHandledPatch } from '../lib/dailyGoal.js';
import { followUpChannelOf } from '../lib/contactGoal.js';
import { computeDayAgenda } from '../lib/dayAgenda.js';
import { useDayAgenda } from '../hooks/useDayAgenda.js';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { DayAgendaCard } from '../components/dailygoal/DayAgendaCard.jsx';
import { RoutineCard } from '../components/dailygoal/RoutineCard.jsx';
import { OutcomePopover } from '../components/dailygoal/OutcomePopover.jsx';
import { writeAppointmentOutcome, correctAppointmentOutcome } from '../lib/appointmentOutcome.js';
import { planPromotion, correctableOutcome, consumedFields } from '../lib/outcomeCorrection.js';
import { applyOutcomeToAula, closeOpenAppointment, upsertScheduledAppointment, upsertScheduledAula } from '../lib/aulasWrites.js';
import { recordPlanFor } from '../lib/aulas.js';
import { daysToExpiryOf, activeRenewalCheckpoint } from '../lib/renewalGoal.js';
import { expiredLabel, expiredSortKey } from '../lib/expiredGoal.js';
import { formatHourLabel, humanizeAge, humanizeUntil } from '../lib/format.js';
import { cn } from '../lib/utils.js';
import { contactOf, telHref, whatsappHref } from '../lib/guardian.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { ContactPhone } from '../components/profile/ContactPhone.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn, IconBtn } from '../components/ui/Btn.jsx';
import { RenewalOutcomeModal } from '../modals/RenewalOutcomeModal.jsx';
import { ContactOutcomeModal } from '../modals/ContactOutcomeModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { RescheduleModal } from '../modals/RescheduleModal.jsx';
import { NextContactModal } from '../modals/NextContactModal.jsx';
import { AlertCircle, BookOpen, Building2, Calendar, Check, CheckCircle, ChevronRight, Clock, Dumbbell, Flame, Kanban, MessageCircle, MessageSquare, MoreHorizontal, Phone, RefreshCw, Target, Zap } from 'lucide-react';

// DAILY GOAL VIEW — DESIGN PRIMITIVES
// ==========================================
// (metadados de categoria/cores e a lógica de slots moraram aqui; foram para
// src/lib/dailyGoal.js, que guarda a regra pura e testada)


function WhatsappGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-3.2-6.4L20 4l-1.4 3.2A8 8 0 0 1 20 12z" />
      <path d="M8.5 9.5c0 3 2 5 5 5l1.5-1.5-2-1-1 1c-1 0-2-1-2-2l1-1-1-2L9 7c-.5 1-.5 2-.5 2.5z" />
    </svg>
  );
}

function DgCategoryChip({ slug }) {
  const m = DG_CATEGORY_META[slug];
  if (!m) return null;
  const t = COLOR_TONES[m.color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
      {m.short}
    </span>
  );
}

function TimePill({ icon, children, tone = 'slate' }) {
  const toneMap = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${toneMap[tone]}`}>
      {icon}
      {children}
    </span>
  );
}


function Dial({ progress }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-[96px] h-[96px]">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={R} stroke="currentColor" className="text-slate-100 dark:text-white/[0.06]" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={R}
          stroke="currentColor"
          className="text-brand-600"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * progress) / 100}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <Target size={26} className="text-brand-600" />
      </div>
    </div>
  );
}

function ProgressHero({ firstName, greeting, counts, totalSlots, doneSlots, progress, volume }) {
  const pendingCount = totalSlots - doneSlots;
  const segs = DG_CATEGORY_ORDER
    .map((c) => ({ c, n: counts[c] || 0 }))
    .filter((s) => s.n > 0);
  const sum = segs.reduce((s, x) => s + x.n, 0) || 1;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-8 flex-wrap">
        <div className="max-w-xl min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Target size={13} className="text-brand-600" /> Meta diária
          </div>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold tracking-tight leading-tight">
            {greeting}, {firstName}.{' '}
            {pendingCount > 0 ? (
              <>
                Você tem <span className="text-brand-600">{pendingCount} {pendingCount === 1 ? 'tarefa' : 'tarefas'}</span> antes de fechar o dia.
              </>
            ) : totalSlots === 0 ? (
              <span className="text-slate-500">Nenhuma tarefa por hoje. Aproveite o turno.</span>
            ) : (
              <span className="text-emerald-600">{volume?.perfect ? 'Dia perfeito ⚡' : 'Meta batida!'}</span>
            )}
          </h2>
          <p className="mt-2 text-[13.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Foque nos novos leads recentes e nas visitas/aulas agendadas. Os atrasados podem esperar o fim do turno.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-5">
          <div className="text-right">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Concluído hoje</div>
            <div className="num text-[44px] font-semibold leading-none tracking-tight mt-1">
              {progress}
              <span className="text-[22px] text-slate-400 dark:text-slate-500">%</span>
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 num mt-1">
              {doneSlots} de {totalSlots} tarefas
            </div>
            {volume?.target > 0 && (
              <div
                className={cn(
                  'mt-1.5 inline-flex items-center gap-1 text-[11.5px] num font-semibold',
                  volume.count >= volume.target ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}
                title={`Prospecção do dia: ${volumeBreakdownLabel(volume.breakdown)}`}
              >
                <Zap size={11} /> {volume.count} de {volume.target} ações
              </div>
            )}
          </div>
          <Dial progress={progress} />
        </div>
      </div>

      <div className="mt-6">
        <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden flex gap-[2px]">
          {segs.map((s) => {
            const m = DG_CATEGORY_META[s.c];
            const t = COLOR_TONES[m.color];
            return (
              <div
                key={s.c}
                className={`seg h-full ${t.strong} opacity-90`}
                style={{ flexBasis: `${(s.n / sum) * 100}%` }}
                title={`${m.short}: ${s.n}`}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
          {segs.map((s) => {
            const m = DG_CATEGORY_META[s.c];
            const t = COLOR_TONES[m.color];
            return (
              <span key={s.c} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className={`w-2 h-2 rounded-full ${t.dot}`}></span>
                <span className="font-medium">{m.short}</span>
                <span className="num text-slate-400">{s.n}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FilterChip({ active, label, count, color, onClick }) {
  const t = color ? COLOR_TONES[color] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-2 transition whitespace-nowrap ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07] dark:hover:bg-white/[0.06]'}`}
    >
      {t && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>}
      {label}
      <span className={`num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center min-w-[18px] ${active ? 'bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}>{count}</span>
    </button>
  );
}

function NextUp({ task, slug, countdownLabel, appointmentLabel, onWhatsapp, onOutcome, onReschedule }) {
  if (!task) return null;
  const m = DG_CATEGORY_META[slug] || DG_CATEGORY_META[DAILY_GOAL_CATEGORIES.VISITA_HOJE];
  const t = COLOR_TONES[m.color];
  // Tipo do compromisso (Visita / Aula Experimental). Sendo aula, mostra
  // também a modalidade e a quantidade de aulas previstas.
  const isAula = slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const TypeIcon = m.Icon;
  const typeLabel = isAula ? 'Aula Experimental' : 'Visita';
  const modality = String(task.appointmentModality || '').trim();
  const qty = Number(task.trialClassesPlanned);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Próximo compromisso</div>
        {countdownLabel && <span className="num text-[11px] text-slate-400 whitespace-nowrap">{countdownLabel}</span>}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={task.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[14px] truncate">{task.name}</div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate"><ContactPhone lead={task} showName /></div>
        </div>
        {appointmentLabel && (
          <div className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold whitespace-nowrap ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
            {appointmentLabel}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
          <TypeIcon size={11} /> {typeLabel}{isAula && Number.isFinite(qty) && qty > 0 ? ` · ${qty} ${qty === 1 ? 'aula' : 'aulas'}` : ''}
        </span>
        {isAula && modality && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
            <Dumbbell size={11} /> {modality}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Btn kind="soft" icon={<WhatsappGlyph size={13} />} onClick={() => onWhatsapp && onWhatsapp(task)}>WhatsApp</Btn>
        {/* NextUp deriva de pendingBySlug (categoria sempre pendente). O campo
            appointmentOutcome no doc pode estar stale de um agendamento anterior,
            por isso o balão abre sempre sem desfecho. */}
        <OutcomePopover
          withMore
          title={`${typeLabel} de ${task.name || 'lead sem nome'}`}
          onPick={(id) => {
            if (id === 'rescheduled') { if (onReschedule) onReschedule(task, slug); }
            else if (onOutcome) onOutcome(task, id, slug);
          }}
        />
      </div>
    </div>
  );
}

// Tipo (ícone + label) do compromisso, usado no card "Amanhã".
function dgApptTypeMeta(lead) {
  const t = getLeadAppointmentType(lead); // 'visita' | 'aula_experimental' | null
  if (t === 'visita') return { Icon: Building2, label: 'Visita' };
  if (t === 'aula_experimental') return { Icon: BookOpen, label: 'Aula exp.' };
  const ft = String(lead?.nextFollowUpType || '');
  if (/liga/i.test(ft)) return { Icon: Phone, label: 'Ligação' };
  if (/mensagem|whats/i.test(ft)) return { Icon: MessageCircle, label: 'Mensagem' };
  return { Icon: MessageSquare, label: 'Contato' };
}

// Nomes dos dias da semana (0=dom..6=sáb), usados no seletor de dias da
// meta nas Configurações Gerais.
const DG_WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Ritmo do mês: dias batidos / sequência / 14 dias. 100% real — lê o
// histórico persistido (não mais mockado). A config de dias é da academia.
function StreakCard({ history14, monthHits, monthTarget, streak, volumeMonth }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Ritmo do mês</div>
        <Flame size={14} className="text-amber-500" />
      </div>
      <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap">
        <span className="num text-[22px] font-semibold tracking-tight">{monthHits}/{monthTarget}</span>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{monthTarget === 1 ? 'dia batido' : 'dias batidos'}</span>
      </div>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: 'repeat(14,minmax(0,1fr))' }}>
        {history14.map((day, i) => (
          <div
            key={i}
            className={`h-5 rounded-[3px] ${
              day.isToday ? 'bg-brand-600/20 ring-1 ring-brand-500'
                : day.hit ? 'bg-emerald-500/80'
                  : day.active ? 'bg-slate-100 dark:bg-white/[0.05]'
                    : 'bg-slate-50 dark:bg-white/[0.02]'
            }`}
            title={`${day.label}${day.hit ? ' · meta batida' : day.active ? ' · não batida' : ' · fora da meta'}`}
          />
        ))}
      </div>
      <div className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
        Sequência atual: <span className="font-semibold text-slate-700 dark:text-slate-200 num">{streak} {streak === 1 ? 'dia' : 'dias'}</span>
      </div>
      {volumeMonth && volumeMonth.target > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-1.5">
          <Zap size={13} className={cn('shrink-0', volumeMonth.total >= volumeMonth.target ? 'text-emerald-500' : 'text-amber-500')} />
          <span className="text-[11.5px] text-muted-foreground">Prospecção no mês</span>
          <span className={cn('num text-[12px] font-semibold ml-auto', volumeMonth.total >= volumeMonth.target ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200')}>{volumeMonth.total} de {volumeMonth.target}</span>
        </div>
      )}
    </div>
  );
}

function DgSection({ slug, tasks, render }) {
  const m = DG_CATEGORY_META[slug];
  if (!m || !tasks.length) return null;
  const t = COLOR_TONES[m.color];
  const Icon = m.Icon;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-6 h-6 rounded-md grid place-items-center ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
          <Icon size={13} />
        </span>
        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">{m.label}</h3>
        <span className="num text-[11.5px] text-slate-500 dark:text-slate-400">{tasks.length}</span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-white/[0.06] ml-1"></div>
      </div>
      <div className="space-y-2.5">
        {tasks.map((task) => render(task, slug))}
      </div>
    </div>
  );
}

// Renders a single (lead × categorySlug) task card.
// Same lead with two pending categories renders TWICE — once per slug — with independent actions per main's per-category status model.
// Exportado para o teste em node conferir os links sem montar a tela inteira.
export function TaskCard({ task, slug, now, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, onPostpone, onOutcome, onReschedule, onGoalDone, onWhatsapp, onCall }) {
  const m = DG_CATEGORY_META[slug];
  if (!m) return null;
  const t = COLOR_TONES[m.color];
  const isAppt = slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const isOverdue = slug === DAILY_GOAL_CATEGORIES.ATRASADO;
  const isNovo = slug === DAILY_GOAL_CATEGORIES.NOVO_24H;
  const isContato = slug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE;
  const isExpired = slug === DAILY_GOAL_CATEGORIES.VENCIDO;
  const Icon = m.Icon;

  // Contato: especifica se o follow-up agendado é Ligação ou Mensagem
  // (lido de nextFollowUpType). Fallback "Contato" p/ tipo genérico/legado.
  const followUpType = String(task.nextFollowUpType || '');
  const isLigacao = /liga/i.test(followUpType);
  const isMensagem = /mensagem|whats/i.test(followUpType);
  const contatoTypeLabel = isLigacao ? 'Ligação' : isMensagem ? 'Mensagem' : 'Contato';
  const ContatoIcon = isLigacao ? Phone : MessageCircle;
  const contatoDate = isContato && task.nextFollowUp instanceof Date && !isNaN(task.nextFollowUp.getTime())
    ? task.nextFollowUp : null;
  // Observação que o consultor registrou ao agendar o contato.
  const followUpNote = String(task.nextFollowUpNote || '').trim();
  // TaskCard só renderiza para categorias pendentes (filtro em pendingBySlug),
  // então qualquer appointmentOutcome no documento é de um agendamento ANTERIOR
  // já tratado (o campo persiste entre agendamentos) — por isso o desfecho
  // NÃO é exibido aqui (evita um "Desfecho registrado" stale bloqueando ações).
  const apptDate = getLeadAppointmentDate(task);
  const appointmentLabel = (isAppt && apptDate) ? `Hoje · ${formatHourLabel(apptDate)}` : null;
  const enteredAtLabel = (isNovo && task.createdAt) ? formatHourLabel(task.createdAt) : null;
  const age = isNovo ? humanizeAge(task.createdAt, now) : null;
  // A régua da lib (overdueDaysOf), a mesma da ordem da lista e dos Relatórios.
  // Conta também o lead novo sem próximo passo, que entra aqui sem próximo
  // contato: para ele o card diz por que está atrasado.
  const overdueDays = isOverdue ? overdueDaysOf(task, now) : 0;
  const newLeadWithoutNextStep = isOverdue && !task.nextFollowUp;
  const note = task.observation || '';

  return (
    <div className="task-card group bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200/80 dark:border-white/[0.06] shadow-card hover:shadow-card-lg hover:border-slate-300 dark:hover:border-white/10 transition fade-in">
      {/* relative: é este cabeçalho que a camada do link esticado cobre. O
          onClick saiu, senão o clique empilharia duas entradas no histórico. */}
      <div className="relative p-3.5 flex items-start gap-3 cursor-pointer">
        <Avatar name={task.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* draggable={false}: a camada do ::after é da âncora, então sem
                isto arrastar em qualquer ponto do cabeçalho arrastaria o
                endereço da ficha para outra aba ou para um campo de texto.
                after:rounded-t-xl, e não rounded-xl: aqui a camada cobre só o
                bloco de cima do card, então arredondar os quatro cantos deixa
                dois cantinhos mortos na divisa com o rodapé e desenha canto
                arredondado do anel de foco no meio do card. */}
            <LeadLink
              leadId={task.id}
              stretched
              draggable={false}
              className="font-semibold text-[14px] text-slate-900 dark:text-white truncate outline-none after:rounded-t-xl focus-visible:after:ring-inset focus-visible:after:anel-foco"
            >
              {task.name}
            </LeadLink>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500 dark:text-slate-400 num flex-wrap">
            <ContactPhone lead={task} showName />
            {task.source && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
                <span className="truncate">{task.source}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <DgCategoryChip slug={slug} />
            {isContato && (
              <TimePill icon={<ContatoIcon size={11} />}>
                {contatoTypeLabel}{contatoDate ? <span className="opacity-60"> · Hoje {formatHourLabel(contatoDate)}</span> : null}
              </TimePill>
            )}
            {appointmentLabel && (
              <TimePill icon={<Calendar size={11} />}>{appointmentLabel}</TimePill>
            )}
            {enteredAtLabel && (
              <TimePill icon={<Clock size={11} />}>
                Entrou {enteredAtLabel}{age ? <span className="opacity-60"> · {age}</span> : null}
              </TimePill>
            )}
            {newLeadWithoutNextStep && (
              <TimePill icon={<AlertCircle size={11} />} tone="rose">Sem próximo passo desde o cadastro</TimePill>
            )}
            {isOverdue && overdueDays > 0 && (
              overdueDays >= slaOverdueDays ? (
                // Fora do SLA da academia: destaque sólido.
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap bg-rose-600 text-white">
                  <AlertCircle size={11} /> {overdueDays} dias — crítico
                </span>
              ) : (
                <TimePill icon={<AlertCircle size={11} />} tone="rose">{overdueDays} {overdueDays === 1 ? 'dia' : 'dias'} atrasado</TimePill>
              )
            )}
            {isExpired && (
              <TimePill icon={<Clock size={11} />}>
                {expiredLabel(task, now)}
                {task.currentPlanName ? <span className="opacity-60"> · {task.currentPlanName}</span> : null}
              </TimePill>
            )}
            {task.hasOtherActivityToday && (
              <TimePill icon={<Check size={11} />} tone="amber">Já interagido. Feche pela Meta</TimePill>
            )}
          </div>

          {followUpNote && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.05] px-2.5 py-1.5 text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
              <MessageSquare size={12} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="clip-2">{followUpNote}</span>
            </div>
          )}
          {note && (
            <p className="text-[12.5px] leading-snug text-slate-500 dark:text-slate-400 mt-2 clip-1">{note}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className={`w-8 h-8 grid place-items-center rounded-lg ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
            <Icon size={15} />
          </div>
          {/* relative z-10: sem isto ele fica por baixo da camada do link
              esticado e para de responder. */}
          <LeadLink
            leadId={task.id}
            tabIndex={-1}
            draggable={false}
            title="Abrir ficha"
            aria-label={`Abrir ficha de ${task.name || 'lead sem nome'}`}
            className="relative z-10 w-8 h-8 grid place-items-center rounded-lg transition text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]"
          >
            <MoreHorizontal size={16} />
          </LeadLink>
        </div>
      </div>

      <div className="px-3.5 pb-3 pt-1 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Btn kind="soft" icon={<WhatsappGlyph size={14} />} onClick={() => onWhatsapp && onWhatsapp(task)}>WhatsApp</Btn>
          <IconBtn icon={<Phone size={15} />} title="Ligar" onClick={() => onCall && onCall(task)} />
          {!isAppt && (
            <IconBtn icon={<Calendar size={15} />} title="Reagendar" onClick={() => onPostpone && onPostpone(task, slug)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isAppt ? (
            <OutcomePopover
              withMore
              title={`${slug === DAILY_GOAL_CATEGORIES.AULA_HOJE ? 'Aula experimental' : 'Visita'} de ${task.name || 'lead sem nome'}`}
              onPick={(id) => {
                if (id === 'rescheduled') { if (onReschedule) onReschedule(task, slug); }
                else if (onOutcome) onOutcome(task, id, slug);
              }}
            />
          ) : (
            <Btn kind="primary" icon={<Check size={14} />} onClick={() => onGoalDone && onGoalDone(task, slug, '')}>Concluir</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// `now`, `saving` e `onCorrect` ligam a correção do desfecho: sem onCorrect o
// card só mostra o texto, como antes. Sem hook, porque o metaLinks.test chama
// o componente como função.
export function DoneCard({ lead, now = null, saving = false, onReschedule, onCorrect }) {
  const firstDoneSlug = (lead.categorySlugs || []).find(s => lead.categoryStatus?.[s]);
  const outcomeMeta = lead.appointmentOutcome ? getAppointmentOutcomeMeta(lead.appointmentOutcome) : null;
  const apptSlug = (lead.categorySlugs || []).find(
    s => s === DAILY_GOAL_CATEGORIES.VISITA_HOJE || s === DAILY_GOAL_CATEGORIES.AULA_HOJE
  );
  const correctable = apptSlug && onCorrect && now ? correctableOutcome(lead, now) : null;
  // relative: base da camada do link esticado. Sem o onClick do container o
  // clique simples empilha uma entrada só no histórico.
  return (
    <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition">
      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 grid place-items-center pop">
        <Check size={13} />
      </div>
      <Avatar name={lead.name} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* draggable={false}: mesma razão do TaskCard, a camada cobre o
              card inteiro e sem isto o card vira um endereço arrastável. */}
          <LeadLink
            leadId={lead.id}
            stretched
            draggable={false}
            className="font-medium text-[13px] text-slate-800 dark:text-slate-100 line-through decoration-slate-400/60 truncate outline-none after:rounded-xl focus-visible:after:ring-inset focus-visible:after:anel-foco"
          >
            {lead.name}
          </LeadLink>
          {firstDoneSlug && <DgCategoryChip slug={firstDoneSlug} />}
        </div>
        {correctable ? (
          // relative z-10: por cima da camada do link esticado, igual ao Remarcar.
          <div className="mt-1">
            <OutcomePopover
              size="sm"
              outcome={correctable}
              saving={saving}
              className="relative z-10"
              title={`Desfecho de ${lead.name || 'lead sem nome'}`}
              onPick={(to) => onCorrect(lead, apptSlug, to)}
            />
          </div>
        ) : outcomeMeta ? (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{outcomeMeta.icon} {outcomeMeta.label}</div>
        ) : (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">Concluído</div>
        )}
      </div>
      {apptSlug && onReschedule && (
        <button
          type="button"
          onClick={() => onReschedule(lead, apptSlug)}
          title="Remarcar agendamento"
          className="relative z-10 w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"
        >
          <RefreshCw size={13} />
        </button>
      )}
      <ChevronRight size={16} className="text-slate-400" />
    </div>
  );
}

// Uma linha da prévia de amanhã. É link de verdade, como as outras entradas da
// ficha, e fica num componente próprio para o teste em node conseguir
// renderizá-la sem montar a Meta inteira. A âncora é a linha inteira, então
// draggable={false}, senão arrastar em qualquer ponto dela arrastaria o
// endereço da ficha para outra aba ou para um campo de texto.
export function TomorrowApptRow({ lead, when }) {
  const { Icon, label } = dgApptTypeMeta(lead);
  return (
    <LeadLink
      leadId={lead.id}
      draggable={false}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/10 transition outline-none focus-visible:ring-inset focus-visible:anel-foco"
    >
      <Avatar name={lead.name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
        <div className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1"><Icon size={12} /> {label}</span>
          {contactOf(lead).phone && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
              <ContactPhone lead={lead} showName />
            </>
          )}
        </div>
      </div>
      <span className="num text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">{formatHourLabel(when)}</span>
    </LeadLink>
  );
}

// ==========================================
// DAILY GOAL VIEW (META DIÁRIA)
// ==========================================

function DailyGoalView({ leads, interactions, appUser, statuses, db, usersList, listenersActive = true }) {
  const toast = useToast();
  // A categoria aberta vem do endereço: F5 mantém e o link abre na mesma
  // categoria.
  const paramsCtx = useMemo(() => ({}), []);
  const [{ cat: filter }, setParams] = useScreenParams('dailyGoal', paramsCtx);
  const setFilter = (v) => setParams({ cat: v });
  const [now, setNow] = useState(() => new Date());
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [nextContactTarget, setNextContactTarget] = useState(null);
  const prevProgress = useRef(null); // null = ainda sem cálculo nesta montagem
  // Tarefas com gravação em andamento (lead e categoria). O card só some quando
  // o snapshot chega, e o segundo clique nesse meio gravava a marca de novo.
  const savingTasks = useRef(new Set());
  const claimTask = (key) => {
    if (savingTasks.current.has(key)) return false;
    savingTasks.current.add(key);
    return true;
  };
  const releaseTask = (key) => savingTasks.current.delete(key);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Chave do dia derivada do relógio (atualiza por minuto): muda SÓ na virada
  // de meia-noite e entra como dependência dos memos baseados em "hoje" — sem
  // ela, a categorização ficava congelada no dia anterior com a aba aberta (A5).
  const todayKey = dgDateKey(now);

  // ── Ritmo do mês (histórico de metas batidas, por consultor) ──────────
  // Dias da semana em que a meta vale (0=dom..6=sáb) — política da ACADEMIA,
  // definida pelo admin nas Configurações Gerais. A sequência pula os dias
  // inativos (não quebram nem contam). Default seg–sex.
  // renewalGraceDays sem default aqui de propósito: undefined deixa
  // computeDailyGoalSlots cair no próprio default, e evita o número mágico
  // repetido em cada tela. O que NÃO pode é deixar de repassar — era isso que
  // fazia a Meta do gestor divergir da do consultor.
  const { metaWeekdays = [1, 2, 3, 4, 5], slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, renewalCheckpoints = [90, 60, 30], renewalGraceDays } = useGeneralConfig();

  // Renovação: popup de desfecho (8b) ao concluir a tarefa + fluxo de
  // matrícula/renovação existente quando o desfecho é "Renovou".
  const [renewalTarget, setRenewalTarget] = useState(null); // { lead, activeCheckpoint } | null
  const [matriculaTarget, setMatriculaTarget] = useState(null); // lead | null
  // Contato: popup de desfecho (8b) ao concluir a tarefa de Contato Hoje
  // (feito / reagendar). Só para a categoria Contato — atrasado segue no
  // NextContactModal antigo.
  const [contactTarget, setContactTarget] = useState(null); // { lead, categorySlug } | null

  // Histórico persistido: 1 doc por dia que o consultor zerou a meta.
  const [dailyHistory, setDailyHistory] = useState([]);
  useEffect(() => {
    if (!appUser?.authUid) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      query(ref, where('consultantAuthUid', '==', appUser.authUid)),
      (snap) => setDailyHistory(snap.docs.map(d => d.data())),
      () => { /* regras ainda não publicadas → mantém vazio sem quebrar a UI */ }
    );
    return () => unsub();
  }, [db, appUser]);

  // Grava (idempotente) a marca de "meta batida hoje". ID determinístico
  // por (consultor, dia) → setDoc/merge não duplica. volumeCount/volumeTarget
  // ficam no mesmo doc — base do selo "dia perfeito" e do relatório futuro.
  // A escrita em si mora em lib/dailyGoalHistory.js: o App grava de qualquer
  // tela quando as pendências do dia zeram, não só por aqui.
  const recordGoalHit = useCallback(
    (volCount = null, volTarget = null) => recordGoalHitDoc(db, appUser, { volumeCount: volCount, volumeTarget: volTarget }),
    [db, appUser]
  );

  const ritmoMes = useMemo(() => {
    void todayKey; // o "hoje" do ritmo/sequência também vira com o dia (A5)
    return computeRitmo(dailyHistory, metaWeekdays);
  }, [dailyHistory, metaWeekdays, todayKey]);

  // Slots da MINHA meta — regra única em src/lib/dailyGoal.js (Meta-only:
  // só Venda/Perda hoje ou daily_goal_done marcam tarefa).
  // Com o relógio da tela (`now`, por minuto): a janela de 24h do lead novo
  // fecha na hora certa, e não só quando chega dado novo.
  // O índice das interações só muda quando chegam interações, e não a cada
  // minuto do relógio.
  const interactionsByLead = useMemo(() => buildInteractionsByLead(interactions), [interactions]);
  const processedLeads = useMemo(
    () => computeDailyGoalSlots(leads, interactionsByLead, appUser.id, renewalCheckpoints, renewalGraceDays, now),
    [leads, appUser, interactionsByLead, now, renewalCheckpoints, renewalGraceDays]
  );

  // Agenda do dia (painel compartilhado): todas as visitas e aulas de HOJE na
  // academia, de qualquer consultor. Calculada à parte — NÃO entra em
  // processedLeads/totalSlots, não conta na minha meta. Quem confirma credita o
  // dono da tarefa do agendamento: o dono do lead, ou o consultor que agendou
  // no lead dele (writeAppointmentOutcome e appointmentTaskOwnerId).
  const [savingAgendaId, setSavingAgendaId] = useState(null);

  // Índice de usuários por doc id E por authUid: consultantId guarda o id do
  // doc, appointmentOutcomeBy guarda o authUid. Uma entrada por chave, mesmo
  // objeto, para a regra pura resolver os dois nomes com um lookup só.
  const usersById = useMemo(() => {
    const m = new Map();
    (usersList || []).forEach((u) => {
      const entry = { name: u.name };
      m.set(u.id, entry);
      if (u.authUid) m.set(u.authUid, entry);
    });
    return m;
  }, [usersList]);

  const { items: agendaLeads } = useDayAgenda({ db, enabled: listenersActive, dayKey: todayKey });

  const dayAgenda = useMemo(
    () => computeDayAgenda({ liveLeads: leads, agendaLeads, usersById, viewerId: appUser.id, now }),
    [leads, agendaLeads, usersById, appUser, now]
  );

  // Agenda de hoje. Linha sem desfecho: grava o escolhido. Linha já marcada:
  // o balão corrige (troca ou desfaz) pelo correctAppointmentOutcome, que
  // devolve a etapa e o próximo contato que o Compareceu tinha mudado.
  const markAgendaPresence = async (row, choice) => {
    if (savingAgendaId) return;
    setSavingAgendaId(row.id);
    try {
      // CLIENTE é caso à parte: ele está na agenda só para upsell de modalidade,
      // não para prospecção. A presença dele não mexe em etapa do funil
      // (promote), senão podia empurrá-lo de volta para o funil de vendas. O
      // próximo contato segue a regra de todos (consumedFields): sai só o eco do
      // agendamento, e o contato de renovação marcado à parte fica.
      const quem = row.isMine ? '' : ` (meta de ${row.ownerName})`;
      const isCliente = row.isClient;

      if (row.outcome) {
        const to = choice === 'undo' ? null : choice;
        if (to === row.outcome) return;
        const { revertedTo } = await correctAppointmentOutcome({
          db, lead: row, from: row.outcome, to, categorySlug: row.categorySlug, appUser, statuses,
          isClient: isCliente, sourceLabel: 'Agenda do dia',
        });
        const volta = revertedTo ? ` Voltou para ${revertedTo}.` : '';
        if (to === null) toast.success(`Marcação de ${row.name} desfeita${quem}.${volta}`);
        else if (to === 'attended') toast.success(`Desfecho de ${row.name} corrigido para compareceu${quem}.`);
        else toast.success(`Desfecho de ${row.name} corrigido para não compareceu${quem}.${volta}`);
        // Mesmo passo do Não compareceu normal: sem nova data o lead fica parado.
        if (to === 'no_show') {
          setRescheduleTarget({ lead: row, categorySlug: row.categorySlug, flow: 'after_no_show' });
        }
        return;
      }

      if (choice !== 'attended' && choice !== 'no_show') return;
      // Não regrava a marca da Meta se já existe uma de hoje nesta categoria.
      // Sem isso, dois consultores confirmando a mesma linha (que é o cenário
      // normal de uma agenda compartilhada) empilham registros na timeline.
      // Só conta a marca do dono da tarefa de agora: a visita que outra pessoa
      // fez de manhã no mesmo lead tem a marca dela, e a visita de agora
      // precisa da sua para contar na Meta de quem a tem.
      const jaTemMarcaHoje = hasGoalDoneTodayFor(
        row,
        row.categorySlug,
        (interactions || []).filter((i) => i.leadId === row.id),
        new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        appointmentTaskOwnerId(row)
      );
      await writeAppointmentOutcome({
        db, lead: row, outcome: choice, categorySlug: row.categorySlug, appUser, statuses,
        promote: !isCliente,
        writeGoalDone: !jaTemMarcaHoje,
        sourceLabel: 'Agenda do dia',
      });
      toast.success(choice === 'attended'
        ? `Presença de ${row.name} confirmada${quem}.`
        : `${row.name} marcado como não veio${quem}.`);
      // Quem não veio precisa de nova data, senão o lead fica parado sem
      // próximo passo. Abre a remarcação na hora — fechar a janela é o
      // "deixo pra marcar depois". Mesmo comportamento do handleOutcome da
      // Meta; comparecimento não pergunta nada, só aplica o que já é regra.
      if (choice === 'no_show') {
        setRescheduleTarget({ lead: row, categorySlug: row.categorySlug, flow: 'after_no_show' });
      }
    } catch (err) {
      console.error('markAgendaPresence', err);
      toast.error('Não foi possível salvar a presença. Tente novamente.');
    } finally {
      setSavingAgendaId(null);
    }
  };

  // Helper para filtragem por categoria. Lead com 2 categorias pode
  // estar "feito" em uma e "pendente" na outra.
  const isLeadDoneForCategory = (lead, categorySlug) =>
    Boolean(lead.categoryStatus?.[categorySlug]);

  // Cada lead pode estar em várias categorias, cada uma com status próprio. A
  // conta é a mesma do selo do menu (slotTotals, em lib/dailyGoal.js).
  const { totalSlots, doneSlots, progress } = slotTotals(processedLeads);
  const total = totalSlots;

  // ── Meta por VOLUME (piso de esforço) ──────────────────────────────────
  // Alvo: definido por consultor (doc do usuário); sem alvo = sem régua.
  // Gestor fica fora (target 0 = sem barra). Ações = agendamentos/reagendamentos,
  // ligações/mensagens e leads novos (ver lib/dailyGoal.js).
  // Cota de prospecção é 100% individual: vem do doc do usuário, não do
  // config da academia. volumeTargetFor ignora qualquer 2º argumento.
  const volumeTarget = volumeTargetFor(appUser);
  const volumeData = useMemo(() => {
    if (!volumeTarget) return null;
    void todayKey; // vira com o dia, como o resto da Meta
    return computeDailyVolume(leads, interactions, appUser.id, appUser.authUid);
  }, [leads, interactions, appUser, volumeTarget, todayKey]);
  const volumeCount = volumeData?.total || 0;
  // Dia perfeito ⚡ = pendências zeradas E volume batido (não trava o ritmo).
  const perfectDay = progress === 100 && total > 0 && volumeTarget > 0 && volumeCount >= volumeTarget;
  // Acumulado do MÊS de prospecção (vs alvo do mês = alvo/dia × dias de meta) —
  // exibido abaixo do "Ritmo do mês".
  const volumeMonth = useMemo(() => {
    if (!volumeTarget) return null;
    void todayKey;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { total: mTotal } = computeVolumeInRange(leads, interactions, appUser.id, appUser.authUid, monthStart, null, metaWeekdays);
    return { total: mTotal, target: volumeTarget * countMetaDaysInMonth(metaWeekdays) };
  }, [leads, interactions, appUser, volumeTarget, metaWeekdays, todayKey]);

  // Para a coluna "Feitos Hoje" — mostra leads que têm AO MENOS uma
  // categoria concluída. Lead pendente em qualquer categoria continua
  // aparecendo na coluna "A Fazer".
  const done = processedLeads.filter(l => l.categorySlugs.some(s => isLeadDoneForCategory(l, s)));


  useEffect(() => {
    if (progress === 100 && total > 0) {
      // Confete SÓ em transição real durante a sessão (ex.: 90% → 100%).
      // prevProgress null = primeiro cálculo após montar — quem reabre a tela
      // com a meta já batida não ganha celebração repetida (A4).
      if (prevProgress.current !== null && prevProgress.current !== 100) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, zIndex: 99999 });
      }
      // A gravação do "dia batido" roda SEMPRE que a meta está zerada com
      // tarefa (idempotente) — inclusive no mount, cobrindo quem fechou a
      // última tarefa fora da Meta (ex.: Venda no Kanban) e só abriu depois.
      // Dia de folga (total = 0) não conta no ritmo. volumeCount nas deps:
      // o doc do dia atualiza se o volume crescer após zerar as pendências.
      recordGoalHit(volumeCount, volumeTarget);
    }
    prevProgress.current = progress;
  }, [progress, total, volumeCount, volumeTarget, recordGoalHit]);

  // Abre o pop-up de desfecho da categoria, já no desfecho pedido (o Reagendar
  // do card passa 'reagendar'). Devolve false quando a categoria não tem
  // pop-up: o Novo lead conclui direto.
  // - Renovação e Vencidos: RenewalOutcomeModal (regra em renewalGoal.js e
  //   expiredGoal.js), com o marco ativo na Renovação.
  // - Contato e Atrasado: ContactOutcomeModal (regra em contactGoal.js), que
  //   obriga data futura no Reagendar.
  const openOutcomePopup = (lead, categorySlug, initialOutcome = null) => {
    if (categorySlug === DAILY_GOAL_CATEGORIES.RENOVACAO) {
      const checkpoint = activeRenewalCheckpoint(daysToExpiryOf(lead.currentContractEndsAt, now), renewalCheckpoints);
      setRenewalTarget({ lead, activeCheckpoint: checkpoint, initialOutcome });
      return true;
    }
    if (categorySlug === DAILY_GOAL_CATEGORIES.VENCIDO) {
      setRenewalTarget({ lead, activeCheckpoint: null, variant: 'vencido', initialOutcome });
      return true;
    }
    if (categorySlug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE || categorySlug === DAILY_GOAL_CATEGORIES.ATRASADO) {
      setContactTarget({ lead, categorySlug, initialOutcome });
      return true;
    }
    return false;
  };

  // O botão de reagendar do card (o antigo "Adiar p/ amanhã"). Abre o pop-up de
  // desfecho já no Reagendar, com amanhã preenchido e o motivo obrigatório, e a
  // tarefa conta como feita, como no Reagendar do Concluir. Até 17/10/2026 ele
  // gravava o próximo contato direto: a tarefa sumia sem marca e sem motivo (dava
  // para bater o dia adiando tudo), o atrasado de uma visita perdida virava uma
  // visita falsa no dia seguinte e o agendamento do aluno era apagado. O Novo
  // lead usa o pop-up do contato.
  const handleRescheduleTask = (lead, categorySlug) => {
    if (!openOutcomePopup(lead, categorySlug, 'reagendar')) {
      setContactTarget({ lead, categorySlug, initialOutcome: 'reagendar' });
    }
  };

  const handleOutcome = async (lead, outcome, categorySlug) => {
    if (!APPOINTMENT_OUTCOMES.includes(outcome)) return;
    const meta = getAppointmentOutcomeMeta(outcome);
    // Auto-move "Compareceu" em visita/aula → Negociação no mesmo funil. A
    // regra e o registro de onde o lead saiu (para a correção poder voltar)
    // moram em planPromotion (src/lib/outcomeCorrection.js), a mesma da Agenda.
    // Cliente nunca é promovido: quem virou cliente não volta a ser lead, nem
    // o que está numa etapa com nome de matrícula ("Matriculado").
    const { toStatus: promoteTo, promotedFrom } = planPromotion({
      lead, outcome, categorySlug, statuses, promote: !isClientLead(lead),
    });

    // A trava vem colada ao try: o finally sempre a solta, e nada antes dele
    // pode deixá-la presa e o card mudo.
    const taskKey = `${lead.id}:${categorySlug}`;
    if (!claimTask(taskKey)) return;
    try {
      const leadUpdate = {
        appointmentOutcome: outcome,
        appointmentOutcomeAt: serverTimestamp(),
        appointmentOutcomeBy: appUser.authUid || appUser.id || null,
        appointmentPromotedFrom: promotedFrom
      };
      if (promoteTo) {
        leadUpdate.status = promoteTo;
        leadUpdate.statusEnteredAt = serverTimestamp();
      }
      // O que o desfecho tira do lead, na mesma regra da Agenda de hoje
      // (consumedFields): o eco do agendamento e, no Cancelou, o agendamento.
      Object.assign(leadUpdate, consumedFields(outcome, lead));
      // Marca a tarefa da Meta como concluída para essa categoria
      // específica. Type='daily_goal_done' é a fonte ÚNICA de verdade
      // para "tarefa cumprida" no fluxo da Meta Diária. O leadUpdate acompanha
      // a interação no mesmo batch (withBucket porque pode promover para
      // Negociação, mudando o status resultante). A marca guarda quem tem a
      // tarefa agora (goalOwnerFields), e o crédito fica com essa pessoa.
      await logInteraction(db, lead, appUser,
        {
          text: `${meta.icon} ${meta.label} — Meta Diária (${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug})`,
          type: 'daily_goal_done',
          dailyGoalCategory: categorySlug,
          ...goalOwnerFields(lead, categorySlug),
          appointmentOutcome: outcome
        },
        withBucket(leadUpdate, lead)
      );
      // Dual-write best-effort: só desfecho de AULA toca o histórico (guarda #1).
      // handleOutcome atende visita_hoje E aula_hoje; sem isto, o desfecho de
      // uma visita corromperia a aula antiga apontada por currentAulaId.
      if (outcomeAppliesToAula(categorySlug)) {
        try { await applyOutcomeToAula({ db, lead, outcome }); } catch (err) { console.error('applyOutcomeToAula falhou', err); }
      }
      // Log adicional da mudança de fase para o feed do lead.
      if (promoteTo) {
        await logInteraction(db, lead, appUser, {
          text: `Fase alterada para [${promoteTo}] após comparecimento em ${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug}.`,
          type: 'status_change',
          ...stageChangeFields(lead, promoteTo)
        });
      }
      if (promoteTo) {
        toast.success(`${meta.label} registrado. ${lead.name} → ${promoteTo}.`);
      } else {
        toast.success(`${meta.label} registrado para ${lead.name}.`);
      }
      // Após o desfecho, oferecer o próximo toque. 'no_show' remarca a
      // visita/aula; 'attended'/'cancelled' abrem o "Próximo contato?" (a data
      // antiga foi consumida e já foi limpa acima, então sem isto o lead
      // ficaria sem follow-up futuro). A tarefa de hoje já está fechada.
      if (outcome === 'no_show') {
        setRescheduleTarget({ lead, categorySlug, flow: 'after_no_show' });
      } else if (outcome === 'attended' || outcome === 'cancelled') {
        const ctx = outcome === 'attended' ? 'Comparecimento registrado' : 'Agendamento cancelado';
        setNextContactTarget({ lead, categorySlug, flow: 'after_outcome', contextLabel: ctx });
      }
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível registrar o comparecimento. Tente novamente.');
    } finally {
      releaseTask(taskKey);
    }
  };

  // "Feitos hoje": corrige o desfecho de visita ou aula marcado hoje. Usa o
  // mesmo estado de gravação da Agenda (savingAgendaId), porque as duas mexem
  // no desfecho do mesmo lead. Depois da correção, o passo seguinte é o do
  // card "A fazer": Não compareceu pede a remarcação e Compareceu pergunta o
  // próximo contato.
  const handleCorrectOutcome = async (lead, categorySlug, to) => {
    if (savingAgendaId) return;
    const from = correctableOutcome(lead, now);
    if (!from || from === to || (to !== 'attended' && to !== 'no_show')) return;
    setSavingAgendaId(lead.id);
    try {
      const { revertedTo } = await correctAppointmentOutcome({
        db, lead, from, to, categorySlug, appUser, statuses,
        isClient: isClientLead(lead), sourceLabel: 'Meta Diária',
      });
      const volta = revertedTo ? ` Voltou para ${revertedTo}.` : '';
      if (to === 'attended') toast.success(`Desfecho de ${lead.name} corrigido para compareceu.`);
      else toast.success(`Desfecho de ${lead.name} corrigido para não compareceu.${volta}`);
      if (to === 'no_show') {
        setRescheduleTarget({ lead, categorySlug, flow: 'after_no_show' });
      } else {
        setNextContactTarget({ lead, categorySlug, flow: 'after_outcome', contextLabel: 'Comparecimento registrado' });
      }
    } catch (err) {
      console.error('handleCorrectOutcome', err);
      toast.error('Não foi possível corrigir o desfecho. Tente novamente.');
    } finally {
      setSavingAgendaId(null);
    }
  };

  const handleGoalDone = async (lead, categorySlug, note) => {
    if (!Object.values(DAILY_GOAL_CATEGORIES).includes(categorySlug)) return;
    // Renovação, Vencidos, Contato e Atrasado concluem pelo pop-up de desfecho,
    // que grava o patch, a linha do tempo e a marca do dia. O Atrasado usa o do
    // contato porque ele obriga data futura no Reagendar: o "Próximo contato?"
    // antigo deixava gravar o próximo contato no passado.
    if (openOutcomePopup(lead, categorySlug)) return;
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    if (!window.confirm(`Concluir a tarefa "${categoryLabel}" deste lead?`)) return;
    const noteText = (note || '').trim();
    const taskKey = `${lead.id}:${categorySlug}`;
    if (!claimTask(taskKey)) return;
    try {
      // O Concluir do Novo lead trata o lead (newLeadHandledPatch): ele não vira
      // Atrasado quando a janela de 24h fechar.
      await logInteraction(db, lead, appUser, {
        text: noteText
          ? `✅ ${categoryLabel} — Meta Diária. Obs: ${noteText}`
          : `✅ ${categoryLabel} — Meta Diária concluída.`,
        type: 'daily_goal_done',
        dailyGoalCategory: categorySlug,
        ...goalOwnerFields(lead, categorySlug)
      }, newLeadHandledPatch(categorySlug));
      toast.success(`Tarefa "${categoryLabel}" concluída.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível concluir a tarefa. Tente novamente.');
    } finally {
      releaseTask(taskKey);
    }
  };

  // "Próximo contato?" — escolheu uma data. Agenda o próximo toque (contato:
  // Mensagem/Ligação) e, no fluxo 'complete' (Contato/Atrasado), fecha a tarefa
  // de hoje. volumeKind faz o agendamento contar como reaquecimento.
  const commitNextContact = async (newDate, note) => {
    if (!nextContactTarget) return;
    const { lead, categorySlug, flow = 'complete' } = nextContactTarget;
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    const noteText = (note || '').trim();
    const formattedDate = newDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = newDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    // Preserva o tipo de contato do lead (Ligação/Mensagem); default Mensagem.
    const { type: followUpTypeLabel, volumeKind } = followUpChannelOf(lead);
    const closeTask = flow === 'complete';
    try {
      // Agendar o próximo CONTATO não encosta no compromisso formal. Até
      // 18/08/2026 isto zerava appointmentType/appointmentScheduledFor e
      // apagava a visita ou aula que o lead tinha marcada (mesmo bug do wizard
      // e do contactReschedule). A categoria "Contato Hoje" da Meta agora
      // compara a DATA do compromisso, então não há mais conflito a evitar.
      const leadUpdate = {
        nextFollowUp: newDate,
        nextFollowUpType: followUpTypeLabel
      };
      // No fluxo 'complete' não há desfecho a preservar; em 'after_outcome' o
      // appointmentOutcome ('Compareceu'/'Cancelou') é mantido para o card.
      if (closeTask) {
        leadUpdate.appointmentOutcome = null;
        leadUpdate.appointmentOutcomeAt = null;
        leadUpdate.appointmentOutcomeBy = null;
      }
      await logInteraction(db, lead, appUser,
        {
          text: noteText
            ? `✅ ${categoryLabel} concluída — próximo contato (${followUpTypeLabel.toLowerCase()}) em ${formattedDate} às ${formattedTime}. Obs: ${noteText}`
            : `✅ ${categoryLabel} concluída — próximo contato (${followUpTypeLabel.toLowerCase()}) em ${formattedDate} às ${formattedTime}.`,
          type: closeTask ? 'daily_goal_done' : 'note',
          ...(closeTask ? { dailyGoalCategory: categorySlug, ...goalOwnerFields(lead, categorySlug) } : {}),
          volumeKind,
          rescheduledFor: newDate
        },
        leadUpdate
      );
      toast.success(`Próximo contato em ${formattedDate} às ${formattedTime}.`);
      setNextContactTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível agendar o próximo contato. Tente novamente.');
    }
  };

  // "Próximo contato?" — "Sem próximo contato". No fluxo 'complete' fecha a
  // tarefa e LIMPA só o nextFollowUp (não toca appointmentScheduledFor, para
  // nunca apagar uma visita/aula futura legítima). Em 'after_outcome' a tarefa
  // já foi fechada e a data já foi limpa no desfecho — só registra a obs.
  const commitNoNextContact = async (note) => {
    if (!nextContactTarget) return;
    const { lead, categorySlug, flow = 'complete' } = nextContactTarget;
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    const noteText = (note || '').trim();
    try {
      if (flow === 'complete') {
        await logInteraction(db, lead, appUser,
          {
            text: noteText
              ? `✅ ${categoryLabel} concluída — sem próximo contato agendado. Obs: ${noteText}`
              : `✅ ${categoryLabel} concluída — sem próximo contato agendado.`,
            type: 'daily_goal_done',
            dailyGoalCategory: categorySlug,
            ...goalOwnerFields(lead, categorySlug)
          },
          {
            nextFollowUp: null,
            nextFollowUpType: null
          }
        );
        toast.success(`Tarefa "${categoryLabel}" concluída.`);
      } else if (noteText) {
        await logInteraction(db, lead, appUser, {
          text: `Sem próximo contato agendado. Obs: ${noteText}`,
          type: 'note'
        });
      }
      setNextContactTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível concluir a tarefa. Tente novamente.');
    }
  };

  // Reschedule: opens the date dialog (set on TaskCard click or after no_show), then this commits.
  // Three flows:
  //   - flow='manual', cross-day  → writes daily_goal_done (today's task closes)
  //   - flow='manual', same-day   → writes plain 'note' (task remains pending, just new time)
  //   - flow='after_no_show'      → writes plain 'note' (task already closed via no_show)
  // Always updates appointment fields and clears appointmentOutcome so the
  // new appointment is fresh.
  const handleReschedule = async (newDate, note, newApptType, newModality, newQty, newProfessorId, newProfessorName, newSoloTraining) => {
    if (!rescheduleTarget) return;
    const { lead, categorySlug, flow = 'manual' } = rescheduleTarget;
    const formattedDate = newDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = newDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const noteText = (note || '').trim();

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const isStillToday = newDate >= todayStart && newDate <= todayEnd;
    const isAfterNoShow = flow === 'after_no_show';
    // Cross-day manual reschedule is the only path that needs to close today's task.
    const shouldCloseToday = !isAfterNoShow && !isStillToday;

    // Type may change during reschedule (decision 4): user can flip Visita ↔ Aula.
    const finalApptType = newApptType || getLeadAppointmentType(lead) || 'visita';
    const finalApptTypeLabel = finalApptType === 'aula_experimental' ? 'Aula Experimental' : 'Visita';
    const isAula = finalApptType === 'aula_experimental';
    const finalModality = isAula ? ((newModality || '').trim() || null) : null;
    const finalQty = isAula ? (Number(newQty) > 0 ? Number(newQty) : null) : null;
    const finalProfessorId = isAula ? (newProfessorId || null) : null;
    const finalProfessorName = isAula ? (newProfessorName || null) : null;
    const finalSoloTraining = isAula ? Boolean(newSoloTraining) : false;

    try {
      // Dual-write best-effort no histórico de aulas (stronix_aulas): a regra
      // do Firestore pode ainda não estar publicada, então falha aqui não
      // pode quebrar o reagendamento do lead, por isso o try/catch isolado.
      // O registro segue o agendamento do lead, como no assistente da ficha
      // (recordPlanFor, em lib/aulas.js): o que não vai mais acontecer fecha
      // (falta depois do "Não veio"; o "Compareceu" ou o "Não veio" que o lead
      // já tem, quando o agendamento muda, como no "Remarcar agendamento" do
      // "Feitos hoje"; cancelado na troca de tipo) e a visita nova move o
      // registro aberto ou abre um.
      const recordPlan = recordPlanFor(lead, { type: finalApptType, at: newDate, afterNoShow: isAfterNoShow });
      if (recordPlan.close) {
        try {
          await closeOpenAppointment({ db, lead, ...recordPlan.close });
        } catch (e) {
          console.error('closeOpenAppointment falhou', e);
        }
      }

      let currentAulaId = lead.currentAulaId || null;
      if (isAula) {
        try {
          currentAulaId = await upsertScheduledAula({
            db, lead,
            fields: {
              professorId: finalProfessorId,
              professorName: finalProfessorName,
              soloTraining: finalSoloTraining,
              modality: finalModality,
              scheduledFor: newDate,
            },
          });
        } catch (e) {
          console.error('upsertScheduledAula falhou', e);
        }
      }

      if (recordPlan.upsertVisita) {
        try {
          // O Remarcar não escolhe unidade: vai a do agendamento do lead, e
          // sem ela o registro em aberto mantém a que tinha.
          await upsertScheduledAppointment({
            db, lead,
            type: 'visita',
            fields: lead.appointmentUnit
              ? { unit: lead.appointmentUnit, scheduledFor: newDate }
              : { scheduledFor: newDate },
          });
        } catch (e) {
          console.error('upsertScheduledAppointment (visita) falhou', e);
        }
      }

      const leadUpdate = {
        appointmentScheduledFor: newDate,
        nextFollowUp: newDate, // keep legacy field in sync so the lead doesn't show up as "Atrasado" after rescheduling
        appointmentType: finalApptType,
        nextFollowUpType: finalApptTypeLabel,
        nextFollowUpNote: noteText || null,
        appointmentModality: finalModality,
        appointmentProfessorId: finalProfessorId,
        appointmentProfessorName: finalProfessorName,
        appointmentSoloTraining: finalSoloTraining,
        trialClassesPlanned: finalQty,
        appointmentOutcome: null,
        appointmentOutcomeAt: null,
        appointmentOutcomeBy: null,
        appointmentPromotedFrom: null,
        currentAulaId
      };

      let baseText;
      if (isAfterNoShow) {
        baseText = `🔄 Próxima tentativa marcada (${finalApptTypeLabel}) para ${formattedDate} às ${formattedTime}, após "Não veio".`;
      } else if (isStillToday) {
        baseText = `🔄 Horário ajustado: ${finalApptTypeLabel.toLowerCase()} para hoje às ${formattedTime}.`;
      } else {
        baseText = `🔄 Remarcou ${finalApptTypeLabel.toLowerCase()} para ${formattedDate} às ${formattedTime} — Meta Diária.`;
      }

      const interactionPayload = {
        text: noteText ? `${baseText} Obs: ${noteText}` : baseText,
        type: shouldCloseToday ? 'daily_goal_done' : 'note',
        rescheduledFor: newDate
      };
      // O reagendamento É a ação de prospecção (reaquecimento): conta SEMPRE
      // via volumeKind, inclusive quando também fecha a tarefa de hoje. O
      // daily_goal_done apenas fecha a tarefa da Meta (não soma no volume), logo
      // não há dupla contagem.
      interactionPayload.volumeKind = finalApptType;
      if (shouldCloseToday) {
        interactionPayload.dailyGoalCategory = categorySlug;
        interactionPayload.appointmentOutcome = 'rescheduled';
        // O Remarcar não troca o dono da tarefa: a marca fica com quem a tem.
        Object.assign(interactionPayload, goalOwnerFields(lead, categorySlug));
      }

      await logInteraction(db, lead, appUser, interactionPayload, leadUpdate);

      if (isAfterNoShow) {
        toast.success(`Próxima tentativa em ${formattedDate} às ${formattedTime}.`);
      } else if (isStillToday) {
        toast.success(`Horário ajustado para hoje às ${formattedTime}.`);
      } else {
        toast.success(`Remarcado para ${formattedDate} às ${formattedTime}.`);
      }
      setRescheduleTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a remarcação. Tente novamente.');
    }
  };

  // Fecha o popup de desfecho da renovação. "Renovou" encadeia o fluxo de
  // matrícula/renovação existente (ContractModal), que
  // grava o contrato e reseta os campos de renovação. Os outros desfechos já
  // gravaram tudo dentro do próprio RenewalOutcomeModal — só fecha.
  const handleRenewalOutcomeDone = (outcome) => {
    const renewedLead = renewalTarget?.lead || null;
    setRenewalTarget(null);
    if (outcome === 'renovou' && renewedLead) {
      setMatriculaTarget(renewedLead);
    }
  };

  const handleWhatsapp = (lead) => {
    const href = whatsappHref(contactOf(lead).phone);
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (lead) => {
    const href = telHref(contactOf(lead).phone);
    if (href) window.location.href = href;
  };

  // Per-slug pending tasks. A lead with two pending categories renders TWICE — once per slug — preserving main's per-category status model.
  const pendingBySlug = useMemo(() => {
    // Dinâmico a partir de DG_CATEGORY_ORDER — assim categorias novas (ex.:
    // 'renovacao') entram automaticamente. Hardcodar a lista aqui já fez a
    // tarefa de Renovação ser descartada silenciosamente (groups[slug]
    // undefined no push abaixo).
    const groups = Object.fromEntries(DG_CATEGORY_ORDER.map(slug => [slug, []]));
    processedLeads.forEach(lead => {
      (lead.categorySlugs || []).forEach(slug => {
        if (!isLeadDoneForCategory(lead, slug) && groups[slug]) groups[slug].push(lead);
      });
    });
    // SLA: na seção Atrasados, o atraso mais antigo vem primeiro — o consultor
    // ataca o lead mais crônico antes de o gestor precisar cobrar.
    groups[DAILY_GOAL_CATEGORIES.ATRASADO].sort((a, b) => overdueDaysOf(b, now) - overdueDaysOf(a, now));
    // Vencidos: o vencimento mais RECENTE primeiro — o inverso dos Atrasados,
    // de propósito: a chance de reativação cai a cada dia fora da academia.
    groups[DAILY_GOAL_CATEGORIES.VENCIDO].sort((a, b) => expiredSortKey(b) - expiredSortKey(a));
    return groups;
  }, [processedLeads, now]);

  const counts = Object.fromEntries(
    DG_CATEGORY_ORDER.map(slug => [slug, (pendingBySlug[slug] || []).length])
  );
  const totalPendingSlots = Object.values(counts).reduce((a, b) => a + b, 0);

  const nextAppt = useMemo(() => {
    const apptLeads = [
      ...pendingBySlug[DAILY_GOAL_CATEGORIES.VISITA_HOJE].map(l => ({ l, slug: DAILY_GOAL_CATEGORIES.VISITA_HOJE })),
      ...pendingBySlug[DAILY_GOAL_CATEGORIES.AULA_HOJE].map(l => ({ l, slug: DAILY_GOAL_CATEGORIES.AULA_HOJE }))
    ];
    return apptLeads
      .map(x => ({ ...x, when: getLeadAppointmentDate(x.l) }))
      .filter(x => x.when)
      .sort((a, b) => a.when - b.when)[0] || null;
  }, [pendingBySlug]);

  const nextApptDate = nextAppt ? getLeadAppointmentDate(nextAppt.l) : null;
  const countdownLabel = nextApptDate ? humanizeUntil(nextApptDate, now) : null;
  const nextApptLabel = nextApptDate ? `Hoje · ${formatHourLabel(nextApptDate)}` : null;

  // Agendamentos de AMANHÃ (prévia) — visitas, aulas e contatos do consultor
  // marcados para o dia seguinte. NÃO entram na meta de hoje (não tocam em
  // processedLeads/totalSlots): é só uma antecipação do que vem pela frente.
  // A visita e a aula seguem o dono da tarefa do agendamento, e o contato segue
  // quem tem o contato, que pode ser o colega que o recebeu, como na Meta
  // (regra em tomorrowAppointmentsOf, src/lib/dailyGoal.js).
  const tomorrowAppts = useMemo(() => {
    void todayKey; // "amanhã" também vira com o dia (A5)
    return tomorrowAppointmentsOf(leads, appUser.id);
  }, [leads, appUser, todayKey]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, [now]);

  const todayLabel = useMemo(() =>
    now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  [now]);

  const firstName = (appUser.name || '').split(' ')[0] || 'consultor';

  const renderTaskCard = (task, slug) => (
    <TaskCard
      key={`${task.id}-${slug}`}
      task={task}
      slug={slug}
      now={now}
      slaOverdueDays={slaOverdueDays}
      onPostpone={handleRescheduleTask}
      onOutcome={handleOutcome}
      onReschedule={(t, s) => setRescheduleTarget({ lead: t, categorySlug: s })}
      onGoalDone={handleGoalDone}
      onWhatsapp={handleWhatsapp}
      onCall={handleCall}
    />
  );

  const isTomorrowView = filter === 'tomorrow';
  const visibleSlugs = filter === 'all' ? DG_CATEGORY_ORDER : [filter];
  const visibleCount = filter === 'all'
    ? totalPendingSlots
    : isTomorrowView
      ? tomorrowAppts.length
      : (counts[filter] || 0);

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in relative font-sans">
      <ProgressHero
        firstName={firstName}
        greeting={greeting}
        counts={counts}
        totalSlots={totalSlots}
        doneSlots={doneSlots}
        progress={progress}
        volume={{ count: volumeCount, target: volumeTarget, perfect: perfectDay, breakdown: volumeData }}
      />


      <div className="grid grid-cols-12 gap-6 flex-1 min-h-[400px]">
        {/* LEFT — A FAZER */}
        <section className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden h-full flex flex-col">
            <div className="px-5 pt-5 pb-3 flex items-center gap-2.5 border-b border-slate-100 dark:border-white/[0.05]">
              <h2 className="text-[15px] font-semibold">{isTomorrowView ? 'Amanhã' : 'A fazer hoje'}</h2>
              <span className="num text-[11.5px] px-1.5 h-[20px] rounded-md grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{visibleCount}</span>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.05] flex flex-wrap gap-1.5">
              <FilterChip active={filter === 'all'} label="Todos" count={totalPendingSlots} onClick={() => setFilter('all')} />
              {DG_CATEGORY_ORDER.map(slug => (
                <FilterChip
                  key={slug}
                  active={filter === slug}
                  color={DG_CATEGORY_META[slug].color}
                  label={DG_CATEGORY_META[slug].short}
                  count={counts[slug] || 0}
                  onClick={() => setFilter(slug)}
                />
              ))}
              {/* Prévia: agendamentos de amanhã — não conta na meta de hoje,
                  por isso fica separado por um divisor das categorias acima. */}
              <span className="w-px h-5 bg-slate-200 dark:bg-white/10 self-center mx-0.5" aria-hidden="true" />
              <FilterChip
                active={isTomorrowView}
                label="Amanhã"
                count={tomorrowAppts.length}
                onClick={() => setFilter('tomorrow')}
              />
            </div>

            <div className={`p-5 flex-1 overflow-y-auto thin-scroll ${isTomorrowView ? 'space-y-2.5' : 'space-y-7'}`}>
              {isTomorrowView ? (
                tomorrowAppts.length === 0 ? (
                  <div className="py-14 grid place-items-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.05] grid place-items-center mb-3">
                      <Calendar size={22} className="text-slate-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nada agendado para amanhã</p>
                    <p className="text-[12.5px] mt-1">Sem visitas, aulas ou contatos marcados para o dia seguinte.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">
                      Prévia do dia seguinte. <span className="font-medium text-slate-600 dark:text-slate-300">Não conta na meta de hoje</span>.
                    </p>
                    {tomorrowAppts.map(({ lead, when }) => (
                      <TomorrowApptRow key={lead.id} lead={lead} when={when} />
                    ))}
                  </>
                )
              ) : totalSlots === 0 ? (
                <div className="py-14 grid place-items-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 grid place-items-center mb-3">
                    <CheckCircle size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Sua meta está vazia hoje</p>
                  <p className="text-[12.5px] mt-1">Aproveite o turno para prospectar novos leads.</p>
                </div>
              ) : visibleCount === 0 ? (
                <div className="py-14 grid place-items-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 grid place-items-center mb-3">
                    <CheckCircle size={22} className="text-emerald-500" />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhuma tarefa por aqui</p>
                  <p className="text-[12.5px] mt-1">Você está em dia com essa categoria. Bom trabalho!</p>
                </div>
              ) : (
                visibleSlugs.map(slug => (
                  <DgSection
                    key={slug}
                    slug={slug}
                    tasks={pendingBySlug[slug] || []}
                    render={renderTaskCard}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — Sidebar */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <NextUp
            task={nextAppt?.l}
            slug={nextAppt?.slug}
            countdownLabel={countdownLabel}
            appointmentLabel={nextApptLabel}
            onWhatsapp={handleWhatsapp}
            onOutcome={handleOutcome}
            onReschedule={(t, s) => setRescheduleTarget({ lead: t, categorySlug: s })}
          />

          {isMetaParticipant(appUser) && (
            <RoutineCard
              db={db}
              appUser={appUser}
              enabled={listenersActive}
              now={now}
              metaWeekdays={metaWeekdays}
            />
          )}

          <DayAgendaCard
            rows={dayAgenda.rows}
            pending={dayAgenda.pending}
            nextIndex={dayAgenda.nextIndex}
            savingId={savingAgendaId}
            onMark={markAgendaPresence}
          />

          <StreakCard
            history14={ritmoMes.history14}
            monthHits={ritmoMes.monthHits}
            monthTarget={ritmoMes.monthTarget}
            streak={ritmoMes.streak}
            volumeMonth={volumeMonth}
          />

          <div className="rounded-2xl border border-border bg-card shadow-card flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/[0.05]">
              <div className="flex items-center gap-2">
                <h3 className="text-[13.5px] font-semibold">Feitos hoje</h3>
                <span className="num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{done.length}</span>
              </div>
            </div>
            <div className="p-3 space-y-2 flex-1 overflow-y-auto thin-scroll">
              {done.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-[12.5px]">
                  Nenhuma tarefa concluída ainda.
                </div>
              ) : (
                done.map(lead => (
                  <DoneCard
                    key={lead.id}
                    lead={lead}
                    now={now}
                    saving={savingAgendaId === lead.id}
                    onReschedule={(l, s) => setRescheduleTarget({ lead: l, categorySlug: s })}
                    onCorrect={handleCorrectOutcome}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="pt-1 pb-2 text-center text-[11.5px] text-slate-400">
        Atualizado agora · {todayLabel} · <span className="font-display font-medium">STRONI</span><span className="font-display font-bold text-brand-600 dark:text-brand-400">LEAD</span>
      </footer>

      {rescheduleTarget && (
        <RescheduleModal
          lead={rescheduleTarget.lead}
          categorySlug={rescheduleTarget.categorySlug}
          currentDate={getLeadAppointmentDate(rescheduleTarget.lead)}
          currentType={getLeadAppointmentType(rescheduleTarget.lead)}
          flow={rescheduleTarget.flow || 'manual'}
          onConfirm={handleReschedule}
          onClose={() => setRescheduleTarget(null)}
        />
      )}

      {nextContactTarget && (
        <NextContactModal
          lead={nextContactTarget.lead}
          contextLabel={nextContactTarget.contextLabel}
          onPick={commitNextContact}
          onSkip={commitNoNextContact}
          onClose={() => setNextContactTarget(null)}
        />
      )}

      {renewalTarget && (
        <RenewalOutcomeModal
          lead={renewalTarget.lead}
          appUser={appUser}
          db={db}
          activeCheckpoint={renewalTarget.activeCheckpoint}
          variant={renewalTarget?.variant || 'renovacao'}
          initialOutcome={renewalTarget.initialOutcome}
          onDone={handleRenewalOutcomeDone}
          onClose={() => setRenewalTarget(null)}
        />
      )}

      {matriculaTarget && (
        <ContractModal
          lead={matriculaTarget}
          appUser={appUser}
          db={db}
          mode="renovacao"
          renewedFromId={matriculaTarget.currentContractId || null}
          onClose={() => setMatriculaTarget(null)}
          // `stale`: o modal já foi fechado pelo X (gravação pendente sem internet) e pode ter sido reaberto; não fecha o de agora.
          onDone={({ stale } = {}) => { if (!stale) setMatriculaTarget(null); }}
        />
      )}

      {contactTarget && (
        <ContactOutcomeModal
          lead={contactTarget.lead}
          categorySlug={contactTarget.categorySlug}
          initialOutcome={contactTarget.initialOutcome}
          appUser={appUser}
          db={db}
          onDone={() => setContactTarget(null)}
          onClose={() => setContactTarget(null)}
        />
      )}
    </div>
  );
}
export { DailyGoalView, DG_WEEKDAY_NAMES };
