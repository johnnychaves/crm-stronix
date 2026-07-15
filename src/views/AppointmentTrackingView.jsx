import { useState, useMemo, useRef, useEffect } from 'react';
import { canMarkPresenceNow } from '../lib/presenceWindow.js';
import { Ban, BookOpen, Building2, Calendar, Check, ChevronDown, Clock, Phone, SlidersHorizontal, Timer, TrendingUp, Users } from 'lucide-react';
import { DAILY_GOAL_CATEGORIES, getAppointmentOutcomeMeta, getLeadAppointmentDate, getLeadAppointmentType, hasGoalDoneToday, isAdminUser, isLeadConverted } from '../lib/leads.js';
import { LIST_PAGE_SIZE } from '../lib/leadStatus.js';
import { usePagedLeads } from '../hooks/usePagedLeads.js';
import { appointmentsInWindowQuerySpec } from '../lib/leadQueries.js';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { SOLO_TRAINING, SOLO_TRAINING_LABEL } from '../lib/professores.js';
import { writeAppointmentOutcome, clearAppointmentOutcome } from '../lib/appointmentOutcome.js';
import { cn } from '@/lib/utils';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { PresenceSwitch } from '../components/ui/PresenceSwitch.jsx';

// Janela de confirmação rápida: da hora marcada até 15min depois. Fora dela o
// atalho continua clicável (sempre editável — decisão do Johnny), só perde o
// destaque de "confirmar agora".
const CONFIRM_WINDOW_MS = 15 * 60 * 1000;

// ==========================================
// APPOINTMENT TRACKING VIEW (AULAS EXPERIMENTAIS / VISITAS)
// ==========================================
// Tela SOMENTE LEITURA: lista os leads agendados para um tipo de
// compromisso ('aula_experimental' ou 'visita'), mostrando data marcada,
// situação e finalização. NADA é criado aqui — o cadastro e o
// acompanhamento continuam pela Linha do Tempo (LeadDetailsModal) e pela
// Meta Diária. Clicar numa linha apenas abre o perfil do lead p/ consulta.
// Os dados já chegam escopados por consultor (regra do Firestore): admin
// vê todos, consultor vê só os seus.
//
// Aulas (4a) e Visitas (5a) do handoff "Modernização de telas" compartilham
// o MESMO componente; a 4ª coluna é a única diferença estrutural (Passe
// livre nas aulas, Situação nas visitas).

