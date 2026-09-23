// Endereços do app. Tabela única das telas e as regras de ler e montar
// endereço. Puro de propósito (sem React, sem Firebase, sem window): o App lê o
// endereço com parseAppPath e monta link com hrefFor, e tudo isso roda em teste
// no node.
//
// Regras que não podem mudar:
// - O endereço nunca escolhe a academia dos dados. Quem escolhe é o claim
//   tenantId da sessão. O slug do endereço só é conferido contra ele.
// - Nome, telefone, CPF e texto de busca nunca entram no endereço. A ficha leva
//   só o id do documento (isValidLeadId).
// - Parâmetro de query novo nunca pode se chamar invite, t ou ref: o App decide
//   o convite e a indicação pública por eles, antes do roteador.
// - Tela nova com primeiro segmento novo entra também em RESERVED_TENANT_SLUGS
//   (src/lib/tenantSlug.js). O tenantSlug.test.js quebra se faltar.

import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';
import { isAdminUser } from './leads.js';

const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

// Tela do endereço curto /<academia>. Mostra o Operacional.
export const HOME_SCREEN = 'dashboard';

const tela = (segs, title, trava = {}) => Object.freeze({ segs: Object.freeze(segs), title, ...trava });

// Sub-telas: id interno para o segmento em português. Molde da subaba do
// super-admin (SUPER_TABS, abaixo). Elas NÃO entram na screenKey nem no molde
// do Sentry: trocar de seção ou de aba não pode remontar a tela.
export const SETTINGS_SECTIONS = Object.freeze({
  overview: 'visao-geral',
  team: 'equipe',
  transfer: 'transferencia',
  'referral-owners': 'indicacoes',
  import: 'importacao',
  pace: 'ritmo',
  sched: 'agenda',
  funnels: 'funis',
  catalogs: 'catalogos',
  zap: 'stronizap',
});
export const FICHA_TABS = Object.freeze({
  timeline: 'linha-do-tempo',
  crm: 'crm',
  contratos: 'contratos',
  referrals: 'indicacoes',
});

// id da tela (os mesmos valores de activeTab de sempre) para os segmentos
// depois da academia, o título da aba, a trava de acesso e, onde existe, a
// tabela de sub-telas com o padrão de quem abre sem sub-tela no endereço.
export const SCREENS = Object.freeze({
  dashboard: tela([], 'Visão geral'),
  dashOperacional: tela(['visao-geral', 'operacional'], 'Operacional'),
  dashCrm: tela(['visao-geral', 'crm'], 'CRM'),
  dashGerencial: tela(['visao-geral', 'gerencial'], 'Gerencial'),
  kanban: tela(['pipeline'], 'Pipeline'),
  clientes: tela(['clientes'], 'Clientes'),
  dailyGoal: tela(['meta-diaria'], 'Meta diária'),
  leads: tela(['leads'], 'Leads'),
  aulas: tela(['leads', 'aulas'], 'Aulas'),
  visitas: tela(['leads', 'visitas'], 'Visitas'),
  settings: tela(['configuracoes'], 'Configurações', { gestor: true, subs: SETTINGS_SECTIONS, subPadrao: 'team' }),
  profile: tela(['perfil-da-academia'], 'Perfil da academia', { gestor: true }),
  billing: tela(['plano-e-faturas'], 'Plano e faturas', { gestor: true }),
  superadmin: tela(['super-admin'], 'Super-admin', { superAdmin: true }),
  ficha: tela(['ficha'], 'Ficha', { subs: FICHA_TABS, subPadrao: 'timeline' }),
});

