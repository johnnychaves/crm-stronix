// Regras puras do agendamento pelo Stronizap (ações schedule-options, schedule
// e appointment-status de api/zap.js). Sem Firestore: a rota lê, chama estas
// funções e grava. O firebase-admin passa por cima das regras do Firestore,
// então o que o assistente de agendamento da ficha e as regras garantem é
// refeito aqui.
//
// A gravação espelha o assistente (handleWizardConfirm, em
// src/views/LeadProfileView.jsx, mais o upsertScheduledAppointment de
// src/lib/aulasWrites.js e o logInteraction de src/lib/interactions.js): o
// mesmo registro em stronix_aulas, a mesma interação e o mesmo patch do lead
// (buildSchedulePatch). Mudou o assistente, mude aqui.
//
// Dia e hora sempre no horário de Brasília (_horarioDeBrasilia.js), porque a
// função da Vercel roda em UTC. Toda recusa de regra leva `message`, um texto
// pronto para a tela. Nada daqui vai para o log.
//
// Spec: docs/superpowers/specs/2026-09-29-agendamento-pelo-stronizap-design.md
import { ZAP_LEAD_MESSAGES, invalidData, nationalDigits, emailFromActor, teamRole } from './_zapLead.js';
import { zapMatchKey } from './_zapPhone.js';
import { appointmentOutcomeOf, isAppointmentCancelled } from './_zapCard.js';
import { diaDeBrasilia, horaInteiraDeBrasilia, diaDaSemanaDoDia, isoDoDia } from './_horarioDeBrasilia.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { normalizeAppointmentType } from '../src/lib/dates.js';
import { normalizeTrialClassOptions, normalizeMetaWeekdays } from '../src/lib/leadStatus.js';

const MINUTE_MS = 60000;
// Anotação do agendamento: o mesmo tamanho da observação do cadastro.
const NOTE_MAX = 1000;
// Dias sugeridos e até onde procurar por eles (wzDayOptions do ScheduleWizard).
const DAYS_SHOWN = 5;
const DAYS_SEARCHED = 90;
// Depois das 18h de Brasília, os dias sugeridos começam amanhã.
const EVENING_HOUR = 18;

// Leads por pedido do appointment-status: o teto do operador `in` do
// Firestore, o mesmo do match.
export const LEAD_IDS_MAX = 30;

// No máximo 60 agendamentos por hora por academia (api/_rateLimit.js).
export const SCHEDULE_LIMIT = Object.freeze({ limit: 60, windowMs: 60 * MINUTE_MS });

