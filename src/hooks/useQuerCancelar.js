// Os alunos que disseram "quer cancelar" nos últimos 30 dias, para o sino do
// gestor. Uma leitura na abertura, como o useHandoffs.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, FALTOSOS_PATH } from '../lib/firebase.js';

export function useQuerCancelar({ db, enabled }) {
  const [itens, setItens] = useState([]);
  useEffect(() => {
    if (!db || !enabled) return undefined;
    let vivo = true;
    const desde = new Date(Date.now() - 30 * 86400000);
    getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', FALTOSOS_PATH), where('querCancelarEm', '>=', desde)))
      .then((s) => { if (vivo) setItens(s.docs.map((d) => ({ id: d.id, ...d.data() }))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [db, enabled]);
  return enabled ? itens : [];
}
