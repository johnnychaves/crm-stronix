// Gravação dos VÍNCULOS de indicação no Firestore. O QUE gravar (textos,
// campos) vem de referrals.js (puro); aqui fica o COMO — o writeBatch com o
// patch no lead indicado e os eventos de timeline dos dois lados.
//
// Decisão deliberada: o doc do INDICADOR não recebe patch nenhum (nem
// lastInteractionAt/interactionsCount) — indicação não é contato real com o
// cliente; ver a exclusão correspondente em hasActiveInteractionToday.

import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from './firebase.js';
import { getInteractionSecurityFields } from './leads.js';
import { referralIndicadoText, referralIndicouText } from './referrals.js';

const interactionBase = (lead, appUser) => ({
  consultantName: appUser?.name || null,
  ...getInteractionSecurityFields(lead, appUser),
  actorId: appUser?.id || null,
  actorAuthUid: appUser?.authUid || null,
  createdAt: serverTimestamp()
});

// Vincula (ou re-vincula) um indicador ao lead indicado, num batch atômico:
//  1. patch no INDICADO: referredById/Name + referredAt + bump normal de
//     atividade (+ extraLeadPatch opcional — ex.: a mudança de funil/etapa do
//     vínculo retroativo; o caller aplica withBucket quando mexer em status)
//  2. evento 🤝 na timeline do INDICADO
//  3. evento 🤝 na timeline do INDICADOR (sem patch no doc dele)
export async function commitReferralLink({ db, lead, appUser, referrer, extraLeadPatch = null }) {
  if (!lead?.id || !referrer?.id) throw new Error('Vínculo de indicação sem lead ou indicador.');
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
    {
      referredById: referrer.id,
      referredByName: referrer.name || null,
      referredAt: serverTimestamp(),
      ...(extraLeadPatch || {}),
      lastInteractionAt: serverTimestamp(),
      interactionsCount: increment(1)
    },
    { merge: true }
  );

  batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)), {
    leadId: lead.id,
    leadName: lead.name || null,
    text: referralIndicadoText(referrer.name || 'cliente'),
    type: 'referral',
    ...interactionBase(lead, appUser)
  });

  batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)), {
    leadId: referrer.id,
    leadName: referrer.name || null,
    text: referralIndicouText(lead.name || 'lead'),
    type: 'referral',
    ...interactionBase(referrer, appUser)
  });

  await batch.commit();
}

// Remove o vínculo do lead indicado (correção de erro). Evento só no lado do
// indicado — a aba do ex-indicador se ajusta sozinha (a query por referredById
// deixa de retornar este lead).
export async function removeReferralLink({ db, lead, appUser }) {
  if (!lead?.id) throw new Error('Lead não informado.');
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
    {
      referredById: null,
      referredByName: null,
      referredAt: null,
      lastInteractionAt: serverTimestamp(),
      interactionsCount: increment(1)
    },
    { merge: true }
  );

  batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)), {
    leadId: lead.id,
    leadName: lead.name || null,
    text: 'Vínculo de indicação removido.',
    type: 'referral',
    ...interactionBase(lead, appUser)
  });

  await batch.commit();
}