// Dia da semana curto, sem "-feira": o balão do Stronizap tem 380px.
const WEEKDAY_LABEL = Object.freeze(['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);

// Os textos das recusas do agendamento. Academia bloqueada, fora da equipe,
// telefone, canal e campo em formato errado usam os do cadastro
// (ZAP_LEAD_MESSAGES).
export const ZAP_SCHEDULE_MESSAGES = Object.freeze({
  actor: 'Não deu para saber quem está agendando.',
  schedule: 'Faltaram os dados do agendamento.',
  leadId: 'Não deu para saber para quem é o agendamento.',
  type: 'Escolha entre visita e aula experimental.',
  date: 'Escolha o dia.',
  time: 'Escolha o horário.',
  noteLong: `Anotação longa demais. Use até ${NOTE_MAX} caracteres.`,
  leadIds: `Envie de 1 a ${LEAD_IDS_MAX} leads, sem repetir.`,
  pick: Object.freeze({
    unit: 'Escolha a unidade.',
    modality: 'Escolha a modalidade.',
    professorId: 'Escolha o professor ou "Treina sozinho".',
    quantity: 'Escolha quantas aulas.'
  }),
  gone: Object.freeze({
    unit: 'Essa unidade não existe mais no Stronilead. Escolha de novo.',
    modality: 'Essa modalidade não existe mais no Stronilead. Escolha de novo.',
    professorId: 'Esse professor não está mais disponível para essa modalidade. Escolha de novo.',
    quantity: 'Essa quantidade de aulas não existe mais no Stronilead. Escolha de novo.'
  }),
  pastTime: 'Esse horário já passou. Escolha outro.',
  notTheLead: 'Esse cadastro não é deste número no Stronilead.',
  alreadyScheduled: 'Esse agendamento já estava no Stronilead.',
  rateLimited: 'Muitos agendamentos em pouco tempo. Tente de novo em alguns minutos.'
});

// ---------------------------------------------------------------------------
// Listas do balão e cadastros do número (schedule-options)
// ---------------------------------------------------------------------------

const hasText = (v) => typeof v === 'string' && v.trim() !== '';
const textOrNull = (v) => (hasText(v) ? v : null);
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const sortedByOrder = (docs) => [...(docs || [])].sort(byOrder);
// A mesma ordem de nome do cartão (buildZapWards, em api/_zapCard.js).
const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR');
const positiveIntOrNull = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// As unidades na ordem da academia, com o nome gravado (é o que o lead guarda
// em appointmentUnit) e o endereço, ou null quando está vazio.
export function unitsView(units) {
  return sortedByOrder(units)
    .filter((u) => hasText(u.name))
    .map((u) => ({ name: u.name, address: hasText(u.address) ? u.address.trim() : null }));
}

// Os catálogos no formato do balão, na ordem das telas do Stronilead (a mesma
// do App.jsx: tudo pelo `order`). Professor desligado (ativo: false) fica de
// fora, como no assistente. A quantidade de aulas e os dias da meta passam
// pela mesma normalização do App.jsx.
export function scheduleCatalogView({ units = [], modalities = [], professors = [], config = null } = {}) {
  return {
    units: unitsView(units),
    modalities: sortedByOrder(modalities).filter((m) => hasText(m.name)).map((m) => ({ id: m.id, name: m.name })),
    professors: sortedByOrder(professors)
      .filter((p) => p.ativo !== false && hasText(p.nome))
      .map((p) => ({
        id: p.id,
        name: p.nome,
        modalityIds: (Array.isArray(p.modalidadeIds) ? p.modalidadeIds : []).filter((id) => typeof id === 'string')
      })),
    trialClassOptions: normalizeTrialClassOptions(config?.trialClassOptions, config?.maxTrialClasses),
    metaWeekdays: normalizeMetaWeekdays(config?.metaWeekdays)
  };
}

// Os cinco dias sugeridos, na regra do wzDayOptions do ScheduleWizard, mas no
// horário de Brasília: começa hoje antes das 18h e amanhã depois delas, só nos
// dias da meta da academia (lista vazia vale todos) e procura no máximo 90
// dias. O horário começa em 18:00 para hoje e 09:00 para os outros dias.
export function suggestedDays({ now = new Date(), metaWeekdays = null } = {}) {
  const today = diaDeBrasilia(now);
  const startOffset = horaInteiraDeBrasilia(now) >= EVENING_HOUR ? 1 : 0;
  const onMeta = (dia) =>
    !Array.isArray(metaWeekdays) || metaWeekdays.length === 0 || metaWeekdays.includes(diaDaSemanaDoDia(dia));
  const days = [];
  for (let k = 0; days.length < DAYS_SHOWN && k < DAYS_SEARCHED; k++) {
    const offset = startOffset + k;
    const dia = today + offset;
    if (!onMeta(dia)) continue;
    let label = WEEKDAY_LABEL[diaDaSemanaDoDia(dia)];
    if (offset === 0) label = 'Hoje';
    else if (offset === 1) label = 'Amanhã';
    days.push({ date: isoDoDia(dia), label, defaultTime: offset === 0 ? '18:00' : '09:00' });
  }
  return days;
}

// Agendar hoje conta na Meta diária de quem agenda: consultor, em dia da meta
// da academia, no calendário de Brasília. Gestor fica fora da régua, como no
// Stronilead.
export function countsForMeta({ member, metaWeekdays, now = new Date() }) {
  return teamRole(member) === 'consultor' && (metaWeekdays || []).includes(diaDaSemanaDoDia(diaDeBrasilia(now)));
}

// O parentesco do menor visto por quem escreve: a mãe vê "Filho" ou "Filha".
// O cadastro guarda o contrário (guardian.relationship é "Mãe", "Pai"...), e
// o gênero sai do campo Sexo do lead. Sem sexo, ou com "Outro", não dá para
// escrever sem adivinhar, e vai null, como no cadastro do próprio número.
const WARD_OF = Object.freeze({
  Mãe: ['Filho', 'Filha'], Pai: ['Filho', 'Filha'],
  Avó: ['Neto', 'Neta'], Avô: ['Neto', 'Neta'],
  Tia: ['Sobrinho', 'Sobrinha'], Tio: ['Sobrinho', 'Sobrinha']
});
export function wardRelationship(lead) {
  const pair = WARD_OF[lead?.guardian?.relationship];
  if (!pair) return null;
  if (lead.sexo === 'Masculino') return pair[0];
  if (lead.sexo === 'Feminino') return pair[1];
  return null;
}

// O agendamento que a ficha, o cartão e a Meta Diária mostram hoje, no
// formato AppointmentDetail do contrato da ponte, ou null. Sai do lead, pelas
// mesmas leituras do cartão, e cancelado vira null. `units` é a lista de
// unitsView, de onde sai o endereço da unidade pelo nome.
export function appointmentDetailOf(lead, units = []) {
  if (!lead || isAppointmentCancelled(lead)) return null;
  const type = normalizeAppointmentType(getLeadAppointmentType(lead));
  const at = getLeadAppointmentDate(lead);
  if (!type || !at) return null;
  const isVisita = type === 'visita';
  const unit = isVisita ? textOrNull(lead.appointmentUnit) : null;
  return {
    leadId: lead.id ?? null,
    leadName: lead.name ?? null,
    type,
    at: at.toISOString(),
    unit,
    unitAddress: unit ? ((units || []).find((u) => u.name === unit)?.address ?? null) : null,
    modality: isVisita ? null : textOrNull(lead.appointmentModality),
    professorName: isVisita ? null : textOrNull(lead.appointmentProfessorName),
    soloTraining: isVisita ? false : Boolean(lead.appointmentSoloTraining),
    quantity: isVisita ? null : positiveIntOrNull(lead.trialClassesPlanned),
    outcome: appointmentOutcomeOf(lead)
  };
}

// Os cadastros do número, na ordem do "Para quem?": primeiro o do próprio
// número, depois os menores em ordem de nome, como os `wards` do cartão. O
// agendamento de cada um alimenta o aviso de remarcação, e o desfecho vai
// junto (pela regra do cartão), para o Stronizap só avisar quando o
// agendamento ainda não aconteceu.
export function scheduleTargets({ owner = null, wards = [] } = {}) {
  const target = (lead, relationship) => {
    const detail = appointmentDetailOf(lead);
    return {
      leadId: lead.id,
      name: lead.name ?? null,
      relationship,
      appointment: detail ? { type: detail.type, at: detail.at, outcome: detail.outcome } : null
    };
  };
  return [
    ...(owner ? [target(owner, null)] : []),
    ...[...(wards || [])].sort(byName).map((w) => target(w, wardRelationship(w)))
  ];
}

// Lê o corpo do schedule-options: o número da conversa e o e-mail de quem pede.
export function readScheduleOptionsBody(body) {
  const phone = nationalDigits(body?.phone);
  if (!phone) return { refusal: invalidData('phone', ZAP_LEAD_MESSAGES.phone) };
  const email = emailFromActor(body?.actor);
  if (!email) return { refusal: invalidData('actor', ZAP_SCHEDULE_MESSAGES.actor) };
  return { value: { phone, matchKey: zapMatchKey(phone), email } };
}

// Resposta do schedule-options.
export function buildScheduleOptions({ member, catalogs, owner = null, wards = [], now = new Date() }) {
  const view = scheduleCatalogView(catalogs);
  return {
    actor: {
      id: member.id,
      name: member.name ?? null,
      role: teamRole(member),
      countsForMeta: countsForMeta({ member, metaWeekdays: view.metaWeekdays, now })
    },
    targets: scheduleTargets({ owner, wards }),
    units: view.units,
    modalities: view.modalities,
    professors: view.professors,
    trialClassOptions: view.trialClassOptions,
    days: suggestedDays({ now, metaWeekdays: view.metaWeekdays })
  };
}
