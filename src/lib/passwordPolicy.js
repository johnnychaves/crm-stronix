// Regra de senha do sistema, em UM lugar só.
//
// Por que isso existe: o Admin SDK IGNORA a política de senha configurada no
// console do Firebase Auth — ele tem passe livre por natureza. Então todo
// caminho que cria conta ou troca senha pelo servidor (createUser/updateUser)
// precisa validar à mão, senão a política vira decoração e vale só no
// "esqueci minha senha" da tela de login.
//
// Módulo PURO e sem dependências de propósito: é importado pelo front (telas
// de cadastro) e pelas funções serverless em api/, para os dois nunca
// divergirem. Front aceitando 6 e servidor recusando é bug de usabilidade.
//
// AO MUDAR AQUI: alinhe também em Authentication → Settings → Password policy
// no console do Firebase, senão a redefinição pela tela de login fica com
// regra diferente das demais.

export const MIN_PASSWORD_LENGTH = 8;

export function passwordTooShort(password) {
  return String(password || '').length < MIN_PASSWORD_LENGTH;
}

export function passwordTooShortError() {
  return `Senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
}
