// O link público da pesquisa de NPS de um professor (a página /avaliar, do
// PR 5). O código tem 10 símbolos de um alfabeto de 32 sem os que se confundem
// (0, o, 1, l). Com 32 símbolos, o byte sorteado módulo 32 não pende para
// nenhum lado. Ver spec 2026-11-24-perfil-do-professor, "Nível e metas".
const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789';
export const NPS_CODE_TAMANHO = 10;

export function gerarNpsCode(sortear = (bytes) => crypto.getRandomValues(bytes)) {
  return Array.from(sortear(new Uint8Array(NPS_CODE_TAMANHO)), (b) => ALFABETO[b % ALFABETO.length]).join('');
}

export const npsLinkDe = (origin, tenantId, code) => (code && tenantId ? `${origin}/avaliar/${tenantId}/${code}` : null);
