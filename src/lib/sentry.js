// Fiação do Sentry no front. Único arquivo do front que importa o SDK.
// A lógica de limpeza mora em sentryScrub.js, que é puro e testado.

import * as Sentry from '@sentry/react';
import { scrubEvent, scrubBreadcrumb } from './sentryScrub.js';

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
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,

    beforeSend: scrubEvent,
    // O beforeSend só vale para evento de ERRO. Sem esta linha, a amostra de
    // 10% das transações sairia sem limpeza nenhuma, levando a URL inteira
    // (e o token de convite que viaja nela) para o Sentry.
    beforeSendTransaction: scrubEvent,
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
