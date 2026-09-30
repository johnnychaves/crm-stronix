// O e-mail de login de quem está na equipe. A tela de Equipe & acessos e a
// ação set-email do api/admin-users.js dividem esta regra. Módulo puro e sem
// dependências, no molde do passwordPolicy.js: as telas importam daqui e as
// funções em api/ também.
//
// Quem tem conta no Firebase Auth troca o e-mail pelo servidor, que muda o
// e-mail da conta e o do cadastro juntos e revoga as sessões da pessoa. Quem
// ainda não tem conta vinculada (cadastro sem authUid) não tem login para
// trocar, e a tela troca só o cadastro.

// A ação do POST /api/admin-users.
export const SET_EMAIL_ACTION = 'set-email';

// O teto de um endereço de e-mail.
export const LOGIN_EMAIL_MAX_LENGTH = 254;

// Frases da ação. O servidor manda e a tela mostra.
export const LOGIN_EMAIL_INVALID_MESSAGE = 'E-mail inválido. Confira o endereço digitado.';
export const LOGIN_EMAIL_TAKEN_MESSAGE = 'Esse e-mail já é de outra conta.';
export const LOGIN_EMAIL_FAILED_MESSAGE = 'Não deu para trocar o e-mail de login agora. Tente de novo.';

// Usuário, uma arroba e um domínio com ponto, sem espaço. A mesma conferência
// do convite e da criação de academia.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Mesma normalização do login: sem espaço nas pontas e em minúsculas.
export function normalizeLoginEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

// null quando o e-mail serve, ou a frase para mostrar.
export function loginEmailError(email) {
  const s = normalizeLoginEmail(email);
  if (!s || s.length > LOGIN_EMAIL_MAX_LENGTH || !EMAIL_RE.test(s)) return LOGIN_EMAIL_INVALID_MESSAGE;
  return null;
}

// O que o Salvar do "Editar membro" faz com o e-mail digitado:
//   { kind: 'none' }                   igual ao do cadastro, nada muda
//   { kind: 'invalid', error }         formato ruim, nada é salvo
//   { kind: 'account', email, body }   quem tem conta: o body vai para o set-email
//   { kind: 'record', email }          cadastro sem conta: só o cadastro muda
// O "igual" compara com o e-mail do cadastro, que é o que a tela conhece.
export function planLoginEmailChange(member, typed) {
  const email = normalizeLoginEmail(typed);
  if (email === normalizeLoginEmail(member?.email)) return { kind: 'none' };
  const error = loginEmailError(email);
  if (error) return { kind: 'invalid', error };
  // Sem espaço nas pontas, como o selo "Vinculado" da lista lê o authUid.
  const targetAuthUid = String(member?.authUid ?? '').trim();
  if (!targetAuthUid) return { kind: 'record', email };
  return { kind: 'account', email, body: { action: SET_EMAIL_ACTION, targetAuthUid, email } };
}

// A pergunta antes da troca. O e-mail novo aparece inteiro, para quem digitou
// errado ver antes de salvar. O próprio gestor também perde as sessões, então
// o texto dele pede para entrar de novo.
export function loginEmailConfirmText({ name, email, self }) {
  if (self) {
    return `Trocar o seu e-mail de login para ${email}?\n\nVocê passa a entrar com o e-mail novo, e as suas sessões abertas são encerradas. Depois de salvar, saia e entre de novo.`;
  }
  return `Trocar o e-mail de login de "${name}" para ${email}?\n\nA pessoa passa a entrar com o e-mail novo, e as sessões abertas dela são encerradas.`;
}
