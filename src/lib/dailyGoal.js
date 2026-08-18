import { AlertCircle, BookOpen, Building2, MessageSquare, RefreshCw, UserX, Zap } from 'lucide-react';
import {
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  getLeadAppointmentType,
  getLeadAppointmentDate,
  hasGoalDoneToday,
  isLeadResolvedToday,
  hasActiveInteractionToday,
  contactOwnerId
} from './leads.js';
import { normalizeAppointmentType } from './dates.js';
import { shouldPromptRenewal, DEFAULT_RENEWAL_CHECKPOINTS, DEFAULT_RENEWAL_GRACE_DAYS } from './renewalGoal.js';
import { shouldPromptExpired } from './expiredGoal.js';

// ============================================================================
// Lógica compartilhada da META DIÁRIA — usada pela tela do consultor
// (DailyGoalView) e pelo painel da equipe do gestor (DailyGoalTeamView).
// FILOSOFIA META-ONLY (regra única): uma tarefa só é "feita" quando o lead
// virou Venda/Perda hoje OU existe interaction `daily_goal_done` da categoria
// criada hoje. Qualquer outra atividade NÃO marca a tarefa.
// ============================================================================

// Metadados visuais das 5 categorias (slug → label/cor/ícone).
export const DG_CATEGORY_META = {
  [DAILY_GOAL_CATEGORIES.NOVO_24H]: { label: DAILY_GOAL_CATEGORY_LABEL.novo_24h, short: 'Novos leads', color: 'blue', Icon: Zap },
  [DAILY_GOAL_CATEGORIES.VISITA_HOJE]: { label: DAILY_GOAL_CATEGORY_LABEL.visita_hoje, short: 'Visitas', color: 'violet', Icon: Building2 },
  [DAILY_GOAL_CATEGORIES.AULA_HOJE]: { label: DAILY_GOAL_CATEGORY_LABEL.aula_hoje, short: 'Aulas exp.', color: 'amber', Icon: BookOpen },
  [DAILY_GOAL_CATEGORIES.CONTATO_HOJE]: { label: DAILY_GOAL_CATEGORY_LABEL.contato_hoje, short: 'Contatos', color: 'teal', Icon: MessageSquare },
  [DAILY_GOAL_CATEGORIES.ATRASADO]: { label: DAILY_GOAL_CATEGORY_LABEL.atrasado, short: 'Atrasados', color: 'rose', Icon: AlertCircle },
  [DAILY_GOAL_CATEGORIES.RENOVACAO]: { label: DAILY_GOAL_CATEGORY_LABEL.renovacao, short: 'Renovações', color: 'emerald', Icon: RefreshCw },
  [DAILY_GOAL_CATEGORIES.VENCIDO]: { label: DAILY_GOAL_CATEGORY_LABEL.vencido, short: 'Vencidos', color: 'slate', Icon: UserX }
};

export const DG_CATEGORY_ORDER = [
  DAILY_GOAL_CATEGORIES.NOVO_24H,
  DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  DAILY_GOAL_CATEGORIES.AULA_HOJE,
  DAILY_GOAL_CATEGORIES.CONTATO_HOJE,
  DAILY_GOAL_CATEGORIES.ATRASADO,
  DAILY_GOAL_CATEGORIES.RENOVACAO,
  DAILY_GOAL_CATEGORIES.VENCIDO
];

