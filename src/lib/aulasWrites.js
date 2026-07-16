// Escrita no histórico de aulas (stronix_aulas). Dual-write: chamado ao lado
// das escritas existentes do lead. Consultas por campo único (índice automático).
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, AULAS_PATH } from './firebase.js';
import { AULA_STATUS, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from './aulas.js';

const aulasCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH);
const aulaDoc = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', AULAS_PATH, id);

// Ao agendar: atualiza o registro atual se ele ainda estiver 'agendada' (só
// ajuste antes da aula acontecer); senão cria um novo. Devolve o aulaId — o
// caller grava em lead.currentAulaId.
export async function upsertScheduledAula({ db, lead, fields }) {
  const currentId = lead.currentAulaId;
  const patch = {
    professorId: fields.professorId || null,
    professorName: fields.professorName || null,
    soloTraining: Boolean(fields.soloTraining),
    modality: fields.modality || null,
    scheduledFor: fields.scheduledFor || null,
  };
  if (currentId) {
    const snap = await getDoc(aulaDoc(db, currentId));
    if (snap.exists() && snap.data().status === AULA_STATUS.AGENDADA) {
      await updateDoc(aulaDoc(db, currentId), patch);
      return currentId;
    }
  }
  const record = aulaRecordFields({
    leadId: lead.id,
    leadName: lead.name || lead.nome || null,
    consultantId: lead.consultantId || null,
    consultantAuthUid: lead.consultantAuthUid || null,
    consultantName: lead.consultantName || null,
    status: AULA_STATUS.AGENDADA,
    ...patch,
  });
  const ref = await addDoc(aulasCol(db), { ...record, createdAt: serverTimestamp() });
  return ref.id;
}

// Ao marcar presença: aplica attended/no_show/cancelled no registro atual.
export async function applyOutcomeToAula({ db, lead, outcome }) {
  const status = outcomeToAulaStatus(outcome);
  if (!status || !lead?.currentAulaId) return;
  await updateDoc(aulaDoc(db, lead.currentAulaId), { status, outcomeAt: serverTimestamp() });
}

// Ao desfazer o desfecho (atalho reversível das Aulas): volta pra 'agendada'.
export async function clearAulaOutcome({ db, lead }) {
  if (!lead?.currentAulaId) return;
  await updateDoc(aulaDoc(db, lead.currentAulaId), { status: AULA_STATUS.AGENDADA, outcomeAt: null });
}

// Ao converter: marca a última aula atendida do lead como convertida.
export async function markConvertingAula({ db, leadId }) {
  if (!leadId) return;
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  const aulas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const chosen = pickConvertingAula(aulas);
  if (!chosen) return;
  await updateDoc(aulaDoc(db, chosen.id), { converted: true, convertedAt: serverTimestamp() });
}

// Ao desfazer a venda: desmarca a(s) aula(s) convertida(s) do lead. Filtro de
// converted client-side p/ não exigir índice composto (leadId+converted).
export async function unmarkConvertedAula({ db, leadId }) {
  if (!leadId) return;
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  await Promise.all(
    snap.docs.filter((d) => d.data().converted).map((d) => updateDoc(aulaDoc(db, d.id), { converted: false, convertedAt: null }))
  );
}
