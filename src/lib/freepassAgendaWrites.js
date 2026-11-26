// Peças das aulas do freepass: lê os registros do lead, monta os registros
// extras que o lote do lançamento grava e recalcula o contador do freepass.
import { collection, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, AULAS_PATH, FREEPASS_PATH } from './firebase.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields } from './aulas.js';
import {
  activeFreepassesOf, buildFreepassDoc, freepassAulaDaVez, freepassAulasPatch, freepassLaunchText,
  freepassSummaryPatch, FREEPASS_INTERACTION_TYPE
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

// O freepass que nasce no Agendar da ficha: o id reservado, o documento e os
// registros das aulas 2..N. `aulas` são os campos de registro de cada aula, em
// ordem de data; a primeira é gravada pelo recordNewAppointment e é a aula da
// vez. O início é o dia da primeira aula.
export function freepassLaunchParts({ db, lead, appUser, type, modalidadeName, aulas }) {
  const ref = doc(freepassCol(db));
  const data = buildFreepassDoc({ lead, type, modalidadeName, startsAt: aulas[0].scheduledFor, appUser, via: 'agendar' });
  return { ref, data, extras: extraAulaRecords({ db, lead, freepassId: ref.id, aulas: aulas.slice(1) }) };
}

// O lado do freepass de um agendamento da ficha, depois do registro gravado
// (recordNewAppointment). Relê os registros do lead, recalcula o contador do
// freepass de destino (targetId) e do que a aula deixou (leftId), e diz para
// onde o agendamento do lead aponta (a aula da vez é a mais cedo). Não grava:
// devolve o resumo para o lead, a aula da vez (null fica na gravada), as notas
// a mais e o gancho extra do logInteractions, que grava tudo no mesmo lote.
export async function freepassScheduleWrites({ db, lead, freepasses, targetId = null, leftId = null, launch = null, currentAulaId, now = new Date() }) {
  const pending = (launch?.extras || []).map((e) => ({ id: e.ref.id, ...e.data }));
  const records = [...(await readLeadAulas(db, lead.id)), ...pending];
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
    leadPatch: freepassSummaryPatch(activeFreepassesOf(lead, after, now), now),
    daVez: targetId ? freepassAulaDaVez({ records, freepassId: targetId, currentAulaId, now }) : null,
    notes: launched ? [{ type: FREEPASS_INTERACTION_TYPE, text: freepassLaunchText(launched), freepassId: launched.id }] : [],
    extra: (batch) => {
      if (launched) {
        const { id: _id, ...data } = launched;
        batch.set(launch.ref, { ...data, createdAt: serverTimestamp() });
      }
      for (const e of launch?.extras || []) batch.set(e.ref, e.data);
      for (const [id, patch] of patches) if (id !== launched?.id) batch.update(doc(freepassCol(db), id), patch);
    },
  };
}
