// Identificador da academia no endereço (stronilead.com.br/<academia>/...).
// Puro e sem import: o front (leitura do endereço e formulário do Console), as
// funções da api/ (provision-tenant e tenant-resolve) e os scripts importam
// daqui, para a regra nunca divergir entre eles.

// Leitura do endereço. Mais larga que a de criação para continuar aceitando
// qualquer academia antiga que já tenha link circulando.
export const TENANT_SLUG_READ_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Criação de academia nova: de 3 a 40 caracteres, minúsculas, números e hífen,
// sem hífen nas pontas.
export const TENANT_SLUG_CREATE_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// Palavras que nunca podem ser academia, porque o endereço já usa ou vai usar:
// - api e assets: a Vercel serve esses caminhos antes do app;
// - as palavras de tela do primeiro nível (pipeline, clientes, ficha...): é o
//   que deixa o app ler /pipeline como tela sem academia. Tela nova com
//   primeiro segmento novo entra aqui, e o tenantSlug.test.js quebra se faltar;
// - i, convite e invite: indicação pública e convite;
// - console e super-admin: endereços do super-admin;
// - o resto é precaução.
// Antes de acrescentar uma palavra, confira que nenhuma academia usa esse id,
// senão o link dela passa a abrir outra coisa.
export const RESERVED_TENANT_SLUGS = Object.freeze([
  'api', 'assets', 'static', 'public', 'index', 'favicon', 'robots', 'sitemap', 'manifest', 'service-worker',
  'i', 'convite', 'invite', 'indicacao', 'login', 'entrar', 'sair', 'logout', 'cadastro', 'ativar', 'recuperar-senha',
  'visao-geral', 'pipeline', 'clientes', 'meta-diaria', 'leads', 'configuracoes', 'perfil-da-academia', 'plano-e-faturas', 'ficha', 'super-admin',
  'console', 'admin', 'superadmin', 'painel', 'app', 'www', 'suporte', 'ajuda', 'status', 'stronilead',
]);

const RESERVED = new Set(RESERVED_TENANT_SLUGS);

// Não diferencia maiúscula e ignora espaço nas pontas: 'API' também é reservada.
export function isReservedTenantSlug(s) {
  return typeof s === 'string' && RESERVED.has(s.trim().toLowerCase());
}

// Por que um id NÃO pode virar academia nova: 'formato', 'reservado' ou null
// quando ele serve. Recebe o id do jeito que vai ser gravado (o provisionamento
// já passa aparado e em minúsculas), então não normaliza nada: 'Console' dá
// 'formato', e 'console' dá 'reservado'.
export function tenantSlugProblem(s) {
  if (typeof s !== 'string' || !TENANT_SLUG_CREATE_RE.test(s)) return 'formato';
  if (RESERVED.has(s)) return 'reservado';
  return null;
}
