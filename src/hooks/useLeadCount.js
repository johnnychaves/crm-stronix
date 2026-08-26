// Contagem de leads a partir de uma spec pura de leadQueries.js, agregada no
// SERVIDOR (getCountFromServer): 1 leitura por bloco de mil documentos, não uma
// por documento. Serve para badge que precisa do total sem baixar a lista.
//
// Irmão do useFunnelCounts, que conta por funnelId + balde e só aceita
// igualdades. Este aceita qualquer spec, inclusive com faixa de datas, e por
// isso serve aos funis de SISTEMA, cujos cards são clientes projetados por
// query — ninguém tem funnelId apontando para eles, então contar por funil dá
// zero num board cheio.
//
// LIMITE que decide onde este hook pode ser usado: a contagem é exatamente o
// que a query devolve. Se a tela ainda exclui alguém no cliente (o funil
// Renovações tira contrato cancelado e trancado, porque `currentContractStatus`
// não tem backfill e filtrar por ele no servidor derrubaria em silêncio todo
// cliente antigo sem o campo), este número seria MAIOR que o da tela. Nesse
// caso não use — conte sobre o que o board carregou.
//
// Não é ao vivo (getCountFromServer, não onSnapshot).

import { useState, useEffect } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { appId } from '../lib/firebase.js';

// useLeadCount({ db, path, spec, specKey, enabled })
//   spec    : descritor de leadQueries.js — só os `wheres` entram na contagem
//             (orderBy e limit não fazem sentido em agregação).
//   specKey : string estável que muda quando a spec muda; é ela que dispara a
//             recontagem, porque o objeto da spec é recriado a cada render.
// Devolve o número, ou null enquanto não há resposta (e se a contagem falhar).
// null NÃO é zero: quem consome precisa saber a diferença entre "não há
// nenhum" e "ainda não sei".
export function useLeadCount({ db, path, spec, specKey, enabled = true }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!enabled || !db || !spec) {
      setCount(null);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', path);
        const cs = (spec.wheres || []).map((w) => where(w.field, w.op, w.value));
        const snap = await getCountFromServer(query(colRef, ...cs));
        if (vivo) setCount(snap.data().count);
      } catch (err) {
        // Falhar em contar não pode derrubar a tela: volta a null e o badge
        // simplesmente não aparece, em vez de mostrar um zero mentiroso.
        console.error('useLeadCount', path, err);
        if (vivo) setCount(null);
      }
    })();
    return () => { vivo = false; };
    // specKey representa a spec, que é recriada a cada render do consumidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, db, path, specKey]);

  return count;
}
