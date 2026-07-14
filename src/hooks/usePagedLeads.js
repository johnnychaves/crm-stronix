// Leitura paginada (getDocs + cursor) para os consumidores da PR E. NÃO é tempo
// real (getDocs, não onSnapshot): as telas que migram (Clientes, coluna Perda
// do Kanban, ...) são listas navegáveis, não boards ao vivo. É ADITIVO — a
// assinatura da coleção inteira segue intacta no App até a PR G; este hook só
// entra em uso quando uma tela passa a consumi-lo.
//
// A lógica de risco (qual campo/op/orderBy, casamento com os índices compostos)
// vive nas specs PURAS de src/lib/leadQueries.js, cobertas por teste. Aqui é só
// a tradução mecânica spec→firebase + o cursor.
//
// PRÉ-REQUISITO DE PRODUÇÃO: as queries por lifecycleBucket/campos derivados só
// retornam os leads antigos DEPOIS do backfill da PR D (senão eles não têm o
// campo e somem da lista). Não ligar telas a este hook antes do backfill.

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { appId } from '../lib/firebase.js';

// Traduz uma spec pura (leadQueries.js) para constraints do firebase.
export function specToConstraints(spec, cursor = null) {
  const cs = [];
  for (const w of spec?.wheres || []) cs.push(where(w.field, w.op, w.value));
  if (spec?.orderBy) cs.push(orderBy(spec.orderBy.field, spec.orderBy.dir));
  if (cursor) cs.push(startAfter(cursor));
  if (spec?.limit) cs.push(limit(spec.limit));
  return cs;
}

// usePagedLeads({ db, path, spec, specKey, mapDoc, enabled })
//   path    : coleção sob artifacts/{appId}/public/data/ (ex.: LEADS_PATH)
//   spec    : descritor de leadQueries.js
//   specKey : string estável que muda quando a spec muda (reseta a paginação
//             sem depender da identidade do objeto spec, recriado a cada render)
//   mapDoc  : (docSnap) => objeto do item (default: { id, ...data() })
export function usePagedLeads({ db, path, spec, specKey, mapDoc, enabled = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef(null);

  const fetchPage = useCallback(async (reset) => {
    if (!enabled || !spec) return;
    setLoading(true);
    setError(null);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', path);
      const cursor = reset ? null : lastDocRef.current;
      const snap = await getDocs(query(colRef, ...specToConstraints(spec, cursor)));
      const page = snap.docs.map((d) => (mapDoc ? mapDoc(d) : { id: d.id, ...d.data() }));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || lastDocRef.current;
      // Página cheia ⇒ pode haver mais; menos que o limite ⇒ acabou.
      setHasMore(spec.limit ? snap.size === spec.limit : false);
      setItems((prev) => (reset ? page : [...prev, ...page]));
    } catch (e) {
      console.error('usePagedLeads', path, e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [db, path, spec, mapDoc, enabled]);

  // Reseta e recarrega a 1ª página quando a spec (por specKey) muda.
  useEffect(() => {
    lastDocRef.current = null;
    setItems([]);
    setHasMore(true);
    fetchPage(true);
    // fetchPage é derivado de specKey/enabled/db/path; specKey representa a spec.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, enabled, db, path]);

  const loadMore = useCallback(() => { if (!loading && hasMore) fetchPage(false); }, [loading, hasMore, fetchPage]);
  const reload = useCallback(() => fetchPage(true), [fetchPage]);

  return { items, loading, error, hasMore, loadMore, reload };
}
