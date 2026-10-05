// Papéis da equipe (Equipe & acessos) e a regra de ligar uma pessoa a um
// professor do cadastro de professores (stronix_professores).
//
// Puro de propósito: a tela e a api/ (convite, aceite, cadastro e troca de
// papel) importam daqui, então a regra é uma só dos dois lados. A api/ roda o
// SDK de servidor, e por isso este arquivo só importa ./acesso.js e
// ./modules.js, que não importam nada. O teamRolesImports.test.js trava isso.
// O nome de cada papel na tela mora em acesso.js (ROLE_LABELS e roleLabel).
import { ROLES, ROLE_LABELS, roleOf } from './acesso.js';
import { hasModule, MODULES } from './modules.js';

// A ação do /api/admin-users que troca o papel. Tela e servidor usam a mesma
// constante, como o set-email.
export const SET_ROLE_ACTION = 'set-role';

const nameOrSomeone = (name) => (typeof name === 'string' && name.trim() ? name.trim() : 'Essa pessoa');

export const PROFESSOR_LINK_MESSAGES = Object.freeze({
  moduleOff: 'O papel Professor só existe com o módulo Professor e faltosos ligado nesta academia.',
  missing: 'Escolha qual professor do cadastro é esta pessoa.',
  notFound: 'Esse professor não está mais no cadastro de professores. Atualize a tela e escolha de novo.',
  inactive: 'Esse professor está inativo no cadastro. Escolha um professor ativo.',
  taken: 'Esse professor já tem acesso ao app. Cada professor do cadastro tem um login só.',
  inviteStale: 'Este convite de professor não vale mais. Peça um convite novo ao gestor.',
  // O professor não é dono de lead: quem vira professor passa a carteira antes.
  // O set-role barra qualquer lead com o consultantId da pessoa, cliente e
  // perda inclusive (o cliente que ficasse com ela passaria o consultantId
  // para cada indicação nova pelo link público). O Migrar leads abre só com
  // "Leads em aberto" marcado, então o texto diz os três tipos com os nomes da
  // tela, senão o gestor migra o padrão e recebe a mesma recusa. O
  // teamRoles.test.js confere os nomes na tela.
  ownsLeads: (name) => `${nameOrSomeone(name)} ainda tem leads na carteira, contando clientes e perdas. Passe os leads em Configurações → Migrar leads, marcando Leads em aberto, Clientes ativos e Perdas, antes de mudar o papel para Professor.`,
  // As regras do Firestore leem o papel no cadastro de id igual ao uid da
  // conta. Cadastro antigo, de id diferente, não enxergaria a trava do
  // professor.
  legacyRecord: (name) => `${nameOrSomeone(name)} tem um cadastro antigo, que não vira professor. Exclua esse acesso e cadastre a pessoa de novo, já com o papel Professor.`,
});

// Inativo é só quem tem ativo: false, a mesma conta do professorsForModality
// (src/lib/professores.js). Professor cadastrado antes do campo existir conta
// como ativo.
export const isActiveProfessor = (professor) => !!professor && professor.ativo !== false;

// Ids dos professores do cadastro que já têm login. Só conta quem é professor
// hoje: um professorId que sobrou num consultor não prende ninguém.
export function linkedProfessorIds(users, { exceptUserId = null } = {}) {
  const ids = new Set();
  for (const u of users || []) {
    if (!u || u.id === exceptUserId || roleOf(u) !== ROLES.PROFESSOR) continue;
    if (typeof u.professorId === 'string' && u.professorId) ids.add(u.professorId);
  }
  return ids;
}

// Professores que o gestor pode escolher, na ordem do cadastro: ativos e sem
// login. Na edição, `exceptUserId` é quem está sendo editado (o vínculo dele
// não conta como ocupado) e `keepId` mantém o professor que ele já tem, para o
// select mostrar o valor atual mesmo que o professor tenha ficado inativo.
export function availableProfessors(professores, users, { exceptUserId = null, keepId = null } = {}) {
  const taken = linkedProfessorIds(users, { exceptUserId });
  return (professores || []).filter((p) => p && p.id
    && (p.id === keepId || (isActiveProfessor(p) && !taken.has(p.id))));
}