// Subabas do super-admin membro de academia: id interno para o segmento.
export const SUPER_TABS = Object.freeze({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
const SUPER_TAB_BY_SEGMENT = Object.fromEntries(Object.entries(SUPER_TABS).map(([id, seg]) => [seg, id]));

// Índice inverso das sub-telas, por tela: segmento em português para id interno.
const SUB_BY_SEGMENT = Object.fromEntries(
  Object.entries(SCREENS)
    .filter(([, def]) => def.subs)
    .map(([id, def]) => [id, Object.fromEntries(Object.entries(def.subs).map(([sub, seg]) => [seg, sub]))]),
);

// Lê o segmento de sub-tela de uma tela que tem tabela. Devolve o id interno,
// ou marca subUnknown quando o segmento não existe ou vem segmento a mais.
// Tela sem tabela continua ignorando o resto calado, como sempre ignorou.
function readSub(screen, extras, out) {
  if (!own(SUB_BY_SEGMENT, screen) || extras.length === 0) return;
  const seg = lower(extras[0]);
  const sub = extras.length === 1 && own(SUB_BY_SEGMENT[screen], seg) ? SUB_BY_SEGMENT[screen][seg] : null;
  if (sub) out.sub = sub;
  else out.subUnknown = true;
}

// Primeiro segmento de cada tela. Todos precisam estar reservados.
export const FIRST_LEVEL_SEGMENTS = Object.freeze([
  ...new Set(Object.values(SCREENS).map((s) => s.segs[0]).filter(Boolean)),
]);

// Índices de leitura, tirados de SCREENS para a tabela morar num lugar só.
// LEAVES: telas de um segmento que aceitam segmentos a mais (vão para `rest`,
// a vaga da entrega 2: /configuracoes/equipe, /ficha/<id>/contratos).
// GROUPS: o segundo segmento escolhe a tela, e filho desconhecido é endereço
// desconhecido, para erro de digitação não cair calado na tela-mãe.
const SPECIAL = new Set(['ficha', 'superadmin']);
const LEAVES = {};
const GROUPS = {};
for (const [id, def] of Object.entries(SCREENS)) {
  if (def.segs.length !== 2) continue;
  if (!own(GROUPS, def.segs[0])) GROUPS[def.segs[0]] = { alone: null, children: {} };
  GROUPS[def.segs[0]].children[def.segs[1]] = id;
}
for (const [id, def] of Object.entries(SCREENS)) {
  if (def.segs.length !== 1 || SPECIAL.has(id)) continue;
  if (own(GROUPS, def.segs[0])) GROUPS[def.segs[0]].alone = id;
  else LEAVES[def.segs[0]] = id;
}
// /visao-geral sozinho abre o Operacional.
GROUPS['visao-geral'].alone = 'dashOperacional';

// Regra do Firestore para id de documento, com teto de 128 caracteres. É o
// único validador de id de lead do app: quem monta e quem lê o endereço usam
// este mesmo.
const CONTROL_CHAR_RE = /\p{Cc}/u;
export function isValidLeadId(id) {
  return typeof id === 'string'
    && id.length >= 1
    && id.length <= 128
    && !id.includes('/')
    && id !== '.'
    && id !== '..'
    && !/^__.*__$/.test(id)
    && !CONTROL_CHAR_RE.test(id);
}

// Segmentos crus do caminho, sem os vazios de barra dupla ou final.
const rawSegments = (pathname) => String(pathname ?? '').split('/').filter(Boolean);

// Segmento malformado (% quebrado) vira null e invalida só ele mesmo.
const decodeSegment = (raw) => {
  try { return decodeURIComponent(raw); } catch { return null; }
};

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : null);

// Lê a tela a partir dos segmentos depois da academia (ou do começo, na tela
// sem academia). Segmento de tela ignora caixa; o id da ficha não, porque id
// do Firestore diferencia maiúscula.
function readScreen(segs, out) {
  const head = lower(segs[0]);
  if (head === 'ficha') {
    out.screen = 'ficha';
    out.leadId = isValidLeadId(segs[1]) ? segs[1] : null;
    out.rest = segs.slice(2);
    readSub('ficha', out.rest, out);
    return;
  }
  if (head === 'super-admin') {
    const child = lower(segs[1]);
    const tab = segs.length === 1 ? 'overview'
      : (segs.length === 2 && own(SUPER_TAB_BY_SEGMENT, child) ? SUPER_TAB_BY_SEGMENT[child] : null);
    if (tab) {
      out.screen = 'superadmin';
      out.superTab = tab;
    } else {
      out.unknown = true;
    }
    return;
  }
  if (own(GROUPS, head)) {
    const { alone, children } = GROUPS[head];
    const child = lower(segs[1]);
    const screen = segs.length === 1 ? alone
      : (segs.length === 2 && own(children, child) ? children[child] : null);
    if (screen) out.screen = screen;
    else out.unknown = true;
    return;
  }
  if (own(LEAVES, head)) {
    out.screen = LEAVES[head];
    out.rest = segs.slice(1);
    readSub(out.screen, out.rest, out);
    return;
  }
  out.unknown = true;
}

// parseAppPath('/stronix-crm-app/ficha/AbC') →
//   { pathname, tenantSlug, screen, leadId, superTab, rest, unknown }
// - raiz: tudo null e unknown false;
// - tenantSlug: o 1º segmento em minúsculas quando tem formato de academia e
//   não é palavra reservada. Senão fica null e o 1º segmento é lido como tela
//   (tela sem academia, como /pipeline);
// - ficha com id inválido ou sem id: screen 'ficha' e leadId null, que é
//   "ficha não encontrada" e não endereço desconhecido;
// - sub: a seção das Configurações ou a aba da ficha, quando o endereço traz
//   um segmento a mais que a tabela da tela conhece. Segmento desconhecido não
//   é endereço desconhecido: vira subUnknown e a decisão de rota abre a
//   tela-mãe com replace, sem aviso.
export function parseAppPath(pathname) {
  const out = {
    pathname: typeof pathname === 'string' ? pathname : '',
    tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
    // Sub-tela: id interno quando o segmento existe na tabela da tela, e
    // subUnknown quando veio segmento que ela não conhece.
    sub: null, subUnknown: false,
  };
  const segs = rawSegments(pathname).map(decodeSegment);
  if (segs.length === 0) return out;
  const first = lower(segs[0]);
  if (first !== null && TENANT_SLUG_READ_RE.test(first) && !isReservedTenantSlug(first)) {
    out.tenantSlug = first;
    if (segs.length === 1) {
      out.screen = HOME_SCREEN;
      return out;
    }
    readScreen(segs.slice(1), out);
    return out;
  }
  readScreen(segs, out);
  return out;
}

const encode = (s) => {
  try { return encodeURIComponent(s); } catch { return null; }
};

// hrefFor('stronix-crm-app', 'kanban') → '/stronix-crm-app/pipeline'.
// Aceita qualquer academia não vazia, com encode, para o link nunca sair
// quebrado; academia com id fora do formato de leitura fica sempre no
// Operacional, porque o endereço não relê o id (hoje nenhuma está nesse caso,
// e a validação do tenantSlug.js impede criar outra). null quando não dá para
// montar (sem academia, ficha sem id válido): quem chama não navega. Tela
// desconhecida vira a inicial.
export function hrefFor(tenantId, screen, opts = {}) {
  const { leadId, superTab, sub } = opts || {};
  if (typeof tenantId !== 'string' || tenantId === '') return null;
  const t = encode(tenantId);
  if (t === null) return null;
  const base = `/${t}`;
  if (!own(SCREENS, screen) || screen === HOME_SCREEN || screen === 'dashOperacional') return base;
  // Sub-tela fora da tabela some do endereço e a tela abre no padrão dela, do
  // mesmo jeito que a subaba do super-admin cai em visao-geral.
  const subs = SCREENS[screen].subs;
  const trecho = subs && own(subs, sub) ? `/${subs[sub]}` : '';
  if (screen === 'ficha') {
    const id = isValidLeadId(leadId) ? encode(leadId) : null;
    return id === null ? null : `${base}/ficha/${id}${trecho}`;
  }
  if (screen === 'superadmin') {
    return `${base}/super-admin/${own(SUPER_TABS, superTab) ? SUPER_TABS[superTab] : SUPER_TABS.overview}`;
  }
  return `${base}/${SCREENS[screen].segs.join('/')}${trecho}`;
}

// O Voltar da ficha só volta pelo navegador quando há tela do app antes dela
// nesta aba. Quem diz isso é o idx que o React Router grava em
// window.history.state: 0 na primeira entrada da aba, +1 a cada push, igual no
// replace. location.key não serve, porque o replace da correção de endereço
// troca a key e mantém o idx. O routes.test.js trava esse contrato na versão
// instalada do react-router.
export function canGoBackInApp(historyState) {
  return Number.isInteger(historyState?.idx) && historyState.idx > 0;
}

// Quem pode ver cada tela. Repete as travas que o App já faz no render
// (isAdminUser nas telas de gestor, appUser.superAdmin no super-admin). Tela
// sem trava, e id que não é tela, passam.
export function canAccess(screen, appUser) {
  if (!own(SCREENS, screen)) return true;
  const def = SCREENS[screen];
  if (def.gestor) return isAdminUser(appUser);
  if (def.superAdmin) return appUser?.superAdmin === true;
  return true;
}

// Avisos da troca de endereço. O App mostra com toast.warning.
export const ROUTE_NOTICES = Object.freeze({
  'so-gestor': 'Essa tela é só do gestor.',
  'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
});

const OK = Object.freeze({ kind: 'ok' });

// `path` é sempre um caminho limpo, que começa com uma barra só (o navigate do
// React Router recusa //host como destino externo). O alvo é a tela que o App
// desenha já neste render, antes de o endereço trocar.
function redirectTo(path, { search = '', notice = null } = {}) {
  const r = parseAppPath(path);
  // O `sub` vai no alvo junto com a tela: sem ele, a correção de academia
  // desenharia a seção padrão por um render antes de saltar para a certa.
  return { kind: 'redirect', to: path + search, target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab, sub: r.sub }, notice };
}

