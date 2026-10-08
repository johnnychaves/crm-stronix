import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH, ROUTINE_MODELS_PATH } from '../lib/firebase.js';

// O modelo que a pessoa segue e os checks dela no dia (cartão da Meta). As
// duas consultas usam só igualdade (array-contains, e consultantId + date),
// que o Firestore resolve sem índice composto. O doneAt sai com
// serverTimestamps 'estimate', para o check aparecer na hora, antes de o
// servidor confirmar.
//
// Cada resposta fica guardada com a pessoa e o dia a que pertence (o modelo,
// com a pessoa; os checks, com a pessoa e o dia), e só é lida no render quando
// a chave bate com a de agora. Assim, uma aba esquecida aberta pela noite, com
// o portão de ociosidade desligando a assinatura, não entrega ao cartão os
// checks de ontem depois da meia-noite, e o "Acessar como", que troca de
// pessoa sem recarregar a página, nunca mostra o modelo nem os checks da
// pessoa anterior. Nada de setState no corpo do effect: o estado só muda nas
// respostas das assinaturas. O loading fica true até chegar o modelo e, se
// houver modelo, os checks do dia.

const EMPTY = new Map();

export function useMyRoutine({ db, enabled = true, userId, dayKey }) {
  const [modelSnap, setModelSnap] = useState(null);
  const [marksSnap, setMarksSnap] = useState(null);

  useEffect(() => {
    if (!db || !enabled || !userId) return undefined;
    const key = userId;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
    const unsub = onSnapshot(
      query(ref, where('followerIds', 'array-contains', userId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        setModelSnap({ key, model: list[0] || null, error: false });
      },
      (err) => {
        console.error('useMyRoutine modelo falhou', err);
        setModelSnap({ key, model: null, error: true });
      },
    );
    return () => unsub();
  }, [db, enabled, userId]);

  useEffect(() => {
    if (!db || !enabled || !userId || !dayKey) return undefined;
    const key = `${userId}|${dayKey}`;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MARKS_PATH);
    const unsub = onSnapshot(
      query(ref, where('consultantId', '==', userId), where('date', '==', dayKey)),
      (snap) => {
        const next = new Map();
        snap.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          const doneAt = typeof data.doneAt?.toDate === 'function' ? data.doneAt.toDate() : null;
          next.set(data.taskId, { id: d.id, doneAt, note: data.note || '' });
        });
        setMarksSnap({ key, marks: next, error: false });
      },
      (err) => {
        console.error('useMyRoutine checks falhou', err);
        setMarksSnap({ key, marks: EMPTY, error: true });
      },
    );
    return () => unsub();
  }, [db, enabled, userId, dayKey]);

  const modelKey = userId || null;
  const marksKey = userId && dayKey ? `${userId}|${dayKey}` : null;
  const model = modelSnap?.key === modelKey ? modelSnap.model : null;
  const marks = marksSnap?.key === marksKey ? marksSnap.marks : EMPTY;
  const loading = !modelKey
    ? false
    : (modelSnap?.key !== modelKey || (model !== null && marksSnap?.key !== marksKey));
  const error = Boolean(
    (modelSnap?.key === modelKey && modelSnap.error) || (marksSnap?.key === marksKey && marksSnap.error),
  );

  return { model, marks, loading, error };
}
