// Peças das aulas do freepass: lê os registros do lead, monta os registros
// extras que o lote do lançamento grava e recalcula o contador do freepass.
import { collection, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, AULAS_PATH } from './firebase.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields } from './aulas.js';
import { freepassAulasPatch } from './visitante.js';

const aulasCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH);

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