const joinPath = (base, raw) => (raw.length ? `${base}/${raw.join('/')}` : base);

// Regras 6, 7 e 8, sobre um endereço que já é da academia da sessão. A trava de
// tela vem antes da sub-tela: quem não pode ver a tela vai para a inicial com
// aviso, e não para a tela-mãe de uma seção que ele não abriria.
function accessRedirect(route, appUser, home, { tenantId = null, search = '' } = {}) {
  if (route.screen && !canAccess(route.screen, appUser)) {
    return redirectTo(home, { notice: SCREENS[route.screen].gestor ? 'so-gestor' : null });
  }
  if (route.unknown) return redirectTo(home, { notice: 'nao-encontrada' });
  // Regra 8: sub-tela desconhecida abre a tela-mãe, com replace e sem aviso.
  // Erro de digitação na seção não pode punir com perda de contexto, e o aviso
  // de "não achamos essa tela" continua só para endereço de tela.
  if (route.subUnknown) {
    const mae = hrefFor(tenantId, route.screen, { leadId: route.leadId });
    if (mae) return redirectTo(mae, { search });
  }
  return null;
}

// Regra 4, a volta da visualização. Só vale enquanto o endereço ainda é da
// academia que estava assumida, e o caminho guardado é da academia da sessão e
// abre de primeira. Sem isso, o caminho guardado prenderia a pessoa nele.
function returnPathFor(route, appUser, returnTo) {
  const from = returnTo?.fromTenant;
  if (typeof from !== 'string' || from === '' || from === appUser.tenantId) return null;
  if (route.tenantSlug !== from || typeof returnTo.path !== 'string') return null;
  const path = `/${rawSegments(returnTo.path).join('/')}`;
  return routeDecision(parseAppPath(path), appUser).kind === 'ok' ? path : null;
}

