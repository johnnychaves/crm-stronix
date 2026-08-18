// "Já li" do sino. Duas semânticas, porque as duas fontes são diferentes:
//   • novidades  — lista de ids vistos (localStorage, padrão que o pop-up já usava)
//   • indicações — carimbo de tempo em ms (padrão dos tickets: *LeuEmMs)
//
// O carimbo das indicações vai no doc do PRÓPRIO usuário, então some do celular
// depois de ler no computador. A regra do Firestore já permite cada um escrever
// no próprio doc, sem publicar nada novo. Contas antigas em que o id do doc não
// é o auth uid têm a escrita negada — por isso o localStorage fica como reserva
// e a leitura usa sempre o maior dos dois.
//
// A leitura é DERIVADA do appUser a cada render (readSeenState), nunca guardada
// no mount: quando o app monta, a sessão ainda está sendo resolvida e o appUser
// é null. Congelar ali era ler o "já li" de ninguém e não reler mais, e por isso
// os mesmos avisos voltavam como novos a cada F5.

import { useCallback, useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { appId, USERS_PATH } from '../lib/firebase.js';
import { ANNOUNCEMENTS, markAnnouncementSeen } from '../lib/announcements.js';
import { readSeenState, mergeSeenIds, writeReferralStamp } from '../lib/notifications.js';

const NADA_MARCADO = { uid: null, ids: [], atMs: 0 };

export function useNotificationsSeen({ db, appUser }) {
  // O que foi marcado NESTA sessão. Só serve para a tela reagir na hora do
  // clique; a persistência de verdade é o localStorage + o doc do usuário, que
  // o readSeenState relê. Guarda o uid junto para não vazar de um usuário para
  // o outro quando alguém sai e outro entra na mesma aba.
  const [marcado, setMarcado] = useState(NADA_MARCADO);
  const meu = marcado.uid && marcado.uid === appUser?.id ? marcado : NADA_MARCADO;

  const gravado = useMemo(() => readSeenState(appUser), [appUser]);
  const seenIds = useMemo(() => mergeSeenIds(gravado.seenIds, meu.ids), [gravado.seenIds, meu.ids]);
  const lastSeenReferralsAt = Math.max(gravado.lastSeenReferralsAt, meu.atMs);

  const markAllSeen = useCallback(() => {
    if (!appUser?.id) return;
    ANNOUNCEMENTS.forEach((a) => markAnnouncementSeen(appUser, a.id));

    const now = Date.now();
    writeReferralStamp(appUser.id, now);
    setMarcado({ uid: appUser.id, ids: ANNOUNCEMENTS.map((a) => a.id), atMs: now });
    // Best-effort: falha (doc legado com id ≠ uid) não pode quebrar o clique.
    if (db) {
      setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, appUser.id),
        { lastSeenReferralsAtMs: now },
        { merge: true }
      ).catch(() => { /* fica só o localStorage */ });
    }
  }, [db, appUser]);

  return { seenIds, lastSeenReferralsAt, markAllSeen };
}
