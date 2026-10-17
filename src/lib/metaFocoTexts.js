import { DAILY_GOAL_CATEGORIES as C, getLeadAppointmentDate } from './leads.js';
import { followUpChannelOf } from './contactGoal.js';
import { expiredLabel } from './expiredGoal.js';
import { activeRenewalCheckpoint, daysToExpiryOf, DEFAULT_RENEWAL_CHECKPOINTS } from './renewalGoal.js';
import { overdueDaysOf, DEFAULT_SLA_OVERDUE_DAYS } from './dailyGoal.js';
import { getSafeDateOrNull } from './dates.js';
import { formatHourLabel } from './format.js';
import { dayRefText } from './whenPicker.js';
import { FOCO_ORDER, URGENT_WINDOW_MIN, inFoco, rankFoco } from './metaFoco.js';

// Os textos da tela nova da Meta (Foco agora, mockup B): o motivo de cada
// tarefa estar onde está na fila, os fatos do bloco Agora e o que a barra "Foco
// em" mostra. Puro e testado em node; a ordem da fila continua em metaFoco.js.

const MIN_MS = 60 * 1000;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const isAppt = (slug) => slug === C.VISITA_HOJE || slug === C.AULA_HOJE;
const slaOf = (opts) => (Number.isFinite(opts?.sla) && opts.sla > 0 ? opts.sla : DEFAULT_SLA_OVERDUE_DAYS);

// Os nomes da barra "Foco em", na ordem de FOCO_ORDER.
export const FOCO_LABEL = Object.freeze({
  all: 'Todos',
  compromissos: 'Visitas e aulas',
  [C.CONTATO_HOJE]: 'Contatos',
  [C.NOVO_24H]: 'Novos leads',
  [C.ATRASADO]: 'Atrasados',
  [C.RENOVACAO]: 'Renovações',
  [C.VENCIDO]: 'Vencidos',
});

// O nome de uma tarefa de cada categoria, no singular, para o Agora e a fila.
export const CATEGORY_ONE = Object.freeze({
  [C.VISITA_HOJE]: 'Visita',
  [C.AULA_HOJE]: 'Aula experimental',
  [C.CONTATO_HOJE]: 'Contato',
  [C.NOVO_24H]: 'Novo lead',
  [C.ATRASADO]: 'Atrasado',
  [C.RENOVACAO]: 'Renovação',
  [C.VENCIDO]: 'Contrato vencido',
});

// A ordem da fila em palavras, para o "Como a ordem é definida".
export const focoRules = (sla = DEFAULT_SLA_OVERDUE_DAYS) => [
  'Visita ou aula que já passou do horário e ainda está sem desfecho',
  `O que vence em até ${URGENT_WINDOW_MIN} minutos: visita, aula, contato marcado ou fim da janela de 24h de um lead novo`,
  `Atrasados críticos, a partir de ${plural(sla, 'dia', 'dias')}`,
  'O restante do que tem horário, pela hora',
  'Atrasados',
  'Renovações, do vencimento mais próximo',
  'Vencidos, do vencimento mais recente',
];