// Regra 5: o endereço não é da academia da sessão. Devolve o caminho corrigido,
// ou null quando o endereço já é dela. Os segmentos depois da academia vão
// crus, do jeito que chegaram, para o id da ficha não mudar.
function sessionPathFor(route, tenantId, home) {
  const raw = rawSegments(route.pathname);
  if (raw.length === 0) return home;
  if (route.tenantSlug === tenantId) {
    // Mesma academia com outra caixa (/STRONIX/...): troca só o slug.
    return decodeSegment(raw[0]) === tenantId ? null : joinPath(home, raw.slice(1));
  }
  // Tela sem academia (/pipeline, /ficha/<id>): põe a academia na frente.
  if (route.tenantSlug === null) return route.unknown ? home : joinPath(home, raw);
  // Outra academia: a tela vem junto, a ficha e o super-admin não, porque são
  // dados da outra academia.
  const keepsScreen = route.screen && route.screen !== 'ficha' && route.screen !== 'superadmin';
  return keepsScreen ? joinPath(home, raw.slice(1)) : home;
}

// O que fazer com o endereço atual nesta sessão. Roda a cada render do app
// logado e para na primeira regra que se aplica:
// 1. sem sessão: ok (o login aparece em qualquer endereço e volta para ele);
// 2. super-admin puro: o console só existe em '/';
// 3. sessão assumida ("Acessar como") com o endereço de outra academia: vai
//    para a tela inicial da assumida;
// 4. volta da visualização: vai para o caminho guardado na entrada;
// 5. endereço sem a academia da sessão: corrige o slug, sem aviso;
// 6. tela que a sessão não vê: tela inicial, com aviso se for de gestor;
// 7. endereço desconhecido: tela inicial, com aviso;
// 8. sub-tela desconhecida: a tela-mãe, sem aviso.
// A regra 5 já sai com as regras 6, 7 e 8 aplicadas ao endereço corrigido, então
// o destino de todo redirect é aceito de primeira: nada pisca e nada entra em
// laço. Devolve { kind: 'ok' } ou { kind: 'redirect', to, target, notice }.
export function routeDecision(route, appUser, opts = {}) {
  const { search = '', returnTo = null } = opts || {};
  if (!appUser) return OK;
  if (appUser.superAdminOnly) return route.pathname === '/' ? OK : redirectTo('/');
  const tenantId = appUser.tenantId;
  const home = hrefFor(tenantId, HOME_SCREEN);
  // Trava contra laço: academia cujo id não relê como ela mesma (fora do
  // formato ou palavra reservada) não é mandada pelo endereço. Sem isso, o
  // redirect cairia nele mesmo para sempre. Vale para as regras 3 a 8.
  if (!home || parseAppPath(home).tenantSlug !== tenantId) return OK;
  if (appUser.impersonating && route.tenantSlug !== tenantId) return redirectTo(home);
  const back = returnPathFor(route, appUser, returnTo);
  if (back) return redirectTo(back);
  const fixed = sessionPathFor(route, tenantId, home);
  const extra = { tenantId, search };
  if (fixed !== null) return accessRedirect(parseAppPath(fixed), appUser, home, extra) ?? redirectTo(fixed, { search });
  return accessRedirect(route, appUser, home, extra) ?? OK;
}

