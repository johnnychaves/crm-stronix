// As aulas experimentais de hoje de um professor, para a Agenda da Meta dele.
// Só leitura (decisão do Johnny, 27/11/2026). O filtro de tipo, professor e
// cancelada é no navegador: a consulta só pede o dia, no índice automático.
// O scheduledFor é gravado como Date (Timestamp), e a consulta usa Date, como o useAulasInWindow.
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, AULAS_PATH } from '../lib/firebase.js';
import { isAulaRecord, AULA_STATUS } from '../lib/aulas.js';

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function useAulasDeHojeDoProfessor({ db, professorId, now, listenersActive = true }) {
  const dia = inicioDoDia(now || new Date());
  const chave = professorId ? `${appId}:${professorId}:${dia}` : null;
  const [lido, setLido] = useState({ chave: null, aulas: [] });

  useEffect(() => {
    if (!db || !professorId || !listenersActive) return undefined;
    return onSnapshot(
      query(
        collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH),
        where('scheduledFor', '>=', new Date(dia)),
        where('scheduledFor', '<=', new Date(dia + 86400000 - 1)),
      ),
      (snap) => setLido({
        chave,
        aulas: snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => isAulaRecord(a) && a.professorId === professorId && a.status !== AULA_STATUS.CANCELLED),
      }),
      () => setLido({ chave, aulas: [] }),
    );
  }, [db, professorId, listenersActive, dia, chave]);

  return lido.chave === chave ? lido.aulas : [];
}
