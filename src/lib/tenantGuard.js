// Quem pode sofrer uma ação administrativa dentro de um tenant.
//
// A resposta vem do CLAIM da conta no Firebase Auth, que só o Admin SDK grava.
// Nunca do doc em stronix_users: aquele documento é escrito pelo próprio admin
// da academia (firestore.rules libera o write na coleção do tenant dele), então
// usá-lo como prova de "esta pessoa é minha" deixava um admin apontar o campo
// authUid para o uid de outra academia e agir sobre ela — trocar a senha e
// apagar a conta. A checagem passava porque o admin tinha acabado de escrever
// o documento que ela consultava.
//
// Módulo PURO de propósito, no mesmo espírito do passwordPolicy.js: as funções
// da api/ importam via api/_auth.js e os testes rodam sem carregar o Admin SDK.

export const TARGET_OK = 'ok';
export const TARGET_FOREIGN = 'outro-tenant';
export const TARGET_SUPERADMIN = 'super-admin';
export const TARGET_UNCLAIMED = 'sem-tenant';
// Não existe conta no Auth para este uid. Vale para o doc de membro órfão,
// que é o único caso em que a exclusão segue adiante limpando só o cadastro.
export const TARGET_NO_ACCOUNT = 'sem-conta';

// `customClaims` é o objeto de claims do alvo (adminAuth.getUser().customClaims).
// `tenantId` é o tenant de quem chama, tirado do token JÁ VERIFICADO.
export function targetVerdict(customClaims, tenantId) {
  const claims = customClaims || {};
  // O dono da plataforma nunca é alvo de ação administrativa de tenant, mesmo
  // que ele também tenha um claim de tenant.
  if (claims.superAdmin === true) return TARGET_SUPERADMIN;
  if (!tenantId) return TARGET_FOREIGN;
  if (!claims.tenantId) return TARGET_UNCLAIMED;
  return claims.tenantId === tenantId ? TARGET_OK : TARGET_FOREIGN;
}

export function targetAllowed(customClaims, tenantId) {
  return targetVerdict(customClaims, tenantId) === TARGET_OK;
}

// Resposta HTTP para um veredito de recusa. "Outro tenant" e "sem tenant"
// devolvem a MESMA mensagem: dizer ao admin que o uid existe mas é de outra
// academia confirmaria a existência de contas fora da dele.
export function targetVerdictError(verdict) {
  if (verdict === TARGET_OK) return null;
  if (verdict === TARGET_SUPERADMIN) {
    return { status: 403, error: 'Esta conta não pode ser alterada por aqui.' };
  }
  return { status: 404, error: 'Usuário não encontrado neste tenant.' };
}
