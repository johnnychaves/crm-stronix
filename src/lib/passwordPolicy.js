// Regra de senha do sistema, em UM lugar só.
//
// Ela espelha a política de senha ligada no Firebase Auth (Authentication →
// Settings → Password policy), que vale também para o Admin SDK: em 2026-09-25
// o createUser do provision-tenant foi recusado por ela. Até ali este arquivo
// partia do contrário, que o Admin SDK ignorava a política, e só conferia o
// tamanho: senha só de minúsculas passava aqui, o Firebase recusava, e a
// recusa chegava na tela como "Erro interno".
//
// Política em vigor, lida em GET identitytoolkit.googleapis.com/v2/passwordPolicy
// (a mesma leitura que o SDK do navegador faz): de 8 a 4096 caracteres, com
// letra minúscula, letra maiúscula, número e um dos símbolos de
// PASSWORD_SYMBOLS. A conferência abaixo é a do SDK: tamanho pelo .length,
// letra e número pela faixa ASCII, então letra com acento não conta, e símbolo
// só da lista, então +, = e espaço não contam. Quem dá a palavra final é o
// servidor do Firebase; se ele discordar desta cópia, a recusa vira
// PASSWORD_REJECTED_ERROR.
//
// Módulo PURO e sem dependências de propósito: é importado pelo front (telas
// que pedem senha) e pelas funções serverless em api/, para os dois nunca
// divergirem.
//
// AO MUDAR A POLÍTICA NO CONSOLE: mude aqui e no teste junto. Se esquecer, o
// servidor ainda troca a recusa do Firebase por PASSWORD_REJECTED_ERROR (ver
// passwordRejectedByFirebase), mas as telas deixam de avisar antes de enviar.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 4096;

// allowedNonAlphanumericCharacters da política do Firebase.
export const PASSWORD_SYMBOLS = '^$*.[]{}()?"!@#%&/\\,><\':;|_~`-';

const SYMBOL_EXAMPLE = 'símbolo (como ! @ # $)';

// Para mostrar perto do campo, antes de a pessoa digitar.
export const PASSWORD_RULE_TEXT =
  `Use ${MIN_PASSWORD_LENGTH} caracteres ou mais, com letra maiúscula, letra minúscula, número e ${SYMBOL_EXAMPLE}.`;

// Resposta para quando o Firebase recusa uma senha que a regra daqui aceitou.
// Só acontece se a política do console mudar sem este arquivo mudar junto. O
// Firebase diz o que faltou, em inglês, e o log do servidor mostra isso. Como a
// regra daqui já exige as quatro classes, o desvio provável é o console ter
// subido o mínimo, então a frase pede uma senha mais longa.
export const PASSWORD_REJECTED_ERROR = 'O sistema recusou essa senha. Tente uma senha mais longa.';

const isLower = (c) => c >= 'a' && c <= 'z';
const isUpper = (c) => c >= 'A' && c <= 'Z';
const isDigit = (c) => c >= '0' && c <= '9';
const isSymbol = (c) => PASSWORD_SYMBOLS.includes(c);
// Letras acentuadas do Latin-1 (Á, Ç, Õ...), que o Firebase não conta como letra.
const ACCENTED_UPPER = /[À-ÖØ-Þ]/;
const ACCENTED_LOWER = /[ß-öø-ÿ]/;

// A frase com o que falta na senha, ou null quando ela serve.
export function passwordPolicyError(password) {
  const s = typeof password === 'string' ? password : '';
  // O teto vem antes de percorrer o texto: o convite é rota pública.
  if (s.length > MAX_PASSWORD_LENGTH) {
    return `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  const chars = s.split('');
  const missing = [];
  if (s.length < MIN_PASSWORD_LENGTH) missing.push(`${MIN_PASSWORD_LENGTH} caracteres ou mais`);
  // Quem digitou "Érica" está vendo a maiúscula, então a frase diz "sem acento".
  if (!chars.some(isLower)) missing.push(ACCENTED_LOWER.test(s) ? 'letra minúscula sem acento' : 'letra minúscula');
  if (!chars.some(isUpper)) missing.push(ACCENTED_UPPER.test(s) ? 'letra maiúscula sem acento' : 'letra maiúscula');
  if (!chars.some(isDigit)) missing.push('número');
  if (!chars.some(isSymbol)) missing.push(SYMBOL_EXAMPLE);
  if (!missing.length) return null;
  const list = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} e ${missing.at(-1)}`;
  return `A senha precisa ter ${list}.`;
}

// O erro do Firebase é a recusa da política de senha? O firebase-admin 13.8 não
// conhece esse erro: o código sai auth/internal-error e o motivo vem só na
// mensagem, junto com a resposta do servidor. O código próprio fica para uma
// versão do SDK que passe a mapear o erro.
export function passwordRejectedByFirebase(err) {
  if (err?.code === 'auth/password-does-not-meet-requirements') return true;
  return /PASSWORD_DOES_NOT_MEET_REQUIREMENTS|Missing password requirements/.test(String(err?.message || ''));
}

// Senha temporária que o gestor passa ao consultor: 12 caracteres, ao menos um
// de cada exigência, e nenhum dos que se confundem ao ler (0 e O, 1, l e I). Os
// símbolos são os fáceis de achar no teclado do celular, todos da lista acima.
const TEMP_LOWER = 'abcdefghjkmnpqrstuvwxyz';
const TEMP_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_DIGITS = '23456789';
const TEMP_SYMBOLS = '!@#$%&*?';
const TEMP_LENGTH = 12;

function randomIndex(n) {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % n;
}

export function generateTemporaryPassword() {
  const pick = (set) => set[randomIndex(set.length)];
  const all = TEMP_LOWER + TEMP_UPPER + TEMP_DIGITS + TEMP_SYMBOLS;
  const chars = [pick(TEMP_LOWER), pick(TEMP_UPPER), pick(TEMP_DIGITS), pick(TEMP_SYMBOLS)];
  while (chars.length < TEMP_LENGTH) chars.push(pick(all));
  // Embaralha, senão as quatro exigências ficariam sempre no começo.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
