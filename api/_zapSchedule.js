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
import {
  ZAP_LEAD_MESSAGES, NAME_MAX, CHANNEL_MAX, NOTE_MAX, refusal, invalidData, nationalDigits, emailFromActor, teamRole
} from './_zapLead.js';
import { zapMatchKey } from './_zapPhone.js';
import { appointmentOutcomeOf, isAppointmentCancelled } from './_zapCard.js';
import {
  diaDeBrasilia, horaInteiraDeBrasilia, diaDaSemanaDoDia, isoDoDia, dataHoraDeBrasilia, instanteDeBrasilia
} from './_horarioDeBrasilia.js';
import { getLeadAppointmentType, getLeadAppointmentDate, getInteractionSecurityFields, ZAP_VIA } from '../src/lib/leads.js';
import { normalizeAppointmentType } from '../src/lib/dates.js';
import { normalizeTrialClassOptions, normalizeMetaWeekdays } from '../src/lib/leadStatus.js';
import { professorNameById, SOLO_TRAINING_LABEL } from '../src/lib/professores.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields, isAulaRecord } from '../src/lib/aulas.js';
import { buildSchedulePatch } from '../src/lib/schedulePatch.js';
import { contactOf } from '../src/lib/guardian.js';

const MINUTE_MS = 60000;
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
  // Lista vazia vale todos os dias, como no wzDayOptions, mas a rota nunca chega
  // aqui com lista vazia: o scheduleCatalogView a troca por segunda a sexta.
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
// Stronilead. Lista vazia de dias conta como nenhum dia, mas a rota nunca
// chega aqui com lista vazia: o scheduleCatalogView a troca por segunda a sexta.
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
  // hasOwn, porque WARD_OF é objeto comum: "constructor" ou "toString"
  // achariam uma função herdada, e o parentesco sairia undefined em vez de null.
  const relationship = lead?.guardian?.relationship;
  const pair = Object.hasOwn(WARD_OF, relationship) ? WARD_OF[relationship] : null;
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

// ---------------------------------------------------------------------------
// Pedido de agendamento e conferências (schedule e appointment-status)
// ---------------------------------------------------------------------------

export const SCHEDULE_TYPES = Object.freeze(['visita', 'aula_experimental']);

// Id de documento do Firestore: texto não vazio, sem barra, que não seja "."
// nem "..", e que não comece e termine com "__" (o padrão __x__, que o
// Firestore reserva e recusa com erro na leitura).
export const isDocId = (v) =>
  typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.includes('/') && v !== '.' && v !== '..'
  && !/^__.*__$/.test(v);

// Lê o corpo do schedule. Só o formato: o que depende da academia (equipe,
// catálogos, o lead) é conferido depois. Devolve { value } ou { refusal }.
// Visita não leva campo de aula, e aula não leva unidade. O instante sai do
// dia e da hora de Brasília.
export function readScheduleBody(body) {
  const phone = nationalDigits(body?.phone);
  if (!phone) return { refusal: invalidData('phone', ZAP_LEAD_MESSAGES.phone) };
  const email = emailFromActor(body?.actor);
  if (!email) return { refusal: invalidData('actor', ZAP_SCHEDULE_MESSAGES.actor) };
  const channel = body.channelName;
  if (channel != null && typeof channel !== 'string') {
    return { refusal: invalidData('channelName', ZAP_LEAD_MESSAGES.channelName) };
  }
  const s = body.schedule;
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return { refusal: invalidData('schedule', ZAP_SCHEDULE_MESSAGES.schedule) };
  }
  if (!isDocId(s.leadId)) return { refusal: invalidData('leadId', ZAP_SCHEDULE_MESSAGES.leadId) };
  if (!SCHEDULE_TYPES.includes(s.type)) return { refusal: invalidData('type', ZAP_SCHEDULE_MESSAGES.type) };
  const wrong = (field) => ({ refusal: invalidData(field, ZAP_LEAD_MESSAGES.wrongType) });
  for (const field of ['unit', 'modality', 'professorId', 'note']) {
    if (s[field] != null && typeof s[field] !== 'string') return wrong(field);
  }
  if (s.quantity != null && !(Number.isInteger(s.quantity) && s.quantity > 0)) return wrong('quantity');
  // soloTraining não tem campo próprio na tela: é a opção "Treina sozinho" do
  // passo do professor.
  if (s.soloTraining != null && typeof s.soloTraining !== 'boolean') return wrong('professorId');
  const isAula = s.type === 'aula_experimental';
  if (isAula) {
    if (hasText(s.unit)) return wrong('unit');
    if (hasText(s.professorId) && s.soloTraining === true) return wrong('professorId');
  } else {
    if (hasText(s.modality)) return wrong('modality');
    if (hasText(s.professorId) || s.soloTraining === true) return wrong('professorId');
    if (s.quantity != null) return wrong('quantity');
  }
  if (!instanteDeBrasilia(s.date, '00:00')) return { refusal: invalidData('date', ZAP_SCHEDULE_MESSAGES.date) };
  const at = instanteDeBrasilia(s.date, s.time);
  if (!at) return { refusal: invalidData('time', ZAP_SCHEDULE_MESSAGES.time) };
  const note = typeof s.note === 'string' ? s.note.trim() : '';
  if (note.length > NOTE_MAX) return { refusal: invalidData('note', ZAP_SCHEDULE_MESSAGES.noteLong) };
  const actorName = typeof body.actor.name === 'string' ? body.actor.name.trim().slice(0, NAME_MAX) : '';
  return {
    value: {
      phone,
      matchKey: zapMatchKey(phone),
      email,
      actorName: actorName || null,
      channelName: (typeof channel === 'string' ? channel.trim().slice(0, CHANNEL_MAX) : '') || null,
      at,
      schedule: {
        leadId: s.leadId,
        type: s.type,
        unit: isAula ? null : textOrNull(s.unit),
        modality: isAula ? textOrNull(s.modality) : null,
        professorId: isAula ? textOrNull(s.professorId) : null,
        soloTraining: isAula && s.soloTraining === true,
        quantity: isAula ? (s.quantity ?? null) : null,
        note: note || null
      }
    }
  };
}