// Texto do professor ligado, na lista da equipe.
export function linkedProfessorText(user, professores) {
  if (!user?.professorId) return 'Sem professor ligado';
  const professor = (professores || []).find((p) => p.id === user.professorId);
  return professor?.nome || 'Professor fora do cadastro';
}

// Papéis do convite, na ordem do select. Professor só com o módulo. Aceita a
// lista de módulos (appUser.tenantModules) ou o documento da academia.
export function inviteRoleOptions(modulesOrTenant) {
  const options = [
    { value: ROLES.CONSULTOR, label: ROLE_LABELS[ROLES.CONSULTOR] },
    { value: ROLES.GESTOR, label: `${ROLE_LABELS[ROLES.GESTOR]} (admin)` },
  ];
  if (hasModule(modulesOrTenant, MODULES.FALTOSOS)) {
    options.push({ value: ROLES.PROFESSOR, label: ROLE_LABELS[ROLES.PROFESSOR] });
  }
  return options;
}

// O que a edição de um membro muda no papel: null quando nada muda, ou
// { role, professorId }. O gestor nunca muda de papel por aqui. Qualquer
// papel pedido que não seja Professor vira Consultor, e o professorId só
// existe no Professor (vazio quando a tela ainda não escolheu).
export function planRoleChange(user, { role, professorId } = {}) {
  const from = roleOf(user);
  if (from === ROLES.GESTOR) return null;
  if (role !== ROLES.PROFESSOR) {
    return from === ROLES.CONSULTOR ? null : { role: ROLES.CONSULTOR, professorId: null };
  }
  const next = typeof professorId === 'string' ? professorId : '';
  if (from === ROLES.PROFESSOR && next === (user?.professorId || '')) return null;
  return { role: ROLES.PROFESSOR, professorId: next };
}

// Conferências do servidor, em três tempos, cada uma pronta para responder
// ({ status, code, error }) ou null: o formato antes de qualquer leitura, o
// módulo depois de ler a academia, o professor depois de ler o cadastro dele
// e quem já está ligado a ele.

// O mesmo formato de id de documento que a ponte do Stronizap aceita
// (isDocId, em api/_zapSchedule.js). O api/admin-users.js confere com ela o
// userDocId da troca de papel e da exclusão.
export const isDocId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 128
  && !v.includes('/') && v !== '.' && v !== '..' && !/^__.*__$/.test(v);

const refusal = (status, code, error) => ({ status, code, error });

export function professorIdProblem(professorId) {
  return isDocId(professorId) ? null : refusal(400, 'professor_obrigatorio', PROFESSOR_LINK_MESSAGES.missing);
}

export function professorModuleProblem(modulesOrTenant) {
  return hasModule(modulesOrTenant, MODULES.FALTOSOS)
    ? null
    : refusal(403, 'modulo_desligado', PROFESSOR_LINK_MESSAGES.moduleOff);
}

// `professor` é o documento do cadastro (null quando não existe) e
// `linkedUsers`, os cadastros da equipe com esse professorId.
export function professorLinkProblem({ professor, linkedUsers = [], exceptUserId = null }) {
  if (!professor) return refusal(422, 'professor_sumiu', PROFESSOR_LINK_MESSAGES.notFound);
  if (!isActiveProfessor(professor)) return refusal(422, 'professor_inativo', PROFESSOR_LINK_MESSAGES.inactive);
  if (linkedProfessorIds(linkedUsers, { exceptUserId }).size > 0) {
    return refusal(409, 'professor_com_login', PROFESSOR_LINK_MESSAGES.taken);
  }
  return null;
}