// Voltar da ficha: pelo navegador quando há tela do app antes dela nesta aba;
// senão, troca a entrada por Clientes (cliente) ou Pipeline (lead).
export function backTarget({ historyState, isClient, tenantId } = {}) {
  if (canGoBackInApp(historyState)) return { type: 'back' };
  return { type: 'replace', href: hrefFor(tenantId, isClient ? 'clientes' : 'kanban') };
}

// Chave da tela mostrada, para a key do AppErrorBoundary e para a rolagem.
// /<academia> e /visao-geral/operacional são a mesma tela, o `rest` e a subaba
// do super-admin não trocam a chave (o SuperAdminView não remonta nem refaz a
// busca a cada subaba), outra ficha troca.
export function screenKey(route) {
  const screen = route?.screen;
  if (screen === 'ficha') return `ficha:${route.leadId}`;
  if (screen === HOME_SCREEN || screen === 'dashOperacional') return 'dashOperacional';
  return screen || 'dashboard';
}

// Título da aba do navegador: tela primeiro, para distinguir várias abas.
// Nunca leva nome de lead, porque o histórico do navegador guarda o título.
export function documentTitle({ screen, tenantName } = {}) {
  const parts = [];
  if (own(SCREENS, screen)) parts.push(SCREENS[screen].title);
  if (tenantName) parts.push(tenantName);
  parts.push('STRONILEAD');
  return parts.join(' · ');
}

// Molde do endereço para o Sentry: '/:tenant' no lugar da academia e ':leadId'
// no lugar do id da ficha. O `rest` fica de fora. Nunca devolve dado real.
export function routeTemplate(pathname) {
  const r = parseAppPath(pathname);
  if (rawSegments(r.pathname).length === 0) return '/';
  const prefix = r.tenantSlug ? '/:tenant' : '';
  if (r.unknown || !r.screen) return `${prefix}/*`;
  if (r.screen === 'ficha') return `${prefix}/ficha/:leadId`;
  if (r.screen === 'superadmin') return `${prefix}/super-admin/${SUPER_TABS[r.superTab]}`;
  const segs = SCREENS[r.screen].segs;
  return segs.length ? `${prefix}/${segs.join('/')}` : prefix;
}

// Rolagem do container compartilhado. Outra tela por push ou replace: topo.
// Voltar ou avançar para outra tela: devolve a posição daquela entrada. Mesma
// tela, ou a primeira tela da aba: não mexe.
export function scrollActionFor({ navigationType, prevScreenKey, screenKey: key } = {}) {
  if (prevScreenKey == null || prevScreenKey === key) return 'none';
  return navigationType === 'POP' ? 'restore' : 'top';
}
