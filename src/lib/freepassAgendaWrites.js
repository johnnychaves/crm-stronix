// Peças das aulas do freepass: lê os registros do lead, monta os registros
// extras que o lote do lançamento grava e recalcula o contador do freepass.
import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, AULAS_PATH, FREEPASS_PATH, LEADS_PATH } from './firebase.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields } from './aulas.js';
import { getSafeDateOrNull } from './dates.js';
import { appointmentTaskOwnerFor } from './schedulePatch.js';
import { slotPatchFor } from './slotPatch.js';
import {
  activeFreepassesOf, buildFreepassDoc, freepassAulasPatch, freepassLaunchText,
  freepassSummaryPatch, leadSlotFor, FREEPASS_INTERACTION_TYPE
} from './visitante.js';

const aulasCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH);
const freepassCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', FREEPASS_PATH);

export async function readLeadAulas(db, leadId) {
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Não grava: quem chama faz batch.set(ref, data) dentro do extra do logInteractions.
export function extraAulaRecords({ db, lead, freepassId, aulas }) {
  return aulas.map((item) => ({
    ref: doc(aulasCol(db)),
    data: {
      ...aulaRecordFields({
        type: APPOINTMENT_RECORD_TYPES.AULA,
        leadId: lead.id,
        leadName: lead.name || lead.nome || null,
        consultantId: lead.consultantId || null,
        consultantAuthUid: lead.consultantAuthUid || null,
        consultantName: lead.consultantName || null,
        status: AULA_STATUS.AGENDADA,
        freepassId,
        ...item,
      }),
      createdAt: serverTimestamp(),
    },
  }));
}

export function freepassAfterAulas({ freepass, records }) {
  const patch = freepassAulasPatch({ freepass, records });
  return { patch, freepass: { ...freepass, ...patch } };
}

// O freepass que nasce no Agendar da ficha (ou na aba Contratos, `via`): o id
// reservado, o documento e os registros das aulas 2..N. `aulas` são os campos
// de registro de cada aula, em ordem de data; a primeira é gravada pelo
// recordNewAppointment e é a aula da vez. O início é o dia da primeira aula.
// Com `fresh` (o lançamento da aba Contratos que não remarca a pendente), a
// primeira também vai no lote, como as outras.
export function freepassLaunchParts({ db, lead, appUser, type, modalidadeName, aulas, via = 'agendar', fresh = false }) {
  const ref = doc(freepassCol(db));
  const data = buildFreepassDoc({ lead, type, modalidadeName, startsAt: aulas[0].scheduledFor, appUser, via });
  return { ref, data, extras: extraAulaRecords({ db, lead, freepassId: ref.id, aulas: fresh ? aulas : aulas.slice(1) }) };
}

// O lado do freepass de um agendamento (a ficha e a Meta), depois do registro
// gravado (recordNewAppointment). Relê os registros do lead, recalcula o
// contador do freepass de destino (targetId) e do que a aula deixou (leftId), e
// diz para onde o agendamento do lead aponta (leadSlotFor: o compromisso
// pendente mais cedo, com ou sem freepass). Não grava: devolve o resumo para o
// lead (vazio quando nenhum freepass mudou), o `slot` (o registro para onde o
// lead aponta, ou null para ficar como `leadAfter`), as notas a mais e o gancho
// extra do logInteractions, que grava tudo no mesmo lote.
// `leadAfter` é o lead como fica com o patch de quem chama (o agendamento
// pedido); sem ele, o lead de agora. `extras` são registros novos que vão no
// lote (a aula a mais do modo 'new').
export async function freepassScheduleWrites({ db, lead, leadAfter = lead, freepasses, targetId = null, leftId = null, launch = null, extras = [], currentAulaId, now = new Date() }) {
  const novos = [...(launch?.extras || []), ...extras];
  const pending = novos.map((e) => ({ id: e.ref.id, ...e.data }));
  const records = [...(await readLeadAulas(db, lead.id)), ...pending];
  // O recordNewAppointment engole a falha e devolve o id antigo: sem a aula
  // gravada no freepass de destino, nada do lote pode seguir.
  if (targetId && !records.some((r) => r.id === currentAulaId && r.freepassId === targetId)) {
    throw new Error('freepassScheduleWrites: a aula não foi gravada no freepass');
  }
  const ids = new Set([targetId, leftId].filter(Boolean));
  const patches = new Map();
  const after = [...(freepasses || []), ...(launch ? [{ id: launch.ref.id, ...launch.data }] : [])].map((fp) => {
    if (!ids.has(fp.id)) return fp;
    const r = freepassAfterAulas({ freepass: fp, records });
    patches.set(fp.id, r.patch);
    return r.freepass;
  });
  const launched = launch ? after.find((fp) => fp.id === launch.ref.id) : null;
  return {
    leadPatch: ids.size || launched ? freepassSummaryPatch(activeFreepassesOf(lead, after, now), now) : {},
    slot: leadSlotFor({ lead: leadAfter, records, freepasses: after, now }),
    notes: launched ? [{ type: FREEPASS_INTERACTION_TYPE, text: freepassLaunchText(launched), freepassId: launched.id }] : [],
    extra: !launched && !novos.length && !patches.size ? null : (batch) => {
      if (launched) {
        const { id: _id, ...data } = launched;
        batch.set(launch.ref, { ...data, createdAt: serverTimestamp() });
      }
      for (const e of novos) batch.set(e.ref, e.data);
      for (const [id, patch] of patches) if (id !== launched?.id) batch.update(doc(freepassCol(db), id), patch);
    },
  };
}

// Remarcar uma aula do freepass que não é a da vez (o diálogo do cartão): muda
// só o dia e o professor do registro, reconta o freepass (o fim do por aulas
// é o dia da última aula) e o agendamento do lead segue o leadSlotFor. Um lote
// só, sem interação. `fields` são os campos do registro: scheduledFor,
// professorId, professorName, soloTraining. Devolve { refused } sem gravar
// quando a aula mudou em outra aba.
export async function writeFreepassAulaMove({ db, lead, appUser, freepasses, aula, fields, now = new Date() }) {
  const freepass = (freepasses || []).find((fp) => fp.id === aula.freepassId);
  if (!freepass) throw new Error('writeFreepassAulaMove: freepass da aula não encontrado');
  const lidos = await readLeadAulas(db, lead.id);
  const atual = lidos.find((r) => r.id === aula.id);
  if (!atual || atual.status !== AULA_STATUS.AGENDADA || atual.freepassId !== freepass.id) {
    return { refused: 'Essa aula mudou enquanto você remarcava. Confira o cartão do freepass.' };
  }
  const records = lidos.map((r) => (r.id === aula.id ? { ...r, ...fields } : r));
  const after = freepassAfterAulas({ freepass, records });
  const all = (freepasses || []).map((fp) => (fp.id === freepass.id ? after.freepass : fp));
  // O lead que aponta para esta aula (outra aba fez dela a da vez enquanto o
  // diálogo estava aberto) acompanha a data nova, ou vai para a mais cedo.
  const leadOnIt = lead.currentAulaId === aula.id && lead.appointmentType === 'aula_experimental';
  const moved = records.find((r) => r.id === aula.id);
  const leadAfter = leadOnIt ? { ...lead, appointmentScheduledFor: getSafeDateOrNull(fields.scheduledFor), appointmentOutcome: null } : lead;
  const slot = leadSlotFor({ lead: leadAfter, records, freepasses: all, now }) || (leadOnIt ? moved : null);
  const leadPatch = {
    ...freepassSummaryPatch(activeFreepassesOf(lead, all, now), now),
    ...(slot && slotPatchFor({ lead, record: slot, taskOwner: appointmentTaskOwnerFor({ scheduler: appUser, lead }), now })),
  };
  const batch = writeBatch(db);
  batch.update(doc(aulasCol(db), aula.id), fields);
  batch.update(doc(freepassCol(db), freepass.id), after.patch);
  batch.update(doc(collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH), lead.id), leadPatch);
  await batch.commit();
  return { refused: null };
}

// A aula pendente do lead que o lançamento por aulas da aba Contratos reaproveita
// como a aula 1: aula experimental da mesma modalidade, fora de freepass e sem
// desfecho. Fora disso, o lançamento não mexe nela (fresh).
export function reusablePendingAula({ lead, pendingAula, modalidadeName }) {
  if (!pendingAula || lead?.appointmentOutcome || pendingAula.freepassId) return null;
  if (pendingAula.type && pendingAula.type !== APPOINTMENT_RECORD_TYPES.AULA) return null;
  return modalidadeName && pendingAula.modality === modalidadeName ? pendingAula : null;
}
