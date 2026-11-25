// O QR code do link do NPS em PNG, para o professor imprimir ou mandar no
// WhatsApp. O uqr dá a matriz; o canvas desenha cada módulo como um quadrado
// de `escala` pixels, com a borda branca de 4 módulos que os leitores pedem.
import { encode } from 'uqr';

export function matrizDoQr(texto) {
  return encode(texto, { ecc: 'M', border: 4 }).data;
}

export function qrPngBlob(texto, { escala = 12 } = {}) {
  const matriz = matrizDoQr(texto);
  const lado = matriz.length * escala;
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lado, lado);
  ctx.fillStyle = '#000000';
  matriz.forEach((linha, y) => linha.forEach((preto, x) => { if (preto) ctx.fillRect(x * escala, y * escala, escala, escala); }));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('O navegador não gerou a imagem.'))), 'image/png'));
}

export async function baixarQr(texto, nomeDoArquivo) {
  const url = URL.createObjectURL(await qrPngBlob(texto));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
