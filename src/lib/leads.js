// Lead-centric helpers: appointment introspection, conversion detection,
// permission checks, security field builders. Pure functions — no React,
// no Firestore SDK imports needed at this layer.

import { getSafeDate, getSafeDateOrNull, normalizeAppointmentType } from './dates.js';
import { onlyDigits } from './globalSearch.js';

// Normalização de UM doc de lead (fonte ÚNICA). A assinatura global do App e as
// queries paginadas (ex.: dashboard do consultor no E2a) precisam produzir
// EXATAMENTE o mesmo shape, senão as funções de dashboardMetrics divergem — em
// especial createdAtMissing, que NÃO é campo do Firestore e é derivado aqui.
// Recebe um DocumentSnapshot (usa .id/.data()); sem importar o SDK.
export const normalizeLeadDoc = (docSnap) => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: getSafeDate(data.createdAt),
    // Doc sem createdAt real: getSafeDate devolve "agora", o que faria o lead
    // contar como captado hoje — a flag permite excluí-lo (dashboardMetrics).
    createdAtMissing: !data.createdAt,
    nextFollowUp: getSafeDateOrNull(data.nextFollowUp),
    appointmentOutcomeAt: getSafeDateOrNull(data.appointmentOutcomeAt),
  };
};

export const getLeadAppointmentType = (lead) => {
  return lead?.appointmentType || normalizeAppointmentType(lead?.nextFollowUpType);
};

export const getLeadAppointmentDate = (lead) => {
  return (
    getSafeDateOrNull(lead?.appointmentScheduledFor) ||
    (getLeadAppointmentType(lead) ? getSafeDateOrNull(lead?.nextFollowUp) : null)
  );
};

// Nomes de status que significam matrícula: o sentinel 'Venda' e etapas
// customizadas cujo nome contém "convertid"/"matricul". Compartilhado entre
// a leitura (isLeadConverted) e a escrita (carimbo de convertedAt ao mover
// um lead para uma etapa dessas).
export const isConvertedStatusName = (statusName) => {
  if (statusName === 'Venda') return true;
  const name = String(statusName || '').toLowerCase();
  return name.includes('convertid') || name.includes('matricul');
};

export const isLeadConverted = (lead) => {
  return Boolean(lead?.isConverted || isConvertedStatusName(lead?.status));
};

// Cliente = matriculado (lifecycleStage) OU lead 'Venda' legado sem contrato
// registrado. É o recorte da aba Clientes; a negação é o recorte do Kanban
// (clientes saem do board). Base do futuro lifecycleBucket.
export const isClientLead = (lead) =>
  lead?.lifecycleStage === 'cliente' || isLeadConverted(lead);

// Duplicado por WhatsApp: compara só os dígitos. Guardas de tamanho mínimo
// ficam no caller (o cadastro só checa com >= 10 dígitos).
export const findLeadByPhoneDigits = (leads, phoneDigits) =>
  (leads || []).find((l) => onlyDigits(l.whatsapp) === phoneDigits);

export const getLeadConversionDate = (lead) => {
  return getSafeDateOrNull(lead?.convertedAt) || getSafeDateOrNull(lead?.createdAt);
};

// Só o carimbo real da matrícula, SEM cair no createdAt. Use quando a data
// precisa ser confiável por si (métricas por período, financeiro futuro);
// getLeadConversionDate segue existindo para quem quer o fallback.
export const getLeadConversionDateStrict = (lead) => getSafeDateOrNull(lead?.convertedAt);

export const getLeadSatisfactionDate = (lead) => {
  return getSafeDateOrNull(lead?.satisfactionAt);
};

// --- Daily Goal (Meta Diária) ---
// A Meta Diária tem uma regra clara: uma tarefa só é considerada
// concluída quando o consultor explicitamente "Conclui" dentro do
// fluxo da Meta — independentemente do que ele tenha feito no Kanban,
// no LeadDetailsModal etc. A única exceção é Venda/Perda registrada
// hoje: nesse caso a tarefa é auto-concluída (o consultor obviamente
// atuou pra matricular ou descartar).

// Slugs canônicos das categorias da meta. Persistidos como metadata
// em interactions tipo 'daily_goal_done' — mudar isso quebra o
// histórico, então tratar como contrato estável.
export const DAILY_GOAL_CATEGORIES = {
  NOVO_24H: 'novo_24h',
  ATRASADO: 'atrasado',
  VISITA_HOJE: 'visita_hoje',
  AULA_HOJE: 'aula_hoje',
  CONTATO_HOJE: 'contato_hoje',
  // Cliente com contrato 'a vencer' (feature lead→cliente). Única categoria
  // cujo alvo é um CLIENTE (status 'Venda'), não um lead em prospecção.
  RENOVACAO: 'renovacao'
};

// Label legível por categoria (usado na UI).
export const DAILY_GOAL_CATEGORY_LABEL = {
  novo_24h: 'Novo Lead 24h',
  atrasado: 'Atrasado',
  visita_hoje: 'Visita Hoje',
  aula_hoje: 'Aula Experimental Hoje',
  contato_hoje: 'Contato Hoje',
  renovacao: 'Renovação'
};

// Retorna true se há ao menos uma interaction `daily_goal_done`
// criada hoje para o par (lead, categoria). `todayStart` deve ser um
// Date com hora 00:00.
export const hasGoalDoneToday = (lead, categorySlug, interactions, todayStart) => {
  if (!lead || !categorySlug || !todayStart) return false;
  return (interactions || []).some(i =>
    i.leadId === lead.id &&
    i.type === 'daily_goal_done' &&
    (i.dailyGoalCategory === categorySlug || i.metadata?.category === categorySlug) &&
    i.createdAt instanceof Date &&
    i.createdAt >= todayStart
  );
};

