import { doc, updateDoc } from 'firebase/firestore';
import { appId, LEADS_PATH } from './firebase.js';
import { buildSectionPatch } from './cadastroSections.js';

// Grava uma seção do Cadastro da ficha. O patch leva só as chaves da seção
// (buildSectionPatch), então duas seções editadas em momentos diferentes nunca
// se sobrescrevem. O lead passado é o que a ficha tem agora: ele só serve para
// montar o formulário completo que o montador de patch exige, e o que está fora
// da seção é descartado antes de gravar. O erro sobe, e quem chama mostra o aviso.
export async function saveCadastroSection({ db, lead, sectionId, form }) {
  const patch = buildSectionPatch(sectionId, form, lead);
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), patch);
  return patch;
}
