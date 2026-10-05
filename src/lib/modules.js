// Módulos que o super-admin liga por academia. A lista mora em
// tenants/{id}.modules e só a api/tenant-status.js grava (as regras não deixam
// o navegador escrever em /tenants). O app lê a lista no login, junto com o
// resto do documento da academia (App.jsx), e a guarda em
// appUser.tenantModules. Hoje existe um módulo só, o do professor e dos
// faltosos, ligado apenas na STRONIX.
//
// Arquivo puro e sem import: a api/ usa este arquivo direto, e as regras do
// Firestore têm a mesma conta na função hasModule, que lê o mesmo campo.
// Módulo novo entra em MODULES; se as regras o usarem, com o mesmo texto lá
// (o modules.test.js confere).
//
// A tela "Feature flags" do super console é outra coisa: ela grava chaves
// globais que nenhuma parte do app lê.

export const MODULES = Object.freeze({ FALTOSOS: 'faltosos' });

export const KNOWN_MODULES = Object.freeze(Object.values(MODULES));

// A lista que vale: só módulos conhecidos, sem repetição e em ordem. O que não
// é lista vira lista vazia. Não corrige caixa nem espaço, porque a
// api/tenant-status.js recusa o que não é exato antes de gravar.
export function normalizeModules(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((m) => KNOWN_MODULES.includes(m)))].sort();
}

// O módulo `key` está ligado? Aceita o documento da academia ({ modules }),
// as vagas do getSeatUsage ({ modules }) ou a lista direto, como a do
// appUser.tenantModules. Documento ausente, campo fora do formato ou chave
// desconhecida dão false.
export function hasModule(tenantOrModules, key) {
  const raw = Array.isArray(tenantOrModules) ? tenantOrModules : tenantOrModules?.modules;
  return normalizeModules(raw).includes(key);
}
