// O que a sessão vê na casca do app: os itens do menu lateral e, para o
// professor, se ele tem tela nenhuma. Puro, testado em node, porque o App.jsx
// não monta em teste.
//
// Cada item de tela pergunta ao mesmo canAccess da decisão de rota
// (src/lib/routes.js), para o menu nunca mostrar uma tela que o endereço
// recusaria com aviso. Hoje só o professor perde itens: ele fica com Meta
// diária e Clientes (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md). O Suporte
// não é tela, é o chamado com a equipe do Stronilead, e segue a lista de
// permissões (ACTIONS.SUPORTE_ABRIR). Configurações e Organizações continuam no
// bloco Administração do App, com as travas de gestor e de super-admin.
import { canAccess } from './routes.js';
import { ACTIONS, can, isProfessor } from './acesso.js';
import { MODULES, hasModule } from './modules.js';

export function sidebarNav(appUser) {
  const tela = (id) => canAccess(id, appUser);
  return Object.freeze({
    overview: tela('dashOperacional') && tela('dashCrm') && tela('dashGerencial'),
    kanban: tela('kanban'),
    clientes: tela('clientes'),
    dailyGoal: tela('dailyGoal'),
    rotinas: tela('rotinas'),
    leads: tela('leads') && tela('aulas') && tela('visitas'),
    suporte: can(appUser, ACTIONS.SUPORTE_ABRIR),
  });
}

// Professor numa academia com o módulo "Professor e faltosos" desligado. O
// login continua valendo, mas nenhuma tela é dele: o App mostra só o aviso,
// com o Sair, e as regras do Firestore recusam as gravações dele no lead e nas
// interações (no registro da aula, não: ver stronix_aulas). A lista vem
// do appUser.tenantModules, lida no login; sem ela, vale desligado.
export function professorAccessOff(appUser) {
  return isProfessor(appUser) && !hasModule(appUser?.tenantModules, MODULES.FALTOSOS);
}
