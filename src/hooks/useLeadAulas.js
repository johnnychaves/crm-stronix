// Os registros de aula e visita da pessoa (stronix_aulas), ao vivo, para a
// ficha saber qual freepass a aula pendente ocupa e listar as aulas no cartão.
// Mesmo molde do useLeadFreepasses: null até o primeiro retorno, [] se falhar.
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, AULAS_PATH } from '../lib/firebase.js';
import { getSafeDateOrNull } from '../lib/dates.js';

export function useLeadAulas({ db, leadId, active = true }) {
  const [aulas, setAulas] = useState(null);
  useEffect(() => {
    if (!db || !leadId || !active) return undefined;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH), where('leadId', '==', leadId));
    return onSnapshot(
      q,
      (snap) => setAulas(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (getSafeDateOrNull(a.scheduledFor)?.getTime() || 0) - (getSafeDateOrNull(b.scheduledFor)?.getTime() || 0))
      ),
      (e) => { console.error('useLeadAulas', e); setAulas([]); }
    );
  }, [db, leadId, active]);
  return aulas;
}
