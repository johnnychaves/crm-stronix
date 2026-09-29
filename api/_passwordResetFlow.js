import { normalizeEmail, isResetCodeFormat, RESET_CODE_MAX_ATTEMPTS } from '../src/lib/passwordReset.js';
import { passwordRejectedByFirebase } from '../src/lib/passwordPolicy.js';
import {
  generateResetCode, hashResetCode, resetCodeMatches, accountRefusal, maskEmail, marksChanged,
} from './_passwordReset.js';
import { buildResetEmail } from './_passwordResetEmail.js';

// O fluxo do "Esqueci a senha" (docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md).
// Tudo que toca o mundo entra por `deps`. As ações usam o realResetDeps() do
// _passwordResetRepo.js, e o teste passa versões falsas:
//   findAccount(email) → conta ou null
//   issueCode(uid, { now, codeHash, tenantId, signInMark, tokensMark }) → { ok, reason? }
//   reserveAttempt(uid, now) → { ok, attempt?, code? }
//   killCode(uid, codeHash, now)
//   setPassword(uid, password), revokeSessions(uid), audit({ uid, tenantId })
//   sendMail({ to, subject, html, text })
//   now(), randomInt(max), secret, log
// Os motivos de recusa vão para o log e nunca para a tela. O código nunca vai
// para o log.

// Quem aparece no log: o uid quando há conta, o e-mail mascarado quando não há.
const who = (account, email) => account?.uid || maskEmail(email);

export async function requestPasswordReset(email, ip, deps) {
  const target = normalizeEmail(email);
  const account = await deps.findAccount(target);
  const refusal = accountRefusal(account);
  if (refusal) {
    deps.log.info('esqueci-a-senha: pedido sem envio', { motivo: refusal, conta: who(account, target), ip });
    return { sent: false, reason: refusal };
  }

  const code = generateResetCode(deps.randomInt);
  const codeHash = hashResetCode(deps.secret, account.uid, code);
  const issued = await deps.issueCode(account.uid, {
    now: deps.now(),
    codeHash,
    tenantId: account.tenantId,
    signInMark: account.signInMark,
    tokensMark: account.tokensMark,
  });
  if (!issued.ok) {
    deps.log.info('esqueci-a-senha: pedido sem envio', { motivo: issued.reason, conta: account.uid, academia: account.tenantId, ip });
    return { sent: false, reason: issued.reason };
  }

  try {
    await deps.sendMail({ to: target, ...buildResetEmail(account.name, code) });
  } catch (err) {
    // A pessoa dona da conta não ficou sabendo do pedido: o código morre logo
    // depois do log, e o pedido continua contando no limite do dia. O log vem
    // primeiro para o diagnóstico não depender do killCode. O erro que sobe é o
    // do envio: a rota captura no waitUntil e manda ao Sentry, porque chave
    // revogada ou domínio sem verificação quebram todo pedido, e o log da
    // Vercel some em 1 hora. A resposta ao navegador já saiu antes, então quem
    // pediu não percebe nada. Se o killCode também falhar, essa falha só vai
    // para o log e nunca esconde o erro do envio.
    deps.log.error('esqueci-a-senha: envio falhou', { conta: account.uid, erro: err?.message || String(err), status: err?.status });
    try {
      await deps.killCode(account.uid, codeHash, deps.now());
    } catch (killErr) {
      deps.log.error('esqueci-a-senha: não matou o código depois da falha no envio', { conta: account.uid, erro: killErr?.message || String(killErr) });
    }
    throw err;
  }
  deps.log.info('esqueci-a-senha: código enviado', { conta: account.uid, academia: account.tenantId, ip });
  return { sent: true };
}

export async function confirmPasswordReset({ email, code, newPassword, ip }, deps) {
  // Código fora do formato não gasta tentativa.
  if (!isResetCodeFormat(code)) return { ok: false, reason: 'bad_format' };
  const target = normalizeEmail(email);
  const account = await deps.findAccount(target);
  const refusal = accountRefusal(account);
  if (refusal) return refuse(deps, refusal, who(account, target), ip);

  // A tentativa é reservada antes de comparar: no máximo 5 comparações por
  // código, mesmo com pedidos ao mesmo tempo. O número vem da reserva, e não
  // de uma leitura anterior, que já pode estar velha.
  const reserved = await deps.reserveAttempt(account.uid, deps.now());
  if (!reserved.ok) return refuse(deps, 'no_live_code', account.uid, ip);
  const { codeHash } = reserved.code;

  if (marksChanged(reserved.code, account)) {
    await deps.killCode(account.uid, codeHash, deps.now());
    return refuse(deps, 'account_changed', account.uid, ip);
  }
  if (!resetCodeMatches(deps.secret, account.uid, code, codeHash)) {
    if (reserved.attempt >= RESET_CODE_MAX_ATTEMPTS) await deps.killCode(account.uid, codeHash, deps.now());
    return refuse(deps, 'wrong_code', account.uid, ip);
  }

  try {
    await deps.setPassword(account.uid, newPassword);
  } catch (err) {
    // Mesma conferência do passwordRejection (api/_auth.js): o SDK entrega a
    // recusa da política como auth/internal-error. O código continua vivo.
    if (!passwordRejectedByFirebase(err)) throw err;
    deps.log.error('esqueci-a-senha: o Firebase recusou uma senha que passou em src/lib/passwordPolicy.js. Alinhe o arquivo com a política do console.', { conta: account.uid });
    return { ok: false, reason: 'password_rejected' };
  }

  // A senha já mudou. Daqui em diante, falha só vai para o log: se o código
  // não for marcado, ele morre do mesmo jeito, porque a troca muda a marca
  // tokensValidAfterTime da conta.
  await deps.killCode(account.uid, codeHash, deps.now()).catch((err) =>
    deps.log.error('esqueci-a-senha: não marcou o código como usado', { conta: account.uid, erro: err?.message || String(err) }));
  await deps.revokeSessions(account.uid).catch((err) =>
    deps.log.error('esqueci-a-senha: não revogou as sessões', { conta: account.uid, erro: err?.message || String(err) }));
  await deps.audit({ uid: account.uid, tenantId: account.tenantId }).catch((err) =>
    deps.log.error('esqueci-a-senha: não gravou a auditoria', { conta: account.uid, erro: err?.message || String(err) }));
  deps.log.info('esqueci-a-senha: senha trocada', { conta: account.uid, academia: account.tenantId, ip });
  return { ok: true };
}

function refuse(deps, reason, conta, ip) {
  deps.log.info('esqueci-a-senha: troca recusada', { motivo: reason, conta, ip });
  return { ok: false, reason };
}
