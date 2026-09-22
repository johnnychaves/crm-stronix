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

const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

// Tela do endereço curto /<academia>. Mostra o Operacional.
export const HOME_SCREEN = 'dashboard';

const tela = (segs, title, trava = {}) => Object.freeze({ segs: Object.freeze(segs), title, ...trava });

// id da tela (os mesmos valores de activeTab de sempre) para os segmentos
// depois da academia, o título da aba e a trava de acesso.
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
  settings: tela(['configuracoes'], 'Configurações', { gestor: true }),
  profile: tela(['perfil-da-academia'], 'Perfil da academia', { gestor: true }),
  billing: tela(['plano-e-faturas'], 'Plano e faturas', { gestor: true }),
  superadmin: tela(['super-admin'], 'Super-admin', { superAdmin: true }),
  ficha: tela(['ficha'], 'Ficha'),
});

// Subabas do super-admin membro de academia: id interno para o segmento.
export const SUPER_TABS = Object.freeze({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
const SUPER_TAB_BY_SEGMENT = Object.fromEntries(Object.entries(SUPER_TABS).map(([id, seg]) => [seg, id]));

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
//   "ficha não encontrada" e não endereço desconhecido.
export function parseAppPath(pathname) {
  const out = {
    pathname: typeof pathname === 'string' ? pathname : '',
    tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
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
  const { leadId, superTab } = opts || {};
  if (typeof tenantId !== 'string' || tenantId === '') return null;
  const t = encode(tenantId);
  if (t === null) return null;
  const base = `/${t}`;
  if (!own(SCREENS, screen) || screen === HOME_SCREEN || screen === 'dashOperacional') return base;
  if (screen === 'ficha') {
    const id = isValidLeadId(leadId) ? encode(leadId) : null;
    return id === null ? null : `${base}/ficha/${id}`;
  }
  if (screen === 'superadmin') {
    return `${base}/super-admin/${own(SUPER_TABS, superTab) ? SUPER_TABS[superTab] : SUPER_TABS.overview}`;
  }
  return `${base}/${SCREENS[screen].segs.join('/')}`;
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
