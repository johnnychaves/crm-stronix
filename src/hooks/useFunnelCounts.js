// Contagem por bucket de um funil via getCountFromServer — agrega no SERVIDOR,
// sem baixar os docs (1 leitura por bucket, não N). Alimenta os badges de
// contagem das colunas terminais do Kanban (ex.: total de Perdas), que depois
// do E1c passaram a carregar só uma página. Usa apenas as igualdades de
// bucketByFunnelCountSpec (prefixo dos índices #1/#2 — sem índice novo).
//
// Não é ao vivo (getCountFromServer, não onSnapshot). Refaz quando muda o funil,
// os buckets ou o `reloadKey` (bump manual após marcar/desfazer perda). É
// ADITIVO — a assinatura global segue intacta até a PR G.

import { useState, useEffect } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { appId } from '../lib/firebase.js';
import { bucketByFunnelCountSpec } from '../lib/leadQueries.js';

// useFunnelCounts({ db, path, funnelId, buckets, enabled, reloadKey })
//   buckets : lista de baldes (ex.: ['perda']) — conta um por um.
//   reloadKey: valor que, ao mudar, força recontagem (mutação local).
// Retorna { counts: { [bucket]: number }, loading }. Bucket sem resposta fica
// ausente do objeto (o caller cai no fallback de contagem em memória).
export function useFunnelCounts({ db, path, funnelId, buckets, enabled = true, reloadKey = 0 }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const bucketsKey = (buckets || []).join(',');

  useEffect(() => {
    if (!enabled || !db || !funnelId || !(buckets || []).length) {
      setCounts({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', path);
    Promise.all(
      buckets.map(async (b) => {
        const spec = bucketByFunnelCountSpec(b, funnelId);
        const cs = spec.wheres.map((w) => where(w.field, w.op, w.value));
        const snap = await getCountFromServer(query(colRef, ...cs));
        return [b, snap.data().count];
      })
    )
      .then((pairs) => { if (!cancelled) setCounts(Object.fromEntries(pairs)); })
      .catch((e) => { if (!cancelled) { console.error('useFunnelCounts', path, e); setCounts({}); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // buckets é representado por bucketsKey (a lista é recriada a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, path, funnelId, bucketsKey, enabled, reloadKey]);

  return { counts, loading };
}