// True se o lead virou Venda/Perda hoje. Auto-marca todas as
// categorias da meta para esse lead (decisão de produto: matricular
// ou perder é trabalho real, não precisa duplicar com "concluir" na
// Meta).
export const isLeadResolvedToday = (lead, todayStart) => {
  if (!lead || !todayStart) return false;
  // convertedAt/lostAt chegam como Timestamp do Firestore (não normalizados no
  // snapshot) — getSafeDateOrNull cobre Timestamp/Date/null sem o bug do
  // `instanceof Date` (que dava sempre false p/ Timestamp).
  const conv = getSafeDateOrNull(lead.convertedAt);
  if (lead.status === 'Venda' && conv && conv >= todayStart) return true;
  const lost = getSafeDateOrNull(lead.lostAt);
  if (lead.status === 'Perda' && lost && lost >= todayStart) return true;
  return false;
};

// True se o texto da interaction é a observação automática gerada no
// cadastro do lead (prefixo literal "OBSERVAÇÃO DO CADASTRO:"). Usado
// pra (i) ignorar essas observações no contador de atividade ativa e
// (ii) rotular o evento corretamente no feed da Dashboard.
export const isRegistrationNote = (text) =>
  typeof text === 'string' && text.startsWith('OBSERVAÇÃO DO CADASTRO:');

// True se houve qualquer interaction "ativa" hoje (mudança de fase,
// nota, follow-up agendado, etc.) que NÃO seja 'daily_goal_done' nem
// observação automática do cadastro. Usado para o badge "Já
// interagido hoje" — informa o consultor que ele já tocou no lead
// mas ainda precisa fechar a tarefa via Meta Diária.
export const hasActiveInteractionToday = (lead, interactions, todayStart) => {
  if (!lead || !todayStart) return false;
  return (interactions || []).some(i => {
    if (i.leadId !== lead.id) return false;
    if (!(i.createdAt instanceof Date) || i.createdAt < todayStart) return false;
    if (i.type === 'daily_goal_done') return false;
    if (isRegistrationNote(i.text)) return false;
    return true;
  });
};

// --- Appointment outcome (comparecimento) ---
// Outcome marca o desfecho de um agendamento de visita/aula experimental:
//   - 'attended'    → o lead compareceu
//   - 'no_show'     → o lead não veio (sem aviso)
//   - 'rescheduled' → o lead pediu para remarcar
//   - 'cancelled'   → o lead desistiu do agendamento
//   - null/undefined → ainda pendente de confirmação
// O outcome NÃO substitui o status do funil. Ele é informação ortogonal:
// um lead pode comparecer e ainda estar em negociação, ou cancelar mas
// virar Venda por outra via.
export const APPOINTMENT_OUTCOMES = ['attended', 'no_show', 'rescheduled', 'cancelled'];

const APPOINTMENT_OUTCOME_META = {
  attended: {
    label: 'Compareceu',
    icon: '✅',
    badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-400'
  },
  no_show: {
    label: 'Não veio',
    icon: '❌',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400'
  },
  rescheduled: {
    label: 'Remarcou',
    icon: '🔄',
    badgeClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
  },
  cancelled: {
    label: 'Cancelou',
    icon: '🚫',
    badgeClass: 'bg-gray-500/10 text-gray-600 dark:text-neutral-300'
  }
};

export const getAppointmentOutcomeMeta = (outcome) => APPOINTMENT_OUTCOME_META[outcome] || null;

// isLeadAttended consolida múltiplas fontes para "este lead compareceu?":
//   1) outcome explícito 'attended'
//   2) Venda (matriculou-se → claramente compareceu por algum canal)
//   3) hasAttended legado (campo do trabalho local) para retrocompatibilidade
export const isLeadAttended = (lead) => {
  if (!lead) return false;
  if (lead.appointmentOutcome === 'attended') return true;
  if (isLeadConverted(lead)) return true;
  if (lead.hasAttended === true) return true;
  return false;
};

export const getLeadAttendanceDate = (lead) => {
  return (
    getSafeDateOrNull(lead?.appointmentOutcomeAt) ||
    getSafeDateOrNull(lead?.attendedAt) ||  // legado
    (isLeadConverted(lead) ? getLeadConversionDate(lead) : null)
  );
};

// Guarda do dual-write de histórico de aulas: só o desfecho de uma AULA
// experimental propaga para stronix_aulas. Sem isto, marcar o desfecho de uma
// VISITA num lead que ainda tem currentAulaId de uma aula antiga sobrescrevia
// o status daquela aula (bug de fidelidade #1).
export const outcomeAppliesToAula = (categorySlug) =>
  categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE;

// --- Permissions ---

export const isAdminUser = (user) => user?.role === 'admin';

export const canEditLead = (user, lead) =>
  isAdminUser(user) || (Boolean(lead?.consultantAuthUid) && lead.consultantAuthUid === user?.authUid);

// --- Security fields written alongside leads/interactions ---

export const getLeadOwnershipFields = (user) => ({
  consultantId: user?.id || null,
  consultantName: user?.name || null,
  consultantAuthUid: user?.authUid || null
});

export const getInteractionSecurityFields = (lead, user) => ({
  leadConsultantId: lead?.consultantId || user?.id || null,
  leadConsultantAuthUid: lead?.consultantAuthUid || user?.authUid || null
});
