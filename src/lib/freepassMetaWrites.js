// O freepass na Meta Diária: o Remarcar (e o "Agendar próxima tentativa") e o
// Cancelou de uma aula. A Meta não assina os freepass nem os registros de aula
// do lead, então tudo aqui lê na hora (uma leitura, sem assinatura). A regra é
// a do Agendar da ficha, sem escolha de tipo: autoFreepassFor (visitante.js).
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { appId, FREEPASS_PATH, LEADS_PATH } from './firebase.js';
import { can, ACTIONS } from './acesso.js';
import { AULA_STATUS, isAulaRecord, recordPlanFor } from './aulas.js';
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';
import { isAppointmentEcho } from './outcomeCorrection.js';
import { buildSchedulePatch } from './schedulePatch.js';
import { readLeadAulas, freepassAfterAulas, freepassLaunchParts } from './freepassAgendaWrites.js';
import { activeFreepassesOf, autoFreepassFor, freepassSummaryPatch, nextFreepassAula } from './visitante.js';

const col = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

export async function readLeadFreepasses(db, leadId) {
  const snap = await getDocs(query(col(db, FREEPASS_PATH), where('leadId', '==', leadId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Os dois de uma vez: o pop-up mostra a linha e a gravação relê antes de gravar.
export const readMetaFreepassData = (db, leadId) =>
  Promise.all([readLeadFreepasses(db, leadId), readLeadAulas(db, leadId)]).then(([freepasses, records]) => ({ freepasses, records }));

// O que a aula remarcada faz com o freepass. `pendingFreepassId` é o freepass
// da aula pendente do lead (currentAulaId 'agendada'), que a aula deixa se for
// para outro ou virar avulsa. Ela só conta como movida (movingFreepassId, que
// mantém a aula no mesmo freepass mesmo cheio) quando o Remarcar move o
// registro: depois do Não compareceu o registro fecha como falta e a aula nova
// é outra (recordPlanFor).
export function metaFreepassChoice({ lead, freepasses, records, types, modalities, modalidadeName, appUser, at = null, afterNoShow = false, now = new Date() }) {
  const pending = (records || []).find((r) => r.id === lead?.currentAulaId && r.status === AULA_STATUS.AGENDADA && isAulaRecord(r));
  const pendingFreepassId = pending?.freepassId || null;
  const closesAula = recordPlanFor(lead, { type: 'aula_experimental', at, afterNoShow }).close?.type === 'aula';
  const choice = autoFreepassFor({
    lead, freepasses, types,
    modalidadeId: (modalities || []).find((m) => m.name === modalidadeName)?.id || null,
    canLaunch: can(appUser, ACTIONS.FREEPASS_LANCAR) && lead?.status !== 'Perda',
    movingFreepassId: closesAula ? null : pendingFreepassId,
    now,
  });
  return { choice, pendingFreepassId };
}

// O Remarcar antes de gravar o registro: relê os freepass e os registros e
// decide. `aula` são os campos da aula remarcada (null quando vira visita).
// Devolve o freepassId que o registro leva (null é a aula avulsa, que sai do
// freepass), o lançamento (freepassLaunchParts, com o tipo padrão) e o freepass
// que a aula pendente deixa (leftId), para o freepassScheduleWrites recontar.
export async function metaFreepassPlan({ db, lead, appUser, types, modalities, aula = null, afterNoShow = false, now = new Date() }) {
  const { freepasses, records } = await readMetaFreepassData(db, lead.id);
  const { choice, pendingFreepassId } = metaFreepassChoice({
    lead, freepasses, records, types, modalities, modalidadeName: aula?.modality || null, appUser,
    at: aula?.scheduledFor || null, afterNoShow, now,
  });
  const launch = aula && choice.kind === 'launch'
    ? freepassLaunchParts({ db, lead, appUser, type: choice.type, modalidadeName: aula.modality, aulas: [aula], via: 'meta' })
    : null;
  const targetId = !aula ? null : choice.kind === 'use' ? choice.freepass.id : launch?.ref.id || null;
  return { freepasses, targetId, launch, leftId: pendingFreepassId !== targetId ? pendingFreepassId : null };
}

// As chaves do próximo contato que o buildSchedulePatch grava com o eco.
const NEXT_CONTACT_KEYS = ['nextFollowUp', 'nextFollowUpType', 'nextFollowUpNote', 'nextFollowUpOwnerId', 'nextFollowUpOwnerName'];

// Depois do Cancelou de uma aula de freepass (o registro já fechou como
// cancelado pelo applyOutcomeToAula): o freepass reconta pelos registros e a
// vaga volta, e o agendamento do lead passa para a próxima aula do freepass,
// quando houver, sem anotação e sem mexer no dono da tarefa. Um contato de
// verdade (não o eco) de hoje em diante fica, como na virada da aula da vez.
// `lead` é o de antes do Cancelou. Devolve a aula para onde o lead foi, ou null.
export async function writeFreepassAfterCancel({ db, lead, now = new Date() }) {
  const { freepasses, records } = await readMetaFreepassData(db, lead.id);
  const cancelled = records.find((r) => r.id === lead.currentAulaId);
  if (!cancelled?.freepassId || cancelled.status !== AULA_STATUS.CANCELLED) return null;
  const freepass = freepasses.find((fp) => fp.id === cancelled.freepassId);
  if (!freepass) return null;
  const after = freepassAfterAulas({ freepass, records });
  const all = freepasses.map((fp) => (fp.id === freepass.id ? after.freepass : fp));
  const next = nextFreepassAula({ records, freepassId: freepass.id, now });
  let schedule = {};
  if (next) {
    const { appointmentOwnerId: _o, appointmentOwnerName: _n, ...patch } = buildSchedulePatch({
      typeLabel: 'Aula Experimental', date: getSafeDateOrNull(next.scheduledFor), modalidade: next.modality || null,
      professorId: next.professorId || null, professorName: next.professorName || null,
      soloTraining: Boolean(next.soloTraining), currentAulaId: next.id,
    });
    const contact = getSafeDateOrNull(lead.nextFollowUp);
    if (contact && !isAppointmentEcho(lead) && calendarDaysBetween(now, contact) >= 0) {
      for (const k of NEXT_CONTACT_KEYS) delete patch[k];
    }
    schedule = patch;
  }
  const batch = writeBatch(db);
  batch.update(doc(col(db, FREEPASS_PATH), freepass.id), after.patch);
  batch.update(doc(col(db, LEADS_PATH), lead.id), { ...freepassSummaryPatch(activeFreepassesOf(lead, all, now), now), ...schedule });
  await batch.commit();
  return next;
}
