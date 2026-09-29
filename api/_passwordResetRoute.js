import { waitUntil } from '@vercel/functions';
import { checkRateLimit, clientIp } from './_rateLimit.js';
import { mailStatus } from './_mail.js';
import { captureError } from './_sentry.js';
import { requestPasswordReset, confirmPasswordReset } from './_passwordResetFlow.js';
import { realResetDeps } from './_passwordResetRepo.js';
import { passwordPolicyError, PASSWORD_REJECTED_ERROR } from '../src/lib/passwordPolicy.js';
import {
  RESET_ACTION_REQUEST, RESET_ACTION_CONFIRM, isEmailFormat,
  CODE_REFUSED_MESSAGE, MAIL_OFF_MESSAGE, TOO_MANY_MESSAGE, EMAIL_INVALID_MESSAGE, SAVE_FAILED_MESSAGE, SEND_FAILED_MESSAGE,
} from '../src/lib/passwordReset.js';

// As duas ações públicas do "Esqueci a senha", servidas pelo tenant-resolve
// para a Vercel continuar com 11 funções (o plano Hobby para em 12). Desenho
// em docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

const WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Limites por IP. O pedido tem dois: a janela de 15 minutos reinicia 96 vezes
// por dia e, sozinha, deixaria um IP fazer 480 pedidos em 24 horas.
const REQUESTS_PER_WINDOW = 5;
const REQUESTS_PER_DAY = 20;
const CONFIRMS_PER_WINDOW = 10;

// Toda resposta da troca que passa pelo limitador, inclusive a 400 e a 500, sai
// no mínimo neste tempo depois de ligado o piso. Sem o piso, a troca com um
// código qualquer demora mais quando o e-mail tem conta (leitura da equipe e
// transação da tentativa), e esse tempo entrega quem tem conta sem o dono
// receber aviso nenhum. O piso precisa ficar acima do trabalho mais lento, e
// por isso cada troca registra no log quanto o trabalho levou (ms): um ms perto
// do piso pede piso maior. O 415 e a 429 saem antes dele, porque dependem só do
// pedido e do IP. O pedido de código não precisa do piso, porque responde antes
// do trabalho.
export const CONFIRM_MIN_MS = 2500;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// A chave do limite por IP. No IPv6 vale o bloco /64: quem recebe uma rede IPv6
// tem bilhões de endereços e trocaria de IP a cada tentativa para fugir do
// limite. O IPv4 fica como veio, e o IPv4 mapeado ('::ffff:1.2.3.4') vale o IPv4
// dele, para o mesmo cliente não ganhar duas cotas. Texto que não é endereço
// também fica como veio.
export function rateKeyIp(ip) {
  const text = String(ip ?? '').trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(text);
  if (mapped) return mapped[1];
  if (!text.includes(':')) return text;

  // O '::' vira zeros até completar as 8 partes, e o bloco são as 4 primeiras.
  const halves = text.split('::');
  if (halves.length > 2) return text;
  const partsOf = (s) => (s ? s.split(':') : []);
  const head = partsOf(halves[0]);
  const tail = halves.length === 2 ? partsOf(halves[1]) : [];
  const zeros = halves.length === 2 ? Array(Math.max(0, 8 - head.length - tail.length)).fill('0') : [];
  const block = [...head, ...zeros, ...tail].slice(0, 4);
  if (block.length < 4 || !block.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) return text;
  return block.map((part) => parseInt(part, 16).toString(16)).join(':');
}

export function isPasswordResetAction(action) {
  return action === RESET_ACTION_REQUEST || action === RESET_ACTION_CONFIRM;
}

// O corpo só vale em JSON: o content-type começa com application/json, em
// maiúsculas ou minúsculas, com ou sem "; charset=...". O parser da Vercel
// também transforma application/x-www-form-urlencoded em objeto, e um
// <form method="post"> de outro site chega aqui sem preflight, com o IP de quem
// abriu a página. A tela manda JSON (postResetAction, em src/lib/passwordReset.js).
function isJsonBody(req) {
  return /^application\/json\s*(;|$)/i.test(String(req.headers?.['content-type'] ?? '').trim());
}

// O 415 sai antes de tudo: antes do limitador, antes do 200 do pedido e antes
// do piso da troca. Ele não diz nada sobre contas. Só as duas ações do
// "Esqueci a senha" passam por aqui; a indicação não olha o content-type.
export function handlePasswordReset(req, res) {
  const isRequest = req.body?.action === RESET_ACTION_REQUEST;
  if (!isJsonBody(req)) return res.status(415).json({ error: isRequest ? SEND_FAILED_MESSAGE : SAVE_FAILED_MESSAGE });
  return isRequest ? handleRequest(req, res) : handleConfirm(req, res);
}

// O que vai para o log quando o trabalho falha: a frase do erro, o status da
// recusa do Resend, o código do erro (os do Firebase, como auth/internal-error)
// e o código da queda de rede (err.cause.code), que diz por que o envio não
// saiu. Nunca leva o e-mail, o código nem a senha.
const failureLog = (err) => ({
  erro: err?.message || String(err),
  status: err?.status,
  codigo: err?.code,
  causa: err?.cause?.code,
});

