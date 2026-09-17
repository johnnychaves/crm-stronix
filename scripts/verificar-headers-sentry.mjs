// Confere, com o SDK do Sentry de verdade, que header sensível não sai em
// evento de erro das funções da api/.
//
// Reproduz o vazamento achado em 2026-09-17: da segunda requisição em diante,
// com a instância aquecida, o header x-stronizap-key chegava em claro ao
// evento. Roda em Node puro, fora do vitest, porque o SDK intercepta o http do
// Node e o vitest carrega os módulos do jeito dele.
//
//   node scripts/verificar-headers-sentry.mjs
//
// Nada sai da máquina: o DSN é falso e o beforeSend descarta o evento depois
// de olhar. Sai com código 1 se algum header fora da lista permitida aparecer,
// antes ou depois do scrubEvent.
import http from 'node:http';
import * as Sentry from '@sentry/node';
import { SENTRY_OPTIONS } from '../api/_sentry.js';
import { scrubEvent, HEADERS_PERMITIDOS } from '../src/lib/sentryScrub.js';

const capturas = [];
let iniciado = false;

// Init preguiçoso dentro do handler, como o withSentry faz em produção. É com
// a instância já aquecida que o vazamento aparecia.
const servidor = http.createServer(async (_req, res) => {
  if (!iniciado) {
    Sentry.init({
      ...SENTRY_OPTIONS,
      dsn: 'https://public@o0.ingest.sentry.io/0',
      beforeSend: (evento) => {
        const bruto = evento.request?.headers ? { ...evento.request.headers } : null;
        const limpo = scrubEvent(evento)?.request?.headers ?? null;
        capturas.push({ bruto, limpo });
        return null;
      }
    });
    iniciado = true;
  }
  try {
    throw new Error('Firestore indisponível (simulado)');
  } catch (err) {
    Sentry.captureException(err);
    await Sentry.flush(500);
  }
  res.statusCode = 500;
  res.end();
});

await new Promise((pronto) => servidor.listen(0, pronto));
const { port } = servidor.address();

const chamar = () => new Promise((fim) => {
  const req = http.request(
    {
      port,
      method: 'POST',
      path: '/api/zap?tenant=academia-teste&phone=5511987654321',
      headers: {
        'x-stronizap-key': 'szk_SEGREDO_DE_TESTE',
        authorization: 'Bearer token-de-teste',
        'content-type': 'application/json',
        'user-agent': 'verificar-headers-sentry'
      }
    },
    (res) => { res.resume(); res.on('end', fim); }
  );
  req.end('{"action":"match"}');
});

for (let i = 0; i < 3; i++) await chamar();
servidor.close();

const fora = (headers) =>
  Object.keys(headers ?? {}).filter((nome) => !HEADERS_PERMITIDOS.includes(nome.toLowerCase()));

let vazou = false;
capturas.forEach(({ bruto, limpo }, i) => {
  const foraBruto = fora(bruto);
  const foraLimpo = fora(limpo);
  console.log(`evento ${i + 1}: na origem ${JSON.stringify(bruto)} | depois do scrub ${JSON.stringify(limpo)}`);
  if (foraBruto.length || foraLimpo.length) {
    vazou = true;
    console.log(`  fora da lista: origem [${foraBruto.join(', ')}] | depois do scrub [${foraLimpo.join(', ')}]`);
  }
});

if (capturas.length === 0) {
  console.log('Nenhum evento capturado: a verificação não provou nada.');
  process.exit(1);
}
console.log(vazou ? 'VAZOU header fora da lista.' : 'Nenhum header fora da lista.');
process.exit(vazou ? 1 : 0);
