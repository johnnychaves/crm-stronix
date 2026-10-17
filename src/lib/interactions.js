// Escrita de interação na timeline + atualização denormalizada do lead, no
// MESMO writeBatch (atômico). Substitui o par "addDoc(interação) + updateDoc
// (lead)" espalhado por ~18 call sites.
//
// Campos NOVOS gravados na interação:
//   actorId / actorAuthUid = quem FEZ a ação (base do volume por pessoa a
//   partir da PR C). getInteractionSecurityFields segue gravando o dono do
//   LEAD (leadConsultantId/leadConsultantAuthUid), preservado para permissão.
//
// Campos NOVOS gravados no lead (denormalização p/ a PR G parar de assinar a
// coleção de interações inteira):
//   lastInteractionAt = agora (espelha buildInteractionIndex.lastDate, que é
//                       max(createdAt) de TODAS as interações — por isso todo
//                       tipo, inclusive daily_goal_done, atualiza)
//   interactionsCount = increment(1)
//
// leadPatch (opcional): mudanças de status/campos do lead que ACOMPANHAM a
// interação (ex.: mover de fase, marcar perda, agendar). Passe aqui para a
// escrita ser atômica em vez de um updateDoc separado. Aplique withBucket()
// no leadPatch quando ele mudar status/lifecycleStage/isConverted.

import { writeBatch, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { appId, INTERACTIONS_PATH, LEADS_PATH } from './firebase.js';
import { getInteractionSecurityFields } from './leads.js';

export async function logInteraction(db, lead, appUser, interactionPayload, leadPatch = null) {
  const [id] = await logInteractions(db, lead, appUser, [interactionPayload], leadPatch);
  return id;
}

// Várias interações do mesmo lead, com o leadPatch, num batch só: grava tudo
// ou nada. É o caso do desfecho que grava a nota do motivo e a marca do dia.
// Em duas gravações, uma falha entre elas deixava o lead mudado e a tarefa
// fora da Meta sem a marca, e a nova tentativa repetia a nota.
export async function logInteractions(db, lead, appUser, interactionPayloads, leadPatch = null) {
  const batch = writeBatch(db);

  // Todas saem com a mesma hora do servidor. Com mais de uma, batchSeq guarda a
  // ordem em que foram passadas, e a linha do tempo da ficha desempata por ele
  // (originLastOnTies, em timeline.js): a nota do motivo fica antes da marca.
  // A interação sozinha não leva o campo.
  const many = interactionPayloads.length > 1;
  const ids = interactionPayloads.map((interactionPayload, index) => {
    const iRef = doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
    batch.set(iRef, {
      ...(many ? { batchSeq: index } : {}),
      leadId: lead.id,
      // Nome no momento da ação, para a interação se explicar sozinha mesmo
      // quando o lead não está na base carregada, que só tem os ATIVOS (cliente
      // em renovação, por exemplo). Quem lia era o extrato de prospecção da Meta
      // da equipe, que saiu; o campo continua gravado.
      leadName: lead.name || null,
      consultantName: appUser?.name || null,
      ...getInteractionSecurityFields(lead, appUser),
      actorId: appUser?.id || null,
      actorAuthUid: appUser?.authUid || null,
      createdAt: serverTimestamp(),
      ...interactionPayload,
    });
    return iRef.id;
  });

  batch.set(
    doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
    {
      lastInteractionAt: serverTimestamp(),
      interactionsCount: increment(ids.length),
      ...(leadPatch || {}),
    },
    { merge: true }
  );

  await batch.commit();
  return ids;
}
