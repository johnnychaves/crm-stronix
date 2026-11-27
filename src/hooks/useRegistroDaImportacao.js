// O registro da última importação (só o gestor lê): os nomes que ela não ligou.
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { appId, IMPORTACOES_NEXTFIT_PATH } from '../lib/firebase.js';

export function useRegistroDaImportacao({ db, id }) {
  const [lido, setLido] = useState({ id: null, registro: null });
  useEffect(() => {
    if (!db || !id) return undefined;
    let vivo = true;
    getDoc(doc(db, 'artifacts', appId, 'public', 'data', IMPORTACOES_NEXTFIT_PATH, id))
      .then((s) => { if (vivo) setLido({ id, registro: s.exists() ? s.data() : null }); })
      .catch(() => { if (vivo) setLido({ id, registro: null }); });
    return () => { vivo = false; };
  }, [db, id]);
  return lido.id === id ? lido.registro : null;
}
