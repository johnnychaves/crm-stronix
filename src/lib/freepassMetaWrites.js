// O freepass na Meta Diária: o Remarcar (e o "Agendar próxima tentativa") e o
// Cancelou de uma aula. A Meta não assina os freepass nem os registros de aula
// do lead, então tudo aqui lê na hora (uma leitura, sem assinatura). A regra é
// a do Agendar da ficha, sem escolha de tipo: autoFreepassFor (visitante.js).
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { appId, FREEPASS_PATH, LEADS_PATH } from './firebase.js';
import { can, ACTIONS } from './acesso.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, isAulaRecord, recordPlanFor } from './aulas.js';
import { closeOpenAppointment } from './aulasWrites.js';
import { consumedFields } from './outcomeCorrection.js';
import { slotPatchFor } from './slotPatch.js';
import { readLeadAulas, freepassAfterAulas, freepassLaunchParts } from './freepassAgendaWrites.js';
import { activeFreepassesOf, autoFreepassFor, freepassSummaryPatch, leadPointsTo, leadSlotFor } from './visitante.js';

const fold = (v) => String(v || '').trim();
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
    modalidadeId: (modalities || []).find((m) => fold(m.name) === fold(modalidadeName))?.id || null,
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

// Depois do Cancelou de uma visita ou aula, só com o módulo (o registro da aula
// já fechou como cancelado pelo applyOutcomeToAula; a visita fecha aqui, porque
// o desfecho de visita não vai para o registro e a visita cancelada voltaria
// pelo avanço do dia). A aula de freepass devolve a vaga (o freepass reconta),
// e o agendamento do lead passa para o compromisso pendente mais cedo
// (leadSlotFor), com ou sem freepass, sem anotação e sem mexer no dono da
// tarefa. Um contato de verdade (não o eco) de hoje em diante fica.
// `lead` é o de antes do Cancelou. Devolve o registro para onde o lead foi, ou null.
export async function writeSlotAfterCancel({ db, lead, now = new Date() }) {
  if (lead.appointmentType === 'visita') {
    await closeOpenAppointment({ db, lead, type: APPOINTMENT_RECORD_TYPES.VISITA, status: AULA_STATUS.CANCELLED });
  }
  const { freepasses, records } = await readMetaFreepassData(db, lead.id);
  const cancelled = lead.appointmentType === 'aula_experimental' ? records.find((r) => r.id === lead.currentAulaId) : null;
  const freepass = cancelled?.freepassId && cancelled.status === AULA_STATUS.CANCELLED
    ? freepasses.find((fp) => fp.id === cancelled.freepassId)
    : null;
  const after = freepass ? freepassAfterAulas({ freepass, records }) : null;
  const all = after ? freepasses.map((fp) => (fp.id === freepass.id ? after.freepass : fp)) : freepasses;
  const leadAfter = { ...lead, ...consumedFields('cancelled', lead, now) };
  // O compromisso cancelado nunca volta, mesmo que o registro dele não tenha fechado.
  const slot = leadSlotFor({ lead: leadAfter, records: records.filter((r) => !leadPointsTo(lead, r)), freepasses: all, now });
  if (!after && !slot) return null;
  const batch = writeBatch(db);
  if (after) batch.update(doc(col(db, FREEPASS_PATH), freepass.id), after.patch);
  batch.update(doc(col(db, LEADS_PATH), lead.id), {
    ...(after && freepassSummaryPatch(activeFreepassesOf(lead, all, now), now)),
    ...(slot && slotPatchFor({ lead: leadAfter, record: slot, now })),
  });
  await batch.commit();
  return slot;
}
