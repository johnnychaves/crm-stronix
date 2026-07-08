import { useState, useMemo, useRef, useEffect } from 'react';
import { Ban, BookOpen, Building2, Calendar, Check, ChevronDown, Clock, Dumbbell, Phone, Search, SlidersHorizontal, Timer, TrendingUp, Users } from 'lucide-react';
import { getAppointmentOutcomeMeta, getLeadAppointmentDate, getLeadAppointmentType, isAdminUser, isLeadConverted } from '../lib/leads.js';
import { LIST_PAGE_SIZE } from '../lib/leadStatus.js';
import { cn } from '@/lib/utils';
import { useLeadProfile } from '../contexts/LeadProfileContext.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Btn } from '../components/ui/Btn.jsx';
import { StatPill } from '../components/ui/StatPill.jsx';

// ==========================================
// APPOINTMENT TRACKING VIEW (AULAS EXPERIMENTAIS / VISITAS)
// ==========================================
// Tela SOMENTE LEITURA: lista os leads agendados para um tipo de
// compromisso ('aula_experimental' ou 'visita'), mostrando data marcada,
// comparecimento e finalização. NADA é criado aqui — o cadastro e o
// acompanhamento continuam pela Linha do Tempo (LeadDetailsModal) e pela
// Meta Diária. Clicar numa linha apenas abre o perfil do lead p/ consulta.
// Os dados já chegam escopados por consultor (regra do Firestore): admin
// vê todos, consultor vê só os seus.
//
// Aulas Experimentais usa o redesign 4a (handoff "Modernização de telas");
// Visitas segue no layout anterior (proposta 3b ainda não aprovada).

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

function AppointmentTrackingView(props) {
  return props.appointmentType === 'aula_experimental'
    ? <AulasExperimentaisView {...props} />
    : <VisitasTrackingView {...props} />;
}

// ==========================================
// AULAS EXPERIMENTAIS — redesign 4a
// ==========================================

const DAY_MS = 86400000;

