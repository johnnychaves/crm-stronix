// Foto de lead/cliente: processamento client-side (canvas) + upload/delete no
// Firebase Storage. Ponto único e testável — a UI (EditLeadModal) só orquestra.
//
// Fluxo: o arquivo escolhido é validado (isSupportedImage), recortado no
// quadrado central e reduzido para <=512px em JPEG (processImageToSquareBlob),
// e só no Salvar sobe pro Storage (uploadLeadPhoto). O doc do lead guarda a
// download URL + o caminho do objeto (para poder deletar depois).

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Lado máximo do avatar gravado. Recorte quadrado, sem upscale.
export const LEAD_PHOTO_MAX_PX = 512;
// Teto que a REGRA do Storage também impõe (2MB). O resultado processado fica
// bem abaixo (~50-80KB); o teto é folga/segurança.
export const LEAD_PHOTO_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Guarda de ENTRADA: rejeita arquivos absurdos antes de decodificar no canvas
// (10MB de folga para foto de celular). O processamento derruba pra dezenas de KB.
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

// Valida o arquivo escolhido: precisa ser jpeg/png/webp dentro do teto de entrada.
export function isSupportedImage(file) {
  if (!file) return false;
  if (!SUPPORTED_TYPES.includes(file.type)) return false;
  if (typeof file.size === 'number' && file.size > MAX_INPUT_BYTES) return false;
  return true;
}

// Caminho do objeto no Storage. Espelha o isolamento por tenant do Firestore
// (appId == claim tenantId). Nome fixo: trocar a foto sobrescreve o objeto.
export function leadPhotoPath(appId, leadId) {
  return `tenants/${appId}/leads/${leadId}/avatar.jpg`;
}

// Recorta a imagem no quadrado central, reduz para <=size e re-encoda JPEG 0.85.
// Retorna um Blob pronto pra subir. Depende de DOM (canvas/Image), então roda só
// no navegador — no teste cobrimos as funções puras (path/validação).
export async function processImageToSquareBlob(file, size = LEAD_PHOTO_MAX_PX) {
  const bitmap = await loadBitmap(file);
  const w = bitmap.naturalWidth || bitmap.width;
  const h = bitmap.naturalHeight || bitmap.height;
  const side = Math.min(w, h);
  const sx = Math.max(0, Math.floor((w - side) / 2));
  const sy = Math.max(0, Math.floor((h - side) / 2));
  const out = Math.min(size, side); // não faz upscale de imagem pequena

  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  if (typeof bitmap.close === 'function') bitmap.close();

  return await canvasToJpegBlob(canvas, 0.85);
}

// Sobe o Blob pro Storage e devolve { url (download tokenizada), path }.
export async function uploadLeadPhoto(storage, appId, leadId, blob) {
  const path = leadPhotoPath(appId, leadId);
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}

// Apaga o objeto do Storage. Tolerante a objeto inexistente (não é erro do usuário).
export async function deleteLeadPhoto(storage, path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}

// ── Helpers internos (DOM) ──

// Decodifica o arquivo respeitando a orientação EXIF quando o browser suporta
// createImageBitmap; senão cai no <img>.
function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadViaImage(file));
  }
  return loadViaImage(file);
}

function loadViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao ler a imagem.')); };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao processar a imagem.'))),
      'image/jpeg',
      quality
    );
  });
}