async function handleRequest(req, res) {
  const ip = clientIp(req);
  const ipKey = rateKeyIp(ip);
  // Contagem própria: não gasta a cota da marca do login nem a da indicação. O
  // limite do dia vem depois do de 15 minutos, então o pedido barrado na janela
  // não gasta a cota do dia.
  const rl = await checkRateLimit(`pw-reset-request:${ipKey}`, { limit: REQUESTS_PER_WINDOW, windowMs: WINDOW_MS });
  if (!rl.ok) return res.status(429).json({ error: TOO_MANY_MESSAGE });
  const daily = await checkRateLimit(`pw-reset-request-day:${ipKey}`, { limit: REQUESTS_PER_DAY, windowMs: DAY_MS });
  if (!daily.ok) return res.status(429).json({ error: TOO_MANY_MESSAGE });
  const email = req.body?.email;
  if (!isEmailFormat(email)) return res.status(400).json({ error: EMAIL_INVALID_MESSAGE });
  if (mailStatus() === 'off') return res.status(503).json({ error: MAIL_OFF_MESSAGE });

  // A resposta sai antes do trabalho, igual exista a conta ou não: nada que
  // dependa da conta pode vir antes desta linha, senão o tempo da resposta
  // entrega quem tem conta. O waitUntil segura a função viva até o pedido
  // terminar, e erro dali em diante vai para o log e para o Sentry. O trabalho
  // começa dentro de uma promessa, para um erro do próprio realResetDeps cair no
  // mesmo catch e o waitUntil, que só aceita promessa, receber sempre uma. O deps
  // vai direto ao fluxo e nunca copiado: o secret dele não é enumerável, e a
  // cópia o perde.
  res.status(200).json({ ok: true });
  waitUntil(
    Promise.resolve()
      .then(() => requestPasswordReset(email, ip, realResetDeps()))
      .catch(async (err) => {
        console.error('esqueci-a-senha: pedido falhou', failureLog(err));
        await captureError(err, req);
      }),
  );
  return undefined;
}

// A troca. O 415 já saiu no handlePasswordReset, e a 429 sai aqui na hora,
// antes de ligar o piso: ela depende só do IP e não diz nada sobre contas. Com
// o piso, cada pedido barrado ocuparia a função 2,5 s em vez de uns 100 ms, e
// isso gasta o tempo de função do plano Hobby. Todo o resto espera o piso: o
// trabalho (confirmOutcome) devolve o que responder e só esta função responde,
// depois dele. O relógio do piso começa antes de qualquer trabalho que dependa
// da conta, e a resposta espera o mais demorado dos dois, o trabalho ou o piso:
// um não soma ao outro. Erro inesperado, de dentro ou de fora do fluxo (o
// limitador que lança, por exemplo), também espera o piso e vira 500.
async function handleConfirm(req, res) {
  const ip = clientIp(req);
  let limited = false;
  let limiterError = null;
  try {
    limited = !(await checkRateLimit(`pw-reset-confirm:${rateKeyIp(ip)}`, { limit: CONFIRMS_PER_WINDOW, windowMs: WINDOW_MS })).ok;
  } catch (err) {
    limiterError = err;
  }
  if (limited) return res.status(429).json({ error: TOO_MANY_MESSAGE });

  const started = Date.now();
  const floor = sleep(CONFIRM_MIN_MS);
  let out;
  try {
    if (limiterError) throw limiterError;
    out = await confirmOutcome(req, ip);
  } catch (err) {
    console.error('esqueci-a-senha: troca falhou', failureLog(err));
    // O envio ao Sentry pode levar até 2 s (o flush) e a resposta não espera por ele.
    waitUntil(captureError(err, req));
    out = { status: 500, body: { error: SAVE_FAILED_MESSAGE } };
  }
  // Quanto o trabalho levou, medido antes do piso: é o número que diz se o piso
  // ainda cobre o pior caso. Sem e-mail e sem código.
  console.info('esqueci-a-senha: troca respondida', { status: out.status, ms: Date.now() - started });
  await floor;
  return res.status(out.status).json(out.body);
}

// Devolve o que responder e lança no erro inesperado, que o handleConfirm trata.
async function confirmOutcome(req, ip) {
  const { email, code, newPassword } = req.body || {};
  // A regra da senha vem antes de tudo e não gasta tentativa.
  const problem = passwordPolicyError(newPassword);
  if (problem) return { status: 400, body: { error: problem, field: 'newPassword' } };
  // Mesmo limite de formato do pedido: e-mail que não tem cara de e-mail, ou
  // comprido demais, nem chega ao fluxo.
  if (!isEmailFormat(email) || typeof code !== 'string') return { status: 400, body: { error: CODE_REFUSED_MESSAGE } };

  const result = await confirmPasswordReset({ email, code, newPassword, ip }, realResetDeps());
  if (result.ok) return { status: 200, body: { ok: true } };
  if (result.reason === 'password_rejected') {
    return { status: 400, body: { error: PASSWORD_REJECTED_ERROR, field: 'newPassword' } };
  }
  // Uma frase só para qualquer falha de conta ou de código.
  return { status: 400, body: { error: CODE_REFUSED_MESSAGE } };
}
