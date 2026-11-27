// A lista da equipe: junta as fichas (stronix_equipe), os logins
// (stronix_users) e os professores (stronix_professores). Puro, só importa
// ../acesso.js e ./ficha.js, porque a api/ também lê. Spec
// docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md, "Quem é quem
// na lista".
import { ROLES, isProfessor, roleOf } from '../acesso.js';
import { FUNCOES } from './ficha.js';

export const ACESSOS = Object.freeze(['com', 'convite', 'sem']);

const FUNCAO_DO_PAPEL = Object.freeze({
  [ROLES.GESTOR]: 'gestor',
  [ROLES.CONSULTOR]: 'consultor',
  [ROLES.PROFESSOR]: 'professor',
});

function conviteValido(convite, agora) {
  const ate = Date.parse(convite?.expiraEm || '');
  return Number.isFinite(ate) && ate > agora.getTime();
}

function pessoa({ id, ficha, user, professor, agora }) {
  const funcao = user
    ? FUNCAO_DO_PAPEL[roleOf(user)]
    : (FUNCOES.includes(ficha?.funcao) ? ficha.funcao : (professor ? 'professor' : 'consultor'));
  const nome = ficha?.nome || user?.name || professor?.nome || '';
  const desligada = ficha ? ficha.status === 'desligado' : (!user && professor?.ativo === false);
  let acesso = 'sem';
  if (desligada) acesso = 'desligado';
  // Cadastro de login sem authUid ainda não entra: o vínculo acontece no
  // primeiro login pelo e-mail (a Visão geral cobra isso).
  else if (user) acesso = user.authUid ? 'com' : 'sem';
  else if (ficha?.convite && conviteValido(ficha.convite, agora)) acesso = 'convite';
  return { id, ficha: ficha || null, user: user || null, professor: professor || null, funcao, nome, desligada, acesso };
}

// [{ id, ficha, user, professor, funcao, nome, desligada, acesso }], em ordem
// de nome. O id é o da ficha; sem ficha, o do login ou o do professor, que é o
// id com que a ficha nasce na primeira gravação.
export function montarEquipe({ fichas = [], users = [], professores = [], agora = new Date() } = {}) {
  const validos = (lista) => (lista || []).filter((x) => x && typeof x.id === 'string' && x.id);
  const us = validos(users);
  const ps = validos(professores);
  const userPorId = new Map(us.map((u) => [u.id, u]));
  const profPorId = new Map(ps.map((p) => [p.id, p]));
  const loginDoProfessor = new Map(us.filter((u) => isProfessor(u) && u.professorId).map((u) => [u.professorId, u]));
  const usadosU = new Set();
  const usadosP = new Set();
  const out = [];

  for (const ficha of validos(fichas)) {
    const livre = (u) => (u && !usadosU.has(u.id) ? u : null);
    const user = livre(ficha.userId && userPorId.get(ficha.userId))
      || livre(ficha.professorId && loginDoProfessor.get(ficha.professorId))
      || null;
    // Com login de professor, vale o professor do login: a troca passa pelo set-role, no servidor.
    const profId = (user && isProfessor(user) && user.professorId) || ficha.professorId || null;
    const achado = (profId && profPorId.get(profId)) || null;
    const professor = achado && !usadosP.has(achado.id) ? achado : null;
    if (user) usadosU.add(user.id);
    if (professor) usadosP.add(professor.id);
    out.push(pessoa({ id: ficha.id, ficha, user, professor, agora }));
  }
  for (const user of us) {
    if (usadosU.has(user.id)) continue;
    const prof = isProfessor(user) && user.professorId && !usadosP.has(user.professorId) ? profPorId.get(user.professorId) : null;
    if (prof) usadosP.add(prof.id);
    out.push(pessoa({ id: user.id, ficha: null, user, professor: prof || null, agora }));
  }
  for (const professor of ps) {
    if (usadosP.has(professor.id)) continue;
    out.push(pessoa({ id: professor.id, ficha: null, user: null, professor, agora }));
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Recorte da lista: { situacao: 'ativos' | 'desligados', funcao, vinculo,
// acesso } (null é todos) e o texto da busca, sem acento.
export function filtrarEquipe(pessoas, { situacao = 'ativos', funcao = null, vinculo = null, acesso = null } = {}, busca = '') {
  const q = semAcento(busca).trim();
  return (pessoas || []).filter((p) => (situacao === 'desligados' ? p.desligada : !p.desligada)
    && (!funcao || p.funcao === funcao)
    && (!vinculo || p.ficha?.vinculo === vinculo)
    && (!acesso || p.acesso === acesso)
    && (!q || semAcento(p.nome).includes(q)));
}
