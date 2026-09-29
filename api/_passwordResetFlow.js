import { normalizeEmail, isResetCodeFormat, RESET_CODE_MAX_ATTEMPTS } from '../src/lib/passwordReset.js';
import { passwordRejectedByFirebase } from '../src/lib/passwordPolicy.js';
import {
  generateResetCode, hashResetCode, resetCodeMatches, accountRefusal, maskEmail, marksChanged,
} from './_passwordReset.js';
import { buildResetEmail } from './_passwordResetEmail.js';

// O fluxo do "Esqueci a senha" (docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md).
// Tudo que toca o mundo entra por `deps`. As ações usam o realResetDeps() do
// _passwordResetRepo.js, e o teste passa versões falsas:
//   findAccount(email) → conta ou null. A conta traz o e-mail que o Firebase
//     guarda (email): o código vai para ele, nunca para o que foi digitado.
//   dailyRoom(uid, now) → se cabe mais um código no dia da conta (só leitura)
//   reserveMailSlot() → se há vaga no teto de e-mails do dia
//   issueCode(uid, { now, codeHash, tenantId, signInMark, tokensMark }) → { ok, reason? }
//   reserveAttempt(uid, now) → { ok, attempt?, code? }
//   killCode(uid, codeHash, now)
//   setPassword(uid, password), revokeSessions(uid), audit({ uid, tenantId })
//   sendMail({ to, subject, html, text })
//   now(), randomInt(max), secret, log (com info, warn e error)
// Os motivos de recusa vão para o log e nunca para a tela. O código nunca vai
// para o log.

// Quem aparece no log: o uid quando há conta, o e-mail mascarado quando não há.
const who = (account, email) => account?.uid || maskEmail(email);

