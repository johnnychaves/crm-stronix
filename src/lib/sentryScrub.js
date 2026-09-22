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
  // Chave do Zap: szk_ + 48 hex (api/_zapAuth.js, PREFIX + randomBytes(24) em
  // hex). Alfabeto de 16 símbolos e prefixo próprio, então o padrão não pega
  // nada que não seja a própria chave. Primeiro da lista, antes até do CPF,
  // pela mesma razão do CPF vir primeiro: quanto mais específico, mais cedo.
  [/\bszk_[0-9a-f]{48}\b/g, '[chave]'],
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

// A query string carrega segredo. O convite viaja em /?invite=<token>&t=<tenant>
// e o SDK preenche request.url com o href inteiro, então o token chegaria ao
// Sentry mesmo com corpo, cookie e header já removidos. O corte é aqui, e não
// no init, porque este módulo serve o front e as funções da api/.
export function stripQuery(url) {
  if (typeof url !== 'string' || !url) return url;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

// Header de requisição só sai para o Sentry se estiver nesta lista. É lista de
// permitidos, e não de proibidos, porque a de proibidos só conhecia
// authorization e cookie e deixou passar a chave do Zap (x-stronizap-key) em
// 2026-09-17. Qualquer header sensível novo teria o mesmo destino. No front
// ela é a única trava (o SDK do browser não tem opção de origem equivalente).
// Nas funções da api/ ela virou a segunda camada, dentro do scrubEvent: a
// origem (api/_sentry.js) desliga os headers de requisição por completo,
// porque a lista `allow` do SDK não filtrou evento de erro nesta versão.
export const HEADERS_PERMITIDOS = ['content-type', 'content-length', 'user-agent', 'accept', 'x-vercel-id'];

// Chaves em que o SDK guarda URL dentro de span, contexto de trace e breadcrumb.
// url.path é o caminho da tela, que o SDK grava no contexto de toda transação
// de navegação. lcp.url é a maior imagem da tela no pageload: com a foto do
// cliente, é o endereço do Storage com o token de download na query.
const URL_KEYS = ['url', 'url.full', 'url.path', 'http.url', 'to', 'from', 'lcp.url'];

// Seletor do elemento que o SDK anexa às medidas de LCP (lcp.element) e de
// CLS (cls.source.1, cls.source.2...). Leva title e alt do elemento, e o
// Avatar põe o nome do cliente no alt.
function isDomSelectorKey(key) {
  return key === 'lcp.element' || key.startsWith('cls.source.');
}

function stripUrlsIn(bag) {
  if (!bag || typeof bag !== 'object') return bag;
  for (const key of URL_KEYS) {
    if (typeof bag[key] === 'string') bag[key] = stripQuery(bag[key]);
  }
  for (const key of Object.keys(bag)) {
    if (isDomSelectorKey(key) && typeof bag[key] === 'string') bag[key] = redactDomAttrs(bag[key]);
  }
  delete bag['url.query'];
  // Mesma coisa, com o nome que a instrumentação http do backend usa: a
  // query do GET (?tenant=...&phone=...) trafega aqui num breadcrumb de
  // pedido, não só em request.url.
  delete bag['http.query'];
  return bag;
}

// O htmlTreeAsString do SDK anexa aria-label, type, name, title e alt ao seletor
// do elemento clicado. title e alt são justamente onde o app põe nome de cliente
// e o campo "dor" (card do Kanban, Avatar, Agendamentos), então a PII entra pelo
// caminho do DOM, não pela mensagem de erro. Os cinco atributos são fixos no
// código do SDK: a opção dom.serializeAttribute não desliga isso, por isso a
// redação acontece aqui. Tag e classe ficam, que é o valor de diagnóstico.
const DOM_ATTR_RE = /\[(title|alt|aria-label)="[^"]*"\]/g;

export function redactDomAttrs(text) {
  if (typeof text !== 'string') return text;
  return text.replace(DOM_ATTR_RE, '[$1="[redigido]"]');
}

// O endereço da ficha leva o id do lead (/<academia>/ficha/<id>). O SDK copia
// o caminho cru para request.url, para o nome da transação no escopo (que vai
// em todo erro), para as migalhas de navegação e para url.path. A troca usa a
// mesma marca do molde de rota (routeTemplate), então é idempotente e a URL
// limpa agrupa igual à transação. Não distingue maiúscula, porque o endereço
// também é lido sem distinguir. Para em espaço e aspas para não comer o resto
// da frase quando o caminho aparece numa mensagem de erro.
const LEAD_PATH_RE = /(\/ficha\/)[^/?#\s"'<>]+/gi;

export function scrubLeadPath(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(LEAD_PATH_RE, '$1:leadId');
}

// Rede final: troca o id da ficha em qualquer texto do evento, inclusive em
// campo que o SDK venha a acrescentar sem avisar (url.path entrou assim).
// Não usa scrubDeep porque ele para em MAX_DEPTH níveis e apagaria os frames
// do stacktrace. Pula sdkProcessingMetadata: ali ficam objetos vivos do SDK
// (escopo, span), que ele mesmo apaga antes do envio. O WeakSet segura
// referência circular. Só grava quando o texto muda, para não tropeçar em
// objeto congelado que não tinha nada a trocar.
export function scrubLeadPathsDeep(node, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node) || ArrayBuffer.isView(node)) return node;
  seen.add(node);
  for (const key of Object.keys(node)) {
    if (key === 'sdkProcessingMetadata') continue;
    const value = node[key];
    if (typeof value === 'string') {
      const clean = scrubLeadPath(value);
      if (clean !== value) node[key] = clean;
    } else if (value && typeof value === 'object') {
      scrubLeadPathsDeep(value, seen);
    }
  }
  return node;
}

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
      // Variável local é o que a função tinha na mão no momento do erro: a
      // chave do Zap e os telefones do lote, no handleMatch. dataCollection
      // trava isso na origem (stackFrameVariables: false, em api/_sentry.js),
      // mas quem ligar includeLocalVariables sem saber disso traria tudo de
      // volta — por isso a segunda camada apaga de novo aqui.
      for (const frame of entry.stacktrace?.frames ?? []) delete frame.vars;
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
    if (typeof event.request.url === 'string') event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    if (event.request.headers && typeof event.request.headers === 'object') {
      const permitidos = {};
      for (const [nome, valor] of Object.entries(event.request.headers)) {
        if (HEADERS_PERMITIDOS.includes(nome.toLowerCase())) permitidos[nome] = valor;
      }
      event.request.headers = permitidos;
    }
  }

  // Transação (beforeSendTransaction): a URL reaparece nas spans e no contexto
  // de trace, que não passam pelo bloco de request acima.
  if (Array.isArray(event.spans)) {
    for (const span of event.spans) {
      if (!span) continue;
      stripUrlsIn(span.data);
      stripUrlsIn(span.attributes);
      if (typeof span.description === 'string') {
        span.description = maskSensitive(span.description);
        // Só corta quando a descrição carrega uma URL de verdade, para não
        // truncar texto de diagnóstico que por acaso tenha "?".
        if (span.description.includes('://')) span.description = stripQuery(span.description);
      }
    }
  }
  if (event.contexts?.trace) {
    stripUrlsIn(event.contexts.trace.data);
    stripUrlsIn(event.contexts.trace.attributes);
  }

  // Por último, a rede do id da ficha no evento inteiro: event.transaction,
  // request.url, migalhas, contexto de trace e o que mais vier.
  return scrubLeadPathsDeep(event);
}