export const COLOR_TONES = {
  blue: { dot: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50', strong: 'bg-blue-600', border: 'border-blue-200', darkText: 'dark:text-blue-300', darkSoft: 'dark:bg-blue-500/10' },
  violet: { dot: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50', strong: 'bg-violet-600', border: 'border-violet-200', darkText: 'dark:text-violet-300', darkSoft: 'dark:bg-violet-500/10' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50', strong: 'bg-amber-600', border: 'border-amber-200', darkText: 'dark:text-amber-300', darkSoft: 'dark:bg-amber-500/10' },
  teal: { dot: 'bg-teal-500', text: 'text-teal-700', soft: 'bg-teal-50', strong: 'bg-teal-600', border: 'border-teal-200', darkText: 'dark:text-teal-300', darkSoft: 'dark:bg-teal-500/10' },
  rose: { dot: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50', strong: 'bg-rose-600', border: 'border-rose-200', darkText: 'dark:text-rose-300', darkSoft: 'dark:bg-rose-500/10' },
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', strong: 'bg-emerald-600', border: 'border-emerald-200', darkText: 'dark:text-emerald-300', darkSoft: 'dark:bg-emerald-500/10' },
  slate: { dot: 'bg-slate-500', text: 'text-slate-700', soft: 'bg-slate-100', strong: 'bg-slate-500', border: 'border-slate-200', darkText: 'dark:text-slate-300', darkSoft: 'dark:bg-white/[0.06]' }
};

// Chave de dia em hora LOCAL ('YYYY-MM-DD'), usada como ID do histórico de
// metas batidas. Local (não UTC) para o dia bater com o fuso do consultor.
export function dgDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ── SLA de atrasados ────────────────────────────────────────────────────────
// A partir de QUANTOS dias de atraso um lead vira "crítico" (alerta no painel
// da equipe + destaque na meta do consultor). Política da academia, editável
// em Configurações Gerais (campo slaOverdueDays do config geral).
export const DEFAULT_SLA_OVERDUE_DAYS = 3;

// ── Meta por VOLUME (piso de esforço diário) ───────────────────────────────
// Régua de PIPELINE (critérios v2 do Johnny, 2026-06-11) — cada ação vale 1:
//   • AGENDAMENTO criado: visita, aula experimental, mensagem ou ligação
//     (interações com volumeKind, gravadas pelo wizard/remarcação — cobre o
//     "reaquecimento": reagendar lead parado É um agendamento; conta mesmo
//     quando o reagendamento também fecha a tarefa da Meta do dia)
//   • lead NOVO cadastrado (prospecção)
//   (Venda/Perda do dia NÃO entram — fechamento é resultado, não prospecção.)
// FORA da régua: concluir tarefa da Meta SEM uma ação acima — daily_goal_done
// puro (marcar "concluído" ou registrar comparecimento) NÃO é prospecção
// (decisão do Johnny, 2026-06-16); anotações soltas, observação automática de
// cadastro, "adiar p/ amanhã" (snooze, não recebe volumeKind) e mudanças de fase.
// Volume NÃO trava o "dia batido" — quem bate pendências E volume ganha o
// selo "dia perfeito ⚡". Gestor (role admin) fica fora da régua.
// Retorna { total, agendamentos, leadsNovos }.

// Contagem num INTERVALO [from, to) — base do "hoje" e do acumulado do mês.
// metaWeekdays (opcional): quando passado, só conta ações em dias PROGRAMADOS
// da meta (mesma régua do alvo mensal e do "ritmo do mês") — ação feita em dia
// fora da meta (ex.: sábado) NÃO entra na contabilização. Sem ele = todo dia.
// Dono de uma interação para efeito de VOLUME/prospecção: quem FEZ a ação.
// A partir da PR C toda interação grava actorAuthUid (o autor da ação); as
// antigas caem no dono do LEAD (leadConsultantAuthUid). consultantAuthUid fica
// só como camada defensiva — NUNCA foi gravado em interação.
// IMPORTANTE (mudança de comportamento): antes o volume filtrava direto por
// i.consultantAuthUid, sempre ausente, então "agendamentos" NUNCA contava
// (volume = só leads novos). Com este resolvedor os agendamentos passam a
// contar. Quem agrupa interações por dono (useTeamGoals/DailyGoalTeamView)
// DEVE usar a MESMA função, senão a fatia não bate com o filtro.
export const interactionOwnerAuthUid = (i) =>
  i?.actorAuthUid ?? i?.consultantAuthUid ?? i?.leadConsultantAuthUid ?? null;

export function computeVolumeInRange(leads, interactions, consultantId, consultantAuthUid, from, to = null, metaWeekdays = null) {
  const onMetaDay = (d) => !metaWeekdays || metaWeekdays.includes(d.getDay());
  const inRange = (d) => d instanceof Date && d >= from && (!to || d < to) && onMetaDay(d);
  const r = { agendamentos: 0, leadsNovos: 0 };
  (leads || []).forEach((l) => {
    if (l.consultantId !== consultantId) return;
    if (inRange(l.createdAt)) r.leadsNovos++;
  });
  (interactions || []).forEach((i) => {
    if (interactionOwnerAuthUid(i) !== consultantAuthUid) return;
    if (!inRange(i.createdAt)) return;
    if (i.volumeKind) r.agendamentos++;
  });
  return { total: r.agendamentos + r.leadsNovos, ...r };
}

export function computeDailyVolume(leads, interactions, consultantId, consultantAuthUid, refDate = new Date()) {
  const todayStart = new Date(refDate);
  todayStart.setHours(0, 0, 0, 0);
  return computeVolumeInRange(leads, interactions, consultantId, consultantAuthUid, todayStart);
}

// Dias de META decorridos no mês (1..hoje, respeitando metaWeekdays) — régua
// p/ alvo MENSAL de prospecção (alvo/dia × dias) e p/ "X de Y dias batidos".
export function countMetaDaysInMonth(metaWeekdays, refDate = new Date()) {
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  let n = 0;
  for (let day = 1; day <= today.getDate(); day++) {
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    if ((metaWeekdays || []).includes(d.getDay())) n++;
  }
  return n;
}

// Dias de META já ENCERRADOS no mês (1..ontem). Denominador das asas do painel
// da equipe: hoje ainda está em curso, então não entra nem no numerador nem no
// denominador — contá-lo faria o time começar toda manhã devendo um dia que nem
// começou. Diferente de countMetaDaysInMonth, que INCLUI hoje e é usada onde o
// numerador também inclui (prospecção do mês na tela do consultor).
export function countClosedMetaDaysInMonth(metaWeekdays, refDate = new Date()) {
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);
  let n = 0;
  for (let day = 1; day < today.getDate(); day++) {
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    if ((metaWeekdays || []).includes(d.getDay())) n++;
  }
  return n;
}

// TODOS os dias de META do mês, do dia 1 ao último — inclusive os que ainda não
// chegaram. É o denominador das réguas do painel da equipe: a barra enche até o
// alvo do mês inteiro, então "45%" significa "cumpriu 45% da meta do mês", não
// "45% do que devia ter feito até agora". A leitura de ritmo vem da marca de
// posição esperada na barra, não do denominador.
export function countMetaDaysInMonthAll(metaWeekdays, refDate = new Date()) {
  const d = new Date(refDate);
  const year = d.getFullYear(), month = d.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let day = 1; day <= last; day++) {
    if ((metaWeekdays || []).includes(new Date(year, month, day).getDay())) n++;
  }
  return n;
}

