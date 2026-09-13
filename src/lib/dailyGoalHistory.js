// Doc do dia de meta batida (stronix_daily_goal_history). Um por pessoa por dia,
// id determinístico: gravar de novo não duplica. Saiu do DailyGoalView para
// o App gravar de qualquer tela quando as pendências do dia chegam a zero.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from './firebase.js';
import { dgDateKey } from './dailyGoal.js';

export function buildGoalHitDoc(appUser, dateKey, { volumeCount = null, volumeTarget = null } = {}) {
  return {
    id: `${appUser.id}_${dateKey}`,
    data: {
      consultantId: appUser.id,
      consultantAuthUid: appUser.authUid,
      consultantName: appUser.name || null,
      date: dateKey,
      ...(volumeTarget > 0 ? { volumeCount, volumeTarget } : {})
    }
  };
}

// Decide se o dia batido de agora deve ser gravado, e com qual chave (pra
// marcar no ref e não regravar à toa na mesma sessão). `ready` já reúne os
// gates de carregamento de quem chama (App.jsx): base carregada
// (loadingData/renewalLoading/contactTodayLoading) e listeners ligados —
// combinar esses booleanos é responsabilidade de quem chama, não desta
// função. Sem usuário ou sem base pronta, total zerado ou pendência ainda
// maior que zero, ou o dia já gravado (recordedKey igual à chave): não grava.
export function goalHitKeyToRecord({ userId, dayKey, ready, total, pending, recordedKey }) {
  if (!userId || !ready) return null;
  if (total === 0 || pending > 0) return null;
  const key = `${userId}_${dayKey}`;
  return key === recordedKey ? null : key;
}

export async function recordGoalHit(db, appUser, { date = new Date(), volumeCount = null, volumeTarget = null } = {}) {
  if (!db || !appUser?.id || !appUser?.authUid) return;
  const { id, data } = buildGoalHitDoc(appUser, dgDateKey(date), { volumeCount, volumeTarget });
  try {
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH, id),
      { ...data, hitAt: serverTimestamp() },
      { merge: true }
    );
  } catch { /* regra ainda não publicada: silencioso, como antes */ }
}
