// "Já li" do sino. Duas semânticas, porque as duas fontes são diferentes:
//   • novidades  — lista de ids vistos (localStorage, padrão que o pop-up já usava)
//   • indicações — carimbo de tempo em ms (padrão dos tickets: *LeuEmMs)
//
// O carimbo das indicações vai no doc do PRÓPRIO usuário, então some do celular
// depois de ler no computador. A regra do Firestore já permite cada um escrever
// no próprio doc, sem publicar nada novo. Contas antigas em que o id do doc não
// é o auth uid têm a escrita negada — por isso o localStorage fica como reserva
// e a leitura usa sempre o maior dos dois.

import { useCallback, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { appId, USERS_PATH } from '../lib/firebase.js';
import { ANNOUNCEMENTS, seenAnnouncementIds, markAnnouncementSeen } from '../lib/announcements.js';

const LS_KEY = (uid) => `stronix_seen_referrals_${uid || 'anon'}`;

const readLocalStamp = (uid) => {
  try { return Number(localStorage.getItem(LS_KEY(uid))) || 0; } catch { return 0; }
};

export function useNotificationsSeen({ db, appUser }) {
  const uid = appUser?.id;
  const [seenIds, setSeenIds] = useState(() => seenAnnouncementIds(appUser));
  const [lastSeenReferralsAt, setLastSeenReferralsAt] = useState(
    () => Math.max(Number(appUser?.lastSeenReferralsAtMs) || 0, readLocalStamp(uid))
  );

  const markAllSeen = useCallback(() => {
    if (!appUser?.id) return;
    ANNOUNCEMENTS.forEach((a) => markAnnouncementSeen(appUser, a.id));
    setSeenIds(ANNOUNCEMENTS.map((a) => a.id));

    const now = Date.now();
    setLastSeenReferralsAt(now);
    try { localStorage.setItem(LS_KEY(appUser.id), String(now)); } catch { /* sem localStorage: só o doc */ }
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
