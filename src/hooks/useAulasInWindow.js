// Fonte de aulas (stronix_aulas) para a conversão por PROFESSOR do Gerencial
// (PR-B). Busca os registros de aula cuja `scheduledFor` caia dentro da janela
// [startMs, endMs] — range de campo ÚNICO, índice AUTOMÁTICO, sem composto nem
// publicação manual. Mesmo espírito do useAdminDashboardLeads: não é ao vivo
// (getDocs), rebusca quando a janela muda, guarda de corrida garante que só o
// pedido mais recente escreva.
//
// O consumidor decide o recorte (admin = todas as aulas da janela; consultor =
// filtra pelos seus próprios leads depois de carregar) — este hook só entrega
// a janela crua normalizada.

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { appId, AULAS_PATH } from '../lib/firebase.js';
import { getSafeDateOrNull } from '../lib/dates.js';

// useAulasInWindow({ db, startMs, endMs, enabled })
//   startMs, endMs : limites da janela (ms) aplicados a `scheduledFor`
//   enabled        : liga a busca
export function useAulasInWindow({ db, startMs, endMs, enabled = true }) {
  const [aulas, setAulas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reqIdRef = useRef(0);

  const active = enabled && !!db && startMs != null && endMs != null;

  const fetchAulas = useCallback(async () => {
    if (!active) {
      setAulas([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH);
      const q = query(
        colRef,
        where('scheduledFor', '>=', new Date(startMs)),
        where('scheduledFor', '<=', new Date(endMs)),
        orderBy('scheduledFor')
      );
      const snap = await getDocs(q);
      // Só o pedido mais recente escreve (o usuário pode trocar de período
      // antes do getDocs anterior resolver).
      if (reqId !== reqIdRef.current) return;
      setAulas(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            scheduledFor: getSafeDateOrNull(data.scheduledFor),
            convertedAt: getSafeDateOrNull(data.convertedAt)
          };
        })
      );
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      console.error('useAulasInWindow', e);
      setError(e);
      setAulas([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [db, startMs, endMs, active]);

  // Rebusca quando a janela (startMs/endMs) ou o gate mudam.
  useEffect(() => { fetchAulas(); }, [fetchAulas]);

  return { aulas, loading, error };
}
