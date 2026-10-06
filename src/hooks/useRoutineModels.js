import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, ROUTINE_MODELS_PATH } from '../lib/firebase.js';

// Todos os modelos de rotina da academia (tela Rotinas do gestor). enabled
// recebe o listenersActive: sem ele, uma aba esquecida aberta mantém a
// assinatura a noite toda.
export function useRoutineModels({ db, enabled = true }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !enabled) return undefined;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        setModels(list);
        setLoading(false);
      },
      (err) => { console.error('useRoutineModels onSnapshot falhou', err); setLoading(false); },
    );
    return () => unsub();
  }, [db, enabled]);

  return { models, loading };
}
