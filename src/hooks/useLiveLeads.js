// Lista de leads ao vivo (onSnapshot), para as telas que leem a coleção inteira
// a cada visita: Todos os leads e Configurações.
//
// Antes elas usavam o usePagedLeads, que é leitura única (getDocs), e a leitura
// única sempre vem inteira do servidor: 1.019 leituras na STRONIX a cada
// entrada, umas 12 mil por dia nas duas telas (medição de 09/10/2026). Com a
// leitura ao vivo, o cache persistente do Firestore (src/lib/firebase.js) guarda
// o ponto em que a consulta parou, e quem volta à tela em até 30 minutos paga
// só os leads que mudaram. As duas telas usam a mesma consulta, então passar de
// uma para a outra também aproveita.
//
// A lista só aparece depois da primeira resposta do servidor, como no getDocs:
// a resposta do cache pode vir incompleta, e Configurações usa a lista para não
// deixar apagar etapa ou catálogo em uso. Depois dela, toda mudança entra, até
// a gravação local que ainda não chegou ao servidor.
//
// `enabled` recebe o portão de inatividade (listenersActive): parado, a leitura
// desliga e a lista continua na tela; na volta, religa.
//
// A resposta é guardada junto com o specKey que a pediu (derive-in-render): o
// effect só escreve dentro dos retornos do onSnapshot, nunca no corpo.
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { appId } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';

// Logo depois do login a consulta pode sair antes de o token levar a academia,
// e o acesso negado se cura sozinho em centenas de milissegundos (o mesmo caso
// do getDocsWithAuthRetry). Três novas tentativas, e depois o erro fica.
const RETRY_DELAYS_MS = [300, 600, 1200];

const VAZIO = { key: null, items: [], error: null };

export function useLiveLeads({ db, path, spec, specKey, mapDoc, enabled = true }) {
  const active = Boolean(enabled && db && spec);
  const [result, setResult] = useState(VAZIO);

  useEffect(() => {
    if (!active) return undefined;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', path);
    const q = query(colRef, ...specToConstraints(spec));
    let unsubscribe = null;
    let retryTimer = null;
    let attempt = 0;
    let fromServer = false;

    const listen = () => {
      unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
        if (snap.metadata.fromCache && !fromServer) return;
        fromServer = true;
        attempt = 0;
        const items = snap.docs.map((d) => (mapDoc ? mapDoc(d) : { id: d.id, ...d.data() }));
        setResult({ key: specKey, items, error: null });
      }, (error) => {
        if (error?.code === 'permission-denied' && attempt < RETRY_DELAYS_MS.length) {
          retryTimer = setTimeout(listen, RETRY_DELAYS_MS[attempt]);
          attempt += 1;
          return;
        }
        console.error('useLiveLeads', path, error);
        setResult((prev) => ({ key: specKey, items: prev.key === specKey ? prev.items : [], error }));
      });
    };
    listen();

    return () => {
      clearTimeout(retryTimer);
      unsubscribe?.();
    };
    // spec e mapDoc entram pelo specKey: a spec é recriada a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, db, path, specKey]);

  const current = result.key === specKey;
  return {
    items: current ? result.items : [],
    loading: active && !current,
    error: current ? result.error : null,
  };
}
