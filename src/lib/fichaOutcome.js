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

// As opções que o writeAppointmentOutcome recebe para um item do A seguir, ou
// null quando o item não tem desfecho (mensagem e ligação). A regra é a da
// Agenda de hoje (markAgendaPresence, no DailyGoalView): cliente não muda de
// etapa, e a marca do dia só é gravada quando o dono da tarefa de agora ainda
// não tem a de hoje nessa categoria. `interactions` são as do lead.
export function outcomeOptionsFor(item, { lead, interactions = [], now = new Date() } = {}) {
  const categorySlug = item ? CATEGORY_BY_TYPE[item.type] : null;
  if (!categorySlug || !lead) return null;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    categorySlug,
    promote: !isClientLead(lead),
    writeGoalDone: !hasGoalDoneTodayFor(lead, categorySlug, interactions, todayStart, appointmentTaskOwnerId(lead)),
    sourceLabel: 'Ficha',
  };
}

// O tipo com que o Agendar abre ao remarcar um item do A seguir.
export const schedulePresetOf = (item) => (item ? PRESET_BY_TYPE[item.type] || null : null);
