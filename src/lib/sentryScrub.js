// Limpeza de dado pessoal antes de qualquer evento sair para o Sentry.
// Módulo PURO e sem dependências de propósito: roda no browser (front) e em
// node (funções da api/), e os testes o importam sem carregar SDK nenhum.
//
// A ordem dos padrões importa. CPF formatado primeiro, porque a pontuação o
// torna inconfundível. E-mail antes de telefone, para que a sequência de
// dígitos dentro de um endereço não seja comida pelo padrão de telefone.
// As âncoras \b nas pontas do padrão de telefone evitam que ele morda o meio
// de um número longo, como um timestamp em milissegundos.

const PATTERNS = [
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[cpf]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]'],
  // O caractere anterior é capturado e reemitido em vez de usar lookbehind.
  // Lookbehind só existe no Safari a partir do 16.4, e um erro de sintaxe
  // aqui derrubaria o bundle inteiro no boot, não só o mascaramento. Um \b
  // simples também não serve: ele barra o parêntese de "(11) 98765-4321".
  [/(^|[^\d\w])((?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4})(?!\d)/g, '$1[telefone]'],
  // CPF sem pontuação, e qualquer outra sequência de 11 dígitos que não tenha
  // casado como telefone (o padrão acima exige o 9 do celular na 3ª posição).
  [/(^|[^\d])(\d{11})(?!\d)/g, '$1[documento]'],
];

const MAX_DEPTH = 6;

export function maskSensitive(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  for (const [re, label] of PATTERNS) out = out.replace(re, label);
  return out;
}

// Percorre estrutura aninhada aplicando o mascaramento em toda string.
// O teto de profundidade evita laço infinito em objeto com referência
// circular, que aparece de vez em quando em payload de erro.
export function scrubDeep(value, depth = 0) {
  if (depth >= MAX_DEPTH) return undefined;
  if (typeof value === 'string') return maskSensitive(value);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v, depth + 1);
    return out;
  }
  return value;
}

// Ruído conhecido: erro que não é bug nosso e só queima cota do plano gratuito.
const NOISE_MESSAGES = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Extension context invalidated/i,
];

const NOISE_FILES = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-web-extension:\/\//,
];

export function isNoise(event) {
  const values = event?.exception?.values;
  if (!Array.isArray(values) || values.length === 0) return false;

  for (const entry of values) {
    const message = String(entry?.value || '');
    if (NOISE_MESSAGES.some((re) => re.test(message))) return true;

    // O último frame é onde o erro nasceu. Se veio de extensão, não é nosso.
    const frames = entry?.stacktrace?.frames;
    if (Array.isArray(frames) && frames.length > 0) {
      const origin = String(frames[frames.length - 1]?.filename || '');
      if (NOISE_FILES.some((re) => re.test(origin))) return true;
    }
  }
  return false;
}

// beforeSend do Sentry: devolver null descarta o evento.
export function scrubEvent(event) {
  if (!event) return event;
  if (isNoise(event)) return null;

  if (typeof event.message === 'string') event.message = maskSensitive(event.message);

  if (Array.isArray(event.exception?.values)) {
    for (const entry of event.exception.values) {
      if (typeof entry.value === 'string') entry.value = maskSensitive(entry.value);
    }
  }

  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === 'string') crumb.message = maskSensitive(crumb.message);
      if (crumb.data) crumb.data = scrubDeep(crumb.data);
    }
  }

  if (event.extra) event.extra = scrubDeep(event.extra);

  // O corpo da requisição é onde dado de lead trafega no backend. Ele não tem
  // valor de diagnóstico que justifique o risco, então sai inteiro.
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
  }

  return event;
}