// beforeBreadcrumb do Sentry: devolver null descarta a migalha. Aqui nada é
// descartado, só redigido — a trilha de cliques é o que explica o erro.
export function scrubBreadcrumb(crumb) {
  // O SDK chama este hook sem try/catch: se algo aqui dentro lançar (um
  // getter exótico em crumb.data, por exemplo — scrubDeep percorre com
  // Object.entries, que dispara getter), a exceção sobe e derruba quem
  // chamou. Falha fechada de propósito: descarta a migalha em vez de
  // arriscar propagar o erro (ou pior, o dado que a migalha carregava).
  try {
    if (!crumb) return crumb;

    if (typeof crumb.message === 'string') {
      const fromDom = String(crumb.category || '').startsWith('ui.');
      crumb.message = maskSensitive(fromDom ? redactDomAttrs(crumb.message) : crumb.message);
    }

    if (crumb.data) crumb.data = stripUrlsIn(scrubDeep(crumb.data));

    // Migalha de navegação leva o endereço de origem e de destino (from/to).
    return scrubLeadPathsDeep(crumb);
  } catch {
    return null;
  }
}

// Campos que a span leva quando a limpeza falha: só identificação e tempo.
const SPAN_SHELL_KEYS = ['span_id', 'trace_id', 'parent_span_id', 'start_timestamp', 'timestamp', 'op', 'origin', 'status'];

function spanShell(span) {
  const shell = { description: '[redigido]', data: {} };
  for (const key of SPAN_SHELL_KEYS) {
    try {
      const value = span[key];
      if (typeof value === 'string' || typeof value === 'number') shell[key] = value;
    } catch {
      // campo que não dá para ler fica de fora
    }
  }
  return shell;
}

// beforeSendSpan do Sentry. A span do INP sai num envelope só dela e não passa
// pelo beforeSend nem pelo beforeSendTransaction. A descrição dela é o seletor
// do elemento tocado (com o alt do Avatar, que é o nome do cliente) e
// data.transaction é o caminho da tela. O SDK também passa por aqui cada span
// de transação antes do beforeSendTransaction, o que não atrapalha, porque a
// limpeza é idempotente. Nunca devolve null: com null o SDK manda a span
// ORIGINAL, sem limpeza. Na falha devolve uma casca sem descrição e sem data.
export function scrubSpan(span) {
  if (!span || typeof span !== 'object') return span;
  try {
    if (typeof span.description === 'string') {
      span.description = maskSensitive(redactDomAttrs(span.description));
      if (span.description.includes('://')) span.description = stripQuery(span.description);
    }
    stripUrlsIn(span.data);
    return scrubLeadPathsDeep(span);
  } catch {
    return spanShell(span);
  }
}