// Lê o corpo do appointment-status: de 1 a 30 ids de lead, sem repetição.
export function readStatusBody(body) {
  const ids = body?.leadIds;
  const ok = Array.isArray(ids) && ids.length > 0 && ids.length <= LEAD_IDS_MAX
    && ids.every(isDocId) && new Set(ids).size === ids.length;
  return ok ? { value: { leadIds: ids } } : { refusal: invalidData('leadIds', ZAP_SCHEDULE_MESSAGES.leadIds) };
}

// Unidade, modalidade, professor e quantidade conferidos contra o que existe
// agora no Stronilead. Academia sem unidade não tem o passo da unidade; com
// unidade, ele é obrigatório. O professor precisa estar na lista do balão
// (ativo e com nome) e dar a modalidade, que é a regra do assistente, ou a
// aula é de quem treina sozinho. `catalogs` são os documentos que a rota leu, e
// a conferência usa as mesmas listas normalizadas que o balão recebe
// (scheduleCatalogView): só passa o que o balão ofereceu, e cadastro malformado
// de professor é recusa, e não erro da ação.
export function checkScheduleCatalog(schedule, catalogs) {
  const view = scheduleCatalogView(catalogs);
  const gone = (field) => refusal(422, 'catalogo_mudou', ZAP_SCHEDULE_MESSAGES.gone[field], { field });
  const pick = (field) => invalidData(field, ZAP_SCHEDULE_MESSAGES.pick[field]);
  if (schedule.type === 'visita') {
    if (view.units.length === 0) return schedule.unit ? gone('unit') : null;
    if (!schedule.unit) return pick('unit');
    return view.units.some((u) => u.name === schedule.unit) ? null : gone('unit');
  }
  if (!schedule.modality) return pick('modality');
  const modality = view.modalities.find((m) => m.name === schedule.modality);
  if (!modality) return gone('modality');
  if (!schedule.soloTraining) {
    if (!schedule.professorId) return pick('professorId');
    const teaches = view.professors.some((p) => p.id === schedule.professorId && p.modalityIds.includes(modality.id));
    if (!teaches) return gone('professorId');
  }
  if (schedule.quantity == null) return pick('quantity');
  return view.trialClassOptions.includes(schedule.quantity) ? null : gone('quantity');
}

// Horário que já passou não é aceito.
export function checkFuture(at, now = new Date()) {
  return at.getTime() > now.getTime() ? null : refusal(422, 'horario_passado', ZAP_SCHEDULE_MESSAGES.pastTime);
}