// "40 min", "1h30" ou "2h".
export function durationText(ms) {
  const m = Math.round(Math.abs(ms) / MIN_MS);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h${r ? String(r).padStart(2, '0') : ''}`;
}

// O fim da janela de 24h do lead novo, ou null.
const newLeadCloses = (lead) => {
  const created = getSafeDateOrNull(lead?.createdAt);
  return created ? new Date(created.getTime() + 24 * 60 * MIN_MS) : null;
};

// Por que a tarefa está aqui, numa frase curta, e o tom: late (passou ou
// crítico), now (vence em até 90 minutos), warn (atrasado) e calm (o resto).
export function whyOf({ slug, lead }, now, opts = {}) {
  const soon = (ms) => (ms <= URGENT_WINDOW_MIN * MIN_MS ? 'now' : 'calm');
  if (isAppt(slug)) {
    const at = getLeadAppointmentDate(lead);
    if (!at) return { text: 'Sem horário', tone: 'calm' };
    const ms = at - now;
    return ms < 0 ? { text: `Passou há ${durationText(ms)}`, tone: 'late' } : { text: `Em ${durationText(ms)}`, tone: soon(ms) };
  }
  if (slug === C.CONTATO_HOJE) {
    const { type } = followUpChannelOf(lead);
    const at = getSafeDateOrNull(lead?.nextFollowUp);
    if (!at) return { text: type, tone: 'calm' };
    const ms = at - now;
    return ms < 0 ? { text: `${type} era às ${formatHourLabel(at)}`, tone: 'late' } : { text: `${type} em ${durationText(ms)}`, tone: soon(ms) };
  }
  if (slug === C.NOVO_24H) {
    const at = newLeadCloses(lead);
    if (!at) return { text: 'Lead novo', tone: 'calm' };
    const ms = at - now;
    return ms <= URGENT_WINDOW_MIN * MIN_MS ? { text: `Fecha em ${durationText(Math.max(0, ms))}`, tone: 'now' } : { text: `Fecha às ${formatHourLabel(at)}`, tone: 'calm' };
  }
  if (slug === C.ATRASADO) {
    const days = overdueDaysOf(lead, now);
    // O lead novo que acabou de passar da janela de 24h ainda não tem dia de atraso.
    if (days === 0) return { text: 'Sem próximo passo', tone: 'warn' };
    return { text: `${plural(days, 'dia', 'dias')} de atraso`, tone: days >= slaOf(opts) ? 'late' : 'warn' };
  }
  if (slug === C.RENOVACAO) {
    const d = daysToExpiryOf(lead?.currentContractEndsAt, now);
    if (d == null) return { text: 'Renovação', tone: 'calm' };
    return { text: d <= 0 ? 'Vence hoje' : `Vence em ${plural(d, 'dia', 'dias')}`, tone: 'calm' };
  }
  return { text: expiredLabel(lead, now) || 'Contrato vencido', tone: 'calm' };
}

const fullDate = (d) => d.toLocaleDateString('pt-BR');

// Até quatro fatos do bloco Agora, como [rótulo, valor]: o que o consultor
// precisa ver antes de falar com a pessoa.
export function factsOf({ slug, lead }, now, opts = {}) {
  const out = [];
  const apptAt = getLeadAppointmentDate(lead);
  if (slug === C.AULA_HOJE) {
    const qty = Number(lead?.trialClassesPlanned) || 1;
    const quem = lead?.appointmentProfessorName ? ` com ${lead.appointmentProfessorName}` : lead?.appointmentSoloTraining ? ', treina sozinho' : '';
    out.push(['Aula', `${lead?.appointmentModality || 'Sem modalidade'}${quem}, ${plural(qty, 'aula', 'aulas')}`]);
    if (apptAt) out.push(['Horário', dayRefText(apptAt, now)]);
  } else if (slug === C.VISITA_HOJE) {
    if (lead?.appointmentUnit) out.push(['Unidade', lead.appointmentUnit]);
    if (apptAt) out.push(['Horário', dayRefText(apptAt, now)]);
  } else if (slug === C.CONTATO_HOJE) {
    const at = getSafeDateOrNull(lead?.nextFollowUp);
    if (at) out.push(['Combinado', `${followUpChannelOf(lead).type}, ${dayRefText(at, now)}`]);
  } else if (slug === C.NOVO_24H) {
    const created = getSafeDateOrNull(lead?.createdAt);
    const closes = newLeadCloses(lead);
    if (created) out.push(['Entrou', dayRefText(created, now)]);
    if (closes) out.push(['Sai desta lista', `às ${formatHourLabel(closes)}`]);
  } else if (slug === C.ATRASADO) {
    const days = overdueDaysOf(lead, now);
    out.push(['Atraso', days ? plural(days, 'dia', 'dias') : 'Sem próximo passo desde o cadastro']);
    const created = getSafeDateOrNull(lead?.createdAt);
    if (created && !lead?.createdAtMissing) out.push(['Cadastro', fullDate(created)]);
  } else if (slug === C.RENOVACAO) {
    if (lead?.currentPlanName) out.push(['Plano', lead.currentPlanName]);
    const d = daysToExpiryOf(lead?.currentContractEndsAt, now);
    const cp = d == null ? null : activeRenewalCheckpoint(d, opts.renewalCheckpoints || DEFAULT_RENEWAL_CHECKPOINTS);
    if (d != null) out.push(['Vence em', `${plural(Math.max(0, d), 'dia', 'dias')}${cp != null ? `, marco de ${cp}` : ''}`]);
  } else if (slug === C.VENCIDO) {
    if (lead?.currentPlanName) out.push(['Plano', lead.currentPlanName]);
    const endsAt = getSafeDateOrNull(lead?.currentContractEndsAt);
    if (endsAt) out.push(['Venceu em', fullDate(endsAt)]);
  }
  const cliente = slug === C.RENOVACAO || slug === C.VENCIDO;
  if (!cliente && lead?.source) out.push(['Origem', lead.source]);
  if (lead?.dor) out.push(['Interesse', lead.dor]);
  return out.slice(0, 4);
}

// A linha da manhã, antes da primeira tarefa feita: quantas o dia tem e
// quantas têm hora marcada (visita, aula e contato).
export function morningText(entries) {
  const n = (entries || []).length;
  if (!n) return '';
  const timed = entries.filter((e) => isAppt(e.slug) || e.slug === C.CONTATO_HOJE).length;
  return `Você começa o dia com ${plural(n, 'tarefa', 'tarefas')}${timed ? `, ${timed} com horário` : ''}.`;
}

// A barra "Foco em": para cada foco, quantas faltam e o aviso do ponto, que
// é vermelho quando a primeira da fila já passou e azul quando vence em até 90
// minutos. `entries` são as pendentes de todas as categorias.
export function focoTabs(entries, now, opts = {}) {
  return FOCO_ORDER.map((id) => {
    const scoped = (entries || []).filter((e) => inFoco(e.slug, id));
    const top = id === 'all' ? null : rankFoco(scoped, now, opts)[0] || null;
    const why = top ? whyOf(top, now, opts) : null;
    return {
      id,
      label: FOCO_LABEL[id],
      pending: scoped.length,
      why: why ? why.text : null,
      dot: why && (why.tone === 'late' || why.tone === 'now') ? why.tone : null,
    };
  });
}
