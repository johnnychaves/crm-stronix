import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, EQUIPE_PATH } from '../lib/firebase.js';

// As fichas da equipe, ao vivo. Só o gestor lê (regra de stronix_equipe), e só
// a tela Equipe & acessos assina. enabled recebe o listenersActive: sem ele,
// uma aba esquecida aberta mantém a assinatura a noite toda. O tenantId entra
// nas dependências e na chave do estado, porque o "Acessar como" troca de
// academia sem desmontar a tela: a assinatura troca junto, e a resposta da
// academia anterior nunca é lida. Nada de setState no corpo do effect.
const SEM_FICHAS = [];

export function useEquipeFichas({ db, enabled = true, tenantId }) {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    if (!db || !enabled) return undefined;
    return onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', EQUIPE_PATH),
      (snap) => setEstado({ chave: tenantId, fichas: snap.docs.map((d) => ({ id: d.id, ...d.data() })), erro: null }),
      (erro) => {
        console.error('Erro ao ler as fichas da equipe:', erro?.code || erro);
        setEstado({ chave: tenantId, fichas: [], erro });
      },
    );
  }, [db, enabled, tenantId]);
  const pronto = estado !== null && estado.chave === tenantId;
  return { fichas: pronto ? estado.fichas : SEM_FICHAS, pronto, erro: pronto ? estado.erro : null };
}
