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
  const batch = writeBatch(db);

  const iRef = doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
  batch.set(iRef, {
    leadId: lead.id,
    consultantName: appUser?.name || null,
    ...getInteractionSecurityFields(lead, appUser),
    actorId: appUser?.id || null,
    actorAuthUid: appUser?.authUid || null,
    createdAt: serverTimestamp(),
    ...interactionPayload,
  });

  batch.set(
    doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
    {
      lastInteractionAt: serverTimestamp(),
      interactionsCount: increment(1),
      ...(leadPatch || {}),
    },
    { merge: true }
  );

  await batch.commit();
  return iRef.id;
}
