import * as Sentry from '@sentry/node';
import { scrubEvent } from '../src/lib/sentryScrub.js';

// Captura de erro nas funções serverless. O arquivo começa com underscore, e
// a Vercel não publica esses como função — o teto de 12 do plano Hobby fica
// intacto.

const DSN = process.env.SENTRY_DSN || '';
let started = false;

function start() {
  if (started || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    // Mesma trava do front: nada de e-mail, usuário, IP ou corpo de
    // requisição. Aqui o httpBodies vazio é o que mais importa, porque é
    // neste lado que payload de lead trafega.
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    // Sem tracing no backend: custo de cold start sem ganho, o objetivo aqui
    // é erro, não performance.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
  started = true;
}

// Envolve um handler da Vercel. Repassa o erro depois de capturar, para o
// comportamento de resposta continuar exatamente o de hoje.
export function withSentry(handler) {
  return async function sentryWrapped(req, res) {
    start();
    try {
      return await handler(req, res);
    } catch (err) {
      if (DSN) {
        Sentry.captureException(err, { tags: { endpoint: String(req?.url || '') } });
        // A função congela assim que responde. Sem flush explícito o evento
        // morre no buffer e nunca chega ao Sentry.
        await Sentry.flush(2000).catch(() => {});
      }
      throw err;
    }
  };
}
