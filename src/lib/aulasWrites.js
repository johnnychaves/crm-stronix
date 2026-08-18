// Escrita no histórico de aulas (stronix_aulas). Dual-write: chamado ao lado
// das escritas existentes do lead. Consultas por campo único (índice automático).
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, AULAS_PATH, LEADS_PATH } from './firebase.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, isAulaRecord, outcomeToAulaStatus, pickConvertingAula, aulaRecordFields } from './aulas.js';

const aulasCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH);
const aulaDoc = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', AULAS_PATH, id);

// Ao agendar: atualiza o registro em aberto se houver (só ajuste antes do
// compromisso acontecer); senão cria um novo. Devolve o id do registro — no
// caso de AULA o caller grava em lead.currentAulaId.
export async function upsertScheduledAppointment({ db, lead, type = APPOINTMENT_RECORD_TYPES.AULA, fields }) {
  const isVisita = type === APPOINTMENT_RECORD_TYPES.VISITA;
  const patch = isVisita
    ? { unit: fields.unit || null, scheduledFor: fields.scheduledFor || null }
    : {
        professorId: fields.professorId || null,
        professorName: fields.professorName || null,
        soloTraining: Boolean(fields.soloTraining),
        modality: fields.modality || null,
        scheduledFor: fields.scheduledFor || null,
      };

  const openId = isVisita
    ? await findOpenVisitaId(db, lead.id)
    : await findOpenAulaId(db, lead.currentAulaId);
  if (openId) {
    await updateDoc(aulaDoc(db, openId), patch);
    return openId;
  }

  const record = aulaRecordFields({
    type,
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

// Compatibilidade: os chamadores de aula seguem com a assinatura antiga.
export const upsertScheduledAula = ({ db, lead, fields }) =>
  upsertScheduledAppointment({ db, lead, type: APPOINTMENT_RECORD_TYPES.AULA, fields });

// Aula: atalho barato pelo ponteiro que já existia no lead.
async function findOpenAulaId(db, currentId) {
  if (!currentId) return null;
  const snap = await getDoc(aulaDoc(db, currentId));
  return snap.exists() && snap.data().status === AULA_STATUS.AGENDADA ? currentId : null;
}

// Visita: o lead ainda NÃO guarda ponteiro de visita (só passa a guardar no PR
// da virada), então o registro em aberto é achado por query em leadId.
async function findOpenVisitaId(db, leadId) {
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  const open = snap.docs.find(
    (d) => !isAulaRecord(d.data()) && d.data().status === AULA_STATUS.AGENDADA
  );
  return open ? open.id : null;
}

// Ao marcar presença: aplica attended/no_show/cancelled no registro atual.
//
// GUARDA (auditoria de 30/07/2026): só carimba a aula que corresponde ao
// compromisso ATUAL do lead. O dual-write da remarcação é best-effort — quando
// ele falha, o caller mantém o currentAulaId antigo, que aponta para uma aula
// já resolvida. Sem esta checagem, o desfecho de hoje sobrescrevia um registro
// histórico verdadeiro e bagunçava a carteira do professor em silêncio.
// Divergiu, não grava e avisa no console: deixar de carimbar é perda pequena,
// reescrever histórico é perda grande.
const millisOf = (v) => {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

export async function applyOutcomeToAula({ db, lead, outcome }) {
  const status = outcomeToAulaStatus(outcome);
  if (!status || !lead?.currentAulaId) return;

  const snap = await getDoc(aulaDoc(db, lead.currentAulaId));
  if (!snap.exists()) return;

  const aulaMs = millisOf(snap.data().scheduledFor);
  const compromissoMs = millisOf(lead.appointmentScheduledFor);
  if (aulaMs !== null && compromissoMs !== null && aulaMs !== compromissoMs) {
    console.warn('applyOutcomeToAula: currentAulaId aponta para outra data; desfecho não aplicado ao histórico', {
      leadId: lead.id, aulaId: lead.currentAulaId
    });
    return;
  }

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
  // Carteira do professor: ao converter, carimba no lead o professor da aula que
  // fechou a venda (a menos que seja treino solo / sem professor). Cobre os três
  // caminhos de conversão (ficha, ContractModal, Kanban) num lugar só.
  if (chosen.professorId && !chosen.soloTraining) {
    await updateDoc(
      doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId),
      { professorId: chosen.professorId, professorName: chosen.professorName || null }
    );
  }
}

// Ao desfazer a venda: desmarca a(s) aula(s) convertida(s) do lead. Filtro de
// converted client-side p/ não exigir índice composto (leadId+converted).
export async function unmarkConvertedAula({ db, leadId }) {
  if (!leadId) return;
  const snap = await getDocs(query(aulasCol(db), where('leadId', '==', leadId)));
  await Promise.all(
    snap.docs
      // Só aula tem conversão. Redundante hoje (pickConvertingAula já nunca
      // marca visita) e mantido como segunda trava contra dado legado.
      .filter((d) => isAulaRecord(d.data()) && d.data().converted)
      .map((d) => updateDoc(aulaDoc(db, d.id), { converted: false, convertedAt: null }))
  );
}
