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
// Devolve { pages, hasMore, loading, loadMore(days), reload(), patchLead(id,
// patch) }. `pages` e `hasMore` são
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

  // Carga inicial de TODAS as colunas. É o corpo do effect de montagem E o
  // `reload` exposto — um lugar só, de propósito: duplicar isto seria duplicar o
  // gate de geração, que é justamente o que segura a corrida entre uma carga
  // velha e uma nova. Recarregar é a MESMA operação de montar o board.
  const loadAllColumns = useCallback(() => {
    if (!enabled || !db || !(columns || []).length) {
      // Sair da aba no meio da carga: o .finally da busca em voo pula o
      // setLoading por geração, e sem isto o hook ficaria "carregando" para
      // sempre até uma rodada completa acontecer.
      setLoading(false);
      return;
    }
    // Subir a geração aqui invalida tudo que estiver no ar — inclusive um
    // "carregar mais" de outra coluna, que resolveria com o cursor da carga
    // antiga. As duas travas seguem valendo na recarga: a busca vencida não
    // escreve (gate de geração dentro do fetchColumn) e o .finally dela não
    // devolve a vaga de quem entrou depois.
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
  }, [enabled, db, columns, fetchColumn]);

  useEffect(() => {
    loadAllColumns();
    // Sair da aba (ou trocar os marcos) invalida o que estava no ar.
    return () => { generation.current += 1; };
    // columnsKey representa `columns` (e loadAllColumns), que muda de identidade
    // a cada render no consumidor; fetchColumn é derivado de db, cutoffMs e
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

  // Patch RASO na cópia local de um lead já carregado, em qualquer coluna.
  //
  // Existe para o desfecho que muda SÓ um campo do documento (recusar a
  // renovação e desfazer) não precisar refazer o board. Recarregar ali custava
  // caro e mentia: o reload zera os cursores e devolve TODAS as colunas para os
  // 10 primeiros, então quem paginou perde o lugar — e o card que veio da
  // página 2 e foi para a Perda SOME da tela, porque a coluna do marco volta
  // sem ele e a Perda só mostra recusados das páginas carregadas.
  //
  // Não busca nada, então fica FORA das duas travas de concorrência do arquivo:
  //   • inFlight é a vaga da busca de uma coluna — tomar essa vaga aqui só
  //     barraria um "carregar mais" legítimo que estivesse no ar;
  //   • a geração invalida busca vencida — e este patch nunca fica velho: ele
  //     parte de `prev` dentro do próprio setState, então o que a busca em voo
  //     acabar de escrever já está lá quando ele roda.
  // Pelo mesmo motivo não encosta em cursor nem em hasMore: a página continua
  // sendo exatamente a mesma, só com um campo diferente.
  const patchLead = useCallback((id, patch) => {
    if (!id) return;
    setPages((prev) => {
      let mudou = false;
      const next = {};
      // Cópia IMUTÁVEL: mutar o objeto do lead (ou o array da coluna) no lugar
      // manteria as mesmas identidades, o useMemo do split não recalcularia e a
      // tela ficaria parada mostrando o card onde ele não está mais.
      Object.keys(prev).forEach((days) => {
        const lista = prev[days] || [];
        if (!lista.some((l) => l?.id === id)) { next[days] = prev[days]; return; }
        mudou = true;
        next[days] = lista.map((l) => (l?.id === id ? { ...l, ...patch } : l));
      });
      // Lead que não está em página nenhuma não gera render à toa.
      return mudou ? next : prev;
    });
  }, []);

  // `reload` refaz a carga inicial de todas as colunas. O board é uma foto
  // (getDocs, não onSnapshot), então quem grava um desfecho que MUDA A FAIXA do
  // card (renovação fechada: a vigência nova tira o cliente da janela) precisa
  // pedir a foto nova. Para o que só muda um campo existe o patchLead.
  return { pages, hasMore, loading, loadMore, reload: loadAllColumns, patchLead };
}
