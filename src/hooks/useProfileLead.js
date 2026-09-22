// Ficha do lead por id, ao vivo. Assina o DOC ÚNICO (onSnapshot), então abre
// qualquer balde (ativo, cliente, perdido, vencido) e reflete na hora o que
// outra pessoa mudar. Quem chama é a LeadProfileRoute, que só existe com o
// login feito: nada daqui sobrevive ao Sair.
//
// Nada de setState dentro do effect. A última resposta fica guardada com a
// chave (sessão, id, tentativa) que a pediu, e o status sai da comparação no
// render (src/lib/fichaState.js). Resposta de chave velha vira "loading".
//
// `sessionKey` vem só do appUser (`${tenantId}:${authUid || id}`), nunca do
// firebaseUser: ele muda antes de o appId trocar de academia, e a leitura iria
// para o caminho errado. `active` é o portão de ociosidade do App: desligado,
// a assinatura cai e a tela fica com a última resposta.

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { profileSubscriptionKey, nextProfileSnap, profileStatusFor } from '../lib/fichaState.js';

// useProfileLead({ db, leadId, sessionKey, active }) -> { status, lead, retry }
// lead vem com status 'ready' e, em 'deleted', é o último que apareceu.
export function useProfileLead({ db, leadId, sessionKey, active = true }) {
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState(null);
  const key = profileSubscriptionKey({ sessionKey, leadId, attempt });

  useEffect(() => {
    if (!db || !key || !active) return undefined;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, leadId);
    return onSnapshot(
      ref,
      (s) => setSnap((prev) => nextProfileSnap(prev, key, s.exists() ? normalizeLeadDoc(s) : null, { fromCache: s.metadata.fromCache })),
      (e) => {
        console.error('useProfileLead', e);
        setSnap({ key, status: 'error', lead: null });
      }
    );
  }, [db, key, leadId, active]);

  // "Tentar de novo": tentativa nova é chave nova, e o effect assina de novo.
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const status = profileStatusFor({ leadId, sessionKey, key, snap });
  const lead = status === 'ready' || status === 'deleted' ? snap.lead : null;
  return { status, lead, retry };
}
