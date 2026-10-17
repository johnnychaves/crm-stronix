import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH } from './firebase.js';

// Leads lidos do Firestore na hora de excluir ou renomear um item das
// Configurações, e não da lista que a tela carregou ao abrir. Aquela lista é
// uma foto (getDocs), e o lead que um consultor cadastrou ou mudou depois dela
// passaria pela trava de "em uso" ou ficaria fora da cascata do renomear, com
// um nome que não existe mais. Uma consulta de um campo só, que não pede
// índice composto. O Migrar leads faz a mesma coisa pelo dono.
export async function leadsWhere(db, field, op, value) {
  const snap = await getDocs(query(
    collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
    where(field, op, value),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
