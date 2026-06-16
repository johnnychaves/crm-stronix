import { AlertCircle, BookOpen, Building2, MessageSquare, Zap } from 'lucide-react';
import {
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  getLeadAppointmentType,
  getLeadAppointmentDate,
  hasGoalDoneToday,
  isLeadResolvedToday,
  hasActiveInteractionToday,
} from './leads.js';

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
  [DAILY_GOAL_CATEGORIES.ATRASADO]: { label: DAILY_GOAL_CATEGORY_LABEL.atrasado, short: 'Atrasados', color: 'rose', Icon: AlertCircle }
};

export const DG_CATEGORY_ORDER = [
  DAILY_GOAL_CATEGORIES.NOVO_24H,
  DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  DAILY_GOAL_CATEGORIES.AULA_HOJE,
  DAILY_GOAL_CATEGORIES.CONTATO_HOJE,
  DAILY_GOAL_CATEGORIES.ATRASADO
];

export const COLOR_TONES = {
  blue: { dot: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50', strong: 'bg-blue-600', border: 'border-blue-200', darkText: 'dark:text-blue-300', darkSoft: 'dark:bg-blue-500/10' },
  violet: { dot: 'bg-violet-500', text: 'text-violet-700', soft: 'bg-violet-50', strong: 'bg-violet-600', border: 'border-violet-200', darkText: 'dark:text-violet-300', darkSoft: 'dark:bg-violet-500/10' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50', strong: 'bg-amber-600', border: 'border-amber-200', darkText: 'dark:text-amber-300', darkSoft: 'dark:bg-amber-500/10' },
  teal: { dot: 'bg-teal-500', text: 'text-teal-700', soft: 'bg-teal-50', strong: 'bg-teal-600', border: 'border-teal-200', darkText: 'dark:text-teal-300', darkSoft: 'dark:bg-teal-500/10' },
  rose: { dot: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50', strong: 'bg-rose-600', border: 'border-rose-200', darkText: 'dark:text-rose-300', darkSoft: 'dark:bg-rose-500/10' }
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
//   • FECHAMENTO do dia: lead do consultor virou Venda ou Perda hoje
// FORA da régua: concluir tarefa da Meta SEM uma ação acima — daily_goal_done
// puro (marcar "concluído" ou registrar comparecimento) NÃO é prospecção
// (decisão do Johnny, 2026-06-16); anotações soltas, observação automática de
// cadastro, "adiar p/ amanhã" (snooze, não recebe volumeKind) e mudanças de fase.
// Volume NÃO trava o "dia batido" — quem bate pendências E volume ganha o
// selo "dia perfeito ⚡". Gestor (role admin) fica fora da régua.
// Retorna { total, agendamentos, leadsNovos, fechamentos }.

// Contagem num INTERVALO [from, to) — base do "hoje" e do acumulado do mês.
export function computeVolumeInRange(leads, interactions, consultantId, consultantAuthUid, from, to = null) {
  const inRange = (d) => d instanceof Date && d >= from && (!to || d < to);
  const r = { agendamentos: 0, leadsNovos: 0, fechamentos: 0 };
  (leads || []).forEach((l) => {
    if (l.consultantId !== consultantId) return;
    if (inRange(l.createdAt)) r.leadsNovos++;
    if (inRange(l.convertedAt) || inRange(l.lostAt)) r.fechamentos++;
  });
  (interactions || []).forEach((i) => {
    if (i.consultantAuthUid !== consultantAuthUid) return;
    if (!inRange(i.createdAt)) return;
    if (i.volumeKind) r.agendamentos++;
  });
  return { total: r.agendamentos + r.leadsNovos + r.fechamentos, ...r };
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

// Extrato das ações de volume do dia — lista cronológica (mais recente
// primeiro) para o gestor auditar COMO o consultor compôs o número:
// [{ at: Date, label, leadId, leadName }]. Mesmos critérios do contador.
const VOLUME_KIND_LABEL = {
  visita: 'Visita agendada',
  aula_experimental: 'Aula experimental agendada',
  mensagem: 'Mensagem agendada',
  ligacao: 'Ligação agendada',
};

export function listDailyVolumeActions(leads, interactions, consultantId, consultantAuthUid, refDate = new Date()) {
  const todayStart = new Date(refDate);
  todayStart.setHours(0, 0, 0, 0);
  const nameOf = new Map((leads || []).map((l) => [l.id, l.name || '—']));
  const out = [];
  (leads || []).forEach((l) => {
    if (l.consultantId !== consultantId) return;
    if (l.createdAt instanceof Date && l.createdAt >= todayStart) out.push({ at: l.createdAt, label: 'Lead cadastrado', leadId: l.id, leadName: l.name || '—' });
    if (l.convertedAt instanceof Date && l.convertedAt >= todayStart) out.push({ at: l.convertedAt, label: 'Venda fechada', leadId: l.id, leadName: l.name || '—' });
    if (l.lostAt instanceof Date && l.lostAt >= todayStart) out.push({ at: l.lostAt, label: 'Perda registrada', leadId: l.id, leadName: l.name || '—' });
  });
  (interactions || []).forEach((i) => {
    if (i.consultantAuthUid !== consultantAuthUid) return;
    if (!(i.createdAt instanceof Date) || i.createdAt < todayStart) return;
    if (i.volumeKind) {
      out.push({ at: i.createdAt, label: VOLUME_KIND_LABEL[i.volumeKind] || 'Contato agendado', leadId: i.leadId, leadName: nameOf.get(i.leadId) || '—' });
    }
  });
  return out.sort((a, b) => b.at - a.at);
}

// Composição legível do volume ("2 agendamentos · 1 lead novo · 1 fechamento").
export function volumeBreakdownLabel(v) {
  if (!v) return '';
  const parts = [];
  if (v.agendamentos) parts.push(`${v.agendamentos} agendamento${v.agendamentos === 1 ? '' : 's'}`);
  if (v.leadsNovos) parts.push(`${v.leadsNovos} lead${v.leadsNovos === 1 ? '' : 's'} novo${v.leadsNovos === 1 ? '' : 's'}`);
  if (v.fechamentos) parts.push(`${v.fechamentos} fechamento${v.fechamentos === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'nenhuma ação ainda';
}

// Alvo de volume de um usuário: o próprio (doc do consultor) > default da
// academia. 0 = sem régua. Gestor sempre 0 (fora da régua, decisão de produto).
export function volumeTargetFor(user, academyDefault) {
  if (!user || user.role === 'admin') return 0;
  const own = Math.floor(Number(user.dailyVolumeTarget));
  if (Number.isFinite(own) && own > 0) return Math.min(own, 500);
  const def = Math.floor(Number(academyDefault));
  return Number.isFinite(def) && def > 0 ? Math.min(def, 500) : 0;
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
export function computeDailyGoalSlots(leads, interactionsByLead, consultantId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const myLeads = (leads || []).filter(l => l.consultantId === consultantId);
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

    // 5. Contato Hoje — follow-up via Mensagem/Ligação agendado para hoje
    // (qualquer tipo que NÃO seja visita/aula). Pega WhatsApp + ligações sem
    // duplicar quem já está nas seções de visita/aula.
    if (
      lead.status !== 'Venda' &&
      lead.status !== 'Perda' &&
      lead.nextFollowUp &&
      lead.nextFollowUp >= todayStart &&
      lead.nextFollowUp <= todayEnd
    ) {
      const apptType = getLeadAppointmentType(lead);
      if (apptType !== 'visita' && apptType !== 'aula_experimental') {
        addTarget(lead, DAILY_GOAL_CATEGORY_LABEL.contato_hoje, DAILY_GOAL_CATEGORIES.CONTATO_HOJE);
      }
    }
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
  let monthHits = 0, monthTarget = 0;
  for (let day = 1; day <= today.getDate(); day++) {
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
