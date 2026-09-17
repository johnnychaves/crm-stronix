// Docs de lead das vendas dos meses abertos no Gerencial. Servem a um número
// só, a origem do lead que fechou, porque a origem mora no lead e não no
// contrato.
//
// É a única leitura que a tela abre: contratos e planos já chegam pelo
// useGeneralConfig. São cerca de 50 docs por mês aberto, em lotes de 30 e uma
// vez por id na sessão do navegador (leadsPorIdDaSessao, a mesma memória que o
// Operacional usa para a carteira de renovação). Resposta que veio do cache do
// aparelho não entra na memória, para a próxima montagem tentar de novo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { documentId, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { chunk } from '../lib/operacional/queries.js';
import { leadIdsForSales } from '../lib/gerencial/queries.js';
import { colRef, serverDocs, leadsPorIdDaSessao } from './monthSources.js';

export function useGerencialLeads({ db, enabled = true, contracts, monthKeys, liveLeads }) {
  const [seed] = useState(() => new Map(leadsPorIdDaSessao.get(appId)));
  const [fetched, setFetched] = useState(seed);
  const askedRef = useRef(new Set());

  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    const known = new Set([...(liveLeads || []).map((l) => l.id), ...seed.keys(), ...askedRef.current]);
    const ids = leadIdsForSales(contracts, { monthKeys, known });
    if (!ids.length) return undefined;
    ids.forEach((id) => askedRef.current.add(id));
    chunk(ids).forEach((part) => {
      const q = query(colRef(db, LEADS_PATH), where(documentId(), 'in', part));
      serverDocs(q)
        .then((snapDocs) => {
          const docs = snapDocs.map(normalizeLeadDoc);
          if (!leadsPorIdDaSessao.has(tenant)) leadsPorIdDaSessao.set(tenant, new Map());
          docs.forEach((l) => leadsPorIdDaSessao.get(tenant).set(l.id, l));
          setFetched((prev) => {
            const next = new Map(prev);
            docs.forEach((l) => next.set(l.id, l));
            return next;
          });
        })
        // A origem é o único número que depende disso: falhar aqui deixa as
        // vendas em "Sem origem", e o resto da tela segue inteiro.
        .catch((e) => console.error('gerencial origem', e));
    });
    return undefined;
  }, [db, enabled, contracts, monthKeys, liveLeads, seed]);

  return useMemo(() => {
    const byId = new Map(fetched);
    (liveLeads || []).forEach((l) => { if (l?.id) byId.set(l.id, l); });
    return byId;
  }, [fetched, liveLeads]);
}
