// Os estados de falta de um professor e os leads deles, para a Meta do
// professor. Ao vivo, com o portão de ociosidade. A academia vai junto do que
// foi lido, para o "Acessar como" não mostrar a lista da academia anterior.
// shortcut: lê todo o histórico do professor (inclusive quem voltou) e filtra no
// navegador, sem índice composto; com muitos alunos, trocar por status ==
// 'faltando' mais professorId e criar o índice.
import { useEffect, useState } from 'react';
import { collection, documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { appId, FALTOSOS_PATH, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { chunk } from '../lib/operacional/queries.js';

const col = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

export function useFaltososDoProfessor({ db, professorId, listenersActive = true }) {
  const [lido, setLido] = useState({ chave: null, estados: [], erro: false });
  const [leads, setLeads] = useState(() => new Map());
  const chave = professorId ? `${appId}:${professorId}` : null;

  useEffect(() => {
    if (!db || !professorId || !listenersActive) return undefined;
    return onSnapshot(
      query(col(db, FALTOSOS_PATH), where('professorId', '==', professorId)),
      (snap) => setLido({
        chave,
        // 'estimate': o feitaEm recém gravado ainda é pendente do servidor e, sem isso,
        // chegaria nulo e a tarefa sumiria de "Feitos nesta semana" até o ack.
        estados: snap.docs.map((d) => ({ id: d.id, leadId: d.id, ...d.data({ serverTimestamps: 'estimate' }) })),
        erro: false,
      }),
      () => setLido({ chave, estados: [], erro: true }),
    );
  }, [db, professorId, listenersActive, chave]);

  const estados = lido.chave === chave ? lido.estados : [];
  const faltam = estados.map((e) => e.id).filter((id) => !leads.has(id)).sort().join(',');

  useEffect(() => {
    if (!db || !faltam) return undefined;
    let vivo = true;
    Promise.all(chunk(faltam.split(','), 30).map((ids) => getDocs(query(col(db, LEADS_PATH), where(documentId(), 'in', ids)))))
      .then((snaps) => {
        if (!vivo) return;
        setLeads((antes) => {
          const nova = new Map(antes);
          snaps.forEach((s) => s.docs.forEach((d) => nova.set(d.id, normalizeLeadDoc(d))));
          return nova;
        });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [db, faltam]);

  return { estados, leadsById: leads, carregando: Boolean(chave) && lido.chave !== chave, erro: lido.chave === chave && lido.erro };
}
