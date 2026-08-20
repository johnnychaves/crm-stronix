// Carga do funil RENOVAÇÕES do board: uma query por coluna, cada uma com seu
// cursor e seu "carregar mais".
//
// POR QUE NÃO usePagedLeads: o número de colunas vem da config (marcos de
// renovação) e muda em tempo de execução. Hook não roda em laço, então não dá
// para chamar usePagedLeads uma vez por coluna. Aqui as N faixas rodam num só
// effect e os cursores vivem num ref indexado por marco.
//
// Reusa specToConstraints (usePagedLeads.js) para a tradução spec → Firestore:
// a lógica de risco (campo/op/orderBy, casamento com o índice #4) continua nas
// specs puras de leadQueries.js, cobertas por teste.
//
// NÃO é ao vivo (getDocs, não onSnapshot): o board é uma foto do dia, e uma
// assinatura por coluna multiplicaria a leitura pelo tempo de tela aberta.

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { specToConstraints } from './usePagedLeads.js';
import { renewalColumnQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH, appId } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

// useRenewalBoard({ db, columns, cutoffMs, pageSize, enabled })
//   columns : saída de renewalColumnsFromCheckpoints (precisa de .days/.prevDays)
//   cutoffMs: o "hoje" do board, fixado uma vez na montagem da tela
// Devolve { pages, hasMore, loading, loadMore(days) }, todos indexados pelo
// MARCO (days), que é a chave estável da coluna.
export function useRenewalBoard({ db, columns, cutoffMs, pageSize = 10, enabled = true }) {
  const [pages, setPages] = useState({});
  const [hasMore, setHasMore] = useState({});
  const [loading, setLoading] = useState(false);
  const cursors = useRef({});

  // Chave estável do conjunto de colunas: muda quando a config muda, e é o que
  // dispara a recarga. Depender do array `columns` faria refetch a cada render,
  // porque ele é recriado toda vez.
  const columnsKey = (columns || []).map((c) => `${c.prevDays}-${c.days}`).join('|');

  const fetchColumn = useCallback(async (col, reset) => {
    const spec = renewalColumnQuerySpec(cutoffMs, col.days, col.prevDays, pageSize);
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
    const cursor = reset ? null : cursors.current[col.days];
    const snap = await getDocs(query(colRef, ...specToConstraints(spec, cursor)));
    const page = snap.docs.map(normalizeLeadDoc);
    cursors.current[col.days] = snap.docs[snap.docs.length - 1] || cursors.current[col.days];
    setPages((prev) => ({
      ...prev,
      [col.days]: reset ? page : [...(prev[col.days] || []), ...page],
    }));
    // Página cheia ⇒ pode haver mais; menos que o limite ⇒ acabou.
    setHasMore((prev) => ({ ...prev, [col.days]: snap.size === pageSize }));
  }, [db, cutoffMs, pageSize]);

  useEffect(() => {
    if (!enabled || !db || !(columns || []).length) return;
    let cancelado = false;
    cursors.current = {};
    setLoading(true);
    // As colunas são independentes: em paralelo, não em fila. São 3 a 6 queries
    // pequenas e o board só fica pronto quando a última volta.
    Promise.all((columns || []).map((col) => fetchColumn(col, true)))
      .catch((err) => console.error('useRenewalBoard', err))
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
    // columnsKey representa `columns`; fetchColumn é derivado de db/cutoffMs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, db, columnsKey, cutoffMs]);

  const loadMore = useCallback((days) => {
    const col = (columns || []).find((c) => c.days === days);
    if (!col || loading || !hasMore[days]) return;
    setLoading(true);
    fetchColumn(col, false)
      .catch((err) => console.error('useRenewalBoard loadMore', err))
      .finally(() => setLoading(false));
  }, [columns, loading, hasMore, fetchColumn]);

  return { pages, hasMore, loading, loadMore };
}
