// Fiação do Sentry no front. Único arquivo do front que importa o SDK.
// A lógica de limpeza mora em sentryScrub.js, que é puro e testado.

import * as Sentry from '@sentry/react';
import { scrubEvent, scrubBreadcrumb, scrubSpan } from './sentryScrub.js';
import { routeTemplate } from './routes.js';

const env = import.meta.env || {};
const DSN = env.VITE_SENTRY_DSN || '';

// Sem DSN o Sentry não sobe. É o botão de desligar: basta remover a variável
// no painel da Vercel e redeployar, sem tocar em código. Também mantém o
// `npm run dev` mudo por padrão.
export function initSentry() {
  if (!DSN) return false;

  Sentry.init({
    dsn: DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT || 'production',
    release: env.VITE_APP_RELEASE || undefined,

    // Corta na origem o que o SDK coletaria sozinho: e-mail, nome de usuário
    // e IP (userInfo), e corpo de requisição e de resposta (httpBodies).
    // Substitui o sendDefaultPii, que saiu de uso na v10.57 e some na v11.
    // O scrubEvent continua como segunda camada, para o que passar daqui.
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },

    // Session Replay fica de fora. Ele grava a tela, e a tela tem ficha de
    // lead aberta. Decisão de privacidade, não de esforço.
    integrations: [
      Sentry.browserTracingIntegration({
        // O nome da transação é o molde da tela (/:tenant/pipeline,
        // /:tenant/ficha/:leadId), nunca o endereço de verdade. O nome vai
        // no cabeçalho de amostragem, que não passa pelo beforeSend, então
        // não pode levar academia nem id de lead. O molde sai de
        // options.name, que é o caminho da página no pageload e o caminho de
        // DESTINO na navegação. O SDK chama este gancho antes de o endereço
        // trocar, então ler window.location aqui daria o molde da tela de
        // antes. A integração do React Router do Sentry não entra porque
        // exige <Routes>, e o app não usa. O SDK ainda grava o caminho cru no
        // escopo (vai em todo erro) e em url.path: quem limpa isso é o
        // sentryScrub.
        beforeStartSpan: (options) => ({ ...options, name: routeTemplate(options.name) }),
      }),
    ],
    tracesSampleRate: 0.1,

    beforeSend: scrubEvent,
    // O beforeSend só vale para evento de ERRO. Sem esta linha, a amostra de
    // 10% das transações sairia sem limpeza nenhuma, levando a URL inteira
    // (e o token de convite que viaja nela) para o Sentry.
    beforeSendTransaction: scrubEvent,
    // A span do INP sai num envelope só dela, sem passar pelo beforeSend nem
    // pelo beforeSendTransaction, levando o seletor do elemento tocado (com o
    // nome do cliente no alt do Avatar) e o caminho da tela.
    beforeSendSpan: scrubSpan,
    // Redige nome de cliente e o campo "dor" que o SDK captura sozinho dos
    // atributos title/alt/aria-label do elemento clicado.
    beforeBreadcrumb: scrubBreadcrumb,
  });

  return true;
}

// Só uid, tenantId e role. Nome e e-mail ficam no nosso banco; o cruzamento
// com a pessoa é feito lá, não no Sentry.
export function setSentryUser({ uid, tenantId, role, impersonating }) {
  if (!DSN) return;
  Sentry.setUser(uid ? { id: uid } : null);
  Sentry.setTags({
    tenant: tenantId || 'sem-tenant',
    role: role || 'desconhecido',
    impersonating: impersonating ? 'sim' : 'nao',
  });
}

export function clearSentryUser() {
  if (!DSN) return;
  Sentry.setUser(null);
  Sentry.setTags({ tenant: 'sem-tenant', role: 'desconhecido', impersonating: 'nao' });
}
