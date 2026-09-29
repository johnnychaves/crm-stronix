import * as Sentry from '@sentry/node';
import { scrubEvent, scrubBreadcrumb, stripQuery } from '../src/lib/sentryScrub.js';

// Captura de erro nas funções serverless. O arquivo começa com underscore, e
// a Vercel não publica esses como função — o teto de 12 do plano Hobby fica
// intacto.

const DSN = process.env.SENTRY_DSN || '';
let started = false;

// Opções do Sentry, fora do init para o teste conferir o que de fato vai para
// o SDK. Cada trava abaixo foi medida com o SDK de verdade (o script de
// verificação em scripts/), não só lida na documentação — o 10.69 tem mais
// de um caso de opção que existe mas não faz o que o nome promete:
//
//  - corpo do pedido: quem corta é a integração http logo abaixo
//    (`maxIncomingRequestBodySize: 'none'`), não o `httpBodies` — medido que
//    em 10.69 esse campo só é lido pelo middleware do tRPC. O `httpBodies`
//    vazio continua aqui por documentar a intenção e por segurança se uma
//    versão futura voltar a lê-lo, mas hoje ele não impede nada nas funções
//    da api/.
//  - header de requisição: `httpHeaders.request: false` desliga tudo na
//    origem. Chegou a ser tentada uma lista de permitidos (`allow`, com
//    HEADERS_PERMITIDOS — ver src/lib/sentryScrub.js), mas o script provou
//    que ela não filtra evento de erro nesta versão: em 2026-09-17 a chave
//    do Zap (x-stronizap-key) foi reproduzida chegando em claro mesmo com o
//    allow configurado. Daí desligar tudo na origem.
//  - variável local: `stackFrameVariables: false` trava na origem. É o que
//    a função tinha na mão no momento do erro — a chave do Zap e os
//    telefones do lote, no handleMatch — e quem ligar
//    `includeLocalVariables` sem saber disso traria tudo de volta, então o
//    scrubEvent apaga de novo como segunda camada.
//  - cookie: `cookies: false` na origem.
//  - query da URL: `urlQueryParams: false` NÃO funciona nesta versão para
//    evento de erro — medido que a query com telefone (?tenant=...&phone=...)
//    ainda chega no evento bruto com a opção ligada. Continua aqui pela
//    mesma razão do httpBodies (documentar a intenção / segurança numa
//    versão futura), mas quem corta de fato é o stripQuery dentro do
//    scrubEvent (beforeSend) e do scrubBreadcrumb (beforeBreadcrumb),
//    abaixo.
//
// Nada disso substitui o scrubEvent/scrubBreadcrumb como segunda camada: são
// a rede de segurança para quando uma trava de origem se revelar, como as de
// header e query, sem efeito nesta versão do SDK.

// Opções da integração http, exportadas para o teste conferir o valor, e não só
// o nome da integração.
export const HTTP_OPTIONS = { maxIncomingRequestBodySize: 'none' };

// O log de console fica fora do Sentry nas funções da api/. Ele leva uid,
// academia e IP (o do "Esqueci a senha" inclusive), e no Preview o modo log do
// envio escreve o e-mail com o código. O log da Vercel já guarda isso por 1
// hora. As outras migalhas passam pelo scrubBreadcrumb.
function scrubApiBreadcrumb(crumb) {
  return crumb?.category === 'console' ? null : scrubBreadcrumb(crumb);
}

export const SENTRY_OPTIONS = {
  environment: process.env.VERCEL_ENV || 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
    httpHeaders: { request: false, response: false },
    cookies: false,
    urlQueryParams: false,
    stackFrameVariables: false,
  },
  integrations: [Sentry.httpIntegration(HTTP_OPTIONS)],
  // Sem tracing no backend: custo de cold start sem ganho, o objetivo aqui
  // é erro, não performance.
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
  // Sem tracesSampleRate isto não dispara evento nenhum hoje, mas quem ligar
  // rastreamento sem saber que existe beforeSend levaria a query do GET
  // (spans e contexts.trace) sem limpeza — o mesmo motivo que o front trata
  // em src/lib/sentry.js. scrubEvent já cuida de transação (bloco de spans
  // e contexts.trace), então é a mesma função dos dois lados.
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubApiBreadcrumb,
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
      // O captureError espera o envio e nunca lança, então o erro que sobe é
      // sempre o do handler.
      await captureError(err, req);
      throw err;
    }
  };
}

// Manda o erro ao Sentry e espera o envio. O withSentry usa para o erro que
// sobe antes da resposta, e a rota usa no waitUntil, que roda depois dela e
// onde o withSentry não alcança. Sem DSN não faz nada. O flush espera o envio
// porque a função congela quando o trabalho termina, e sem ele o evento morre
// no buffer e nunca chega ao Sentry.
export async function captureError(err, req) {
  try {
    start();
    if (!DSN) return;
    Sentry.captureException(err, { tags: { endpoint: endpointTag(req) } });
    await Sentry.flush(2000);
  } catch {
    // Telemetria não derruba a função.
  }
}
