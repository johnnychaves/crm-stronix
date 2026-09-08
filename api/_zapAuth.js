// Chave de integração do Stronizap. Emitida pelo Stronilead, porque o CRM é
// dono da identidade do tenant. Guardada aqui só como hash: o valor em claro
// aparece uma vez na tela e nunca mais.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'szk_';
const SECRET_BYTES = 24; // 48 chars em hex + 4 do prefixo = 52

export function hashZapKey(key) {
  return createHash('sha256').update(String(key ?? ''), 'utf8').digest('hex');
}

export function generateZapKey() {
  const key = `${PREFIX}${randomBytes(SECRET_BYTES).toString('hex')}`;
  return { key, keyPrefix: key.slice(0, 12), keyHash: hashZapKey(key) };
}

// Comparação em tempo constante, no mesmo espírito do verifyWebhookToken que o
// Stronizap já usa no webhook do Asaas.
export function verifyZapKey(key, storedHash) {
  if (typeof key !== 'string' || typeof storedHash !== 'string') return false;
  if (storedHash.length !== 64) return false;
  const a = Buffer.from(hashZapKey(key), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
