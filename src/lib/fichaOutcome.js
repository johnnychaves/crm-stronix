// O "A seguir" da ficha fala com dois lugares: o gravador de desfecho da Meta
// Diária (writeAppointmentOutcome, em appointmentOutcome.js) e o Agendar
// (ScheduleWizard). Aqui ficam as duas traduções, puras.
import { appointmentTaskOwnerId, DAILY_GOAL_CATEGORIES, hasGoalDoneTodayFor, isClientLead } from './leads.js';

const CATEGORY_BY_TYPE = {
  visita: DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  aula_experimental: DAILY_GOAL_CATEGORIES.AULA_HOJE,
};
// Os ids de tipo do ScheduleWizard (WZ_TYPES).
const PRESET_BY_TYPE = { visita: 'visita', aula_experimental: 'aula', ligacao: 'ligacao', mensagem: 'mensagem' };

// A regra do desfecho de visita e aula, a mesma da Agenda de hoje
// (markAgendaPresence, no DailyGoalView), que também a chama: cliente não muda
// de etapa, e a marca do dia só é gravada quando o dono da tarefa de agora
// ainda não tem a de hoje nessa categoria. `interactions` são as do lead.
export function outcomeRuleFor(lead, categorySlug, { interactions = [], now = new Date() } = {}) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    promote: !isClientLead(lead),
    writeGoalDone: !hasGoalDoneTodayFor(lead, categorySlug, interactions, todayStart, appointmentTaskOwnerId(lead)),
  };
}

// As opções que o writeAppointmentOutcome recebe para um item do A seguir, ou
// null quando o item não tem desfecho (mensagem e ligação).
export function outcomeOptionsFor(item, { lead, interactions = [], now = new Date() } = {}) {
  const categorySlug = item ? CATEGORY_BY_TYPE[item.type] : null;
  if (!categorySlug || !lead) return null;
  return { categorySlug, ...outcomeRuleFor(lead, categorySlug, { interactions, now }), sourceLabel: 'Ficha' };
}

// O tipo com que o Agendar abre ao remarcar um item do A seguir.
export const schedulePresetOf = (item) => (item ? PRESET_BY_TYPE[item.type] || null : null);
