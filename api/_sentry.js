import * as Sentry from '@sentry/node';
import { scrubEvent, stripQuery, HEADERS_PERMITIDOS } from '../src/lib/sentryScrub.js';

// Captura de erro nas funções serverless. O arquivo começa com underscore, e
// a Vercel não publica esses como função — o teto de 12 do plano Hobby fica
// intacto.

const DSN = process.env.SENTRY_DSN || '';
let started = false;

// Opções do Sentry, fora do init para o teste conferir o que de fato vai para
// o SDK.
export const SENTRY_OPTIONS = {
  environment: process.env.VERCEL_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  // Mesma trava do front: nada de e-mail, usuário, IP ou corpo de
  // requisição. Aqui o httpBodies vazio é o que mais importa, porque é
  // neste lado que payload de lead trafega.
  //
  // Header, cookie e query também são cortados na origem. O SDK promete
  // filtrar chave e token sozinho, mas isso não vale para evento de erro: em
  // 2026-09-17 a chave do Zap (x-stronizap-key) foi reproduzida chegando em
  // claro. O scrubEvent repete a lista de headers como segunda camada, e
  // scripts/verificar-headers-sentry.mjs confere as duas com o SDK de verdade.
  // A lista `allow` (com HEADERS_PERMITIDOS) chegou a ser tentada aqui, mas o
  // script provou que ela não filtra evento de erro nesta versão do SDK — daí
  // a origem desligar tudo (`request: false`) e o filtro de verdade ficar só
  // no scrubEvent.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
    httpHeaders: { request: false, response: false },
    cookies: false,
    urlQueryParams: false,
  },
  // Sem tracing no backend: custo de cold start sem ganho, o objetivo aqui
  // é erro, não performance.
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
};

// Rótulo do endpoint no evento. A URL do GET carrega ?tenant=...&phone=..., e
// o telefone é dado pessoal.
export function endpointTag(req) {
  return stripQuery(String(req?.url || ''));
}

function start() {
  if (started || !DSN) return;
  Sentry.init({ dsn: DSN, ...SENTRY_OPTIONS });
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
        Sentry.captureException(err, { tags: { endpoint: endpointTag(req) } });
        // A função congela assim que responde. Sem flush explícito o evento
        // morre no buffer e nunca chega ao Sentry.
        await Sentry.flush(2000).catch(() => {});
      }
      throw err;
    }
  };
}
