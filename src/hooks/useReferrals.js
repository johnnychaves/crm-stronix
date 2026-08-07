// Indicações de um cliente: contagem barata (getCountFromServer, padrão
// useFunnelCounts) quando a ficha de um CLIENTE abre, e a lista completa
// (getDocs) só quando a aba Indicações ativa. Igualdade em campo único
// (referredById) roda no índice automático — nada a publicar no console; a
// ordenação é client-side (sortReferrals) para não exigir índice composto.

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { sortReferrals } from '../lib/referrals.js';

// useReferrals({ db, leadId, enabled, active }) -> { count, items, loading, reload }
//   enabled : dispara a contagem do badge (ficha de cliente aberta)
//   active  : dispara o getDocs da lista (aba Indicações aberta)
//   count   : null enquanto não contado; sincroniza com a lista quando ela chega
//   items   : null enquanto não buscado; depois array normalizado + ordenado
export function useReferrals({ db, leadId, enabled = false, active = false }) {
  const [count, setCount] = useState(null);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled || !db || !leadId) return;
    let cancelled = false;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
    getCountFromServer(query(colRef, where('referredById', '==', leadId)))
      .then((snap) => { if (!cancelled) setCount(snap.data().count); })
      .catch((e) => { console.error('useReferrals count', e); });
    return () => { cancelled = true; };
  }, [db, leadId, enabled, reloadKey]);

  useEffect(() => {
    if (!active || !db || !leadId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- liga o spinner da busca assíncrona disparada pelo próprio effect (padrão dos hooks de getDocs do app).
    setLoading(true);
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
    getDocs(query(colRef, where('referredById', '==', leadId)))
      .then((snap) => {
        if (cancelled) return;
        const list = sortReferrals(snap.docs.map(normalizeLeadDoc));
        setItems(list);
        setCount(list.length);
      })
      .catch((e) => { console.error('useReferrals list', e); if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [db, leadId, active, reloadKey]);

  return { count, items, loading, reload };
}
