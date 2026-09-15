// Agendamentos do CRM, pela coleção stronix_aulas (visitas e aulas). Puro.
// Aula e visita se separam por isAulaRecord, nunca por where no `type`: o
// registro antigo não tem o campo (src/lib/aulas.js). Os registros chegam com
// scheduledFor e createdAt em Date (o hook converte). O desfecho da visita vem
// da linha do tempo (visitOutcomesByLead), porque o app ainda não o grava no
// registro.

import { AULA_STATUS, isAulaRecord, outcomeToAulaStatus } from '../aulas.js';
import { getSafeDateOrNull } from '../dates.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';
import { pct, rankCounts } from './stats.js';
import { clienteSinceOf } from './cohort.js';

const inWindow = (d, start, end) => d instanceof Date && d >= start && d < end;

// Instante em que o agendamento foi marcado: o mais cedo entre createdAt e a
// data marcada. Os backfills gravaram createdAt no dia em que rodaram, depois
// da data de muitos registros, e um agendamento nunca é marcado depois da
// própria data. O registro da carga inicial não tem createdAt: vale a data.
function bookedAt(r) {
  const created = r?.createdAt || null;
  const when = r?.scheduledFor || null;
  if (created && when) return created < when ? created : when;
  return created || when;
}

// Desfechos de visita pela linha do tempo: leadId → [{ at (ms), status }] em
// ordem, sem repetir id. O app ainda não grava o desfecho no registro da
// visita (applyOutcomeToAula só vale para aula), mas a Meta e a tela de
// Visitas registram cada desfecho numa interação daily_goal_done de
// visita_hoje (appointmentOutcome.js). O reagendamento fica fora: ele move o
// registro, não o fecha (outcomeToAulaStatus).
export function visitOutcomesByLead(interactions) {
  const map = new Map();
  const seen = new Set();
  (interactions || []).forEach((i) => {
    if (i?.type !== 'daily_goal_done' || i.dailyGoalCategory !== DAILY_GOAL_CATEGORIES.VISITA_HOJE) return;
    const status = outcomeToAulaStatus(i.appointmentOutcome);
    if (!status || !i.leadId || !(i.createdAt instanceof Date)) return;
    if (i.id) {
      if (seen.has(i.id)) return;
      seen.add(i.id);
    }
    const list = map.get(i.leadId) || [];
    list.push({ at: i.createdAt.getTime(), status });
    map.set(i.leadId, list);
  });
  map.forEach((list) => list.sort((a, b) => a.at - b.at));
  return map;
}

// Status que vale nas contas. A visita que segue "agendada" no registro
// assume o primeiro desfecho do lead registrado entre o início do dia marcado
// e dois dias depois, em horário local; sem desfecho nessa janela, fica como
// está. O cancelamento registrado em outro dia não aparece e o registro segue
// "agendada": limite conhecido até o app gravar o desfecho no próprio registro.
export function effectiveStatus(r, visitOutcomes) {
  if (!visitOutcomes || isAulaRecord(r) || r.status !== AULA_STATUS.AGENDADA || !(r.scheduledFor instanceof Date)) return r.status;
  const d = r.scheduledFor;
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2).getTime();
  const hit = (visitOutcomes.get(r.leadId) || []).find((o) => o.at >= from && o.at < to);
  return hit ? hit.status : r.status;
}

// Agendamentos do mês (spec §4, faixa): scheduledFor em [start, end), sem os
// cancelados. Pessoa e funil saem do lead do registro. Um reagendamento move o
// registro, então ele não conta duas vezes. O agendamento marcado depois de a
// pessoa virar cliente (a aula de upgrade, por exemplo) não é funil de lead e
// fica fora.
export function appointmentsOf(records, { start, end, leadOf, inScope, visitOutcomes = null }) {
  let came = 0;
  let missed = 0;
  let pending = 0;
  const seen = new Set();
  (records || []).forEach((r) => {
    if (!r?.id || seen.has(r.id)) return;
    seen.add(r.id);
    if (!inWindow(r.scheduledFor, start, end)) return;
    const status = effectiveStatus(r, visitOutcomes);
    if (status === AULA_STATUS.CANCELLED) return;
    const lead = leadOf(r.leadId);
    if (!inScope(lead)) return;
    const since = clienteSinceOf(lead);
    if (since && bookedAt(r) >= since) return;
    if (status === AULA_STATUS.ATTENDED) came += 1;
    else if (status === AULA_STATUS.NO_SHOW) missed += 1;
    else pending += 1;
  });
  const decided = came + missed;
  return { total: came + missed + pending, came, missed, pending, decided, rate: pct(came, decided) };
}