// O schema só guarda a QUANTIDADE do passe (trialClassesPlanned) e o
// desfecho da aula marcada. Regra derivada p/ a nota do passe: a validade
// é de 7 dias a partir da aula marcada, e "aula usada" = desfecho
// 'compareceu'. Ajustar aqui se a regra de negócio mudar.
const TRIAL_PASS_VALIDITY_DAYS = 7;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "Hoje · 17:00" / "Amanhã · 08:00" / "Ontem · 10:00" / "10/07 · 15:00"
function fmtAulaDateLine(d) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  const day = diff === 0 ? 'Hoje'
    : diff === 1 ? 'Amanhã'
      : diff === -1 ? 'Ontem'
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${day} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Nota do passe livre ("3 aulas · expira em 7 dias" / "resta 1 · ..." /
// "passe concluído" / "passe expirado"). Retorna null quando o agendamento
// não registrou quantidade.
function getTrialPassNote(lead, attKey) {
  const qty = Number(lead.trialClassesPlanned);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const d = getLeadAppointmentDate(lead);
  if (!d) return null;
  const used = attKey === 'attended' ? 1 : 0;
  const remaining = qty - used;
  if (remaining <= 0) {
    return { text: 'passe concluído', cls: 'text-emerald-700 dark:text-emerald-400' };
  }
  const endDay = startOfDay(new Date(d.getTime() + TRIAL_PASS_VALIDITY_DAYS * DAY_MS));
  const daysLeft = Math.round((endDay.getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  if (daysLeft < 0) {
    return { text: 'passe expirado', cls: 'text-rose-700 dark:text-rose-400' };
  }
  const expira = daysLeft === 0 ? 'expira hoje' : daysLeft === 1 ? 'expira em 1 dia' : `expira em ${daysLeft} dias`;
  const head = used > 0 ? `resta ${remaining}` : `${qty} ${qty === 1 ? 'aula' : 'aulas'}`;
  return {
    text: `${head} · ${expira}`,
    cls: daysLeft <= 2 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'
  };
}

// Quadrado de situação (12×12): verde compareceu · vermelho no-show ·
// amarelo agendado/aguardando (inclui remarcou/cancelou — o tooltip detalha).
const attSquareClass = (attKey) =>
  attKey === 'attended' ? 'bg-emerald-600'
    : attKey === 'no_show' ? 'bg-rose-600'
      : 'bg-amber-500';

const fromDateInput = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

function AulasExperimentaisView({ leads, appUser, usersList }) {
  const { openProfile } = useLeadProfile();
  const isAdmin = isAdminUser(appUser);

  // Atalho de dia e período personalizado são mutuamente exclusivos.
  const [dayTab, setDayTab] = useState('today'); // 'today' | 'yesterday' | 'tomorrow' | null
  const [range, setRange] = useState(null); // { start: Date, end: Date } | null
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [rangeErr, setRangeErr] = useState('');
  const [respFilter, setRespFilter] = useState([]); // vazio = toda a equipe
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

  // 1) Aulas experimentais com data marcada.
  const typeLeads = useMemo(
    () => (leads || []).filter(l => getLeadAppointmentType(l) === 'aula_experimental' && getLeadAppointmentDate(l)),
    [leads]
  );

  // 2) Escopo por responsável (multi-seleção da bubble).
  const scopedLeads = useMemo(
    () => (respFilter.length > 0 ? typeLeads.filter(l => respFilter.includes(l.consultantId)) : typeLeads),
    [typeLeads, respFilter]
  );

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

  const hasActiveFilters = respFilter.length > 0;
  const fmtShort = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const rangeLabel = range ? `${fmtShort(range.start)} – ${fmtShort(range.end)}` : 'Período';

  // Resumo ao lado do filtro: recorte ativo ou "X de Y aulas".
  const filterSummary = useMemo(() => {
    if (!hasActiveFilters) return `${filtered.length} de ${typeLeads.length} aulas`;
    if (respFilter.length === 1) {
      const user = (usersList || []).find(u => u.id === respFilter[0]);
      return user?.name || '1 responsável';
    }
    return `${respFilter.length} responsáveis`;
  }, [hasActiveFilters, filtered.length, typeLeads.length, respFilter, usersList]);

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
                    {respFilter.length}
                  </span>
                )}
              </button>

              {filterOpen && (
                <div className="absolute right-0 top-[46px] w-[264px] rounded-[14px] bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 shadow-[0_16px_40px_-8px_rgba(14,26,64,.22)] overflow-hidden z-30">
                  <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
                    <span className="text-[12.5px] font-bold text-gray-900 dark:text-white">Filtros</span>
                    <button
                      type="button"
                      onClick={() => setRespFilter([])}
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
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo: tabela em card + legenda */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-7 pt-5 pb-7">
          <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,.06)]">
            <div className="hidden md:grid grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr] px-5 py-3 border-b border-slate-100 dark:border-neutral-800 text-[10.5px] font-semibold uppercase tracking-[.07em] text-gray-400 dark:text-neutral-500">
              <span>Aluno</span><span>Objetivo</span><span>Data marcada</span><span>Passe livre</span><span className="text-center">Finalizou</span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center grid place-items-center gap-2">
                <BookOpen className="size-[22px] opacity-40 text-slate-400" />
                <p className="text-[14px] font-semibold text-gray-700 dark:text-neutral-200">Nenhuma aula experimental por aqui</p>
                <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">As aulas agendadas pela Linha do Tempo e Meta Diária aparecem aqui.</p>
              </div>
            ) : (
              visibleRows.map(l => {
                const d = getLeadAppointmentDate(l);
                const att = getApptAttendanceState(l);
                const fin = getApptFinalState(l);
                const pass = getTrialPassNote(l, att.key);
                const isToday = isApptSameDay(d);
                const isPending = att.key === 'pending';
                const consultantFirst = (l.consultantName || '').trim().split(/\s+/)[0] || '';
                return (
                  <div
                    key={l.id}
                    onClick={() => openProfile(l.id)}
                    className="grid grid-cols-1 gap-2 md:gap-0 md:grid-cols-[1.5fr_0.95fr_1fr_1.3fr_0.85fr] md:items-center px-5 py-3 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 cursor-pointer bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Aluno */}
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
                      {fmtAulaDateLine(d)}
                    </div>

                    {/* Passe livre: situação + modalidade + nota do passe */}
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
                    </div>

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

          {/* Legenda */}
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

// ==========================================
// VISITAS — layout anterior (redesign ainda não aprovado)
// ==========================================

function VisitasTrackingView({ leads, appUser, usersList, appointmentType }) {
  const { openProfile } = useLeadProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [consultantFilter, setConsultantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | today | waiting | attended | finished
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const isAdmin = isAdminUser(appUser);
  const isAula = appointmentType === 'aula_experimental';
  const typeLabelSingular = isAula ? 'aula experimental' : 'visita';
  const typeLabelPlural = isAula ? 'aulas experimentais' : 'visitas';
  const HeaderIcon = isAula ? BookOpen : Building2;

  // 1) Leads do tipo de compromisso (com data marcada).
  const typeLeads = useMemo(
    () => (leads || []).filter(l => getLeadAppointmentType(l) === appointmentType && getLeadAppointmentDate(l)),
    [leads, appointmentType]
  );

  // 2) Escopo por consultor (admin) — "de quem são os agendamentos".
  //    Aplica ANTES dos contadores, pra que StatPills e chips reflitam o
  //    consultor selecionado. Sem isso, o chip dizia "Hoje 12" e o clique
  //    entregava 3 (o filtro só agia na lista, não no badge). A busca textual
  //    é uma lupa à parte: mexe só na lista, não nos contadores — mesmo
  //    padrão do LeadsView.
  const scopedLeads = useMemo(
    () => (consultantFilter ? typeLeads.filter(l => l.consultantId === consultantFilter) : typeLeads),
    [typeLeads, consultantFilter]
  );

  // 3) Contadores para stats + chips (sobre o escopo de consultor).
  const counts = useMemo(() => {
    let attended = 0, waiting = 0, finished = 0, today = 0, matriculados = 0;
    scopedLeads.forEach(l => {
      const a = getApptAttendanceState(l);
      if (a.key === 'attended') attended++;
      if (a.key === 'scheduled' || a.key === 'pending') waiting++;
      if (l.status === 'Venda' || l.status === 'Perda') finished++;
      if (l.status === 'Venda' || isLeadConverted(l)) matriculados++;
      if (isApptSameDay(getLeadAppointmentDate(l))) today++;
    });
    return { total: scopedLeads.length, attended, waiting, finished, today, matriculados };
  }, [scopedLeads]);

  // 4) Busca (nome ou telefone) + filtro de status + ordenação (futuros mais
  //    próximos no topo; depois passados mais recentes). O telefone casa tanto
  //    pelo texto cru quanto pelos dígitos normalizados, então "(51) 99999-8888"
  //    e "5199999" acham o mesmo lead (mesmo padrão canônico do LeadsView).
  const filtered = useMemo(() => {
    let list = scopedLeads;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const digits = searchTerm.replace(/\D/g, '');
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.whatsapp && l.whatsapp.includes(searchTerm)) ||
        (digits && String(l.whatsapp || '').replace(/\D/g, '').includes(digits))
      );
    }
    if (statusFilter === 'today') list = list.filter(l => isApptSameDay(getLeadAppointmentDate(l)));
    else if (statusFilter === 'waiting') list = list.filter(l => { const k = getApptAttendanceState(l).key; return k === 'scheduled' || k === 'pending'; });
    else if (statusFilter === 'attended') list = list.filter(l => getApptAttendanceState(l).key === 'attended');
    else if (statusFilter === 'finished') list = list.filter(l => l.status === 'Venda' || l.status === 'Perda');

    const now = Date.now();
    return [...list].sort((a, b) => {
      const da = getLeadAppointmentDate(a)?.getTime() ?? 0;
      const db2 = getLeadAppointmentDate(b)?.getTime() ?? 0;
      const aF = da >= now, bF = db2 >= now;
      if (aF !== bF) return aF ? -1 : 1;
      return aF ? (da - db2) : (db2 - da);
    });
  }, [scopedLeads, searchTerm, statusFilter]);

  // Paginação "carregar mais": renderiza só os primeiros visibleCount.
  // (Sem reset em efeito; ao filtrar, o slice já opera sobre um conjunto menor.)
  const visibleRows = filtered.slice(0, visibleCount);

  const chips = [
    { id: 'all', label: 'Todos', count: counts.total },
    { id: 'today', label: 'Hoje', count: counts.today },
    { id: 'waiting', label: 'Aguardando', count: counts.waiting },
    { id: 'attended', label: 'Compareceram', count: counts.attended },
    { id: 'finished', label: 'Finalizados', count: counts.finished },
  ];

  const finToneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300',
  };

  return (
    <>
      <div className="animate-fade-in space-y-5">
        {/* Header + stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 shrink-0">
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{typeLabelPlural}</h3>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-0.5">
                Controle de {typeLabelPlural} agendadas (somente leitura)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill label="Total" value={counts.total} />
            <StatPill label="Compareceram" value={counts.attended} accent="emerald" />
            <StatPill label="Aguardando" value={counts.waiting} accent="amber" />
            <StatPill label="Matriculados" value={counts.matriculados} accent="brand" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] pl-9 pr-3 placeholder:text-slate-400 transition"
            />
          </div>
          {isAdmin && (
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] outline-none text-[13px] pl-3 pr-8 text-slate-700 dark:text-slate-200 cursor-pointer font-medium"
            >
              <option value="">Todos os consultores</option>
              {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <div className="flex-1" />
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap num">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> de {counts.total}
          </div>
        </div>

        {/* Filtros (chips) */}
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]">
          {chips.map(c => {
            const active = statusFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={`h-8 px-3 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
              >
                {c.label}
                <span className={`num text-[10.5px] px-1 h-[15px] rounded grid place-items-center min-w-[15px] ${active ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'}`}>{c.count}</span>
              </button>
            );
          })}
        </div>

        {/* Tabela */}
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-card border-b border-slate-100 dark:border-white/[0.05]">
                <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 pl-5 pr-3">Aluno</th>
                  <th className="py-3 px-3">Data marcada</th>
                  {isAula && <th className="py-3 px-3">Modalidade</th>}
                  <th className="py-3 px-3 text-center">Compareceu</th>
                  <th className="py-3 pr-5 pl-3 text-center">Finalizou</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(l => {
                  const d = getLeadAppointmentDate(l);
                  const att = getApptAttendanceState(l);
                  const fin = getApptFinalState(l);
                  const FinIcon = fin.Icon;
                  const isPast = att.key === 'pending';
                  return (
                    <tr
                      key={l.id}
                      onClick={() => openProfile(l.id)}
                      className="border-t border-slate-100 dark:border-white/[0.05] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] cursor-pointer transition"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={l.name} size={32} />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-white truncate">{l.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400 num flex-wrap">
                              <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.whatsapp}</span>
                              {isAdmin && l.consultantName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="text-[11px] text-brand-600 dark:text-brand-300">@{l.consultantName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {d ? (
                          <div className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium num whitespace-nowrap ${isPast ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            <Calendar size={13} />
                            <span>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-slate-400 italic">—</span>
                        )}
                      </td>
                      {isAula && (
                        <td className="py-3.5 px-3">
                          {l.appointmentModality ? (
                            <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                              <Dumbbell size={12} className="text-brand-600 dark:text-brand-300 shrink-0" />
                              <span className="truncate max-w-[140px]">{l.appointmentModality}</span>
                              {Number(l.trialClassesPlanned) > 0 && (
                                <span className="num text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 whitespace-nowrap">{l.trialClassesPlanned}x</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11.5px] text-slate-400 italic">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${att.badgeClass}`}>
                          <span aria-hidden="true">{att.icon}</span> {att.label}
                        </span>
                      </td>
                      <td className="py-3.5 pr-5 pl-3 text-center">
                        <span title={fin.reason || ''} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${finToneClass[fin.tone]}`}>
                          <FinIcon size={12} /> {fin.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isAula ? 5 : 4} className="py-16 text-center text-slate-400">
                      <div className="grid place-items-center gap-2">
                        <HeaderIcon size={22} className="opacity-40" />
                        <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">Nenhuma {typeLabelSingular} por aqui</p>
                        <p className="text-[12.5px]">As {typeLabelPlural} agendadas pela Linha do Tempo e Meta Diária aparecem aqui.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {filtered.length > visibleCount && (
          <div className="flex justify-center pt-1">
            <Btn kind="soft" onClick={() => setVisibleCount(c => c + LIST_PAGE_SIZE)}>
              Carregar mais ({visibleRows.length} de {filtered.length})
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}
export { AppointmentTrackingView };
