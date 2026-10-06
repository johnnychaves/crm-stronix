import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, ROUTINE_MODELS_PATH } from '../lib/firebase.js';

// Todos os modelos de rotina da academia (tela Rotinas do gestor). enabled
// recebe o listenersActive: sem ele, uma aba esquecida aberta mantém a
// assinatura a noite toda.
//
// A resposta fica guardada com a academia a que pertence (tenantId) e só é
// lida no render quando a chave bate. O "Acessar como" troca de academia sem
// recarregar a página, e sem isso a tela passaria um instante com os modelos
// da academia anterior. O appId é lido quando o effect roda, depois de o app
// já ter trocado de academia. Nada de setState no corpo do effect: o estado só
// muda nas respostas da assinatura.

// Lista fixa para o "ainda sem resposta desta academia": quem usa `models` em
// useMemo ou em dependência de effect não vê uma lista nova a cada render.
const NO_MODELS = [];

export function useRoutineModels({ db, enabled = true, tenantId }) {
  const [snap, setSnap] = useState(null);

  useEffect(() => {
    if (!db || !enabled) return undefined;
    const key = tenantId;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', ROUTINE_MODELS_PATH);
    const unsub = onSnapshot(
      ref,
      (res) => {
        const list = res.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        setSnap({ key, models: list, error: false });
      },
      (err) => {
        console.error('useRoutineModels onSnapshot falhou', err);
        setSnap({ key, models: [], error: true });
      },
    );
    return () => unsub();
  }, [db, enabled, tenantId]);

  // snap null nunca é a resposta de agora, mesmo com tenantId ausente
  // (undefined === undefined).
  const current = snap !== null && snap.key === tenantId;
  const models = current ? snap.models : NO_MODELS;
  const loading = !current;
  const error = current ? snap.error : false;

  return { models, loading, error };
}
