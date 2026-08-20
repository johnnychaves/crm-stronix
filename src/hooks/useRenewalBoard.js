// Carga do funil RENOVAÇÕES do board: uma query por coluna, cada uma com seu
// cursor e seu "carregar mais".
//
// POR QUE NÃO usePagedLeads: o número de colunas vem da config (marcos de
// renovação) e muda em tempo de execução. Hook não roda em laço, então não dá
// para chamar usePagedLeads uma vez por coluna. Aqui as N faixas rodam num só
// effect e os cursores vivem num ref indexado por marco.
//
// Reusa duas peças do usePagedLeads.js: specToConstraints, para a tradução
// spec → Firestore — a lógica de risco (campo/op/orderBy, casamento com o
// índice #4) continua nas specs puras de leadQueries.js, cobertas por teste —
// e getDocsWithAuthRetry, porque a corrida de carga fria pós-login já mordeu
// este projeto: a query pode sair antes do token trazer o claim de tenant e
// tomar permission-denied que se cura sozinho.
//
// NÃO é ao vivo (getDocs, não onSnapshot): o board é uma foto do dia, e uma
// assinatura por coluna multiplicaria a leitura pelo tempo de tela aberta.

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query } from 'firebase/firestore';
import { specToConstraints, getDocsWithAuthRetry } from './usePagedLeads.js';
import { renewalColumnQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH, appId } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

// useRenewalBoard({ db, columns, cutoffMs, pageSize, enabled })
//   columns : saída de renewalColumnsFromCheckpoints (precisa de .days/.prevDays)
//   cutoffMs: o "hoje" do board, fixado uma vez na montagem da tela
// Devolve { pages, hasMore, loading, loadMore(days) }. `pages` e `hasMore` são
// indexados pelo MARCO (days), a chave estável da coluna; `loading` é só a
// carga inicial do board, porque o "carregar mais" trava por coluna no inFlight.
// Coluna que falha fica vazia e só loga: NÃO existe estado de erro exposto, e
// isso é de propósito — para o consumidor, hoje, "vazio" e "falhou" são
// indistinguíveis.
export function useRenewalBoard({ db, columns, cutoffMs, pageSize = 10, enabled = true }) {
  const [pages, setPages] = useState({});
  const [hasMore, setHasMore] = useState({});
  const [loading, setLoading] = useState(false);
  const cursors = useRef({});
  // Geração da carga. Toda troca do conjunto de colunas (ou saída da aba) sobe a
  // geração e transforma em lixo tudo que estava no ar: sem isso, uma query da
  // faixa ANTIGA que resolva depois grava na chave da coluna nova e deixa o
  // cursor apontando para o lugar errado — e isso não se repara sozinho.
  const generation = useRef(0);
  // Colunas com busca no ar, por marco. É ref e NÃO estado de propósito: o guard
  // do loadMore precisa valer no mesmo instante do clique, e estado só muda no
  // próximo render. Dois cliques dentro do mesmo frame leriam `loading: false`
  // nos dois, usariam o MESMO cursor e anexariam a mesma página duas vezes,
  // duplicando card na tela.
  const inFlight = useRef({});

  // Chave estável do conjunto de colunas: muda quando a config muda, e é o que
  // dispara a recarga. Depender do array `columns` faria refetch a cada render,
  // porque ele é recriado toda vez.
  const columnsKey = (columns || []).map((c) => `${c.prevDays}-${c.days}`).join('|');

  const fetchColumn = useCallback(async (col, reset, gen) => {
    if (inFlight.current[col.days]) return;
    inFlight.current[col.days] = true;
    try {
      const spec = renewalColumnQuerySpec(cutoffMs, col.days, col.prevDays, pageSize);
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);
      const cursor = reset ? null : cursors.current[col.days];
      const snap = await getDocsWithAuthRetry(query(colRef, ...specToConstraints(spec, cursor)));
      if (gen !== generation.current) return;
      const page = snap.docs.map(normalizeLeadDoc);
      cursors.current[col.days] = snap.docs[snap.docs.length - 1] || cursors.current[col.days];
      setPages((prev) => ({
        ...prev,
        [col.days]: reset ? page : [...(prev[col.days] || []), ...page],
      }));
      // Página cheia ⇒ pode haver mais; menos que o limite ⇒ acabou.
      setHasMore((prev) => ({ ...prev, [col.days]: snap.size === pageSize }));
    } finally {
      // Só devolve a vaga se ela ainda é sua: uma carga velha terminando não pode
      // liberar a trava de uma carga nova da mesma coluna.
      if (gen === generation.current) inFlight.current[col.days] = false;
    }
  }, [db, cutoffMs, pageSize]);

  useEffect(() => {
    if (!enabled || !db || !(columns || []).length) {
      // Sair da aba no meio da carga: o .finally da busca em voo pula o
      // setLoading por geração, e sem isto o hook ficaria "carregando" para
      // sempre até uma rodada completa acontecer.
      setLoading(false);
      return;
    }
    const gen = ++generation.current;
    cursors.current = {};
    inFlight.current = {};
    setLoading(true);
    // As colunas são independentes: em paralelo, não em fila. allSettled e não
    // all — com `all`, a primeira falha limparia o loading com as outras colunas
    // ainda no ar, e o board sairia do carregando cedo demais.
    Promise.allSettled((columns || []).map((col) => fetchColumn(col, true, gen)))
      .then((rs) => rs.forEach((r, i) => {
        if (r.status !== 'rejected') return;
        console.error('useRenewalBoard', r.reason);
        // Coluna que falhou fica com hasMore ligado de propósito: sem isso ela
        // some do alcance do loadMore e vira coluna morta até o board inteiro
        // recarregar. Com ele, o "carregar mais" que já existe vira o botão de
        // tentar de novo — o cursor está vazio, então a retentativa busca a
        // primeira página. allSettled indexa pela ORDEM DE ENTRADA, então rs[i]
        // é sempre a coluna columns[i], não a que assentou primeiro.
        // Só para a geração corrente, como todo o resto do arquivo: carga
        // vencida não grava.
        const col = (columns || [])[i];
        if (col && gen === generation.current) {
          setHasMore((prev) => ({ ...prev, [col.days]: true }));
        }
      }))
      .finally(() => { if (gen === generation.current) setLoading(false); });
    // Sair da aba (ou trocar os marcos) invalida o que estava no ar.
    return () => { generation.current += 1; };
    // columnsKey representa `columns`; fetchColumn é derivado de db, cutoffMs e
    // pageSize — este último fica fora daqui de propósito, porque é constante no
    // consumidor e recarregar o board por ele nunca aconteceria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, db, columnsKey, cutoffMs]);

  const loadMore = useCallback((days) => {
    const col = (columns || []).find((c) => c.days === days);
    if (!enabled || !col || !hasMore[days]) return;
    // Sem `loading` no guard: a trava real é o inFlight, por coluna e síncrona.
    // Barrar por `loading` do board ainda impediria carregar mais numa coluna
    // enquanto outra busca — e não impediria o duplo-clique, que é o problema.
    fetchColumn(col, false, generation.current)
      .catch((err) => console.error('useRenewalBoard loadMore', err));
  }, [enabled, columns, hasMore, fetchColumn]);

  return { pages, hasMore, loading, loadMore };
}
