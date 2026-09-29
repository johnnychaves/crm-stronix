import { waitUntil } from '@vercel/functions';
import { checkRateLimit, clientIp } from './_rateLimit.js';
import { mailStatus } from './_mail.js';
import { captureError } from './_sentry.js';
import { requestPasswordReset, confirmPasswordReset } from './_passwordResetFlow.js';
import { realResetDeps } from './_passwordResetRepo.js';
import { passwordPolicyError, PASSWORD_REJECTED_ERROR } from '../src/lib/passwordPolicy.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, isEmailFormat,
  CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, TOO_MANY_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE,
} from '../src/lib/passwordReset.js';

// As duas ações públicas do "Esqueci a senha", servidas pelo tenant-resolve
// para a Vercel continuar com 11 funções (o plano Hobby para em 12). Desenho
// em docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

const WINDOW_MS = 15 * 60 * 1000;

// Toda resposta da troca sai no mínimo neste tempo depois do começo do pedido,
// inclusive a 400, a 429 e a 500. Sem o piso, a troca com um código qualquer
// demora mais quando o e-mail tem conta (leitura da equipe e transação da
// tentativa), e esse tempo entrega quem tem conta sem o dono receber aviso
// nenhum. O pedido de código não precisa dele, porque responde antes do trabalho.
export const CONFIRM_MIN_MS = 1500;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export function isPasswordResetAction(action) {
  return action === RESET_ACTION_REQUEST || action === RESET_ACTION_CONFIRM;
}

export function handlePasswordReset(req, res) {
  return req.body?.action === RESET_ACTION_REQUEST ? handleRequest(req, res) : handleConfirm(req, res);
}

// O que vai para o log quando o trabalho falha: a frase do erro, o status da
// recusa do Resend e o código da queda de rede (err.cause.code), que diz por
// que o envio não saiu. Nunca leva o e-mail, o código nem a senha.
const failureLog = (err) => ({ erro: err?.message || String(err), status: err?.status, causa: err?.cause?.code });

async function handleRequest(req, res) {
  const ip = clientIp(req);
  // Contagem própria: não gasta a cota da marca do login nem a da indicação.
  const rl = await checkRateLimit(`pw-reset-request:${ip}`, { limit: 5, windowMs: WINDOW_MS });
  if (!rl.ok) return res.status(429).json({ error: TOO_MANY_MESSAGE });
  const email = req.body?.email;
  if (!isEmailFormat(email)) return res.status(400).json({ error: EMAIL_INVALID_MESSAGE });
  if (mailStatus() === 'off') return res.status(503).json({ error: MAIL_OFF_MESSAGE });

  // A resposta sai antes do trabalho, igual exista a conta ou não: nada que
  // dependa da conta pode vir antes desta linha, senão o tempo da resposta
  // entrega quem tem conta. O waitUntil segura a função viva até o pedido
  // terminar, e erro dali em diante vai para o log e para o Sentry. O deps vai
  // direto ao fluxo e nunca copiado: o secret dele não é enumerável, e a cópia
  // o perde.
  res.status(200).json({ ok: true });
  waitUntil(
    requestPasswordReset(email, ip, realResetDeps()).catch(async (err) => {
      console.error('esqueci-a-senha: pedido falhou', failureLog(err));
      await captureError(err, req);
    }),
  );
  return undefined;
}

// O piso de tempo vale para toda resposta, então o trabalho (confirmOutcome)
// devolve o que responder e só esta função responde. O relógio começa antes de
// qualquer trabalho, e a resposta espera o mais demorado dos dois, o trabalho ou
// o piso. Um não soma ao outro.
async function handleConfirm(req, res) {
  const floor = sleep(CONFIRM_MIN_MS);
  const { status, body } = await confirmOutcome(req);
  await floor;
  return res.status(status).json(body);
}

async function confirmOutcome(req) {
  const ip = clientIp(req);
  const rl = await checkRateLimit(`pw-reset-confirm:${ip}`, { limit: 10, windowMs: WINDOW_MS });
  if (!rl.ok) return { status: 429, body: { error: TOO_MANY_MESSAGE } };
  const { email, code, newPassword } = req.body || {};
  // A regra da senha vem antes de tudo e não gasta tentativa.
  const problem = passwordPolicyError(newPassword);
  if (problem) return { status: 400, body: { error: problem, field: 'newPassword' } };
  if (typeof email !== 'string' || typeof code !== 'string') return { status: 400, body: { error: CODE_REFUSED_MESSAGE } };

  try {
    const result = await confirmPasswordReset({ email, code, newPassword, ip }, realResetDeps());
    if (result.ok) return { status: 200, body: { ok: true } };
    if (result.reason === 'password_rejected') {
      return { status: 400, body: { error: PASSWORD_REJECTED_ERROR, field: 'newPassword' } };
    }
    // Uma frase só para qualquer falha de conta ou de código.
    return { status: 400, body: { error: CODE_REFUSED_MESSAGE } };
  } catch (err) {
    console.error('esqueci-a-senha: troca falhou', failureLog(err));
    // O envio ao Sentry pode levar até 2 s (o flush) e a resposta não espera por ele.
    waitUntil(captureError(err, req));
    return { status: 500, body: { error: SAVE_FAILED_MESSAGE } };
  }
}