// Estado de comparecimento derivado do appointmentOutcome persistido no lead
// (ou de conversão legada). Helpers puros, fora do componente.
function getApptAttendanceState(lead) {
  const outcome = lead.appointmentOutcome;
  const meta = outcome ? getAppointmentOutcomeMeta(outcome) : null;
  if (meta) return { key: outcome, label: meta.label, icon: meta.icon, badgeClass: meta.badgeClass };
  // Sem desfecho explícito: se converteu, obviamente compareceu (legado).
  if (isLeadConverted(lead)) {
    const a = getAppointmentOutcomeMeta('attended');
    return { key: 'attended', label: a.label, icon: a.icon, badgeClass: a.badgeClass };
  }
  const d = getLeadAppointmentDate(lead);
  if (d && d.getTime() < Date.now()) {
    return { key: 'pending', label: 'Aguardando desfecho', icon: '⏳', badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
  }
  return { key: 'scheduled', label: 'Agendado', icon: '📅', badgeClass: 'bg-brand-500/10 text-brand-700 dark:text-brand-300' };
}

function getApptFinalState(lead) {
  if (lead.status === 'Venda' || isLeadConverted(lead)) return { label: 'Matriculado', Icon: TrendingUp, tone: 'emerald' };
  if (lead.status === 'Perda') return { label: 'Perdido', Icon: Ban, tone: 'rose', reason: lead.lossReason };
  return { label: 'Em andamento', Icon: Clock, tone: 'slate' };
}

function isApptSameDay(d, ref = new Date()) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

const DAY_MS = 86400000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "Hoje · 17:00" / "Amanhã · 08:00" / "Ontem · 10:00" / "10/07 · 15:00"
function fmtApptDateLine(d) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  const day = diff === 0 ? 'Hoje'
    : diff === 1 ? 'Amanhã'
      : diff === -1 ? 'Ontem'
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${day} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Nota do passe livre (só Aulas): a quantidade configurada em Opções → Regras
// gerais (trialClassOptions, ex.: 1/2/7/15) é a VALIDADE do passe em DIAS,
// gravada por agendamento em trialClassesPlanned. Último dia válido = data da
// aula marcada + (N-1) dias; a nota mostra o término e um contador regressivo
// pra dar controle. Retorna null quando o agendamento não registrou a quantidade.
function getTrialPassNote(lead) {
  const days = Number(lead.trialClassesPlanned);
  if (!Number.isFinite(days) || days <= 0) return null;
  const d = getLeadAppointmentDate(lead);
  if (!d) return null;
  const endDay = new Date(startOfDay(d).getTime() + (days - 1) * DAY_MS);
  const fmt = endDay.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const daysLeft = Math.round((endDay.getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  if (daysLeft < 0) return { text: `passe expirou ${fmt}`, cls: 'text-rose-700 dark:text-rose-400' };
  if (daysLeft === 0) return { text: 'passe termina hoje', cls: 'text-amber-700 dark:text-amber-400' };
  const conta = daysLeft === 1 ? 'falta 1 dia' : `faltam ${daysLeft} dias`;
  return {
    text: `até ${fmt} · ${conta}`,
    cls: daysLeft <= 2 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'
  };
}

// Quadrado de situação (12×12): verde compareceu · vermelho no-show ·
// amarelo agendado/aguardando (inclui remarcou/cancelou — o tooltip detalha).
const attSquareClass = (attKey) =>
  attKey === 'attended' ? 'bg-emerald-600'
    : attKey === 'no_show' ? 'bg-rose-600'
      : 'bg-amber-500';

// Rótulo da coluna Situação (Visitas) — texto exato do handoff, na cor do quadrado.
const getSituacaoLabel = (attKey) =>
  attKey === 'attended' ? 'Compareceu'
    : attKey === 'no_show' ? 'Não compareceu'
      : 'Agendado';

const fromDateInput = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

function AppointmentTrackingView({ interactions, appUser, usersList, statuses, db, appointmentType }) {
  const { openProfile } = useLeadProfile();
  const { professores } = useGeneralConfig();
  const toast = useToast();
  const isAdmin = isAdminUser(appUser);
  const isAula = appointmentType === 'aula_experimental';
  const categorySlug = isAula ? DAILY_GOAL_CATEGORIES.AULA_HOJE : DAILY_GOAL_CATEGORIES.VISITA_HOJE;

  // Atalho de presença (Veio/Faltou). Grava o desfecho na hora; credita a Meta
  // do responsável só quando a aula é HOJE (a Meta é de hoje) e ainda não foi
  // concluída — o card de professor e o dashboard leem o appointmentOutcome
  // direto, então valem pra qualquer data. Sempre editável, sem consumir o
  // agendamento (a linha continua na lista) nem promover fase.
  const [savingId, setSavingId] = useState(null);
  // Relógio vivo (tica a cada 30s) para o atalho de presença travar/destravar
  // sozinho conforme a janela de ±15 min do horário agendado abre e fecha.
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const todayStartMs = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const interactionsByLead = useMemo(() => {
    const m = new Map();
    (interactions || []).forEach(i => { const a = m.get(i.leadId); if (a) a.push(i); else m.set(i.leadId, [i]); });
    return m;
  }, [interactions]);

  const markPresence = async (lead, outcome, e) => {
    if (e) e.stopPropagation();
    if (savingId) return;
    // Trava de horário: só marca/desmarca dentro de ±15 min do horário agendado.
    if (!canMarkPresenceNow(getLeadAppointmentDate(lead), Date.now())) return;
    // Clicar no lado JÁ ativo desmarca (volta pro neutro) — reverter um clique
    // errado. Clicar no outro lado alterna direto. Sempre editável.
    const clearing = lead.appointmentOutcome === outcome;
    setSavingId(lead.id);
    try {
      if (clearing) {
        await clearAppointmentOutcome({ db, lead });
        toast.success(`Presença de ${lead.name} desmarcada.`);
      } else {
        const apptDate = getLeadAppointmentDate(lead);
        const isToday = apptDate && isApptSameDay(apptDate);
        const already = hasGoalDoneToday(lead, categorySlug, interactionsByLead.get(lead.id) || [], todayStartMs);
        await writeAppointmentOutcome({
          db, lead, outcome, categorySlug, appUser, statuses,
          consumeAppointment: false,
          promote: false,
          writeGoalDone: Boolean(isToday) && !already,
          sourceLabel: isAula ? 'Aulas experimentais' : 'Visitas'
        });
        toast.success(outcome === 'attended'
          ? `Presença de ${lead.name} confirmada.`
          : `${lead.name} marcado como não veio.`);
      }
    } catch (err) {
      console.error('markPresence', err);
      toast.error('Não foi possível salvar a presença. Tente novamente.');
    } finally {
      setSavingId(null);
    }
  };

  // Rótulos que mudam entre Aulas (4a) e Visitas (5a).
  const pluralLabel = isAula ? 'aulas' : 'visitas';
  const col1Label = isAula ? 'Aluno' : 'Visitante';
  const col4Label = isAula ? 'Passe livre' : 'Situação';
  const EmptyIcon = isAula ? BookOpen : Building2;
  const emptyTitle = isAula ? 'Nenhuma aula experimental por aqui' : 'Nenhuma visita por aqui';
  const emptySub = isAula
    ? 'As aulas agendadas pela Linha do Tempo e Meta Diária aparecem aqui.'
    : 'As visitas agendadas pela Linha do Tempo e Meta Diária aparecem aqui.';

  // Atalho de dia e período personalizado são mutuamente exclusivos.
  const [dayTab, setDayTab] = useState('today'); // 'today' | 'yesterday' | 'tomorrow' | null
  const [range, setRange] = useState(null); // { start: Date, end: Date } | null
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [rangeErr, setRangeErr] = useState('');
  const [respFilter, setRespFilter] = useState([]); // vazio = toda a equipe
  const [profFilter, setProfFilter] = useState([]); // ids de professor + SOLO_TRAINING (só Aulas)
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  // Popovers fecham em clique fora / Esc (mesmo padrão do Kanban).
  const rangeWrapRef = useRef(null);
  const filterWrapRef = useRef(null);
  useEffect(() => {
    if (!rangeOpen && !filterOpen) return;
    const onPointerDown = (e) => {
      if (rangeWrapRef.current?.contains(e.target)) return;
      if (filterWrapRef.current?.contains(e.target)) return;
      setRangeOpen(false);
      setFilterOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setRangeOpen(false);
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [rangeOpen, filterOpen]);

  // 1) Leads do tipo de compromisso (com data marcada). FONTE (E2b): em vez de
  //    filtrar o prop global, busca por JANELA de datas via query (índice #5) — a
  //    janela sempre cobre [ontem, amanhã] (as tabs de dia mostram contagem
  //    sempre) e estende pra cobrir o range custom (≤30d). Contagens/filtro/
  //    ordenação seguem client-side sobre a janela. Não é ao vivo (getDocs);
  //    remonta ao trocar de aba/tipo. Agendamentos crescem sem limite no tempo,
  //    então NÃO trazer o histórico todo — só a janela vista.
  const loadWindow = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    let start = todayStart - DAY_MS;    // ontem 00:00
    let end = todayStart + 2 * DAY_MS;  // depois de amanhã 00:00
    if (range) {
      start = Math.min(start, startOfDay(range.start).getTime());
      end = Math.max(end, startOfDay(range.end).getTime() + DAY_MS);
    }
    return { start, end };
  }, [range]);
  const apptSpec = useMemo(
    () => appointmentsInWindowQuerySpec(appointmentType, loadWindow.start, loadWindow.end),
    [appointmentType, loadWindow.start, loadWindow.end]
  );
  const { items: windowDocs } = usePagedLeads({
    db, path: LEADS_PATH, spec: apptSpec,
    specKey: `appt:${appointmentType}:${loadWindow.start}:${loadWindow.end}`,
    enabled: !!db,
  });
  // Refiltro D4: a query casa pelo CAMPO appointmentType; refiltra client-side
  // pelo getLeadAppointmentType (cobre o fallback nextFollowUpType) e exige data,
  // como antes. Só remove.
  const typeLeads = useMemo(
    () => (windowDocs || []).filter(l => getLeadAppointmentType(l) === appointmentType && getLeadAppointmentDate(l)),
    [windowDocs, appointmentType]
  );
  // Total do tipo (todos os agendamentos, não só a janela) p/ o resumo "X de Y",
  // via getCountFromServer — sem baixar tudo. Enquanto carrega, cai no tamanho da
  // janela. Conta pelo campo appointmentType (índice automático).
  const [typeTotal, setTypeTotal] = useState(null);
  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    const col = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
    getCountFromServer(query(col, where('appointmentType', '==', appointmentType)))
      .then(s => { if (!cancelled) setTypeTotal(s.data().count); })
      .catch(e => { if (!cancelled) { console.error('appt type count', e); setTypeTotal(null); } });
    return () => { cancelled = true; };
  }, [db, appointmentType]);

  // 2) Escopo por responsável (multi-seleção da bubble) + professor (só Aulas).
  const scopedLeads = useMemo(() => {
    let list = respFilter.length > 0 ? typeLeads.filter(l => respFilter.includes(l.consultantId)) : typeLeads;
    if (isAula && profFilter.length > 0) {
      list = list.filter(l => {
        if (l.appointmentSoloTraining) return profFilter.includes(SOLO_TRAINING);
        return l.appointmentProfessorId && profFilter.includes(l.appointmentProfessorId);
      });
    }
    return list;
  }, [typeLeads, respFilter, profFilter, isAula]);

  // 3) Contagem das tabs Hoje/Ontem/Amanhã (sobre o escopo de responsável).
  const dayWindows = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return {
      yesterday: [today - DAY_MS, today],
      today: [today, today + DAY_MS],
      tomorrow: [today + DAY_MS, today + 2 * DAY_MS]
    };
  }, []);
  const dayCounts = useMemo(() => {
    const counts = { today: 0, yesterday: 0, tomorrow: 0 };
    scopedLeads.forEach(l => {
      const t = getLeadAppointmentDate(l).getTime();
      for (const key of Object.keys(counts)) {
        const [ini, fim] = dayWindows[key];
        if (t >= ini && t < fim) counts[key]++;
      }
    });
    return counts;
  }, [scopedLeads, dayWindows]);

  // 4) Recorte do período (tab de dia OU range personalizado) + ordenação
  //    (futuros mais próximos no topo; depois passados mais recentes).
  const filtered = useMemo(() => {
    let list = scopedLeads;
    if (range) {
      const ini = startOfDay(range.start).getTime();
      const fim = startOfDay(range.end).getTime() + DAY_MS;
      list = list.filter(l => { const t = getLeadAppointmentDate(l).getTime(); return t >= ini && t < fim; });
    } else if (dayTab) {
      const [ini, fim] = dayWindows[dayTab];
      list = list.filter(l => { const t = getLeadAppointmentDate(l).getTime(); return t >= ini && t < fim; });
    }
    const now = Date.now();
    return [...list].sort((a, b) => {
      const da = getLeadAppointmentDate(a)?.getTime() ?? 0;
      const db2 = getLeadAppointmentDate(b)?.getTime() ?? 0;
      const aF = da >= now, bF = db2 >= now;
      if (aF !== bF) return aF ? -1 : 1;
      return aF ? (da - db2) : (db2 - da);
    });
  }, [scopedLeads, range, dayTab, dayWindows]);

  const visibleRows = filtered.slice(0, visibleCount);

  const dayTabs = [
    { id: 'today', label: 'Hoje', count: dayCounts.today },
    { id: 'yesterday', label: 'Ontem', count: dayCounts.yesterday },
    { id: 'tomorrow', label: 'Amanhã', count: dayCounts.tomorrow }
  ];

  const hasActiveFilters = respFilter.length > 0 || (isAula && profFilter.length > 0);
  const fmtShort = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const rangeLabel = range ? `${fmtShort(range.start)} – ${fmtShort(range.end)}` : 'Período';

  // Resumo ao lado do filtro: recorte ativo ou "X de Y aulas/visitas".
  const filterSummary = useMemo(() => {
    if (!hasActiveFilters) return `${filtered.length} de ${typeTotal ?? typeLeads.length} ${pluralLabel}`;
    const parts = [];
    if (respFilter.length === 1) {
      const user = (usersList || []).find(u => u.id === respFilter[0]);
      parts.push(user?.name || '1 responsável');
    } else if (respFilter.length > 1) {
      parts.push(`${respFilter.length} responsáveis`);
    }
    if (isAula && profFilter.length > 0) {
      parts.push(`${profFilter.length} professor${profFilter.length > 1 ? 'es' : ''}`);
    }
    return parts.join(' · ') || `${filtered.length} de ${typeTotal ?? typeLeads.length} ${pluralLabel}`;
  }, [hasActiveFilters, filtered.length, typeLeads.length, typeTotal, respFilter, profFilter, isAula, usersList, pluralLabel]);

  const pickDayTab = (id) => {
    setDayTab(id);
    setRange(null);
  };

  const applyRange = () => {
    const start = fromDateInput(draftStart);
    const end = fromDateInput(draftEnd);
    if (!start || !end) { setRangeErr('Informe início e fim.'); return; }
    if (end.getTime() < start.getTime()) { setRangeErr('O fim precisa ser depois do início.'); return; }
    if ((end.getTime() - start.getTime()) / DAY_MS > 30) { setRangeErr('Período máximo de 30 dias.'); return; }
    setRangeErr('');
    setRange({ start, end });
    setDayTab(null);
    setRangeOpen(false);
  };

  const clearRange = () => {
    setDraftStart('');
    setDraftEnd('');
    setRangeErr('');
    setRange(null);
    if (!dayTab) setDayTab('today');
  };

  const toggleResp = (id) => {
    setRespFilter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  return (
    <>
      {/* Full-bleed: mesmo padrão do Kanban — header de página colado no
          header global e conteúdo de borda a borda sobre paper-50. */}
      <div className="-m-4 md:-m-8 h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
        {/* Header da página: atalhos de dia + período + resumo + filtro */}
        <div className="h-16 shrink-0 relative z-20 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-3 md:gap-5 px-4 md:px-7">
          <div className="h-full flex items-stretch gap-0.5">
            {dayTabs.map(t => {
              const active = !range && dayTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickDayTab(t.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'h-full px-3 inline-flex items-center gap-[7px] text-[13px] font-semibold whitespace-nowrap transition-colors',
                    active
                      ? 'text-brand-700 dark:text-brand-300 shadow-[inset_0_-2px_0_var(--color-brand-600)]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      'text-[10.5px] font-bold px-1.5 py-px rounded-md tabular-nums',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
                    )}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Período personalizado (pílula premium + popover) */}
          <div ref={rangeWrapRef} className="relative flex items-center ml-1 shrink-0">
            <button
              type="button"
              onClick={() => setRangeOpen(o => !o)}
              aria-haspopup="dialog"
              aria-expanded={rangeOpen}
              className={cn(
                'h-[34px] px-3.5 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-shadow duration-200',
                range
                  ? 'bg-[linear-gradient(135deg,#2B59FF,#1C3FC4)] text-white border-transparent shadow-[0_4px_14px_-4px_rgba(43,89,255,.5)]'
                  : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 shadow-sm hover:border-brand-200 dark:hover:border-brand-500/40'
              )}
            >
              <Calendar className="size-[13px]" />
              {rangeLabel}
              <ChevronDown className="size-3" strokeWidth={2.2} />
            </button>

            {rangeOpen && (
              <div className="absolute left-0 top-11 w-[288px] rounded-2xl bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 shadow-[0_24px_56px_-12px_rgba(14,26,64,.28)] overflow-hidden z-30">
                <div className="px-4 py-3.5 flex items-center gap-[11px] bg-[linear-gradient(135deg,#F5F8FF,#EAF0FF)] dark:bg-none dark:bg-white/[0.04] border-b border-[#E3EBFF] dark:border-white/10">
                  <span className="size-8 rounded-[10px] shrink-0 grid place-items-center bg-[linear-gradient(135deg,#2B59FF,#1C3FC4)] text-white shadow-[0_4px_10px_-2px_rgba(43,89,255,.45)]">
                    <Calendar className="size-[15px]" />
                  </span>
                  <div>
                    <div className="text-[13px] font-bold text-ink-900 dark:text-white">Período personalizado</div>
                    <div className="mt-px text-[11px] text-slate-500 dark:text-neutral-400">Selecione até 30 dias</div>
                  </div>
                </div>
                <div className="px-4 pt-3.5 pb-4">
                  <div className="flex gap-2">
                    <label className="flex-1 flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-gray-400 dark:text-neutral-500">Início</span>
                      <input
                        type="date"
                        value={draftStart}
                        max={draftEnd || undefined}
                        onChange={(e) => { setDraftStart(e.target.value); setRangeErr(''); }}
                        className="h-[34px] rounded-[9px] border border-slate-200 dark:border-neutral-700 bg-paper-50 dark:bg-neutral-800 outline-none text-[12px] px-2 text-gray-900 dark:text-white focus:border-brand-500"
                      />
                    </label>
                    <label className="flex-1 flex flex-col gap-1">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-gray-400 dark:text-neutral-500">Fim</span>
                      <input
                        type="date"
                        value={draftEnd}
                        min={draftStart || undefined}
                        onChange={(e) => { setDraftEnd(e.target.value); setRangeErr(''); }}
                        className="h-[34px] rounded-[9px] border border-slate-200 dark:border-neutral-700 bg-paper-50 dark:bg-neutral-800 outline-none text-[12px] px-2 text-gray-900 dark:text-white focus:border-brand-500"
                      />
                    </label>
                  </div>
                  {rangeErr && (
                    <div className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{rangeErr}</div>
                  )}
                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={clearRange}
                      className="h-[34px] px-3.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 text-[12px] font-semibold transition-colors"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={applyRange}
                      className="h-[34px] px-[18px] rounded-full bg-[linear-gradient(135deg,#2B59FF,#1C3FC4)] text-white text-[12px] font-bold shadow-[0_4px_14px_-4px_rgba(43,89,255,.5)] hover:shadow-[0_6px_18px_-4px_rgba(43,89,255,.65)] transition-shadow"
                    >
                      Aplicar período
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="hidden md:block text-[11.5px] text-slate-500 dark:text-neutral-400 whitespace-nowrap tabular-nums shrink-0">
            <span className="font-semibold text-gray-700 dark:text-neutral-200">{filterSummary}</span>
          </div>

          {/* Filtro único (Responsável) — consultor não filtra ninguém. */}
          {isAdmin && (
            <div ref={filterWrapRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen(o => !o)}
                title="Filtros"
                aria-haspopup="dialog"
                aria-expanded={filterOpen}
                className={cn(
                  'relative size-[38px] rounded-[11px] border grid place-items-center transition-colors',
                  hasActiveFilters
                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-300'
                    : 'bg-paper-50 border-slate-200 text-gray-600 hover:border-brand-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-brand-500/40'
                )}
              >
                <SlidersHorizontal className="size-[17px]" />
                {hasActiveFilters && (
                  <span className="absolute -top-[5px] -right-[5px] min-w-4 h-4 px-1 rounded-full bg-accent-500 text-white text-[9.5px] font-bold grid place-items-center ring-2 ring-white dark:ring-neutral-900 tabular-nums">
                    {respFilter.length + (isAula ? profFilter.length : 0)}
                  </span>
                )}
              </button>

              {filterOpen && (
                <div className="absolute right-0 top-[46px] w-[264px] rounded-[14px] bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 shadow-[0_16px_40px_-8px_rgba(14,26,64,.22)] overflow-hidden z-30">
                  <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
                    <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">Filtros</span>
                    <button
                      type="button"
                      onClick={() => { setRespFilter([]); setProfFilter([]); }}
                      className="text-[11.5px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="pt-2.5 px-2 pb-3">
                    <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
                      Responsável
                    </div>
                    <button
                      type="button"
                      onClick={() => setRespFilter([])}
                      className={cn(
                        'w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
                        respFilter.length === 0 ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
                      )}
                    >
                      <span className="size-6 rounded-full grid place-items-center bg-paper-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0">
                        <Users className="size-[13px]" />
                      </span>
                      <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white truncate', respFilter.length === 0 ? 'font-bold' : 'font-medium')}>
                        Toda a equipe
                      </span>
                      {respFilter.length === 0 && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                    </button>
                    {(usersList || []).map(u => {
                      const selected = respFilter.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleResp(u.id)}
                          className={cn(
                            'w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
                            selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
                          )}
                        >
                          <Avatar name={u.name} size={24} />
                          <span className={cn('flex-1 text-[12.5px] text-gray-900 dark:text-white truncate', selected ? 'font-bold' : 'font-medium')}>
                            {u.name}
                          </span>
                          {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                        </button>
                      );
                    })}
                  </div>

                  {isAula && (
                    <div className="pt-2.5 px-2 pb-1 border-t border-slate-100 dark:border-white/10 mt-1">
                      <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
                        Professor
                      </div>
                      {(professores || []).map((p) => {
                        const selected = profFilter.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProfFilter(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                            className={cn(
                              'w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
                              selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
                            )}
                          >
                            <span className="flex-1 text-[12.5px] text-gray-900 dark:text-white truncate">{p.nome}</span>
                            {selected && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setProfFilter(prev => prev.includes(SOLO_TRAINING) ? prev.filter(x => x !== SOLO_TRAINING) : [...prev, SOLO_TRAINING])}
                        className={cn(
                          'w-full flex items-center gap-[9px] px-2 py-[7px] rounded-[9px] text-left transition-colors',
                          profFilter.includes(SOLO_TRAINING) ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-paper-50 dark:hover:bg-white/5'
                        )}
                      >
                        <span className="flex-1 text-[12.5px] text-gray-900 dark:text-white truncate">{SOLO_TRAINING_LABEL}</span>
                        {profFilter.includes(SOLO_TRAINING) && <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" strokeWidth={2.6} />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo: tabela em card + legenda */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-7 pt-5 pb-7">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,.06)]">
            <div className={cn('hidden md:grid px-5 py-3 border-b border-slate-100 dark:border-neutral-800 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500', isAula ? 'md:grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]' : 'md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]')}>
              <span>{col1Label}</span><span>Objetivo</span><span>Data marcada</span>{isAula && <span>Professor</span>}<span>{col4Label}</span><span className="text-center">Finalizou</span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center grid place-items-center gap-2">
                <EmptyIcon className="size-[22px] opacity-40 text-slate-400" />
                <p className="text-[14px] font-semibold text-gray-700 dark:text-neutral-200">{emptyTitle}</p>
                <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">{emptySub}</p>
              </div>
            ) : (
              visibleRows.map(l => {
                const d = getLeadAppointmentDate(l);
                const att = getApptAttendanceState(l);
                const fin = getApptFinalState(l);
                const pass = isAula ? getTrialPassNote(l) : null;
                const isToday = isApptSameDay(d);
                const isPending = att.key === 'pending';
                const consultantFirst = (l.consultantName || '').trim().split(/\s+/)[0] || '';
                const sitLabel = getSituacaoLabel(att.key);
                const sitTitle = att.key === 'pending' ? 'Agendado · aguardando desfecho' : sitLabel;
                // Atalho de presença só p/ leads em andamento (não matriculado/perdido).
                const canMark = fin.tone === 'slate';
                const inConfirmWindow = Boolean(d) && nowMs >= d.getTime() && nowMs <= d.getTime() + CONFIRM_WINDOW_MS;
                const canMarkNow = canMarkPresenceNow(d, nowMs);
                const pendingPresence = att.key !== 'attended' && att.key !== 'no_show';
                const savingRow = savingId === l.id;
                return (
                  <div
                    key={l.id}
                    onClick={() => openProfile(l.id)}
                    className={cn(
                      'grid grid-cols-1 gap-2 md:gap-0 md:items-center px-5 py-3 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors',
                      isAula ? 'md:grid-cols-[1.5fr_0.95fr_1fr_1fr_1.3fr_0.85fr]' : 'md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr]'
                    )}
                  >
                    {/* Aluno / Visitante */}
                    <div className="flex items-center gap-[11px] min-w-0">
                      <Avatar name={l.name} size={32} />
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate">{l.name}</div>
                        <div className="mt-px flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-neutral-400 tabular-nums">
                          <span className="inline-flex items-center gap-1"><Phone className="size-[11px]" /> {l.whatsapp}</span>
                          {isAdmin && consultantFirst && (
                            <>
                              <span className="size-1 rounded-full bg-slate-300 dark:bg-white/20" />
                              <span className="text-[11px] text-brand-600 dark:text-brand-300">@{consultantFirst}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Objetivo (dor/necessidade do cadastro) */}
                    <div className="min-w-0 md:pr-3">
                      <span className="block text-[12.5px] font-medium text-gray-700 dark:text-neutral-300 truncate" title={l.dor || ''}>
                        {l.dor || '—'}
                      </span>
                    </div>

                    {/* Data marcada */}
                    <div
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[12.5px] tabular-nums whitespace-nowrap',
                        isPending
                          ? 'font-medium text-amber-700 dark:text-amber-400'
                          : isToday
                            ? 'font-bold text-brand-700 dark:text-brand-300'
                            : 'font-medium text-gray-700 dark:text-neutral-300'
                      )}
                    >
                      <Calendar className="size-[13px] shrink-0" />
                      {fmtApptDateLine(d)}
                    </div>

                    {/* Professor (só Aulas) */}
                    {isAula && (
                      <div className="min-w-0 text-[12.5px] font-medium text-gray-700 dark:text-neutral-300 truncate">
                        {l.appointmentSoloTraining ? SOLO_TRAINING_LABEL : (l.appointmentProfessorName || '—')}
                      </div>
                    )}

                    {/* 4ª coluna: Passe livre (Aulas) ou Situação (Visitas) */}
                    {isAula ? (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span title={att.label} className={cn('size-3 rounded shrink-0', attSquareClass(att.key))} />
                          <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-200 truncate">
                            {l.appointmentModality || '—'}
                          </span>
                        </div>
                        {pass && (
                          <div className={cn('mt-[3px] inline-flex items-center gap-[5px] text-[11px] tabular-nums', pass.cls)}>
                            <Timer className="size-[11px] shrink-0" />
                            {pass.text}
                          </div>
                        )}
                        {canMark && (
                          <div className="mt-1.5">
                            <PresenceSwitch attKey={att.key} highlight={inConfirmWindow && pendingPresence} saving={savingRow} disabled={!canMarkNow} disabledTitle="Só dá para marcar de 15 min antes até 15 min depois do horário agendado." onMark={(o, e) => markPresence(l, o, e)} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0">
                        {canMark ? (
                          <PresenceSwitch attKey={att.key} highlight={inConfirmWindow && pendingPresence} saving={savingRow} disabled={!canMarkNow} disabledTitle="Só dá para marcar de 15 min antes até 15 min depois do horário agendado." onMark={(o, e) => markPresence(l, o, e)} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span title={sitTitle} className={cn('size-3 rounded shrink-0', attSquareClass(att.key))} />
                            <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-200 truncate">{sitLabel}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Finalizou */}
                    <div className="md:text-center">
                      {fin.tone === 'emerald' ? (
                        <span className="inline-flex items-center gap-[5px] text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white whitespace-nowrap shadow-[0_1px_2px_rgba(5,150,105,.35)]">
                          <TrendingUp className="size-[11px]" strokeWidth={2.4} />
                          Matriculado
                        </span>
                      ) : fin.tone === 'rose' ? (
                        <span
                          title={fin.reason || 'Perdido'}
                          className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 whitespace-nowrap"
                        >
                          <Ban className="size-[11px]" strokeWidth={2.2} />
                          Perdido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-[5px] text-[11px] font-medium text-slate-400 dark:text-neutral-500 whitespace-nowrap">
                          <Clock className="size-[11px]" strokeWidth={2.2} />
                          Em andamento
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Legenda dos quadrados de situação */}
          <div className="mt-3 flex items-center gap-4 px-1 text-[11px] text-slate-400 dark:text-neutral-500">
            <span className="inline-flex items-center gap-[5px]"><span className="size-3 rounded bg-emerald-600" /> compareceu</span>
            <span className="inline-flex items-center gap-[5px]"><span className="size-3 rounded bg-rose-600" /> não compareceu</span>
            <span className="inline-flex items-center gap-[5px]"><span className="size-3 rounded bg-amber-500" /> agendado</span>
          </div>

          {filtered.length > visibleCount && (
            <div className="flex justify-center pt-4">
              <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
                Carregar mais ({visibleRows.length} de {filtered.length})
              </Btn>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
export { AppointmentTrackingView };
