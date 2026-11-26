// Lançar e encerrar o freepass. Cada um grava, num lote só, o documento do
// freepass, a interação da linha do tempo e o resumo no lead (logInteractions
// com o gancho extra). `existing` são os freepass da pessoa que ainda fazem
// dela Visitante (activeFreepassesOf), para o resumo sair certo com mais de um.
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { appId, FREEPASS_PATH } from './firebase.js';
import { logInteractions } from './interactions.js';
import {
  buildFreepassDoc, freepassSummaryPatch, freepassLaunchText, freepassEndText,
  FREEPASS_STATUS, FREEPASS_INTERACTION_TYPE
} from './visitante.js';

const freepassCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', FREEPASS_PATH);

export async function writeFreepassLaunch({ db, lead, appUser, type, modalidadeName, startsAt, existing = [], via = 'contratos', now = new Date() }) {
  const ref = doc(freepassCol(db));
  const data = buildFreepassDoc({ lead, type, modalidadeName, startsAt, appUser, via });
  await logInteractions(
    db, lead, appUser,
    [{ type: FREEPASS_INTERACTION_TYPE, text: freepassLaunchText(data), freepassId: ref.id }],
    freepassSummaryPatch([...existing, { id: ref.id, ...data }], now),
    (batch) => batch.set(ref, { ...data, createdAt: serverTimestamp() })
  );
  return ref.id;
}

export async function writeFreepassEnd({ db, lead, appUser, freepass, existing = [], now = new Date() }) {
  const ref = doc(freepassCol(db), freepass.id);
  await logInteractions(
    db, lead, appUser,
    [{ type: FREEPASS_INTERACTION_TYPE, text: freepassEndText(freepass), freepassId: freepass.id }],
    freepassSummaryPatch(existing.filter(fp => fp.id !== freepass.id), now),
    (batch) => batch.update(ref, {
      status: FREEPASS_STATUS.ENCERRADO, endedAt: serverTimestamp(),
      endedById: appUser?.id || null, endedByName: appUser?.name || null
    })
  );
}
