import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { collection, doc, addDoc, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL, APPOINTMENT_OUTCOMES, getAppointmentOutcomeMeta, getLeadAppointmentType, getLeadAppointmentDate, getInteractionSecurityFields, isAdminUser } from '../lib/leads.js';
import { DG_CATEGORY_META, DG_CATEGORY_ORDER, COLOR_TONES, dgDateKey, buildInteractionsByLead, computeDailyGoalSlots, computeDelegatedPresenceSlots, computeRitmo, overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS, computeDailyVolume, computeVolumeInRange, countMetaDaysInMonth, volumeTargetFor, volumeBreakdownLabel } from '../lib/dailyGoal.js';
import { writeAppointmentOutcome } from '../lib/appointmentOutcome.js';
import { PresenceSwitch } from '../components/ui/PresenceSwitch.jsx';
import { formatHourLabel, humanizeAge, humanizeUntil } from '../lib/format.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL, professorsForModality, professorNameById } from '../lib/professores.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn, IconBtn } from '../components/ui/Btn.jsx';
import { DailyGoalTeamView } from './DailyGoalTeamView.jsx';
import { AlertCircle, BookOpen, Building2, Calendar, Check, CheckCircle, ChevronRight, Clock, Dumbbell, Flame, Kanban, MessageCircle, MessageSquare, MoreHorizontal, Phone, RefreshCw, Target, Users, X, Zap } from 'lucide-react';

// DAILY GOAL VIEW — DESIGN PRIMITIVES
// ==========================================
// (metadados de categoria/cores e a lógica de slots moraram aqui; foram para
// src/lib/dailyGoal.js para o painel da equipe do gestor reusar a MESMA regra)


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

