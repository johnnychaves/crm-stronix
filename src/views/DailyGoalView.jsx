import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { collection, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { recordGoalHit as recordGoalHitDoc } from '../lib/dailyGoalHistory.js';
import { DAILY_GOAL_CATEGORIES, DAILY_GOAL_CATEGORY_LABEL, APPOINTMENT_OUTCOMES, getAppointmentOutcomeMeta, getLeadAppointmentType, getLeadAppointmentDate, hasGoalDoneTodayFor, appointmentTaskOwnerId, goalOwnerFields, isClientLead, outcomeAppliesToAula } from '../lib/leads.js';
import { isMetaParticipant } from '../lib/acesso.js';
import { logInteraction } from '../lib/interactions.js';
import { withBucket } from '../lib/leadDerived.js';
import { stageChangeFields } from '../lib/stageMove.js';
import { DG_CATEGORY_META, COLOR_TONES, dgDateKey, buildInteractionsByLead, computeDailyGoalSlots, computeRitmo, DEFAULT_SLA_OVERDUE_DAYS, computeDailyVolume, computeVolumeInRange, countMetaDaysInMonth, volumeTargetFor, tomorrowAppointmentsOf, slotTotals, newLeadHandledPatch } from '../lib/dailyGoal.js';
import { followUpChannelOf } from '../lib/contactGoal.js';
import { computeDayAgenda } from '../lib/dayAgenda.js';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { useFrozenWhileIdle, useMinuteClock } from '../hooks/useMinuteClock.js';
import { frozenDayText } from '../lib/rotinasTela.js';
import { MetaFocoScreen } from '../components/dailygoal/foco/MetaFocoScreen.jsx';
import { RitmoCard, SideCard, SideSection } from '../components/dailygoal/foco/FocoParts.jsx';
import { AgendaHoje } from '../components/dailygoal/foco/AgendaHoje.jsx';
import { RoutineCard } from '../components/dailygoal/RoutineCard.jsx';
import { OutcomePopover } from '../components/dailygoal/OutcomePopover.jsx';
import { writeAppointmentOutcome, correctAppointmentOutcome } from '../lib/appointmentOutcome.js';
import { planPromotion, correctableOutcome, consumedFields } from '../lib/outcomeCorrection.js';
import { applyOutcomeToAula, closeOpenAppointment, upsertScheduledAppointment, upsertScheduledAula } from '../lib/aulasWrites.js';
import { recordPlanFor } from '../lib/aulas.js';
import { daysToExpiryOf, activeRenewalCheckpoint } from '../lib/renewalGoal.js';
import { formatHourLabel } from '../lib/format.js';
import { contactOf, telHref, whatsappHref } from '../lib/guardian.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { LeadLink } from '../components/nav/AppLink.jsx';
import { ContactPhone } from '../components/profile/ContactPhone.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { RenewalOutcomeModal } from '../modals/RenewalOutcomeModal.jsx';
import { ContactOutcomeModal } from '../modals/ContactOutcomeModal.jsx';
import { ContractModal } from '../modals/ContractModal.jsx';
import { RescheduleModal } from '../modals/RescheduleModal.jsx';
import { NextContactModal } from '../modals/NextContactModal.jsx';
import { BookOpen, Building2, Check, ChevronRight, MessageCircle, MessageSquare, Phone, RefreshCw } from 'lucide-react';

// DAILY GOAL VIEW — DESIGN PRIMITIVES
// ==========================================
// (metadados de categoria/cores e a lógica de slots moraram aqui; foram para
// src/lib/dailyGoal.js, que guarda a regra pura e testada)


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
          {/* draggable={false}: a camada cobre o card inteiro, e sem isto o
              card vira um endereço arrastável. */}
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

function DailyGoalView({ leads, agendaLeads = [], interactions, appUser, statuses, db, usersList, listenersActive = true }) {
  const toast = useToast();
  // A categoria aberta vem do endereço: F5 mantém e o link abre na mesma
  // categoria.
  const paramsCtx = useMemo(() => ({}), []);
  const [{ cat: filter }, setParams] = useScreenParams('dailyGoal', paramsCtx);
  const setFilter = (v) => setParams({ cat: v });
  // Relógio por minuto, congelado na pausa por inatividade, como a aba Hoje das
  // Rotinas: sem dados chegando, o relógio andando faria atrasada toda tarefa
  // feita depois da pausa.
  const liveNow = useMinuteClock();
  const now = useFrozenWhileIdle(liveNow, listenersActive);
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

  // agendaLeads: os agendamentos de hoje, lidos ao vivo no App (useDayAgenda),
  // que também põe na Meta os clientes ativos com visita ou aula hoje.
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

  // Para o "Feitos hoje" da lateral: leads com AO MENOS uma categoria
  // concluída. Lead pendente em outra categoria continua na fila do Foco.
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
  // desfecho no Agora: Não compareceu pede a remarcação e Compareceu pergunta o
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

  // A gravação do Concluir sem pop-up (o Novo lead). As categorias com pop-up
  // concluem nele (openOutcomePopup). A tela grava depois do prazo do Desfazer,
  // com `quiet`, porque o aviso dela já disse que a tarefa foi concluída, e sem
  // `quiet` nos últimos segundos do dia, quando grava na hora.
  const concludeTask = async (lead, categorySlug, note, { quiet = false } = {}) => {
    if (!Object.values(DAILY_GOAL_CATEGORIES).includes(categorySlug)) return;
    const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
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
      if (!quiet) toast.success(`Tarefa "${categoryLabel}" concluída.`);
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

  // Reschedule: opens the date dialog (set by the Agora's Remarcar or after no_show), then this commits.
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

  // Os dois dizem se abriram alguma coisa: lead sem telefone de contato não
  // abre nada, e a tela não pergunta "Conversou com…?" nesse caso.
  const handleWhatsapp = (lead) => {
    const href = whatsappHref(contactOf(lead).phone);
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
    return Boolean(href);
  };

  const handleCall = (lead) => {
    const href = telHref(contactOf(lead).phone);
    if (href) window.location.href = href;
    return Boolean(href);
  };

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

  const modals = (
    <>
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
          onDone={() => setMatriculaTarget(null)}
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
    </>
  );

  // A marca do Ritmo: os dias de meta do mês até ontem. No dia 1 ainda é zero.
  const ontem = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const expectedHits = ontem.getMonth() === now.getMonth() ? countMetaDaysInMonth(metaWeekdays, ontem) : 0;
  const amanha = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toLocaleDateString('pt-BR', { weekday: 'long' });
  const tomorrowRow = ({ lead, when }) => <TomorrowApptRow key={lead.id} lead={lead} when={when} />;
  const volume = { count: volumeCount, target: volumeTarget, breakdown: volumeData };
  return (
    <div className="animate-fade-in">
      <MetaFocoScreen
        strip={{
          greeting, firstName, todayLabel, now, totalSlots, doneSlots, progress, volume,
          live: listenersActive,
          frozenDay: listenersActive ? '' : frozenDayText(now, liveNow),
          streak: ritmoMes.streak,
        }}
        processedLeads={processedLeads}
        now={now}
        sla={slaOverdueDays}
        renewalCheckpoints={renewalCheckpoints}
        meId={appUser.id}
        foco={filter}
        onFoco={setFilter}
        totalSlots={totalSlots}
        doneSlots={doneSlots}
        volume={volume}
        perfectDay={perfectDay}
        tomorrow={tomorrowAppts.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="font-display text-[14px] font-bold">Amanhã, {amanha}</h3>
            <div className="mt-2.5 flex flex-col gap-2">{tomorrowAppts.map(tomorrowRow)}</div>
          </div>
        )}
        onOutcome={handleOutcome}
        onReschedule={(l, s) => setRescheduleTarget({ lead: l, categorySlug: s })}
        onPostpone={handleRescheduleTask}
        onOutcomePopup={openOutcomePopup}
        onConclude={concludeTask}
        onWhatsapp={handleWhatsapp}
        onCall={handleCall}
        aside={(
          <>
            <AgendaHoje rows={dayAgenda.rows} now={now} savingId={savingAgendaId} onMark={markAgendaPresence} />
            <RitmoCard ritmo={ritmoMes} expected={expectedHits} volumeMonth={volumeMonth} />
            {isMetaParticipant(appUser) && (
              <RoutineCard db={db} appUser={appUser} enabled={listenersActive} now={now} metaWeekdays={metaWeekdays} />
            )}
            <SideCard>
              <SideSection
                title={`Amanhã, ${amanha}`}
                note="Não conta na meta de hoje"
                items={tomorrowAppts}
                empty="Nada agendado para amanhã."
                renderItem={tomorrowRow}
              />
              <SideSection
                title="Feitos hoje"
                count={done.length}
                items={done}
                empty="Nenhuma tarefa concluída ainda."
                moreLabel="Ver todos"
                renderItem={(lead) => (
                  <DoneCard
                    key={lead.id}
                    lead={lead}
                    now={now}
                    saving={savingAgendaId === lead.id}
                    onReschedule={(l, s) => setRescheduleTarget({ lead: l, categorySlug: s })}
                    onCorrect={handleCorrectOutcome}
                  />
                )}
              />
            </SideCard>
          </>
        )}
      />
      {modals}
    </div>
  );
}
export { DailyGoalView, DG_WEEKDAY_NAMES };
