// Os freepass da pessoa, ao vivo, para a ficha (aba Contratos e a janela de
// lançar). `active` é o portão de ociosidade do App, como no useLeadTimeline.
// A ficha remonta por lead, então o hook não reseta entre leads. Devolve null
// até o primeiro retorno (e [] se a leitura falhar).
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, FREEPASS_PATH } from '../lib/firebase.js';
import { getSafeDateOrNull } from '../lib/dates.js';

export function useLeadFreepasses({ db, leadId, active = true }) {
  const [freepasses, setFreepasses] = useState(null);
  useEffect(() => {
    if (!db || !leadId || !active) return undefined;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', FREEPASS_PATH), where('leadId', '==', leadId));
    return onSnapshot(
      q,
      (snap) => setFreepasses(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (getSafeDateOrNull(b.startsAt)?.getTime() || 0) - (getSafeDateOrNull(a.startsAt)?.getTime() || 0))
      ),
      (e) => { console.error('useLeadFreepasses', e); setFreepasses([]); }
    );
  }, [db, leadId, active]);
  return freepasses;
}
