// Peças das aulas do freepass: lê os registros do lead, monta os registros
// extras que o lote do lançamento grava e recalcula o contador do freepass.
import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, AULAS_PATH, FREEPASS_PATH, LEADS_PATH } from './firebase.js';
import { AULA_STATUS, APPOINTMENT_RECORD_TYPES, aulaRecordFields } from './aulas.js';
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';
import { appointmentTaskOwnerFor, buildSchedulePatch } from './schedulePatch.js';
import {
  activeFreepassesOf, buildFreepassDoc, freepassAulaDaVez, freepassAulasPatch, freepassLaunchText,
  freepassSummaryPatch, nextFreepassAula, FREEPASS_INTERACTION_TYPE
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

// O lado do freepass de um agendamento da ficha, depois do registro gravado
// (recordNewAppointment). Relê os registros do lead, recalcula o contador do
// freepass de destino (targetId) e do que a aula deixou (leftId), e diz para
// onde o agendamento do lead aponta (a aula da vez é a mais cedo). Não grava:
// devolve o resumo para o lead, a aula da vez (null fica na gravada), as notas
// a mais e o gancho extra do logInteractions, que grava tudo no mesmo lote.
// `extras` são registros novos que vão no lote (a aula a mais do modo 'new').
export async function freepassScheduleWrites({ db, lead, freepasses, targetId = null, leftId = null, launch = null, extras = [], currentAulaId, now = new Date() }) {
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
    leadPatch: freepassSummaryPatch(activeFreepassesOf(lead, after, now), now),
    daVez: targetId ? freepassAulaDaVez({ records, freepassId: targetId, currentAulaId, now }) : null,
    notes: launched ? [{ type: FREEPASS_INTERACTION_TYPE, text: freepassLaunchText(launched), freepassId: launched.id }] : [],
    extra: (batch) => {
      if (launched) {
        const { id: _id, ...data } = launched;
        batch.set(launch.ref, { ...data, createdAt: serverTimestamp() });
      }
      for (const e of novos) batch.set(e.ref, e.data);
      for (const [id, patch] of patches) if (id !== launched?.id) batch.update(doc(freepassCol(db), id), patch);
    },
  };
}

const ddmm = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Para onde vai o agendamento do lead quando nasce ou muda uma aula de freepass
// sem remarcar a pendente (o "Agendar" e o "Remarcar" do cartão, e o
// lançamento da aba Contratos com `fresh`): 'keep' fica com o atual, 'switch'
// passa para a aula `at`, e { refuse } recusa antes de gravar, para nenhum
// agendamento ficar sem dono no lead.
// - Fica: o atual é no instante `at` ou antes (a aula atrasada sem desfecho
//   também), ou tem desfecho e é de hoje em diante (quem tira essa aula do
//   lead é a virada do dia da aula seguinte, para a Agenda de hoje não perder
//   a aula marcada), sem ser mais tarde que `at`.
// - Passa: não há agendamento, o desfecho é de antes de hoje, ou o atual é uma
//   aula de freepass, que continua no cartão do freepass.
// - Recusa: o atual é pendente, de hoje em diante, não é aula de freepass e é
//   mais tarde que `at`.
// `records` são os registros de stronix_aulas da pessoa.
export function leadAppointmentFor({ lead, records, at, now = new Date() }) {
  const cur = getSafeDateOrNull(lead?.appointmentScheduledFor);
  const type = lead?.appointmentType || null;
  const next = getSafeDateOrNull(at);
  if (!cur || !type || !next) return 'switch';
  if (lead.appointmentOutcome) return calendarDaysBetween(now, cur) >= 0 && cur <= next ? 'keep' : 'switch';
  if (cur <= next) return 'keep';
  const curRec = type === 'aula_experimental' ? (records || []).find((r) => r.id === lead.currentAulaId) : null;
  if (curRec?.freepassId) return 'switch';
  const nome = String(lead.name || '').trim().split(' ')[0] || 'O lead';
  const oque = type === 'visita' ? 'visita' : 'aula experimental';
  return { refuse: `${nome} tem uma ${oque} marcada para ${ddmm(cur)}. Remarque a ${oque} ou marque esta aula depois dela.` };
}

// Remarcar uma aula do freepass que não é a da vez (o diálogo do cartão): muda
// só o dia e o professor do registro, reconta o freepass (o fim do por aulas
// é o dia da última aula) e, quando a aula passa a ser a mais cedo, o
// agendamento do lead aponta para ela. Um lote só, sem interação. `fields` são
// os campos do registro: scheduledFor, professorId, professorName, soloTraining.
// Devolve { refused } sem gravar quando a aula mudou em outra aba ou quando o
// lead tem um agendamento que ficaria sem dono (leadAppointmentFor).
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
  const running = activeFreepassesOf(lead, (freepasses || []).map((fp) => (fp.id === freepass.id ? after.freepass : fp)), now);
  const next = nextFreepassAula({ records, freepassId: freepass.id, now });
  // Se outra aba fez dela a aula da vez enquanto o diálogo estava aberto, o lead acompanha a mudança.
  const leadOnIt = lead.currentAulaId === aula.id;
  const rumo = next && !leadOnIt && next.id !== lead.currentAulaId ? leadAppointmentFor({ lead, records, at: next.scheduledFor, now }) : 'keep';
  if (rumo?.refuse) return { refused: rumo.refuse };
  const toNext = Boolean(next) && (leadOnIt || rumo === 'switch');
  const owner = toNext ? appointmentTaskOwnerFor({ scheduler: appUser, lead }) : null;
  const leadPatch = {
    ...freepassSummaryPatch(running, now),
    ...(toNext && buildSchedulePatch({
      typeLabel: 'Aula Experimental', date: getSafeDateOrNull(next.scheduledFor), modalidade: next.modality || null,
      professorId: next.professorId || null, professorName: next.professorName || null, soloTraining: Boolean(next.soloTraining),
      currentAulaId: next.id, appointmentOwnerId: owner?.id || null, appointmentOwnerName: owner?.name || null,
    })),
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
