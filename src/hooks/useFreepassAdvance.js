// O compromisso de hoje entra no agendamento do lead no dia dele (decisão do
// Johnny, 27/11/2026). O lead guarda um agendamento só, sempre o pendente mais
// cedo (leadSlotFor, em visitante.js), e a Agenda de hoje e a Meta leem esse
// agendamento. Quem tem mais de um compromisso pendente (uma aula do freepass
// depois de uma avulsa, uma visita marcada à parte) só mostra o mais cedo, e o
// próximo entraria no lead só na próxima gravação. Por isso, quando alguém que
// vende abre o app no dia, esta aba lê os registros de hoje e passa o
// agendamento do lead para o pendente de hoje, aula ou visita, com ou sem
// freepass (slotToAdvance).
//
// Só com o módulo Stronix 2.0 (o App só liga o hook com ele). Uma vez por dia e
// por aba, só com o portão de ociosidade aberto. Leituras avulsas (getDocs e
// getDoc), sem assinatura. Duas abas gravam o mesmo valor.
import { useEffect, useRef } from 'react';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { appId, AULAS_PATH, FREEPASS_PATH, LEADS_PATH } from '../lib/firebase.js';
import { slotPatchFor } from '../lib/slotPatch.js';
import { slotToAdvance } from '../lib/visitante.js';

// Para cada lead, o patch que passa o agendamento para o compromisso de hoje,
// ou nada. `records` são os registros pendentes de hoje; o de freepass que não
// existe ou não corre para o lead (encerrado, do contrato antigo, que não
// chegou a ser gravado) fica de fora. O dono da tarefa fica: o compromisso de
// hoje é de quem já tinha o anterior. Ninguém clicou aqui, então um contato de
// verdade (não o eco) de hoje em diante fica (slotPatchFor).
export function advancePlan({ records, leadsById, freepassesById, now = new Date() }) {
  const byLead = new Map();
  for (const r of records || []) {
    if (!leadsById.get(r.leadId)) continue;
    byLead.set(r.leadId, [...(byLead.get(r.leadId) || []), r]);
  }
  const out = [];
  for (const [leadId, recs] of byLead) {
    const lead = leadsById.get(leadId);
    const freepasses = recs.map((r) => freepassesById.get(r.freepassId)).filter(Boolean);
    const record = slotToAdvance({ lead, records: recs, freepasses, now });
    if (record) out.push({ leadId, patch: slotPatchFor({ lead, record, now }) });
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
  // status no navegador: um where em campo que falta tira o documento.
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.leadId && r.status === 'agendada');
  if (!records.length) return;
  const read = async (path, ids) => new Map((await Promise.all([...new Set(ids)].map(async (id) => {
    const s = await getDoc(doc(col(db, tenant, path), id));
    return s.exists() ? [id, { id, ...s.data() }] : null;
  }))).filter(Boolean));
  const [leadsById, freepassesById] = await Promise.all([
    read(LEADS_PATH, records.map((r) => r.leadId)),
    read(FREEPASS_PATH, records.map((r) => r.freepassId).filter(Boolean)),
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
