// O que o App (src/App.jsx) tira do endereço e da sessão a cada render. Puro de
// propósito, sem React e sem Firebase, para ser testado em node. A tabela de
// telas e a decisão de rota moram em routes.js; aqui fica só o que é da casca
// do App: qual tela o menu acende, qual ficha está aberta e a chave da sessão.

import { HOME_SCREEN, SCREENS, canAccess, hrefFor, parseAppPath } from './routes.js';
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from './tenantSlug.js';

const isScreenId = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(SCREENS, id);

// Tela de onde a ficha foi aberta, guardada no state da navegação
// ({ from: 'kanban' }). Mantém o menu aceso e o título do cabeçalho da origem.
// O state vive no histórico do navegador e pode vir de qualquer lugar, então só
// vale tela conhecida, que não seja a ficha e que esta sessão possa ver.
export function fichaOrigin(state, appUser) {
  const from = state && typeof state === 'object' ? state.from : null;
  if (!isScreenId(from) || from === 'ficha') return null;
  return canAccess(from, appUser) ? from : null;
}

// Os nomes de sempre do App, agora calculados a partir da tela mostrada
// (shown: a do endereço, ou a de destino quando routeDecision redireciona).
// - activeTab: com a ficha aberta, a tela de origem, ou 'ficha' quando ela foi
//   aberta direto numa aba nova. 'dashboard' é o endereço curto /<academia>.
// - resolvedTab: troca 'dashboard' pelo Operacional, como antes.
// - profileLeadId: id da ficha, ou null quando o id do endereço é inválido
//   (a ficha continua aberta e mostra "Ficha não encontrada").
export function screenState(shown, locationState, appUser) {
  const fichaOpen = shown?.screen === 'ficha';
  const activeTab = fichaOpen
    ? (fichaOrigin(locationState, appUser) ?? 'ficha')
    : (shown?.screen ?? HOME_SCREEN);
  return {
    fichaOpen,
    profileLeadId: fichaOpen ? (shown.leadId ?? null) : null,
    activeTab,
    resolvedTab: activeTab === HOME_SCREEN ? 'dashOperacional' : activeTab,
    superTab: shown?.superTab ?? 'overview',
  };
}

// Chave da sessão para a ficha (useProfileLead). Sai só do appUser, nunca do
// firebaseUser: no "Acessar como" o usuário do Firebase troca antes de a
// academia do módulo (appId) trocar, e a ficha leria a academia errada.
export function sessionKeyFor(appUser) {
  if (!appUser || appUser.superAdminOnly || !appUser.tenantId) return null;
  const who = appUser.authUid || appUser.id;
  return who ? `${appUser.tenantId}:${who}` : null;
}

// Academia do endereço, só para a marca da tela de login. Primeiro o caminho
// (/<academia>/...), depois o hash dos links antigos (#<academia>, #/<academia>,
// #/t/<academia>). Palavra de tela (/pipeline, #pipeline) não é academia.
export function loginTenantSlug({ pathname = '', hash = '' } = {}) {
  const fromPath = parseAppPath(pathname).tenantSlug;
  if (fromPath) return fromPath;
  const raw = String(hash || '').replace(/^#\/?(t\/)?/i, '').trim().toLowerCase();
  const slug = raw.split(/[/?#&]/)[0];
  return TENANT_SLUG_READ_RE.test(slug) && !isReservedTenantSlug(slug) ? slug : null;
}

// Marca da academia na tela de login: nada sem academia no endereço, "carregando"
// até a resposta do /api/tenant-resolve daquela academia chegar, e a resposta
// só quando ela é da academia do endereço de agora.
export function loginBrand(slug, resolved) {
  if (!slug) return null;
  if (resolved && resolved.slug === slug) return resolved;
  return { slug, loading: true };
}

// Para onde o Sair leva, com recarga da página: o login da própria academia
// para quem é membro, e o login geral (/) para o super-admin puro e para quem
// está vendo outra academia pelo "Acessar como".
export function logoutDestination(appUser) {
  if (!appUser || appUser.superAdminOnly || appUser.impersonating || !appUser.tenantId) return '/';
  return hrefFor(appUser.tenantId, HOME_SCREEN) || '/';
}

// Volta do "Sair da visualização": o endereço gravado no "Acessar como"
// (returnPath) e a academia assumida, que é a do endereço no momento da volta.
// routeDecision só usa quando o endereço ainda é da academia assumida e o
// caminho é da academia da sessão. Só aceita caminho do próprio site.
export function returnToFrom(record, appUser) {
  const path = record && typeof record === 'object' ? record.returnPath : null;
  const fromTenant = appUser?.tenantId || null;
  if (!fromTenant || typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return { fromTenant, path };
}

// Funil escolhido no Pipeline, salvo por academia no navegador.
export const savedFunnelKey = (tenantId) => `crm-selected-funnel:${tenantId}`;

export function readSavedFunnel(storage, tenantId) {
  if (!tenantId) return null;
  try { return storage?.getItem(savedFunnelKey(tenantId)) || null; } catch { return null; }
}
