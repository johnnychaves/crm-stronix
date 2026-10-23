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
// O dia sem nenhuma tarefa conta como batido (decisão do Johnny, 21/10/2026):
// até ali ele não era gravado e o painel o contava como meta não cumprida. Os
// painéis só contam os dias de meta, então o dia de folga gravado não pesa.
// `dayKey` é o dia de agora (dgDateKey(new Date()) na chamada), e não o dia
// guardado no estado do App, que fica velho com o computador dormindo.
// `seller` diz se a pessoa vende (isSeller, em acesso.js). Quem não vende (o
// professor) não tem a Meta do consultor e nunca grava dia batido. Sem o
// campo, vale quem vende, como sempre foi.
export function goalHitKeyToRecord({ userId, dayKey, ready, total, pending, recordedKey, seller = true }) {
  if (!userId || !ready || !seller) return null;
  if (!(total >= 0) || pending > 0) return null;
  const key = `${userId}_${dayKey}`;
  return key === recordedKey ? null : key;
}

// Diz se gravou. O App só marca o dia como gravado quando deu certo, senão a
// falha de uma gravação deixava o dia sem doc até o próximo F5.
export async function recordGoalHit(db, appUser, { date = new Date(), volumeCount = null, volumeTarget = null } = {}) {
  if (!db || !appUser?.id || !appUser?.authUid) return false;
  const { id, data } = buildGoalHitDoc(appUser, dgDateKey(date), { volumeCount, volumeTarget });
  try {
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH, id),
      { ...data, hitAt: serverTimestamp() },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Erro ao gravar o dia batido da Meta:', err);
    return false;
  }
}
