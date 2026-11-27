import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { appId, CONFIG_PATH } from '../lib/firebase.js';
import { trilhasDe } from '../lib/carreira/trilhas.js';

// A assinatura de stronix_config/carreira: as metas de hoje no topo e as
// trilhas no campo `trilhas`. Para com o portão de ociosidade
// (listenersActive) e guarda o último valor. `carreira` é { doc, erro } da
// última resposta, ou null antes da primeira; `trilhas` é null até lá.
const CARREIRA_ID = 'carreira';

export function useCarreira({ db, listenersActive }) {
  const [carreira, setCarreira] = useState(null);
  useEffect(() => {
    if (!db || !listenersActive) return undefined;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID);
    return onSnapshot(
      ref,
      (snap) => setCarreira({ doc: snap.exists() ? snap.data() : null, erro: null }),
      (err) => {
        console.error('useCarreira', err);
        setCarreira({ doc: null, erro: err });
      },
    );
  }, [db, listenersActive]);
  // A Professor, enquanto não foi gravada, sai das metas de hoje (trilhasDe).
  const trilhas = useMemo(() => (carreira ? trilhasDe(carreira.doc) : null), [carreira]);
  return { carreira, trilhas };
}
