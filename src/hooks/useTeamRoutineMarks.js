import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH } from '../lib/firebase.js';

// Os checks de hoje da academia inteira, para a aba Hoje da tela Rotinas. A
// consulta é só pelo dia (`date` igual à chave do dia), campo único, que o
// Firestore resolve sem índice, e as regras deixam qualquer membro da academia
// ler. enabled recebe o listenersActive: sem ele, uma aba esquecida aberta
// mantém a assinatura a noite toda.
//
// Devolve marks: Map consultor -> (Map tarefa -> { id, doneAt, note }). O
// doneAt sai com serverTimestamps 'estimate', como no useMyRoutine. Quem decide
// se o check conta é o markDoneAt (src/lib/rotinas.js), na conta da aba.
//
// A resposta fica guardada com a academia e o dia, e só é lida no render
// quando a chave bate com a de agora: o dia que vira com a assinatura desligada
// não entrega os checks de ontem, e o "Acessar como", que troca de academia
// sem recarregar a página, não mostra os checks da academia anterior. Nada de
// setState no corpo do effect: o estado só muda nas respostas da assinatura.

const EMPTY = new Map();

export function useTeamRoutineMarks({ db, enabled = true, tenantId, dayKey }) {
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    if (!db || !enabled || !dayKey) return undefined;
    const key = `${tenantId}|${dayKey}`;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH);
    const unsub = onSnapshot(
      query(ref, where('date', '==', dayKey)),
      (res) => {
        const next = new Map();
        res.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          if (!data.consultantId || !data.taskId) return;
          const doneAt = typeof data.doneAt?.toDate === 'function' ? data.doneAt.toDate() : null;
          if (!next.has(data.consultantId)) next.set(data.consultantId, new Map());
          next.get(data.consultantId).set(data.taskId, { id: d.id, doneAt, note: data.note || '' });
        });
        setSnap({ key, marks: next, error: false });
      },
      (err) => {
        console.error('useTeamRoutineMarks onSnapshot falhou', err);
        setSnap({ key, marks: EMPTY, error: true });
      },
    );
    return () => unsub();
  }, [db, enabled, tenantId, dayKey]);

  const key = dayKey ? `${tenantId}|${dayKey}` : null;
  const current = snap !== null && key !== null && snap.key === key;
  return { marks: current ? snap.marks : EMPTY, loading: !current, error: current ? snap.error : false };
}
