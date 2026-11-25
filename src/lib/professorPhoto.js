// Foto do professor (spec 2026-11-24-perfil-do-professor, decisão 13): o mesmo
// processamento da foto do lead (processImageToSquareBlob, em leadPhoto.js),
// noutro caminho do Storage. Quem grava photoUrl e photoPath no professor é o
// gestor (regra de stronix_professores). A regra do Storage deste caminho é
// publicada à mão no console, como a dos leads. A página pública do NPS abre a
// foto pelo link de download, que não passa pela regra.
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { isValidLeadId } from './routes.js';

export function professorPhotoPath(appId, profId) {
  if (!appId || !isValidLeadId(profId)) throw new Error('Professor inválido para a foto.');
  return `tenants/${appId}/professores/${profId}/avatar.jpg`;
}

// Sobe o Blob e devolve { url (download tokenizada), path }.
export async function uploadProfessorPhoto(storage, appId, profId, blob) {
  const path = professorPhotoPath(appId, profId);
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
  return { url: await getDownloadURL(objectRef), path };
}

// Apaga o arquivo. Arquivo que já sumiu não é erro, como em deleteLeadPhoto.
export async function deleteProfessorPhoto(storage, path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