export async function requestPasswordReset(email, ip, deps) {
  const target = normalizeEmail(email);
  const account = await deps.findAccount(target);
  const refusal = accountRefusal(account);
  if (refusal) {
    deps.log.info('esqueci-a-senha: pedido sem envio', { motivo: refusal, conta: who(account, target), academia: account?.tenantId, ip });
    return { sent: false, reason: refusal };
  }

  // A conta que já gastou os 5 códigos do dia para aqui, antes da vaga do teto.
  // Sem isso, o e-mail de um membro só esgotaria o teto sem mandar e-mail. O
  // issueCode confere de novo na transação, e a corrida entre os dois pode
  // gastar uma vaga de vez em quando, o que é aceito.
  if (!(await deps.dailyRoom(account.uid, deps.now()))) {
    deps.log.info('esqueci-a-senha: pedido sem envio', { motivo: 'daily_limit', conta: account.uid, academia: account.tenantId, ip });
    return { sent: false, reason: 'daily_limit' };
  }

  // O teto de e-mails do dia protege a cota do Resend, dividida com o Stronizap.
  // A vaga vem depois da recusa e do espaço do dia, para e-mail inventado e
  // conta sem código disponível não gastarem o teto, e antes do código, para o
  // pedido sem vaga não gastar um dos 5 códigos do dia da pessoa sem mandar
  // e-mail. Teto estourado é sinal de ataque ou de volume real crescendo, e vai
  // para o log como aviso, para aparecer nos filtros de aviso da Vercel.
  if (!(await deps.reserveMailSlot())) {
    deps.log.warn('esqueci-a-senha: pedido sem envio', { motivo: 'mail_cap', conta: account.uid, academia: account.tenantId, ip });
    return { sent: false, reason: 'mail_cap' };
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
    await deps.sendMail({ to: account.email, ...buildResetEmail(account.name, code) });
  } catch (err) {
    // A pessoa dona da conta não soube do pedido: o código morre, e o pedido
    // segue contando no dia. O log vem antes do killCode, que não pode esconder
    // o erro do envio. Esse erro sobe para a rota mandar ao Sentry, porque chave
    // revogada ou domínio sem verificação quebram todo pedido e o log da Vercel
    // some em 1 hora. A resposta ao navegador já saiu, então ninguém percebe.
    deps.log.error('esqueci-a-senha: envio falhou', { conta: account.uid, academia: account.tenantId, ip, erro: err?.message || String(err), status: err?.status });
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
  const target = normalizeEmail(email);
  // Código fora do formato não gasta tentativa e não lê a conta. Só o motivo vai
  // para o log, e nunca o que foi digitado: quem errou um número tem quase o
  // código certo na mão.
  if (!isResetCodeFormat(code)) return refuse(deps, 'bad_format', null, target, ip);
  const account = await deps.findAccount(target);
  const refusal = accountRefusal(account);
  if (refusal) return refuse(deps, refusal, account, target, ip);

  // A tentativa é reservada antes de comparar: no máximo 5 comparações por
  // código, mesmo com pedidos ao mesmo tempo. O número vem da reserva, e não
  // de uma leitura anterior, que já pode estar velha.
  const reserved = await deps.reserveAttempt(account.uid, deps.now());
  if (!reserved.ok) return refuse(deps, 'no_live_code', account, target, ip);
  const { codeHash } = reserved.code;
  // Matar o código nunca muda a resposta: a recusa e a troca valem de qualquer
  // jeito, e a falha só vai para o log.
  const killQuietly = (message) =>
    quietly(deps, account.uid, message, () => deps.killCode(account.uid, codeHash, deps.now()));

  if (marksChanged(reserved.code, account)) {
    await killQuietly('esqueci-a-senha: não matou o código depois da recusa');
    return refuse(deps, 'account_changed', account, target, ip);
  }
  if (!resetCodeMatches(deps.secret, account.uid, code, codeHash)) {
    if (reserved.attempt >= RESET_CODE_MAX_ATTEMPTS) await killQuietly('esqueci-a-senha: não matou o código depois da recusa');
    return refuse(deps, 'wrong_code', account, target, ip);
  }

  try {
    await deps.setPassword(account.uid, newPassword);
  } catch (err) {
    // Mesma conferência do passwordRejection (api/_auth.js): o SDK entrega a
    // recusa da política como auth/internal-error. O código continua vivo. A
    // mensagem do Firebase lista as exigências que faltaram, não a senha, e
    // vai para o log para dizer o que alinhar com o console.
    if (!passwordRejectedByFirebase(err)) throw err;
    deps.log.error('esqueci-a-senha: o Firebase recusou uma senha que passou em src/lib/passwordPolicy.js. Alinhe o arquivo com a política do console.', { conta: account.uid, academia: account.tenantId, ip, erro: err?.message });
    return { ok: false, reason: 'password_rejected' };
  }

  // A senha já mudou. Daqui em diante, falha só vai para o log, inclusive erro
  // síncrono. Se o código não for marcado, ele morre do mesmo jeito: a troca de
  // senha e o revokeRefreshTokens mudam a marca tokensValidAfterTime da conta.
  await killQuietly('esqueci-a-senha: não marcou o código como usado');
  await quietly(deps, account.uid, 'esqueci-a-senha: não revogou as sessões', () => deps.revokeSessions(account.uid));
  await quietly(deps, account.uid, 'esqueci-a-senha: não gravou a auditoria', () => deps.audit({ uid: account.uid, tenantId: account.tenantId }));
  deps.log.info('esqueci-a-senha: senha trocada', { conta: account.uid, academia: account.tenantId, ip });
  return { ok: true };
}

// Passo que não pode mudar a resposta: se falhar, só vai para o log. A função
// roda dentro do try, então pega também o erro síncrono, inclusive o do deps.now().
async function quietly(deps, uid, message, step) {
  try {
    await step();
  } catch (err) {
    deps.log.error(message, { conta: uid, erro: err?.message || String(err) });
  }
}

// Toda recusa da troca vai para o log com o motivo, a conta, a academia e o IP.
// Sem conta, o e-mail sai mascarado e a academia fica de fora.
function refuse(deps, reason, account, target, ip) {
  deps.log.info('esqueci-a-senha: troca recusada', { motivo: reason, conta: who(account, target), academia: account?.tenantId, ip });
  return { ok: false, reason };
}