// O lead escolhido é o cadastro do próprio número, ou um menor que tem esse
// número como responsável e ainda o tem como contato: a mesma conta do cartão.
export function leadBelongsToNumber(lead, matchKey, now = new Date()) {
  if (!lead || !matchKey) return false;
  if (lead.zapMatchKey === matchKey) return true;
  return lead.guardianZapMatchKey === matchKey && contactOf(lead, now).viaGuardian;
}

// O mesmo agendamento já existe: mesmo tipo, mesmo instante e as mesmas escolhas
// de unidade, modalidade, professor e quantidade, com o agendamento ainda em
// aberto, sem desfecho. É o pedido repetido (dois cliques, duas pessoas, o
// "Tentar de novo" depois de uma resposta perdida). Mudou uma dessas escolhas no
// mesmo horário: é remarcação, e grava, como o assistente da ficha.
//
// Agendamento com desfecho (compareceu ou não compareceu) nunca é o mesmo. O
// desfecho pode ser marcado no mesmo dia, antes do horário (Agenda de hoje,
// "Marcar desfecho" ou correção do desfecho), e a pessoa que escreve depois
// dizendo que vem no mesmo horário pede um agendamento que já está encerrado. O
// pedido grava, e o buildSchedulePatch zera o desfecho, como o assistente.
// Cancelado nem chega aqui: o appointmentDetailOf devolve null.
//
// A anotação conta só num sentido, e só para decidir se o pedido é o repetido.
// Anotação escrita e diferente da que o lead tem (`nextFollowUpNote`) é edição, e
// grava também. Pedido sem anotação nunca conta como mudança: o balão do
// Stronizap não recebe a anotação do lead, então em branco quer dizer "não
// digitei", e não "apague". Por isso repetir o agendamento sem digitar nada não
// grava de novo e deixa a anotação como está. Numa remarcação que grava, o
// `nextFollowUpNote` passa a ser a anotação do pedido (vazia, se o pedido não
// trouxer), como no assistente. Com um contato (mensagem ou ligação) marcado na
// ficha depois do compromisso, a anotação do lead é a do contato, e a
// comparação é com ela.
export function hasSameAppointment(lead, { type, at, schedule }) {
  const current = appointmentDetailOf(lead);
  if (!current || current.outcome || current.type !== type || current.at !== at.toISOString()) return false;
  const note = schedule.note || null;
  if (note !== null && note !== (lead.nextFollowUpNote || null)) return false;
  if (type === 'visita') return current.unit === (schedule.unit || null);
  return current.modality === (schedule.modality || null)
    && (lead.appointmentProfessorId || null) === (schedule.professorId || null)
    && current.soloTraining === Boolean(schedule.soloTraining)
    && current.quantity === (schedule.quantity || null);
}

// ---------------------------------------------------------------------------
// O que é gravado e o que é respondido (schedule)
// ---------------------------------------------------------------------------

// Rótulo do tipo, igual ao followUpLabel do ScheduleWizard: é o que vai no
// texto da interação e em nextFollowUpType.
const TYPE_LABEL = Object.freeze({ visita: 'Visita', aula_experimental: 'Aula Experimental' });

// O texto da interação, no formato do assistente (handleWizardConfirm), que a
// linha do tempo lê com parseAppointment:
//   "🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: …"
//   "🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00."
// O navegador escreve o dia e a hora no fuso da academia; aqui eles saem no
// horário de Brasília, porque a Vercel roda em UTC.
export function scheduleInteractionText({
  type, unit = null, modality = null, quantity = null, professorId = null, professorName = null,
  soloTraining = false, at, note = null
}) {
  let extra = '';
  if (type === 'aula_experimental') {
    const q = quantity || 1;
    extra = ` (${modality ? `${modality} · ` : ''}${q} ${q === 1 ? 'aula' : 'aulas'})`;
    if (professorId) extra += ` · ${professorName}`;
    else if (soloTraining) extra += ` · ${SOLO_TRAINING_LABEL}`;
  } else if (unit) {
    extra = ` (Unidade ${unit})`;
  }
  const obs = (note || '').trim();
  return `🔔 ${TYPE_LABEL[type]} agendada${extra} p/ ${dataHoraDeBrasilia(at)}.` + (obs ? ` Obs: ${obs}` : '');
}

// A visita em aberto do lead, como o findOpenVisitaId do aulasWrites.js: a
// primeira visita 'agendada' entre os registros dele.
export function pickOpenVisitaId(records) {
  const open = (records || []).find((r) => !isAulaRecord(r) && r.status === AULA_STATUS.AGENDADA);
  return open ? open.id : null;
}

