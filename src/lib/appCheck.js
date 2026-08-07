// Firebase App Check: carimba toda requisição ao Firebase provando que ela
// nasceu no app legítimo. Cobre o Auth e o Firestore, inclusive a chamada
// direta à API de login, que é o furo que um CAPTCHA no formulário não fecha,
// porque o login do Stronilead não passa pelo nosso servidor.
//
// Este módulo sobe o App Check em MODO MONITORAMENTO. Ele não bloqueia nada:
// quem decide bloquear é o enforcement no console do Firebase, ligado depois,
// com métrica na mão. Ver docs/APPCHECK_SETUP.md.

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const env = import.meta.env || {};
const SITE_KEY = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';
const DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || '';

export function initAppCheck(app) {
  // Sem site key o App Check não sobe e o app funciona igual a hoje. É o botão
  // de desligar: basta remover a variável na Vercel e redeployar.
  if (!SITE_KEY) return null;

  // O token de debug PRECISA ser setado antes do initializeAppCheck, senão o
  // SDK já tentou atestar e falhou. Sem isso, no dia em que o bloqueio for
  // ligado, o `npm run dev` para de conversar com o Firebase.
  if (env.DEV) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN || true;
  }

  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Falha aqui não pode derrubar o boot. Em modo monitoramento o custo é só
    // aparecer como não verificado na métrica.
    console.warn('App Check: falhou ao inicializar, seguindo sem atestação.', err);
    return null;
  }
}
