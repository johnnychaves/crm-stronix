import crypto from 'node:crypto';
import {
  RESET_CODE_TTL_MS, RESET_CODE_MAX_ATTEMPTS, RESET_CODES_PER_DAY, RESET_WINDOW_MS,
  isResetCodeFormat,
} from '../src/lib/passwordReset.js';

// Regras do "Esqueci a senha" que só o servidor usa: o sorteio, a impressão
// do código, quem pode receber e as contas que rodam dentro das transações.
// Sem banco e sem rede. Quem usa é o _passwordResetFlow.js e o
// _passwordResetRepo.js. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

// 6 números com zero à esquerda. O sorteio entra por parâmetro para o teste
// escolher o número.
export function generateResetCode(randomInt = (max) => crypto.randomInt(0, max)) {
  return String(randomInt(1_000_000)).padStart(6, '0');
}

// Chave só deste uso, derivada da chave privada do Admin, que já é
// obrigatória. Trocar a chave privada só mata os códigos pendentes. Sem
// segredo lança erro: com chave vazia ou "undefined", qualquer um refaria a
// impressão.
function resetKey(secret) {
  if (typeof secret !== 'string' || !secret) throw new Error('esqueci-a-senha: falta o segredo da impressão');
  return crypto.createHmac('sha256', secret).update('stronilead:password-reset-code').digest();
}

// A impressão que vai para o banco. HMAC com chave do servidor, e não sha256
// puro: 6 números são só 1 milhão de combinações, e quem lesse o banco
// desfaria um sha256 em segundos. O uid na mensagem faz o mesmo código de
// duas contas dar impressões diferentes.
export function hashResetCode(secret, uid, code) {
  return crypto.createHmac('sha256', resetKey(secret)).update(`${uid}:${code}`).digest('hex');
}

export function resetCodeMatches(secret, uid, code, codeHash) {
  // Impressão de outro formato nunca confere. O Buffer.from(..., 'hex') aceita
  // maiúsculas e para no primeiro par inválido, ignorando o lixo que vem depois.
  // Por isso o formato é conferido antes de decodificar.
  if (typeof codeHash !== 'string' || !/^[0-9a-f]{64}$/.test(codeHash)) return false;
  // Só existe código de 6 números.
  if (!isResetCodeFormat(code)) return false;
  const esperado = Buffer.from(hashResetCode(secret, uid, code), 'hex');
  const guardado = Buffer.from(codeHash, 'hex');
  // timingSafeEqual exige o mesmo tamanho. Com o formato conferido acima os dois
  // têm 32 bytes, e esta checagem fica como segunda trava.
  if (esperado.length !== guardado.length) return false;
  return crypto.timingSafeEqual(esperado, guardado);
}

// Por que esta conta não recebe código nem troca a senha, ou null quando pode.
// É o que o login deixaria entrar. O super-admin fica de fora e troca a senha
// pelo scripts/create-super-admin.js.
export function accountRefusal(account) {
  if (!account) return 'unknown_email';
  if (account.superAdmin) return 'superadmin';
  if (account.disabled) return 'account_disabled';
  if (!account.tenantId) return 'no_tenant';
  if (!account.isMember) return 'not_member';
  if (!account.organizationActive) return 'organization_inactive';
  return null;
}

// E-mail sem conta vai para o log assim, nunca inteiro.
export function maskEmail(email) {
  const s = String(email ?? '');
  const at = s.lastIndexOf('@');
  if (at < 1) return '***';
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
}

// Pedido: com 5 códigos nas últimas 24 horas, recusa. Senão devolve o
// documento novo, que escreve por cima do anterior: só o último código vale.
export function planIssue(current, { now, codeHash, tenantId, signInMark, tokensMark }) {
  if (!Number.isFinite(now)) throw new Error('esqueci-a-senha: relógio inválido');
  const recent = (Array.isArray(current?.requestsMs) ? current.requestsMs : [])
    .filter((t) => typeof t === 'number' && now - t < RESET_WINDOW_MS);
  if (recent.length >= RESET_CODES_PER_DAY) return { ok: false, reason: 'daily_limit' };
  return {
    ok: true,
    doc: {
      tenantId,
      codeHash,
      expiresAtMs: now + RESET_CODE_TTL_MS,
      attempts: 0,
      usedAtMs: null,
      signInMark: signInMark ?? null,
      tokensMark: tokensMark ?? null,
      requestsMs: [...recent, now],
    },
  };
}

// Troca: reserva uma tentativa do código vivo e devolve o número dela. Rodando
// dentro da transação, e com a comparação vindo só depois de a reserva ser
// gravada, ela garante no máximo 5 comparações por código.
export function planReserve(current, now) {
  if (!Number.isFinite(now)) throw new Error('esqueci-a-senha: relógio inválido');
  if (!current || typeof current.codeHash !== 'string' || current.usedAtMs != null) return { ok: false };
  if (typeof current.expiresAtMs !== 'number' || current.expiresAtMs <= now) return { ok: false };
  // Contador que não é inteiro conta como esgotado, nunca como zero.
  const { attempts } = current;
  if (!Number.isInteger(attempts) || attempts >= RESET_CODE_MAX_ATTEMPTS) return { ok: false };
  return {
    ok: true,
    attempt: attempts + 1,
    patch: { attempts: attempts + 1 },
    code: { codeHash: current.codeHash, signInMark: current.signInMark ?? null, tokensMark: current.tokensMark ?? null },
  };
}

// Mata o código só se o documento ainda tiver aquele código vivo. Assim um
// caminho atrasado não mata o código novo de um pedido que chegou depois, a
// não ser que o sorteio repita o mesmo código: a impressão sai igual.
export function planKill(current, codeHash, now) {
  if (typeof codeHash !== 'string' || !current || current.codeHash !== codeHash || current.usedAtMs != null) return null;
  return { usedAtMs: now };
}

// A conta mudou desde o pedido? Login novo ou sessões revogadas (troca de
// senha, suspensão da academia) mudam uma das duas marcas.
export function marksChanged(code, account) {
  return (code.signInMark ?? null) !== (account.signInMark ?? null)
    || (code.tokensMark ?? null) !== (account.tokensMark ?? null);
}