// A aula do currentAulaId só é reaproveitada se ainda estiver 'agendada',
// como no findOpenAulaId do aulasWrites.js. Aqui ela também precisa ser um
// registro de aula e ser deste lead: a api/ grava com poder de admin, e um
// currentAulaId que aponte para o registro de outro lead, ou para uma visita,
// não pode ser sobrescrito. Registro sem `type` é aula (isAulaRecord), e sem
// `leadId` não é de ninguém.
export const isOpenAulaRecord = (record, leadId) =>
  Boolean(record) && Boolean(leadId) && record.leadId === leadId
  && record.status === AULA_STATUS.AGENDADA && isAulaRecord(record);

// O que a ação schedule grava numa transação só, o mesmo que o assistente
// grava em três passos:
//   - record: o registro em stronix_aulas. Com `openRecordId` (a aula do
//     currentAulaId ainda agendada, ou a visita em aberto do lead), só a data
//     e os campos do tipo mudam; sem ele, nasce um registro com o id
//     `newRecordId`, com os campos de consultor do dono do lead;
//   - interaction: a nota que a linha do tempo mostra como agendamento, com o
//     volumeKind da Meta Diária, quem agendou em consultantName, actorId e
//     actorAuthUid, e a origem (via e zapChannelName);
//   - leadPatch: o buildSchedulePatch do assistente, mais lastInteractionAt e
//     interactionsCount, como o logInteraction.
// `professors` são os documentos de stronix_professores, de onde sai o nome.
// `serverTime` e `increment` são os FieldValue do firebase-admin.
export function buildScheduleWrites({
  lead, actor, schedule, at, professors = [], channelName = null, openRecordId = null, newRecordId = null,
  serverTime, increment
}) {
  const isAula = schedule.type === 'aula_experimental';
  const professorName = isAula && schedule.professorId ? professorNameById(professors, schedule.professorId) : null;
  const recordPatch = isAula
    ? {
        professorId: schedule.professorId || null,
        professorName: professorName || null,
        soloTraining: Boolean(schedule.soloTraining),
        modality: schedule.modality || null,
        scheduledFor: at
      }
    : { unit: schedule.unit || null, scheduledFor: at };
  const recordId = openRecordId || newRecordId;
  const record = openRecordId
    ? { id: openRecordId, update: recordPatch }
    : {
        id: newRecordId,
        create: {
          ...aulaRecordFields({
            type: isAula ? APPOINTMENT_RECORD_TYPES.AULA : APPOINTMENT_RECORD_TYPES.VISITA,
            leadId: lead.id,
            leadName: lead.name || lead.nome || null,
            consultantId: lead.consultantId || null,
            consultantAuthUid: lead.consultantAuthUid || null,
            consultantName: lead.consultantName || null,
            status: AULA_STATUS.AGENDADA,
            ...recordPatch
          }),
          createdAt: serverTime
        }
      };
  const interaction = {
    leadId: lead.id,
    leadName: lead.name || null,
    consultantName: actor.name || null,
    ...getInteractionSecurityFields(lead, actor),
    actorId: actor.id || null,
    actorAuthUid: actor.authUid || null,
    createdAt: serverTime,
    text: scheduleInteractionText({ ...schedule, professorName, at }),
    type: 'note',
    volumeKind: schedule.type,
    via: ZAP_VIA,
    zapChannelName: channelName || null
  };
  const leadPatch = {
    lastInteractionAt: serverTime,
    interactionsCount: increment,
    ...buildSchedulePatch({
      typeLabel: TYPE_LABEL[schedule.type],
      date: at,
      modalidade: schedule.modality,
      professorId: schedule.professorId,
      professorName,
      soloTraining: schedule.soloTraining,
      quantidade: schedule.quantity,
      unidade: schedule.unit,
      note: schedule.note,
      currentAulaId: isAula ? recordId : (lead.currentAulaId || null)
    })
  };
  return { record, interaction, leadPatch };
}

// Resposta 409: o cartão do número e o agendamento que já existia. O
// Stronizap trata como sucesso, porque a gravação é a mesma.
export function alreadyScheduledBody({ card, appointment }) {
  return { error: 'ja_agendado', message: ZAP_SCHEDULE_MESSAGES.alreadyScheduled, card, appointment };
}
