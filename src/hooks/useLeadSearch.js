// Busca remota de candidatos (G1b) — substitui o filtro client-side sobre o prop
// global (que só existia porque o App assinava a coleção inteira). O Firestore
// não faz substring, então puxamos um conjunto PEQUENO de candidatos por
// prefixo/token nos search fields materializados (searchCandidateSpecs) e o
// caller roda searchPeople() sobre eles pra reproduzir o ranking/destaque exatos.
//
// Cobre ativos + clientes + perdas (as specs NÃO filtram por lifecycleBucket),
// então segue funcionando depois do flip da PR G (quando o prop global vira
// só 'ativo'). getDocs (não ao vivo) com debounce; cada spec é single-field
// (índice automático — sem índice composto novo).

import { useState, useEffect } from 'react';
import { collection, query as fsQuery, getDocs } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';
import { searchCandidateSpecs } from '../lib/globalSearch.js';
import { normalizeLeadDoc } from '../lib/leads.js';

// useLeadSearch({ db, query, candidatePageSize, debounceMs }) -> { candidates, loading }
// candidates: leads normalizados (dedupe por id) das queries de prefixo/token.
// O caller aplica searchPeople(candidates, query) pro shape final de resultados.
export function useLeadSearch({ db, query, candidatePageSize = 20, debounceMs = 220 }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const specs = searchCandidateSpecs(query, candidatePageSize);
    if (!db || specs.length === 0) {
      setCandidates([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
        const snaps = await Promise.all(
          specs.map((s) => getDocs(fsQuery(colRef, ...specToConstraints(s))))
        );
        if (cancelled) return;
        // Dedupe por id preservando a 1ª ocorrência (a ordem final é do searchPeople).
        const byId = new Map();
        for (const snap of snaps) {
          for (const d of snap.docs) {
            if (!byId.has(d.id)) byId.set(d.id, normalizeLeadDoc(d));
          }
        }
        setCandidates([...byId.values()]);
      } catch (e) {
        // Falha de rede/permissão não pode travar o header — loga e zera.
        console.error('useLeadSearch', e);
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [db, query, candidatePageSize, debounceMs]);

  return { candidates, loading };
}