// Dias de META num intervalo [from, to) — denominador do "X de Y dias batidos"
// quando o painel olha um período passado (ontem/semana/mês anterior/custom).
export function countMetaDaysInRange(metaWeekdays, from, to) {
  let n = 0;
  const d = new Date(from); d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  while (d < end) {
    if ((metaWeekdays || []).includes(d.getDay())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// Metas batidas (docs de histórico {date:'YYYY-MM-DD'}) dentro de [from, to),
// só em dias programados — numerador do "X de Y dias batidos" do período.
export function countHitsInRange(history, metaWeekdays, from, to) {
  const fromKey = dgDateKey(from);
  const toKey = dgDateKey(new Date(to.getTime() - 1));
  let n = 0;
  (history || []).forEach((h) => {
    const key = h?.date;
    if (!key || key < fromKey || key > toKey) return;
    const [y, m, d] = key.split('-').map(Number);
    if (y && m && d && (metaWeekdays || []).includes(new Date(y, m - 1, d).getDay())) n++;
  });
  return n;
}

// Extrato das ações de volume do dia — lista cronológica (mais recente
// primeiro) para o gestor auditar COMO o consultor compôs o número:
// [{ at: Date, label, leadId, leadName }]. Mesmos critérios do contador.
const VOLUME_KIND_LABEL = {
  visita: 'Visita agendada',
  aula_experimental: 'Aula experimental agendada',
  mensagem: 'Mensagem agendada',
  ligacao: 'Ligação agendada',
};

// Extrato num INTERVALO [from, to) — base do "hoje" (sem teto) e dos períodos
// passados (ontem/semana/mês anterior/personalizado). metaWeekdays opcional:
// só ações em dias programados (mesma régua da contabilização).
export function listVolumeActionsInRange(leads, interactions, consultantId, consultantAuthUid, from, to = null, metaWeekdays = null) {
  const onMetaDay = (d) => !metaWeekdays || metaWeekdays.includes(d.getDay());
  const inRange = (d) => d instanceof Date && d >= from && (!to || d < to) && onMetaDay(d);
  const nameOf = new Map((leads || []).map((l) => [l.id, l.name || '—']));
  const out = [];
  (leads || []).forEach((l) => {
    if (l.consultantId !== consultantId) return;
    if (inRange(l.createdAt)) out.push({ at: l.createdAt, label: 'Lead cadastrado', leadId: l.id, leadName: l.name || '—' });
  });
  (interactions || []).forEach((i) => {
    if (interactionOwnerAuthUid(i) !== consultantAuthUid) return;
    if (!inRange(i.createdAt)) return;
    // Nome: primeiro o lead em memória (é o nome ATUAL, se foi corrigido
    // depois), senão o que ficou gravado na interação. O segundo cobre lead
    // que saiu da base ativa — cliente em renovação, por exemplo.
    if (i.volumeKind) out.push({ at: i.createdAt, label: VOLUME_KIND_LABEL[i.volumeKind] || 'Contato agendado', leadId: i.leadId, leadName: nameOf.get(i.leadId) || i.leadName || '—' });
  });
  return out.sort((a, b) => b.at - a.at);
}

export function listDailyVolumeActions(leads, interactions, consultantId, consultantAuthUid, refDate = new Date()) {
  const todayStart = new Date(refDate);
  todayStart.setHours(0, 0, 0, 0);
  return listVolumeActionsInRange(leads, interactions, consultantId, consultantAuthUid, todayStart);
}

// Composição legível do volume ("2 agendamentos · 1 lead novo").
export function volumeBreakdownLabel(v) {
  if (!v) return '';
  const parts = [];
  if (v.agendamentos) parts.push(`${v.agendamentos} agendamento${v.agendamentos === 1 ? '' : 's'}`);
  if (v.leadsNovos) parts.push(`${v.leadsNovos} lead${v.leadsNovos === 1 ? '' : 's'} novo${v.leadsNovos === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'nenhuma ação ainda';
}

// Alvo de volume de um usuário: o próprio (doc do consultor) > default da
// academia. 0 = sem régua. Inclui o GESTOR (admin) — prospecção vale p/ todos.
// Alvo de prospecção do usuário — 100% INDIVIDUAL. Não existe padrão de
// academia: cada consultor (e o gestor, se for o caso) define o próprio alvo
// de ações/dia no seu doc. 0 (ou vazio) significa prospecção DESABILITADA —
// quem não tem alvo, não tem meta de prospecção. (O 2º argumento antigo,
// academyDefault, foi removido; os callers podem seguir passando qualquer
// coisa, é ignorado.)
export function volumeTargetFor(user) {
  if (!user) return 0;
  const own = Math.floor(Number(user.dailyVolumeTarget));
  return Number.isFinite(own) && own > 0 ? Math.min(own, 500) : 0;
}

// Dias de atraso de um lead (follow-up vencido antes de hoje). 0 = em dia.
// Mesma régua do card da Meta: dia parcial não conta, mínimo 1.
export function overdueDaysOf(lead, refDate = new Date()) {
  if (!lead?.nextFollowUp) return 0;
  const todayStart = new Date(refDate);
  todayStart.setHours(0, 0, 0, 0);
  if (!(lead.nextFollowUp < todayStart)) return 0;
  return Math.max(1, Math.ceil((todayStart - lead.nextFollowUp) / 86400000));
}

// Índice de interações por leadId — varrer TODAS as interações por lead é
// O(leads × interações) e trava a UI em volume. O(interações) p/ montar +
// lookups O(1). hasGoalDoneToday/hasActiveInteractionToday filtram por leadId
// internamente, então passar só as do lead dá EXATAMENTE o mesmo resultado.
export function buildInteractionsByLead(interactions) {
  const map = new Map();
  (interactions || []).forEach(i => {
    const arr = map.get(i.leadId);
    if (arr) arr.push(i); else map.set(i.leadId, [i]);
  });
  return map;
}

// Monta os "slots" da meta de UM consultor: cada lead alvo sai com
// categorySlugs[] e categoryStatus{slug:bool} (par lead×categoria = 1 slot;
// um lead pode estar feito numa categoria e pendente noutra).
// renewalGraceDays: hoje governa o funil VENCIDOS (por quantos dias o cliente
// vencido continua sendo cobrado), não mais a Renovação — essa parou no
// vencimento (corte limpo, ver src/lib/renewalGoal.js).
export function computeDailyGoalSlots(leads, interactionsByLead, consultantId, renewalCheckpoints = DEFAULT_RENEWAL_CHECKPOINTS, renewalGraceDays = DEFAULT_RENEWAL_GRACE_DAYS) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Horário REAL, não meia-noite: a regra de vencidos compara a vigência com o
  // instante atual (ver o cabeçalho de shouldPromptExpired). Passar todayStart
  // atrasaria em um dia a entrada de quem vence hoje.
  const nowRef = new Date();

  const myLeads = (leads || []).filter(l => l.consultantId === consultantId);
  // Contato DELEGADO: lead de OUTRO consultor cuja tarefa de contato foi
  // atribuída a mim. Fica FORA de myLeads de propósito — delegar um contato não
  // arrasta visita, aula, atrasado nem novo 24h do lead (spec, decisão 3).
  const delegatedContactLeads = (leads || []).filter(
    l => l.consultantId !== consultantId && l.nextFollowUpOwnerId === consultantId
  );
  const allTargetLeadsMap = new Map();
  const leadInteractions = (id) => interactionsByLead.get(id) || [];

  // Regra única: tarefa é considerada "feita" SOMENTE se
  //   (a) lead virou Venda/Perda hoje (auto-conclui todas as
  //       categorias do lead — decisão de produto), OU
  //   (b) há uma interaction type='daily_goal_done' criada hoje
  //       com dailyGoalCategory matching aquela categoria.
  // Mover no Kanban, anotar no LeadDetailsModal, mudar fase, etc
  // NÃO marcam a tarefa. O consultor precisa confirmar pela Meta.
  const isCategoryDone = (lead, categorySlug) => {
    if (isLeadResolvedToday(lead, todayStart)) return true;
    return hasGoalDoneToday(lead, categorySlug, leadInteractions(lead.id), todayStart);
  };

  const addTarget = (lead, categoryLabel, categorySlug) => {
    if (!allTargetLeadsMap.has(lead.id)) {
      allTargetLeadsMap.set(lead.id, {
        ...lead,
        categories: [],
        categorySlugs: [],
        categoryStatus: {},
        hasOtherActivityToday: hasActiveInteractionToday(lead, leadInteractions(lead.id), todayStart)
      });
    }
    const entry = allTargetLeadsMap.get(lead.id);
    if (!entry.categorySlugs.includes(categorySlug)) {
      entry.categories.push(categoryLabel);
      entry.categorySlugs.push(categorySlug);
      entry.categoryStatus[categorySlug] = isCategoryDone(lead, categorySlug);
    }
  };

  // Categoria 5 — Contato Hoje. Extraída porque roda em DOIS conjuntos: os leads
  // do consultor e os contatos delegados a ele por colegas.
  const addContactTodayIfDue = (lead) => {
    // Dono da TAREFA, que pode não ser o dono do lead.
    if (contactOwnerId(lead) !== consultantId) return;
    if (lead.status === 'Perda') return;
    // CLIENTE ('Venda' + lifecycleStage) entra: é o contato de renovação
    // reagendado, mesma exceção de antes da extração.
    if (lead.status === 'Venda' && lead.lifecycleStage !== 'cliente') return;
    if (!lead.nextFollowUp || lead.nextFollowUp < todayStart || lead.nextFollowUp > todayEnd) return;
    // Eco do compromisso: agendar visita/aula também grava nextFollowUp.
    if (normalizeAppointmentType(lead.nextFollowUpType)) return;
    addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.contato_hoje, DAILY_GOAL_CATEGORIES.CONTATO_HOJE);
  };

  myLeads.forEach(lead => {
    // 1. Novo Lead 24h
    // A regra entra em vigor APENAS no dia seguinte ao cadastro: leads
    // criados hoje não aparecem nessa categoria (o consultor acabou de
    // cadastrar — não precisa de lembrete imediato). Critério: criado
    // antes do início de hoje E dentro das últimas 24h.
    if (
      lead.createdAt &&
      lead.createdAt < todayStart &&
      lead.createdAt >= oneDayAgo &&
      lead.status !== 'Venda' && lead.status !== 'Perda'
    ) {
      addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.novo_24h, DAILY_GOAL_CATEGORIES.NOVO_24H);
    }

    // 2. Atrasados
    if (lead.status !== 'Venda' && lead.status !== 'Perda' && lead.nextFollowUp && lead.nextFollowUp < todayStart) {
      addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.atrasado, DAILY_GOAL_CATEGORIES.ATRASADO);
    }

    // 3. Visitas Hoje
    if (lead.status !== 'Venda' && lead.status !== 'Perda') {
      const apptType = getLeadAppointmentType(lead);
      const apptDate = getLeadAppointmentDate(lead);
      if (apptType === 'visita' && apptDate >= todayStart && apptDate <= todayEnd) {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.visita_hoje, DAILY_GOAL_CATEGORIES.VISITA_HOJE);
      }
    }

    // 4. Aulas Exp. Hoje
    if (lead.status !== 'Venda' && lead.status !== 'Perda') {
      const apptType = getLeadAppointmentType(lead);
      const apptDate = getLeadAppointmentDate(lead);
      if (apptType === 'aula_experimental' && apptDate >= todayStart && apptDate <= todayEnd) {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.aula_hoje, DAILY_GOAL_CATEGORIES.AULA_HOJE);
      }
    }

    // 5. Contato Hoje — regra em addContactTodayIfDue (acima), porque ela roda
    // também sobre os contatos delegados a este consultor por colegas.
    addContactTodayIfDue(lead);

    // 6. Renovação — CLIENTE com um MARCO configurável ativo (ex.: 90/60/30
    // dias antes de vencer) ainda não tratado neste ciclo, OU com um
    // reagendamento de contato vencido. É a ÚNICA categoria que NÃO carrega o
    // guard status!=='Venda' (clientes SÃO 'Venda'). Os marcos SUBSTITUEM o
    // threshold único como gatilho da Meta — o status "A vencer" do sistema
    // (badge/anel em ClientsView, ficha) continua em deriveLeadContractStatus
    // com contractThresholdDays, sem relação com isto (regra em
    // src/lib/renewalGoal.js). Legados sem endsAt nunca entram aqui.
    // A tarefa fecha por daily_goal_done (isCategoryDone) OU some quando o
    // marco é tratado / o cliente renova (shouldPromptRenewal volta a false).
    if (
      lead.lifecycleStage === 'cliente' &&
      shouldPromptRenewal(lead, todayStart, renewalCheckpoints, renewalGraceDays)
    ) {
      addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.renovacao, DAILY_GOAL_CATEGORIES.RENOVACAO);
    }

    // 7. Vencidos — CLIENTE com contrato vencido dentro do período configurado
    // (renewalGraceDays) e sem contato marcado para hoje/futuro. Cobrado TODO
    // dia enquanto durar o período; sai por desfecho (reativou / não vai voltar
    // / reagendou) ou quando o período acaba. Regra em src/lib/expiredGoal.js.
    if (shouldPromptExpired(lead, nowRef, renewalGraceDays)) {
      addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.vencido, DAILY_GOAL_CATEGORIES.VENCIDO);
    }
  });

  // Contatos que colegas delegaram a este consultor: SÓ a categoria 5.
  delegatedContactLeads.forEach(addContactTodayIfDue);

  // Tarefas CONCLUÍDAS hoje continuam visíveis (como FEITAS) mesmo que a ação de
  // conclusão tenha tirado o lead da condição viva da categoria. Ex.: concluir um
  // Contato/Atrasado agenda o próximo toque (nextFollowUp futuro), o que remove o
  // lead da categoria — sem isto a marca daily_goal_done ficaria órfã e a tarefa
  // sumiria em vez de contar como feita. addTarget deduplica, então não recria
  // slots já adicionados pela condição viva acima. (mesma correção da PR #125)
  // Categorias cujo alvo é CLIENTE. Cliente é status 'Venda', então o guard
  // abaixo o excluía do laço e a tarefa concluída hoje SUMIA da tela em vez de
  // ficar marcada como feita. Aqui ele mantém visível só o que concluiu nestas
  // duas — nada de lead muda de comportamento.
  const CLIENT_CATEGORY_SLUGS = [DAILY_GOAL_CATEGORIES.RENOVACAO, DAILY_GOAL_CATEGORIES.VENCIDO];
  myLeads.forEach(lead => {
    const isCliente = lead.lifecycleStage === 'cliente';
    if (!isCliente && (lead.status === 'Venda' || lead.status === 'Perda')) return;
    const slugs = isCliente ? CLIENT_CATEGORY_SLUGS : Object.values(DAILY_GOAL_CATEGORIES);
    slugs.forEach(slug => {
      if (hasGoalDoneToday(lead, slug, leadInteractions(lead.id), todayStart)) {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL[slug] || slug, slug);
      }
    });
  });

  return Array.from(allTargetLeadsMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// Totais de slots de um conjunto processado. Sem tarefas = 100% (meta vazia).
export function slotTotals(processedLeads) {
  const totalSlots = processedLeads.reduce((acc, l) => acc + l.categorySlugs.length, 0);
  const doneSlots = processedLeads.reduce(
    (acc, l) => acc + l.categorySlugs.filter(s => Boolean(l.categoryStatus?.[s])).length,
    0
  );
  return { totalSlots, doneSlots, progress: totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 100 };
}

// Ritmo do mês a partir do histórico de metas batidas (docs com {date}).
// metaWeekdays = dias da semana em que a meta vale (política da academia);
// a sequência pula dias inativos (não quebram nem contam).
export function computeRitmo(history, metaWeekdays) {
  const hits = new Set((history || []).map(h => h.date).filter(Boolean));
  const isActive = (d) => metaWeekdays.includes(d.getDay());

  const history14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    history14.push({ hit: hits.has(dgDateKey(d)), active: isActive(d), isToday: i === 0, label: d.toLocaleDateString('pt-BR') });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Denominador = o mês INTEIRO de dias programados, e hoje entra no numerador.
  // A régua enche até o alvo do mês, então "45%" é "cumpriu 45% da meta do mês".
  // A leitura de ritmo vem da marca de posição esperada na barra, não de
  // encurtar o denominador — encurtar fazia quem batia a meta de manhã aparecer
  // acima de 100%.
  const ultimoDia = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let monthHits = 0, monthTarget = 0;
  for (let day = 1; day <= ultimoDia; day++) {
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    if (!isActive(d)) continue;
    monthTarget++;
    if (hits.has(dgDateKey(d))) monthHits++;
  }

  // Sequência: anda para trás a partir de hoje; pula dias inativos; um dia
  // ativo SEM hit quebra (exceto hoje, que ainda está em andamento).
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (!isActive(d)) continue;
    if (hits.has(dgDateKey(d))) streak++;
    else if (i === 0) continue;
    else break;
  }

  return { history14, monthHits, monthTarget, streak };
}