// Registros por lead, sem repetir id. Serve aos marcos da safra, que olham
// todos os meses carregados.
export function recordsByLeadOf(records) {
  const map = new Map();
  const seen = new Set();
  (records || []).forEach((r) => {
    if (!r?.leadId || !r.id || seen.has(r.id)) return;
    seen.add(r.id);
    const list = map.get(r.leadId) || [];
    list.push(r);
    map.set(r.leadId, list);
  });
  return map;
}

// Agendamento em aberto no próprio lead (o espelho do registro atual).
// Reagendado continua em aberto; atendido, falta e cancelado não.
const OPEN_OUTCOMES = new Set([undefined, null, '', 'rescheduled']);
const hasOpenAppointment = (lead) =>
  Boolean(getSafeDateOrNull(lead?.appointmentScheduledFor)) && OPEN_OUTCOMES.has(lead?.appointmentOutcome);

// Marcos da safra no instante asOf (spec §4, "Funil por marcos"). Agendou: tem
// registro não cancelado marcado até asOf, de qualquer mês carregado, ou, sem
// corte, um agendamento em aberto no próprio lead, que cobre a aula marcada
// para depois dos meses carregados. No corte pró-rata o espelho do lead fica
// de fora porque ele é o retrato de hoje. Compareceu: tem registro attended
// com data até asOf. Quem compareceu também agendou. O status da visita é o
// efetivo, com o desfecho da linha do tempo (effectiveStatus).
export function cohortMilestones(cohort, { asOf, cut, recordsByLead, visitOutcomes = null }) {
  let sched = 0;
  let came = 0;
  (cohort || []).forEach((l) => {
    const recs = (recordsByLead.get(l.id) || []).map((r) => ({ r, status: effectiveStatus(r, visitOutcomes) }));
    const attended = recs.some(({ r, status }) => status === AULA_STATUS.ATTENDED && r.scheduledFor && r.scheduledFor <= asOf);
    const booked = attended
      || recs.some(({ r, status }) => status !== AULA_STATUS.CANCELLED && bookedAt(r) && bookedAt(r) <= asOf)
      || (!cut && hasOpenAppointment(l));
    if (booked) sched += 1;
    if (attended) came += 1;
  });
  return { sched, came };
}

// Aulas experimentais por professor, da academia inteira (spec §4): registros
// de aula, sem visitas, marcados em [start, end). Realizadas = attended,
// faltas = no_show, matrículas = realizada com `converted` (pickConvertingAula
// marca a última aula atendida antes da matrícula), modalidade das realizadas.
// "Treina sozinho" (soloTraining ou sem professor) vai à parte, fora do
// ranking. Professor sem realizada nem falta no mês não aparece.
export function professorsOf(records, { start, end }) {
  const byProf = new Map();
  let solo = null;
  const seen = new Set();
  const bucket = (id, name, isSolo) => ({ id, name, solo: isSolo, done: 0, missed: 0, enrolled: 0, mods: new Map() });
  (records || []).forEach((r) => {
    if (!r?.id || seen.has(r.id) || !isAulaRecord(r) || !inWindow(r.scheduledFor, start, end)) return;
    seen.add(r.id);
    let b;
    if (r.soloTraining || !r.professorId) {
      if (!solo) solo = bucket(null, 'Treina sozinho', true);
      b = solo;
    } else {
      if (!byProf.has(r.professorId)) byProf.set(r.professorId, bucket(r.professorId, r.professorName || 'Professor', false));
      b = byProf.get(r.professorId);
    }
    if (r.status === AULA_STATUS.ATTENDED) {
      b.done += 1;
      if (r.converted === true) b.enrolled += 1;
      const mod = String(r.modality || '').trim() || 'Sem modalidade';
      b.mods.set(mod, (b.mods.get(mod) || 0) + 1);
    } else if (r.status === AULA_STATUS.NO_SHOW) {
      b.missed += 1;
    }
  });
  const finish = (b) => ({ ...b, conv: pct(b.enrolled, b.done), mods: rankCounts(b.mods) });
  const active = (b) => b.done > 0 || b.missed > 0;
  const rows = [...byProf.values()].filter(active).map(finish)
    .sort((a, b) => (b.conv ?? -1) - (a.conv ?? -1) || b.done - a.done || a.name.localeCompare(b.name, 'pt-BR'));
  const soloRow = solo && active(solo) ? finish(solo) : null;
  const done = rows.reduce((a, b) => a + b.done, 0) + (soloRow ? soloRow.done : 0);
  return { rows, solo: soloRow, done };
}
