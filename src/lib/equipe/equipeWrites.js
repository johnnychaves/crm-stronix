// Gravações da ficha da equipe pelo app (o gestor, pelas regras do Firestore).
// A ficha nasce com o id da pessoa na primeira gravação (setDoc com merge),
// então duas abas caem no mesmo documento. Spec
// docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md.
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { appId, EQUIPE_PATH, LEADS_PATH, PROFESSORS_PATH, USERS_PATH, storage } from '../firebase.js';
import { commitOpsInChunks } from '../funnels.js';
import { leadsWhere } from '../settingsLeads.js';
import { isValidLeadId } from '../routes.js';

const docDe = (db, caminho, id) => doc(db, 'artifacts', appId, 'public', 'data', caminho, id);

// Grava os campos de um bloco. Na primeira gravação, a ficha ganha os vínculos
// com o login e o professor, a função, o nome e o status.
export async function gravarBloco(db, pessoa, campos, autor) {
  const nova = !pessoa.ficha;
  await setDoc(docDe(db, EQUIPE_PATH, pessoa.id), {
    ...campos,
    ...(nova ? {
      userId: pessoa.user?.id ?? null,
      professorId: pessoa.professor?.id ?? null,
      funcao: pessoa.funcao,
      nome: campos.nome ?? pessoa.nome,
      status: 'ativo',
      createdAt: serverTimestamp(),
    } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: autor?.id ?? null,
  }, { merge: true });
}

// As modalidades e a foto do professor, que moram no cadastro do professor.
export async function gravarProfessor(db, professorId, campos) {
  await setDoc(docDe(db, PROFESSORS_PATH, professorId), { ...campos, updatedAt: serverTimestamp() }, { merge: true });
}

// O nome novo vai também ao login e ao professor, com as cópias que já existem
// nos leads (consultantName e appointmentProfessorName). Devolve se algum lead
// mudou. Movido do TeamAccessSection (updateMember e saveProfessor).
export async function renomearPessoa(db, pessoa, nome) {
  let leadsMudaram = false;
  if (pessoa.user && pessoa.user.name !== nome) {
    await updateDoc(docDe(db, USERS_PATH, pessoa.user.id), { name: nome });
    const snap = await getDocs(query(
      collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
      where('consultantId', '==', pessoa.user.id),
    ));
    if (!snap.empty) {
      await commitOpsInChunks(db, snap.docs.map((d) => ({ ref: docDe(db, LEADS_PATH, d.id), data: { consultantName: nome } })), 400);
      leadsMudaram = true;
    }
  }
  if (pessoa.professor && pessoa.professor.nome !== nome) {
    await setDoc(docDe(db, PROFESSORS_PATH, pessoa.professor.id), { nome, updatedAt: serverTimestamp() }, { merge: true });
    const leads = await leadsWhere(db, 'appointmentProfessorId', '==', pessoa.professor.id);
    if (leads.length) {
      await commitOpsInChunks(db, leads.map((l) => ({ ref: docDe(db, LEADS_PATH, l.id), data: { appointmentProfessorName: nome } })), 400);
      leadsMudaram = true;
    }
  }
  return leadsMudaram;
}

// Foto de quem não é professor (a do professor mora no cadastro do professor,
// pelo src/lib/professorPhoto.js). Mesmo processamento da foto do lead.
export function equipeFotoPath(id) {
  if (!appId || !isValidLeadId(id)) throw new Error('Pessoa inválida para a foto.');
  return `tenants/${appId}/equipe/${id}/avatar.jpg`;
}
export async function subirFotoDaEquipe(id, blob) {
  const caminho = equipeFotoPath(id);
  const alvo = storageRef(storage, caminho);
  await uploadBytes(alvo, blob, { contentType: 'image/jpeg' });
  return { url: await getDownloadURL(alvo), path: caminho };
}
export async function apagarFotoDaEquipe(caminho) {
  if (!caminho) return;
  try {
    await deleteObject(storageRef(storage, caminho));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