function NextUp({ task, slug, countdownLabel, appointmentLabel, onWhatsapp, onOutcome }) {
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
          <div className="text-[12px] text-slate-500 dark:text-slate-400 num">{task.whatsapp}</div>
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
            por isso não condicionamos o botão a ele. */}
        <Btn kind="success" icon={<CheckCircle size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'attended', slug, e)}>Compareceu</Btn>
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
function TaskCard({ task, slug, now, slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, onOpen, onSnooze, onOutcome, onReschedule, onGoalDone, onWhatsapp, onCall }) {
  const m = DG_CATEGORY_META[slug];
  if (!m) return null;
  const t = COLOR_TONES[m.color];
  const isAppt = slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const isOverdue = slug === DAILY_GOAL_CATEGORIES.ATRASADO;
  const isNovo = slug === DAILY_GOAL_CATEGORIES.NOVO_24H;
  const isContato = slug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE;
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
  // TODO: substituir por critério Hot/Cold real (src/lib/leads) quando integrado aqui
  // Relógio vem da prop `now` (atualizada por minuto) — não de Date.now() no
  // render, que é instável entre re-renders e viola a pureza do componente.
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const isHot = isNovo && task.createdAt && task.createdAt >= oneHourAgo;
  const overdueDays = (isOverdue && task.nextFollowUp)
    ? Math.max(1, Math.ceil((new Date(now).setHours(0, 0, 0, 0) - task.nextFollowUp) / 86400000))
    : 0;
  const note = task.observation || '';

  return (
    <div className="task-card group bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200/80 dark:border-white/[0.06] shadow-card hover:shadow-card-lg hover:border-slate-300 dark:hover:border-white/10 transition fade-in">
      <div className="p-3.5 flex items-start gap-3 cursor-pointer" onClick={() => onOpen && onOpen(task)}>
        <Avatar name={task.name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-semibold text-[14px] text-slate-900 dark:text-white truncate">{task.name}</span>
            {isHot && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
                <Flame size={11} /> Quente
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-slate-500 dark:text-slate-400 num flex-wrap">
            <span>{task.whatsapp}</span>
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
            {isOverdue && overdueDays > 0 && (
              overdueDays >= slaOverdueDays ? (
                // Fora do SLA da academia: destaque sólido — é o lead que o
                // gestor vê como "crítico" no painel da Equipe.
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap bg-rose-600 text-white">
                  <AlertCircle size={11} /> {overdueDays} dias — crítico
                </span>
              ) : (
                <TimePill icon={<AlertCircle size={11} />} tone="rose">{overdueDays} {overdueDays === 1 ? 'dia' : 'dias'} atrasado</TimePill>
              )
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
          <IconBtn icon={<MoreHorizontal size={16} />} title="Mais" onClick={(e) => { e.stopPropagation(); onOpen && onOpen(task); }} />
        </div>
      </div>

      <div className="px-3.5 pb-3 pt-1 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Btn kind="soft" icon={<WhatsappGlyph size={14} />} onClick={(e) => { e.stopPropagation(); onWhatsapp && onWhatsapp(task); }}>WhatsApp</Btn>
          <IconBtn icon={<Phone size={15} />} title="Ligar" onClick={(e) => { e.stopPropagation(); onCall && onCall(task); }} />
          {!isAppt && (
            <IconBtn icon={<Calendar size={15} />} title="Adiar p/ amanhã" onClick={(e) => onSnooze && onSnooze(task, e)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isAppt ? (
            <>
              <Btn kind="success" icon={<Check size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'attended', slug, e)}>Compareceu</Btn>
              <Btn kind="secondary" icon={<X size={13} />} onClick={(e) => onOutcome && onOutcome(task, 'no_show', slug, e)}>Não veio</Btn>
              <Btn kind="soft" onClick={(e) => { e.stopPropagation(); onReschedule && onReschedule(task, slug); }}>Remarcou</Btn>
              <Btn kind="soft" onClick={(e) => onOutcome && onOutcome(task, 'cancelled', slug, e)}>Cancelou</Btn>
            </>
          ) : (
            <Btn kind="primary" icon={<Check size={14} />} onClick={(e) => { e.stopPropagation(); onGoalDone && onGoalDone(task, slug, '', e); }}>Concluir</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function DoneCard({ lead, onOpen, onReschedule }) {
  const firstDoneSlug = (lead.categorySlugs || []).find(s => lead.categoryStatus?.[s]);
  const outcomeMeta = lead.appointmentOutcome ? getAppointmentOutcomeMeta(lead.appointmentOutcome) : null;
  const apptSlug = (lead.categorySlugs || []).find(
    s => s === DAILY_GOAL_CATEGORIES.VISITA_HOJE || s === DAILY_GOAL_CATEGORIES.AULA_HOJE
  );
  return (
    <div
      onClick={() => onOpen && onOpen(lead)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] cursor-pointer hover:bg-white dark:hover:bg-white/[0.04] transition"
    >
      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 grid place-items-center pop">
        <Check size={13} />
      </div>
      <Avatar name={lead.name} size={28} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[13px] text-slate-800 dark:text-slate-100 line-through decoration-slate-400/60 truncate">{lead.name}</span>
          {firstDoneSlug && <DgCategoryChip slug={firstDoneSlug} />}
        </div>
        {outcomeMeta ? (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{outcomeMeta.icon} {outcomeMeta.label}</div>
        ) : (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">Concluído</div>
        )}
      </div>
      {apptSlug && onReschedule && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReschedule(lead, apptSlug); }}
          title="Remarcar agendamento"
          className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition shrink-0"
        >
          <RefreshCw size={13} />
        </button>
      )}
      <ChevronRight size={16} className="text-slate-400" />
    </div>
  );
}

// Build a `YYYY-MM-DDTHH:MM` string in LOCAL time for <input type="datetime-local">.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Botão de tipo do RescheduleModal — fora do componente pai para não ser
// recriado a cada render (evitava perder foco/estado dos inputs irmãos do modal).
function RescheduleTypeBtn({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-9 px-3 rounded-lg text-[12.5px] font-semibold transition border ${
        active
          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.07] dark:hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
  );
}

function RescheduleModal({ lead, categorySlug, currentDate, currentType, flow = 'manual', onConfirm, onClose }) {
  const isAfterNoShow = flow === 'after_no_show';
  const { modalities, trialClassOptions, professores } = useGeneralConfig();

  const defaultValue = useMemo(() => {
    const base = currentDate ? new Date(currentDate) : new Date();
    base.setDate(base.getDate() + 1);
    return toDatetimeLocalValue(base);
  }, [currentDate]);

  const initialType = currentType === 'aula_experimental' || categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE
    ? 'aula_experimental'
    : 'visita';

  const [dateValue, setDateValue] = useState(defaultValue);
  const [apptType, setApptType] = useState(initialType);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Aula experimental: modalidade + quantidade (semeadas do lead, se houver).
  const [modality, setModality] = useState(lead?.appointmentModality || '');
  const [qty, setQty] = useState(() => {
    const n = Number(lead?.trialClassesPlanned);
    return Number.isFinite(n) && n > 0 ? n : ((trialClassOptions && trialClassOptions[0]) || 1);
  });
  // Professor responsável (ou "Treina sozinho"), semeado do lead se houver.
  const [professorSel, setProfessorSel] = useState(
    lead?.appointmentSoloTraining ? SOLO_TRAINING : (lead?.appointmentProfessorId || '')
  );

  // Garante que a opção semeada do lead apareça no select mesmo que não esteja
  // mais na lista configurada (ex.: opção removida depois do agendamento).
  const qtyOptions = useMemo(() => {
    const base = (trialClassOptions && trialClassOptions.length ? trialClassOptions : [1]);
    return base.includes(qty) ? base : [...base, qty].sort((a, b) => a - b);
  }, [trialClassOptions, qty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dateValue || submitting) return;
    const newDate = new Date(dateValue);
    if (isNaN(newDate.getTime())) return;
    const isAula = apptType === 'aula_experimental';
    const finalQty = Number(qty) > 0 ? Math.floor(Number(qty)) : ((trialClassOptions && trialClassOptions[0]) || 1);
    const isSolo = professorSel === SOLO_TRAINING;
    const professorId = isAula && !isSolo ? (professorSel || null) : null;
    const soloTraining = isAula && isSolo;
    const professorName = professorId ? professorNameById(professores, professorId) : null;
    setSubmitting(true);
    await onConfirm(newDate, note, apptType, isAula ? (modality || '').trim() : null, isAula ? finalQty : null, professorId, professorName, soloTraining);
    setSubmitting(false);
  };

  const title = isAfterNoShow
    ? 'Agendar próxima tentativa'
    : `Remarcar ${apptType === 'aula_experimental' ? 'aula experimental' : 'visita'}`;

  const helperText = isAfterNoShow
    ? 'A tarefa de hoje já foi marcada como "Não veio". O lead voltará à Meta Diária na nova data.'
    : 'A tarefa de hoje será concluída e o lead voltará para a sua Meta Diária na nova data.';

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[110] bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in" />
      <div className="fixed inset-0 z-[111] grid place-items-center p-4 animate-fade-in pointer-events-none">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-6 pointer-events-auto">
          <div className="flex items-start gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 text-lg ${
              isAfterNoShow
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            }`}>
              {isAfterNoShow ? '↻' : '🔄'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{lead.name} · <span className="num">{lead.whatsapp}</span></p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tipo
              </label>
              <div className="flex gap-2">
                <RescheduleTypeBtn active={apptType === 'visita'} onClick={() => setApptType('visita')} label="Visita" />
                <RescheduleTypeBtn active={apptType === 'aula_experimental'} onClick={() => setApptType('aula_experimental')} label="Aula Experimental" />
              </div>
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Nova data e horário
              </label>
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                required
                autoFocus
              />
            </div>
            {apptType === 'aula_experimental' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Modalidade
                    </label>
                    <select
                      value={modality}
                      onChange={(e) => setModality(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer"
                    >
                      <option value="">{(modalities || []).length ? 'Selecione...' : 'Cadastre em Config. Gerais'}</option>
                      {(modalities || []).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Aulas previstas
                    </label>
                    <select
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer"
                    >
                      {qtyOptions.map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? 'aula' : 'aulas'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Professor
                  </label>
                  <select
                    value={professorSel}
                    onChange={(e) => setProfessorSel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {professorsForModality(professores, modalities, modality).map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                    <option value={SOLO_TRAINING}>{SOLO_TRAINING_LABEL}</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Observação (opcional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={isAfterNoShow ? 'Ex: combinar pela manhã, ligar antes' : 'Ex: lead pediu para remarcar por motivo de trabalho'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
              />
            </div>
          </div>

          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">{helperText}</p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Btn kind="secondary" onClick={onClose}>
              {isAfterNoShow ? 'Não remarcar agora' : 'Cancelar'}
            </Btn>
            <button
              type="submit"
              disabled={submitting || !dateValue}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold whitespace-nowrap transition active:scale-[.98] bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              {submitting ? 'Salvando...' : (isAfterNoShow ? 'Confirmar agendamento' : 'Confirmar remarcação')}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}

// Botão de preset do NextContactModal — fora do pai para não recriar a cada
// render (mesmo motivo do RescheduleTypeBtn).
function NextContactPresetBtn({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[38px] inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[13px] font-semibold border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition dark:bg-white/[0.03] dark:text-slate-200 dark:border-white/[0.07] dark:hover:bg-white/[0.06]"
    >
      {icon}{label}
    </button>
  );
}

// Popover "Próximo contato?" — abre ao CONCLUIR uma tarefa de Contato/Atrasado
// (e após Compareceu/Cancelou em visita/aula). Garante que o lead sempre saia
// com uma data futura OU sem data — nunca com o nextFollowUp parado no passado,
// que era o que o trazia de volta como "Atrasado" no dia seguinte.
function NextContactModal({ lead, contextLabel = 'Tarefa concluída', onPick, onSkip, onClose }) {
  const [note, setNote] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(() => {
    const base = new Date();
    base.setDate(base.getDate() + 1);
    base.setHours(9, 0, 0, 0);
    return toDatetimeLocalValue(base);
  });
  const [submitting, setSubmitting] = useState(false);

  const run = async (fn) => {
    if (submitting) return;
    setSubmitting(true);
    try { await fn(); } finally { setSubmitting(false); }
  };
  const pickIn = (days) => run(async () => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    await onPick(d, note);
  });
  const pickCustom = () => run(async () => {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime())) return;
    await onPick(d, note);
  });
  const skip = () => run(async () => { await onSkip(note); });

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[110] bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-fade-in" />
      <div className="fixed inset-0 z-[111] grid place-items-center p-4 animate-fade-in pointer-events-none">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-6 pointer-events-auto">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Calendar size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">Próximo contato?</h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{contextLabel} · {lead.name}</p>
            </div>
          </div>

          <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Quando voltar a falar
          </label>
          {!customMode ? (
            <div className="grid grid-cols-2 gap-2">
              <NextContactPresetBtn disabled={submitting} onClick={() => pickIn(1)} icon={<Calendar size={15} />} label="Amanhã" />
              <NextContactPresetBtn disabled={submitting} onClick={() => pickIn(3)} icon={<Calendar size={15} />} label="Em 3 dias" />
              <NextContactPresetBtn disabled={submitting} onClick={() => pickIn(7)} icon={<Calendar size={15} />} label="Em 7 dias" />
              <NextContactPresetBtn disabled={submitting} onClick={() => setCustomMode(true)} icon={<Calendar size={15} />} label="Escolher data…" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] num focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <Btn kind="primary" size="md" icon={<Check size={14} />} onClick={pickCustom} disabled={submitting || !customValue}>OK</Btn>
            </div>
          )}

          <button
            type="button"
            onClick={skip}
            disabled={submitting}
            className="w-full mt-2 h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium text-slate-500 border border-dashed border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.04]"
          >
            <X size={14} /> Sem próximo contato
          </button>

          <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-4 mb-1.5">
            Observação (opcional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ex: respondeu no WhatsApp, retornar a proposta"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
          />

          <div className="mt-5 flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-slate-400 dark:text-slate-500 inline-flex items-center gap-1">
              <RefreshCw size={12} /> Agendar conta como reaquecimento
            </span>
            <Btn kind="secondary" onClick={onClose} disabled={submitting}>Cancelar</Btn>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ==========================================
// DAILY GOAL VIEW (META DIÁRIA)
// ==========================================

// Alternador "Minha meta | Equipe" — visível só para o gestor (admin).
function ViewTab({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12.5px] font-semibold transition ${
        active
          ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {icon}{label}
    </button>
  );
}

// Presença cruzada (item 3): aulas/visitas de OUTROS consultores que caem no
// turno de quem está vendo, com o dono fora de plantão. Não conta na meta;
// confirmar credita o dono. Fica no rodapé da sidebar, separada da meta.
function DelegatedPresenceCard({ items, savingId, onMark }) {
  if (!items || items.length === 0) return null;
  const pending = items.filter(i => !i.done).length;
  return (
    <div className="rounded-2xl border border-accent-200 dark:border-accent-500/25 bg-accent-50/50 dark:bg-accent-500/[0.06] shadow-card">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-accent-100 dark:border-accent-500/15">
        <span className="size-6 rounded-md grid place-items-center bg-accent-500/15 text-accent-600 dark:text-accent-400 shrink-0">
          <Users size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-ink-900 dark:text-white">Presença por você</h3>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">Aulas/visitas de colegas no seu turno · não conta na sua meta</p>
        </div>
        {pending > 0 && (
          <span className="num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center bg-accent-500/15 text-accent-700 dark:text-accent-300 shrink-0">{pending}</span>
        )}
      </div>
      <div className="p-2.5 space-y-1.5">
        {items.map((lead) => {
          const when = getLeadAppointmentDate(lead);
          const saving = savingId === lead.id;
          return (
            <div key={lead.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06]">
              <Avatar name={lead.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
                <div className="text-[10.5px] text-slate-500 dark:text-neutral-400 truncate num">
                  {lead.categoryLabel} · {when ? formatHourLabel(when) : ''} · de {lead.ownerName}
                </div>
              </div>
              <PresenceSwitch attKey={lead.appointmentOutcome} saving={saving} onMark={(o) => onMark(lead, o)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyGoalView({ leads, interactions, appUser, statuses, db, usersList }) {
  const toast = useToast();
  const { openProfile } = useLeadProfile();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('mine'); // 'mine' | 'team' (team = só gestor)
  const [now, setNow] = useState(() => new Date());
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [nextContactTarget, setNextContactTarget] = useState(null);
  const prevProgress = useRef(null); // null = ainda sem cálculo nesta montagem

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
  const { metaWeekdays = [1, 2, 3, 4, 5], slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS, dailyVolumeTarget = 0, contractThresholdDays = 30 } = useGeneralConfig();

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
  const recordGoalHit = useCallback(async (volCount = null, volTarget = null) => {
    if (!appUser?.authUid) return;
    const key = dgDateKey(new Date());
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH, `${appUser.id}_${key}`),
        {
          consultantId: appUser.id,
          consultantAuthUid: appUser.authUid,
          consultantName: appUser.name || null,
          date: key,
          ...(volTarget > 0 ? { volumeCount: volCount, volumeTarget: volTarget } : {}),
          hitAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch { /* regras podem não estar publicadas ainda — silencioso */ }
  }, [db, appUser]);

  const ritmoMes = useMemo(() => {
    void todayKey; // o "hoje" do ritmo/sequência também vira com o dia (A5)
    return computeRitmo(dailyHistory, metaWeekdays);
  }, [dailyHistory, metaWeekdays, todayKey]);

  // Slots da MINHA meta — regra única em src/lib/dailyGoal.js (Meta-only:
  // só Venda/Perda hoje ou daily_goal_done marcam tarefa), compartilhada com
  // o painel da equipe do gestor.
  const processedLeads = useMemo(() => {
    void todayKey; // recategoriza na virada do dia (A5)
    return computeDailyGoalSlots(leads, buildInteractionsByLead(interactions), appUser.id, contractThresholdDays);
  }, [leads, appUser, interactions, todayKey, contractThresholdDays]);

  // Presença cruzada (item 3): aulas/visitas de OUTROS consultores que caem no
  // MEU turno com o dono fora de plantão. Calculada à parte — NÃO entra em
  // processedLeads/totalSlots (não conta na minha meta). Turno vem de
  // shiftStart/shiftEnd no doc do usuário.
  const [savingDelegatedId, setSavingDelegatedId] = useState(null);
  const usersById = useMemo(() => {
    const m = new Map();
    (usersList || []).forEach(u => m.set(u.id, { shiftStart: u.shiftStart || null, shiftEnd: u.shiftEnd || null, name: u.name }));
    return m;
  }, [usersList]);
  const delegatedPresence = useMemo(() => {
    void todayKey;
    const viewer = { id: appUser.id, shiftStart: appUser.shiftStart || null, shiftEnd: appUser.shiftEnd || null };
    return computeDelegatedPresenceSlots(leads, buildInteractionsByLead(interactions), viewer, usersById, now);
  }, [leads, interactions, appUser, usersById, now, todayKey]);

  const markDelegated = async (lead, outcome) => {
    if (savingDelegatedId) return;
    setSavingDelegatedId(lead.id);
    try {
      // Fluxo completo (consome o agendamento + promove), igual a confirmar a
      // própria aula: credita a Meta do DONO via daily_goal_done no lead dele.
      await writeAppointmentOutcome({ db, lead, outcome, categorySlug: lead.categorySlug, appUser, statuses });
      toast.success(outcome === 'attended'
        ? `Presença de ${lead.name} confirmada para ${lead.ownerName}.`
        : `${lead.name} marcado como não veio (meta de ${lead.ownerName}).`);
    } catch (err) {
      console.error('markDelegated', err);
      toast.error('Não foi possível salvar a presença. Tente novamente.');
    } finally {
      setSavingDelegatedId(null);
    }
  };

  // Helper para filtragem por categoria. Lead com 2 categorias pode
  // estar "feito" em uma e "pendente" na outra.
  const isLeadDoneForCategory = (lead, categorySlug) =>
    Boolean(lead.categoryStatus?.[categorySlug]);

  // Agora cada lead pode estar em múltiplas categorias e cada uma
  // tem status independente. Total de "slots" = soma das categorias
  // de cada lead. Done = slots concluídos.
  const totalSlots = processedLeads.reduce((acc, l) => acc + l.categorySlugs.length, 0);
  const doneSlots = processedLeads.reduce(
    (acc, l) => acc + l.categorySlugs.filter(s => isLeadDoneForCategory(l, s)).length,
    0
  );
  const total = totalSlots;
  const progress = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 100;

  // ── Meta por VOLUME (piso de esforço) ──────────────────────────────────
  // Alvo: definido por consultor (doc do usuário); sem alvo = sem régua.
  // Gestor fica fora (target 0 = sem barra). Ações = agendamentos/reagendamentos,
  // ligações/mensagens e leads novos (ver lib/dailyGoal.js).
  const volumeTarget = volumeTargetFor(appUser, dailyVolumeTarget);
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

  const handleSnooze = async (lead, e) => {
    e.stopPropagation();
    if (!window.confirm("Adiar o contato deste lead para amanhã?")) return;
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
        nextFollowUp: tomorrow,
        // A3: limpa o agendamento formal antigo (visita/aula que já passou e
        // virou "Atrasado") para o lead não ficar preso com a data velha em
        // getLeadAppointmentDate — assim ele aparece corretamente em "Amanhã".
        // O tipo de contato (nextFollowUpType: Ligação/Mensagem) é preservado.
        appointmentScheduledFor: null,
        appointmentType: null
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `Contato adiado para amanhã via Meta Diária.`,
        type: 'note',
        createdAt: serverTimestamp()
      });
    } catch(err) { console.error(err); toast.error('Não foi possível adiar o lead. Tente novamente.'); }
  };

  const handleOutcome = async (lead, outcome, categorySlug, e) => {
    if (e) e.stopPropagation();
    if (!APPOINTMENT_OUTCOMES.includes(outcome)) return;
    const meta = getAppointmentOutcomeMeta(outcome);
    // Auto-move "Compareceu" em visita/aula → fase Negociação no mesmo funil.
    // Só dispara se: (a) a etapa Negociação existe pro funil do lead
    // (a migration garante isso) E (b) o lead ainda não está em Negociação/Venda/Perda.
    const isAttendedAppt =
      outcome === 'attended' &&
      (categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE ||
       categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE);
    const negStatus = isAttendedAppt
      ? (statuses || []).find(s =>
          s.funnelId === lead.funnelId &&
          (s.name || '').trim().toLowerCase() === 'negociação'
        )
      : null;
    const shouldPromoteToNegociacao =
      Boolean(negStatus) &&
      lead.status !== negStatus.name &&
      lead.status !== 'Venda' &&
      lead.status !== 'Perda';

    try {
      const leadUpdate = {
        appointmentOutcome: outcome,
        appointmentOutcomeAt: serverTimestamp(),
        appointmentOutcomeBy: appUser.authUid || appUser.id || null
      };
      if (shouldPromoteToNegociacao) {
        leadUpdate.status = negStatus.name; // 'Negociação'
      }
      // Compareceu/Cancelou consomem o agendamento → limpar a data para o lead
      // não cair em "Atrasado" no dia seguinte. ("Não veio" segue para
      // remarcação, que define uma nova data.)
      if (outcome === 'attended' || outcome === 'cancelled') {
        leadUpdate.appointmentScheduledFor = null;
        leadUpdate.appointmentType = null;
        leadUpdate.nextFollowUp = null;
      }
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        leadUpdate
      );
      // Marca a tarefa da Meta como concluída para essa categoria
      // específica. Type='daily_goal_done' é a fonte ÚNICA de verdade
      // para "tarefa cumprida" no fluxo da Meta Diária.
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: `${meta.icon} ${meta.label} — Meta Diária (${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug})`,
        type: 'daily_goal_done',
        dailyGoalCategory: categorySlug,
        appointmentOutcome: outcome,
        createdAt: serverTimestamp()
      });
      // Log adicional da mudança de fase para o feed do lead.
      if (shouldPromoteToNegociacao) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
          leadId: lead.id,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Fase alterada para [${negStatus.name}] após comparecimento em ${DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug}.`,
          type: 'status_change',
          createdAt: serverTimestamp()
        });
      }
      if (shouldPromoteToNegociacao) {
        toast.success(`${meta.label} registrado. ${lead.name} → Negociação.`);
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
    }
  };

  const handleGoalDone = async (lead, categorySlug, note, e) => {
    if (e) e.stopPropagation();
    if (!Object.values(DAILY_GOAL_CATEGORIES).includes(categorySlug)) return;
    // Contato Hoje / Atrasado: concluir abre o "Próximo contato?" para agendar
    // o próximo toque. Sem isso o nextFollowUp ficaria parado no passado e o
    // lead voltaria como "Atrasado" amanhã (a marca daily_goal_done vale só no
    // dia em que foi criada).
    if (
      categorySlug === DAILY_GOAL_CATEGORIES.CONTATO_HOJE ||
      categorySlug === DAILY_GOAL_CATEGORIES.ATRASADO
    ) {
      setNextContactTarget({ lead, categorySlug, flow: 'complete', contextLabel: 'Tarefa concluída' });
      return;
    }
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
    if (!window.confirm(`Concluir a tarefa "${categoryLabel}" deste lead?`)) return;
    const noteText = (note || '').trim();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: noteText
          ? `✅ ${categoryLabel} — Meta Diária. Obs: ${noteText}`
          : `✅ ${categoryLabel} — Meta Diária concluída.`,
        type: 'daily_goal_done',
        dailyGoalCategory: categorySlug,
        createdAt: serverTimestamp()
      });
      toast.success(`Tarefa "${categoryLabel}" concluída.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível concluir a tarefa. Tente novamente.');
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
    const isLigacao = String(lead.nextFollowUpType || '').toLowerCase().includes('liga');
    const followUpTypeLabel = isLigacao ? 'Ligação' : 'Mensagem';
    const volumeKind = isLigacao ? 'ligacao' : 'mensagem';
    const closeTask = flow === 'complete';
    try {
      const leadUpdate = {
        nextFollowUp: newDate,
        nextFollowUpType: followUpTypeLabel,
        appointmentScheduledFor: null,
        appointmentType: null
      };
      // No fluxo 'complete' não há desfecho a preservar; em 'after_outcome' o
      // appointmentOutcome ('Compareceu'/'Cancelou') é mantido para o card.
      if (closeTask) {
        leadUpdate.appointmentOutcome = null;
        leadUpdate.appointmentOutcomeAt = null;
        leadUpdate.appointmentOutcomeBy = null;
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), leadUpdate);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: noteText
          ? `✅ ${categoryLabel} concluída — próximo contato (${followUpTypeLabel.toLowerCase()}) em ${formattedDate} às ${formattedTime}. Obs: ${noteText}`
          : `✅ ${categoryLabel} concluída — próximo contato (${followUpTypeLabel.toLowerCase()}) em ${formattedDate} às ${formattedTime}.`,
        type: closeTask ? 'daily_goal_done' : 'note',
        ...(closeTask ? { dailyGoalCategory: categorySlug } : {}),
        volumeKind,
        rescheduledFor: newDate,
        createdAt: serverTimestamp()
      });
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
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
          nextFollowUp: null,
          nextFollowUpType: null
        });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
          leadId: lead.id,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: noteText
            ? `✅ ${categoryLabel} concluída — sem próximo contato agendado. Obs: ${noteText}`
            : `✅ ${categoryLabel} concluída — sem próximo contato agendado.`,
          type: 'daily_goal_done',
          dailyGoalCategory: categorySlug,
          createdAt: serverTimestamp()
        });
        toast.success(`Tarefa "${categoryLabel}" concluída.`);
      } else if (noteText) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
          leadId: lead.id,
          consultantName: appUser.name,
          ...getInteractionSecurityFields(lead, appUser),
          text: `Sem próximo contato agendado. Obs: ${noteText}`,
          type: 'note',
          createdAt: serverTimestamp()
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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
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
        appointmentOutcomeBy: null
      });

      let baseText;
      if (isAfterNoShow) {
        baseText = `🔄 Próxima tentativa marcada (${finalApptTypeLabel}) para ${formattedDate} às ${formattedTime}, após "Não veio".`;
      } else if (isStillToday) {
        baseText = `🔄 Horário ajustado: ${finalApptTypeLabel.toLowerCase()} para hoje às ${formattedTime}.`;
      } else {
        baseText = `🔄 Remarcou ${finalApptTypeLabel.toLowerCase()} para ${formattedDate} às ${formattedTime} — Meta Diária.`;
      }

      const interactionPayload = {
        leadId: lead.id,
        consultantName: appUser.name,
        ...getInteractionSecurityFields(lead, appUser),
        text: noteText ? `${baseText} Obs: ${noteText}` : baseText,
        type: shouldCloseToday ? 'daily_goal_done' : 'note',
        rescheduledFor: newDate,
        createdAt: serverTimestamp()
      };
      // O reagendamento É a ação de prospecção (reaquecimento): conta SEMPRE
      // via volumeKind, inclusive quando também fecha a tarefa de hoje. O
      // daily_goal_done apenas fecha a tarefa da Meta (não soma no volume), logo
      // não há dupla contagem.
      interactionPayload.volumeKind = finalApptType;
      if (shouldCloseToday) {
        interactionPayload.dailyGoalCategory = categorySlug;
        interactionPayload.appointmentOutcome = 'rescheduled';
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), interactionPayload);

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

  const handleWhatsapp = (lead) => {
    const num = String(lead.whatsapp || '').replace(/\D/g, '');
    if (num) window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (lead) => {
    const num = String(lead.whatsapp || '').replace(/\D/g, '');
    if (num) window.location.href = `tel:${num}`;
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
    groups[DAILY_GOAL_CATEGORIES.ATRASADO].sort((a, b) => overdueDaysOf(b) - overdueDaysOf(a));
    return groups;
  }, [processedLeads]);

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
  const tomorrowAppts = useMemo(() => {
    void todayKey; // "amanhã" também vira com o dia (A5)
    const tStart = new Date(); tStart.setHours(0, 0, 0, 0); tStart.setDate(tStart.getDate() + 1);
    const tEnd = new Date(tStart); tEnd.setHours(23, 59, 59, 999);
    return (leads || [])
      .filter(l => l.consultantId === appUser.id && l.status !== 'Venda' && l.status !== 'Perda')
      .map(l => {
        const when = getLeadAppointmentDate(l) ||
          (l.nextFollowUp instanceof Date && !isNaN(l.nextFollowUp.getTime()) ? l.nextFollowUp : null);
        return { lead: l, when };
      })
      .filter(x => x.when && x.when >= tStart && x.when <= tEnd)
      .sort((a, b) => a.when - b.when);
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
      onOpen={(t) => openProfile(t.id)}
      onSnooze={handleSnooze}
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

  const isManager = isAdminUser(appUser);

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in relative font-sans">
      {isManager && (
        <div className="flex items-center gap-1 self-start bg-slate-100 dark:bg-white/[0.05] rounded-xl p-1">
          <ViewTab active={view === 'mine'} icon={<Target size={13} />} label="Minha meta" onClick={() => setView('mine')} />
          <ViewTab active={view === 'team'} icon={<Users size={13} />} label="Equipe" onClick={() => setView('team')} />
        </div>
      )}

      {isManager && view === 'team' ? (
        <DailyGoalTeamView
          leads={leads}
          interactions={interactions}
          usersList={usersList}
          metaWeekdays={metaWeekdays}
          slaOverdueDays={slaOverdueDays}
          dailyVolumeTarget={dailyVolumeTarget}
          db={db}
          appUser={appUser}
          onOpenLead={(l) => openProfile(l.id)}
        />
      ) : (
      <>
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
                    {tomorrowAppts.map(({ lead, when }) => {
                      const { Icon, label } = dgApptTypeMeta(lead);
                      return (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => openProfile(lead.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/10 transition text-left"
                        >
                          <Avatar name={lead.name} size={38} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">{lead.name}</div>
                            <div className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1"><Icon size={12} /> {label}</span>
                              {lead.whatsapp && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="num">{lead.whatsapp}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="num text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">{formatHourLabel(when)}</span>
                        </button>
                      );
                    })}
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
          />

          <StreakCard
            history14={ritmoMes.history14}
            monthHits={ritmoMes.monthHits}
            monthTarget={ritmoMes.monthTarget}
            streak={ritmoMes.streak}
            volumeMonth={volumeMonth}
          />

          <DelegatedPresenceCard items={delegatedPresence} savingId={savingDelegatedId} onMark={markDelegated} />

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
                    onOpen={(l) => openProfile(l.id)}
                    onReschedule={(l, s) => setRescheduleTarget({ lead: l, categorySlug: s })}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>
      </>
      )}

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
    </div>
  );
}
export { DailyGoalView, DG_WEEKDAY_NAMES };
