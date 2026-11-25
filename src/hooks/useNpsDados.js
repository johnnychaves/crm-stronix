import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, NPS_PESQUISAS_PATH, NPS_RESPOSTAS_PATH, NPS_TOTAIS_PATH } from '../lib/firebase.js';

// As pesquisas de NPS e os totais, ao vivo: as duas coleções são pequenas
// (uma pesquisa por semestre, um total por professor e pesquisa). Com
// `professorId`, os totais vêm só dele, que é a consulta que a regra do
// professor aceita. As assinaturas param com o portão de ociosidade e guardam
// o último valor.
const caminho = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);
const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

function useAoVivo(db, ligado, montar, chave, rotulo) {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    if (!db || !ligado) return undefined;
    return onSnapshot(
      montar(),
      (snap) => setEstado({ chave, lista: lista(snap), erro: null }),
      (err) => {
        console.error(rotulo, err);
        setEstado({ chave, lista: [], erro: err });
      },
    );
    // `montar` muda a cada render; a consulta só depende da chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ligado, chave]);
  // Resposta de outra chave (a pesquisa anterior) não vale para esta.
  return estado?.chave === chave ? estado : null;
}

export function useNpsDados({ db, professorId = null, listenersActive }) {
  const pesquisas = useAoVivo(db, listenersActive, () => caminho(db, NPS_PESQUISAS_PATH), 'pesquisas', 'useNpsDados pesquisas');
  const totais = useAoVivo(
    db,
    listenersActive,
    () => (professorId ? query(caminho(db, NPS_TOTAIS_PATH), where('professorId', '==', professorId)) : caminho(db, NPS_TOTAIS_PATH)),
    `totais:${professorId ?? '*'}`,
    'useNpsDados totais',
  );
  return {
    carregando: !pesquisas || !totais,
    erro: pesquisas?.erro || totais?.erro || null,
    pesquisas: pesquisas?.lista ?? [],
    totais: totais?.lista ?? [],
  };
}

// As respostas de uma pesquisa, só para o gestor (a regra não deixa outro ler).
export function useNpsRespostas({ db, pesquisaId, enabled }) {
  const r = useAoVivo(
    db,
    Boolean(enabled && pesquisaId),
    () => query(caminho(db, NPS_RESPOSTAS_PATH), where('pesquisaId', '==', pesquisaId)),
    `respostas:${pesquisaId}`,
    'useNpsRespostas',
  );
  return { carregando: !r, erro: r?.erro ?? null, respostas: r?.lista ?? [] };
}
