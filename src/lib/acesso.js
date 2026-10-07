// Lista única do que cada papel pode fazer no Stronilead. Toda tela e todo
// botão perguntam aqui, em vez de comparar o papel do cadastro na mão. O
// acessoSweep.test.js reprova comparar `role` com o texto de um papel fora
// deste arquivo.
//
// Puro e sem import nenhum, de propósito: a api/ também lê este arquivo
// (cadastro e agendamento pelo Stronizap), e as regras do Firestore repetem
// a trava do professor em firestore.rules.
//
// Quando os perfis editáveis vierem, a tabela PERMISSOES sai do código e
// passa a ser lida da academia. As telas continuam perguntando do mesmo jeito.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md

// Valores gravados em stronix_users.role.
export const ROLES = Object.freeze({
  GESTOR: 'admin',
  CONSULTOR: 'consultant',
  PROFESSOR: 'professor',
});

// Papel do cadastro. A comparação é exata, igual à das regras do Firestore.
// Sem papel, ou com um papel que não existe ('consultor' de cadastro antigo,
// 'superadmin' da sessão do super-admin puro), vale consultor: é o que o app
// sempre fez com quem não era gestor.
export function roleOf(user) {
  const role = user?.role;
  if (role === ROLES.GESTOR) return ROLES.GESTOR;
  if (role === ROLES.PROFESSOR) return ROLES.PROFESSOR;
  return ROLES.CONSULTOR;
}

export const isGestor = (user) => roleOf(user) === ROLES.GESTOR;
export const isProfessor = (user) => roleOf(user) === ROLES.PROFESSOR;

// Quem vende: gestor e consultor. Decide quem aparece na escolha de consultor
// responsável, nos rankings e nos painéis por pessoa. O
// professor não é dono de lead, não conta em venda e não ocupa vaga de
// consultor.
export const isSeller = (user) => !!user && !isProfessor(user);

// Quem participa da Meta Diária pelo papel: só o consultor. O gestor fica fora
// da régua (acompanha a equipe pela Visão geral) e o professor não vende. Decide quem
// fica com a tarefa da visita ou da aula que agenda no lead de outro consultor
// (appointmentTaskOwnerFor, em src/lib/schedulePatch.js), e a ponte com o
// Stronizap soma a ela o dia da meta no countsForMeta (api/_zapSchedule.js).
export const isMetaParticipant = (user) => isSeller(user) && !isGestor(user);

// Nome do papel na tela.
export const ROLE_LABELS = Object.freeze({
  [ROLES.GESTOR]: 'Gestor',
  [ROLES.CONSULTOR]: 'Consultor',
  [ROLES.PROFESSOR]: 'Professor',
});
export const roleLabel = (user) => ROLE_LABELS[roleOf(user)];

// Ações que dependem do papel. O nome é o que vai para a tabela de perfis
// quando ela sair do código, então não muda.
export const ACTIONS = Object.freeze({
  LEAD_CRIAR: 'lead.criar',
  CADASTRO_EDITAR: 'cadastro.editar',
  FICHA_MUDAR_FASE: 'ficha.mudarFase',
  CONTRATO_EDITAR: 'contrato.editar',
  INDICACAO_CADASTRAR: 'indicacao.cadastrar',
  CLIENTES_EXPORTAR: 'clientes.exportar',
  LEADS_VER: 'leads.ver',
  SINO_EQUIPE: 'sino.equipe',
  SUPORTE_ABRIR: 'suporte.abrir',
});

const TODAS = Object.freeze(Object.values(ACTIONS));

// O que cada papel faz. Gestor e consultor fazem tudo o que está aqui, porque
// é assim hoje: desde a PR #193 o consultor edita cadastro e vende igual ao
// gestor. O que é só do gestor (Configurações e excluir lead) continua no
// isGestor e na trava `gestor` das telas (src/lib/routes.js). O filtro de
// responsável das listas é de todo mundo desde 07/10/2026 e não passa por
// aqui. O professor não faz nenhuma: na ficha ele registra
// anotação, WhatsApp, ligação e agendamento, que não passam por esta lista.
//
// `can` olha só o papel. Ter login (authUid, canEditLead em leads.js)
// continua sendo conferido à parte.
const PERMISSOES = Object.freeze({
  [ROLES.GESTOR]: TODAS,
  [ROLES.CONSULTOR]: TODAS,
  [ROLES.PROFESSOR]: Object.freeze([]),
});

// Ação que não está na lista é recusada em silêncio, para nada quebrar em
// produção. Por isso um nome errado (ACTIONS.LEAD_CRAIR vira undefined)
// esconderia o botão de todo mundo sem erro: o acessoActionsRef.test.js
// confere que todo ACTIONS.NOME de src/ e api/ existe aqui.
export function can(user, action) {
  if (!user) return false;
  return PERMISSOES[roleOf(user)].includes(action);
}

// Telas que o professor abre (ids de SCREENS, em src/lib/routes.js). As
// outras mostram "Essa tela não está liberada para o seu acesso." e levam à
// Meta diária.
export const PROFESSOR_SCREENS = Object.freeze(['dailyGoal', 'clientes', 'ficha']);

// Gestor e consultor passam aqui em toda tela: as travas de gestor e de
// super-admin da tabela SCREENS continuam valendo no canAccess, como hoje.
export function canOpenScreen(user, screenId) {
  if (!isProfessor(user)) return true;
  return PROFESSOR_SCREENS.includes(screenId);
}
