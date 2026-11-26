import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, EQUIPE_PATH } from '../lib/firebase.js';

// As fichas da equipe, ao vivo. Só o gestor lê (regra de stronix_equipe), e só
// a tela Equipe & acessos assina. A academia entra na chave do estado porque o
// "Acessar como" troca de academia sem desmontar a tela.
export function useEquipeFichas(db) {
  const [estado, setEstado] = useState({ chave: null, fichas: [], erro: null });
  const chave = db ? appId : null;
  useEffect(() => {
    if (!db) return undefined;
    const academia = appId;
    return onSnapshot(
      collection(db, 'artifacts', academia, 'public', 'data', EQUIPE_PATH),
      (snap) => setEstado({ chave: academia, fichas: snap.docs.map((d) => ({ id: d.id, ...d.data() })), erro: null }),
      (erro) => {
        console.error('Erro ao ler as fichas da equipe:', erro?.code || erro);
        setEstado({ chave: academia, fichas: [], erro });
      },
    );
  }, [db]);
  const pronto = estado.chave === chave;
  return { fichas: pronto ? estado.fichas : [], pronto, erro: pronto ? estado.erro : null };
}
