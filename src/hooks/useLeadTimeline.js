// Timeline da ficha por query própria (G2). Antes vinha do prop global de
// interactions filtrado por leadId; com o G2 a assinatura global vira só o MÊS
// CORRENTE, então a ficha precisa da própria fonte pra mostrar o histórico
// COMPLETO do lead (qualquer data). onSnapshot ao vivo (índice #10:
// leadId ASC, createdAt DESC) — nova interação aparece na hora, igual antes.
//
// A ficha (LeadProfileView) remonta por lead (key={lead.id}), então o hook não
// precisa resetar entre leads. Sem flag de loading → sem sync-setState no efeito.

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { appId, INTERACTIONS_PATH } from '../lib/firebase.js';
import { getSafeDate } from '../lib/dates.js';

// useLeadTimeline({ db, leadId }) -> interactions[] (mesma forma do prop antigo:
// { id, ...data, createdAt: Date }), ordenadas por createdAt desc.
export function useLeadTimeline({ db, leadId }) {
  const [interactions, setInteractions] = useState([]);

  useEffect(() => {
    if (!db || !leadId) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH);
    const q = query(ref, where('leadId', '==', leadId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInteractions(
          snap.docs.map((d) => {
            const data = d.data();
            return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
          })
        );
      },
      (e) => {
        console.error('useLeadTimeline', e);
        setInteractions([]);
      }
    );
    return () => unsub();
  }, [db, leadId]);

  return interactions;
}
