import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, ROUTINE_MARKS_PATH, ROUTINE_MODELS_PATH } from '../lib/firebase.js';

// O modelo que a pessoa segue e os checks dela no dia (cartão da Meta). As
// duas consultas usam só igualdade (array-contains, e consultantId + date),
// que o Firestore resolve sem índice composto. O doneAt sai com
// serverTimestamps 'estimate', para o check aparecer na hora, antes de o
// servidor confirmar.
export function useMyRoutine({ db, enabled = true, userId, dayKey }) {
  const [model, setModel] = useState(null);
  const [marks, setMarks] = useState(() => new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !enabled || !userId) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
    const unsub = onSnapshot(
      query(ref, where('followerIds', 'array-contains', userId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        setModel(list[0] || null);
        setLoading(false);
      },
      (err) => { console.error('useMyRoutine modelo falhou', err); setLoading(false); },
    );
    return () => unsub();
  }, [db, enabled, userId]);

  useEffect(() => {
    if (!db || !enabled || !userId || !dayKey) return undefined;
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
        setMarks(next);
      },
      (err) => { console.error('useMyRoutine checks falhou', err); },
    );
    return () => unsub();
  }, [db, enabled, userId, dayKey]);

  return { model, marks, loading };
}
