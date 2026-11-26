// A aula da vez do freepass anda no dia da aula seguinte (Tarefa 6 do plano
// docs/superpowers/plans/2026-11-26-visitante-02-agendar.md).
//
// O lead guarda só uma aula no agendamento, e a Agenda de hoje e a Meta leem
// esse agendamento. Se a aula andasse no desfecho, a aula de hoje sumiria da
// Agenda de hoje. Por isso ela anda no dia da aula seguinte: quando alguém que
// vende abre o app nesse dia, esta aba lê as aulas de hoje e passa o agendamento
// do lead para a de freepass que corre (currentAulaToAdvance, em visitante.js).
//
// Uma vez por dia e por aba, só com o portão de ociosidade aberto. Leituras
// avulsas (getDocs e getDoc), sem assinatura. Duas abas gravam o mesmo valor.
import { useEffect, useRef } from 'react';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { appId, AULAS_PATH, FREEPASS_PATH, LEADS_PATH } from '../lib/firebase.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { buildSchedulePatch } from '../lib/schedulePatch.js';
import { activeFreepassesOf, currentAulaToAdvance } from '../lib/visitante.js';

// Para cada lead, o patch que passa o agendamento para a aula de hoje, ou nada.
// `records` são os registros de hoje; só contam os de freepass que existe e
// corre para o lead (o encerrado, o do contrato antigo e o que não chegou a ser
// gravado ficam de fora).
export function advancePlan({ records, leadsById, freepassesById, now = new Date() }) {
  const byLead = new Map();
  for (const r of records || []) {
    const lead = leadsById.get(r.leadId);
    const fp = freepassesById.get(r.freepassId);
    if (!lead || !fp || !activeFreepassesOf(lead, [fp], now).length) continue;
    byLead.set(r.leadId, [...(byLead.get(r.leadId) || []), r]);
  }
  const out = [];
  for (const [leadId, recs] of byLead) {
    const aula = currentAulaToAdvance({ lead: leadsById.get(leadId), records: recs, now });
    if (!aula) continue;
    const {
      appointmentOwnerId: _owner, appointmentOwnerName: _ownerName, ...patch
    } = buildSchedulePatch({
      typeLabel: 'Aula Experimental', date: getSafeDateOrNull(aula.scheduledFor), modalidade: aula.modality || null,
      professorId: aula.professorId || null, professorName: aula.professorName || null,
      soloTraining: Boolean(aula.soloTraining), currentAulaId: aula.id,
    });
    // O dono da tarefa fica: a aula seguinte é de quem já tinha a anterior.
    out.push({ leadId, patch });
  }
  return out;
}

const col = (db, tenant, path) => collection(db, 'artifacts', tenant, 'public', 'data', path);

async function runAdvance(db) {
  // A academia da leitura vale até o fim: o "Acessar como" troca o appId no meio.
  const tenant = appId;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const snap = await getDocs(query(col(db, tenant, AULAS_PATH), where('scheduledFor', '>=', start), where('scheduledFor', '<=', end)));
  // freepassId e status no navegador: um where em campo que falta tira o documento.
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.freepassId && r.leadId && r.status === 'agendada');
  if (!records.length) return;
  const read = async (path, ids) => new Map((await Promise.all([...new Set(ids)].map(async (id) => {
    const s = await getDoc(doc(col(db, tenant, path), id));
    return s.exists() ? [id, { id, ...s.data() }] : null;
  }))).filter(Boolean));
  const [leadsById, freepassesById] = await Promise.all([
    read(LEADS_PATH, records.map((r) => r.leadId)),
    read(FREEPASS_PATH, records.map((r) => r.freepassId)),
  ]);
  for (const { leadId, patch } of advancePlan({ records, leadsById, freepassesById, now })) {
    await updateDoc(doc(col(db, tenant, LEADS_PATH), leadId), patch)
      .catch((err) => console.error('useFreepassAdvance: falha ao gravar o lead', leadId, err));
  }
}

export function useFreepassAdvance({ db, enabled, dayKey }) {
  const doneRef = useRef(null);
  useEffect(() => {
    if (!db || !enabled || doneRef.current === dayKey) return;
    doneRef.current = dayKey;
    runAdvance(db).catch((err) => {
      console.error('useFreepassAdvance falhou', err);
      // A leitura falhou: tenta de novo na próxima volta da aba.
      if (doneRef.current === dayKey) doneRef.current = null;
    });
  }, [db, enabled, dayKey]);
}
