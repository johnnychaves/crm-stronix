import { adminDb } from './_firebaseAdmin.js';

// Limitador de taxa simples por chave (ex.: IP), usando Firestore — sem infra
// extra (Redis/KV). Janela fixa: até `limit` requisições por `windowMs`.
//
// FAIL-OPEN por design: se a própria checagem falhar (erro de transação, etc.),
// NÃO bloqueia a requisição — evita derrubar usuários legítimos por causa do
// limitador. Os docs ficam em /_ratelimit/{chave} (coleção nunca acessada pelo
// cliente — negada por padrão nas Firestore Rules; só o Admin SDK escreve).

const sanitizeKey = (key) =>
  encodeURIComponent(String(key)).replace(/[~/[\]*.#$]/g, '_').slice(0, 256);

export async function checkRateLimit(key, { limit = 10, windowMs = 10 * 60 * 1000 } = {}) {
  if (!key) return { ok: true };
  const ref = adminDb.collection('_ratelimit').doc(sanitizeKey(key));
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const nowMs = Date.now();
      const data = snap.exists ? snap.data() : null;

      if (data && typeof data.windowStartMs === 'number' && (nowMs - data.windowStartMs) < windowMs) {
        const count = Number(data.count || 0);
        if (count >= limit) {
          return { ok: false, retryAfterMs: windowMs - (nowMs - data.windowStartMs) };
        }
        tx.update(ref, { count: count + 1 });
        return { ok: true };
      }

      // primeira requisição da janela (ou janela expirada → reinicia).
      // expiresAt permite limpeza automática via TTL policy do Firestore (campo
      // `expiresAt`, configurada no console) — evita que /_ratelimit cresça sem fim.
      tx.set(ref, { count: 1, windowStartMs: nowMs, expiresAt: new Date(nowMs + windowMs * 2) });
      return { ok: true };
    });
  } catch (err) {
    console.error('checkRateLimit (fail-open):', err?.message || err);
    return { ok: true };
  }
}

// Extrai o IP do cliente a partir dos headers da Vercel.
export function clientIp(req) {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || '';
}
