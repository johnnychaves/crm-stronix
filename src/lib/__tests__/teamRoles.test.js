// Papéis da equipe e o vínculo do professor (src/lib/teamRoles.js): a mesma
// regra serve a tela de Equipe & acessos e a api/ (convite, aceite, cadastro e
// troca de papel).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SETTINGS_RAIL_GROUPS } from '../settingsRail.js';
import {
  SET_ROLE_ACTION, PROFESSOR_LINK_MESSAGES, isActiveProfessor,
  linkedProfessorIds, availableProfessors, linkedProfessorText, inviteRoleOptions,
  planRoleChange, professorIdProblem, professorModuleProblem, professorLinkProblem,
} from '../teamRoles.js';

const TRANSFER_TAB_PATH = fileURLToPath(new URL('../../views/settings/TransferLeadsTab.jsx', import.meta.url));

const RAFA = { id: 'prof-rafa', nome: 'Rafael Menezes', ativo: true };
// Professor cadastrado antes do campo ativo existir.
const LU = { id: 'prof-lu', nome: 'Luana Prado' };
const VELHO = { id: 'prof-velho', nome: 'Carlos Antigo', ativo: false };
const PROFESSORES = [RAFA, LU, VELHO];

const GESTOR = { id: 'u-gestor', role: 'admin' };
const ANA = { id: 'u-ana', role: 'consultant' };
const LEGADO = { id: 'u-legado' };
const PROF_RAFA = { id: 'u-rafa', role: 'professor', professorId: 'prof-rafa' };

const ids = (lista) => lista.map((p) => p.id);

describe('a troca de papel', () => {
  it('a ação é a mesma dos dois lados', () => {
    expect(SET_ROLE_ACTION).toBe('set-role');
  });
});

describe('professores que o gestor pode escolher', () => {
  it('ativo é quem não tem ativo: false', () => {
    expect([RAFA, LU, VELHO].map(isActiveProfessor)).toEqual([true, true, false]);
    expect(isActiveProfessor(null)).toBe(false);
  });

  it('só os ativos e sem login, na ordem do cadastro', () => {
    expect(ids(availableProfessors(PROFESSORES, [GESTOR, ANA, PROF_RAFA]))).toEqual(['prof-lu']);
  });

  it('na edição, o professor da própria pessoa continua na lista', () => {
    expect(ids(availableProfessors(PROFESSORES, [PROF_RAFA], { exceptUserId: 'u-rafa', keepId: 'prof-rafa' })))
      .toEqual(['prof-rafa', 'prof-lu']);
  });

  it('o professor da própria pessoa fica na lista mesmo inativo', () => {
    const carlos = { id: 'u-carlos', role: 'professor', professorId: 'prof-velho' };
    expect(ids(availableProfessors(PROFESSORES, [carlos], { exceptUserId: 'u-carlos', keepId: 'prof-velho' })))
      .toEqual(['prof-rafa', 'prof-lu', 'prof-velho']);
  });

  it('um professorId que sobrou num consultor não prende o professor', () => {
    expect(linkedProfessorIds([{ id: 'u-x', role: 'consultant', professorId: 'prof-rafa' }]).size).toBe(0);
    expect([...linkedProfessorIds([PROF_RAFA, ANA])]).toEqual(['prof-rafa']);
  });

  it('o texto do professor ligado diz o que falta', () => {
    expect(linkedProfessorText(PROF_RAFA, PROFESSORES)).toBe('Rafael Menezes');
    expect(linkedProfessorText({ role: 'professor' }, PROFESSORES)).toBe('Sem professor ligado');
    expect(linkedProfessorText({ role: 'professor', professorId: 'prof-apagado' }, PROFESSORES)).toBe('Professor fora do cadastro');
  });
});

describe('papéis do convite', () => {
  it('Professor só aparece com o módulo ligado, pela lista ou pela academia', () => {
    expect(inviteRoleOptions([]).map((o) => o.value)).toEqual(['consultant', 'admin']);
    expect(inviteRoleOptions(undefined).map((o) => o.value)).toEqual(['consultant', 'admin']);
    expect(inviteRoleOptions(['faltosos']).map((o) => o.value)).toEqual(['consultant', 'admin', 'professor']);
    expect(inviteRoleOptions({ modules: ['faltosos'] }).map((o) => o.label)).toEqual(['Consultor', 'Gestor (admin)', 'Professor']);
  });
});

describe('o que a edição muda no papel', () => {
  it('o gestor nunca muda de papel por aqui', () => {
    expect(planRoleChange(GESTOR, { role: 'professor', professorId: 'prof-lu' })).toBeNull();
    expect(planRoleChange(GESTOR, { role: 'consultant' })).toBeNull();
  });

  it('consultor que continua consultor não muda nada, nem o cadastro sem papel', () => {
    expect(planRoleChange(ANA, { role: 'consultant' })).toBeNull();
    expect(planRoleChange(LEGADO, { role: 'consultant' })).toBeNull();
  });

  it('consultor vira professor com o professor escolhido', () => {
    expect(planRoleChange(ANA, { role: 'professor', professorId: 'prof-lu' })).toEqual({ role: 'professor', professorId: 'prof-lu' });
  });

  it('consultor que escolhe Professor sem professor leva o id vazio, para a tela pedir', () => {
    expect(planRoleChange(ANA, { role: 'professor' })).toEqual({ role: 'professor', professorId: '' });
  });

  it('professor volta a consultor e perde o professor', () => {
    expect(planRoleChange(PROF_RAFA, { role: 'consultant', professorId: 'prof-rafa' })).toEqual({ role: 'consultant', professorId: null });
  });

  it('qualquer outro papel pedido vira consultor', () => {
    expect(planRoleChange(PROF_RAFA, { role: 'admin' })).toEqual({ role: 'consultant', professorId: null });
  });

  it('professor que troca de professor muda; o mesmo professor não muda nada', () => {
    expect(planRoleChange(PROF_RAFA, { role: 'professor', professorId: 'prof-lu' })).toEqual({ role: 'professor', professorId: 'prof-lu' });
    expect(planRoleChange(PROF_RAFA, { role: 'professor', professorId: 'prof-rafa' })).toBeNull();
  });
});

describe('conferências do servidor', () => {
  it('o professorId precisa ter formato de id de documento', () => {
    for (const ruim of [undefined, null, '', 42, 'a/b', '.', '..', '__x__', 'x'.repeat(129)]) {
      expect(professorIdProblem(ruim)).toEqual({ status: 400, code: 'professor_obrigatorio', error: PROFESSOR_LINK_MESSAGES.missing });
    }
    expect(professorIdProblem('prof-rafa')).toBeNull();
  });

  it('sem o módulo, recusa; com ele, segue', () => {
    expect(professorModuleProblem([])).toEqual({ status: 403, code: 'modulo_desligado', error: PROFESSOR_LINK_MESSAGES.moduleOff });
    expect(professorModuleProblem(undefined)).toEqual({ status: 403, code: 'modulo_desligado', error: PROFESSOR_LINK_MESSAGES.moduleOff });
    expect(professorModuleProblem(['faltosos'])).toBeNull();
    expect(professorModuleProblem({ modules: ['faltosos'] })).toBeNull();
  });

  it('professor fora do cadastro, inativo ou com login de outra pessoa', () => {
    expect(professorLinkProblem({ professor: null })).toMatchObject({ status: 422, code: 'professor_sumiu', error: PROFESSOR_LINK_MESSAGES.notFound });
    expect(professorLinkProblem({ professor: { ativo: false } })).toMatchObject({ status: 422, code: 'professor_inativo', error: PROFESSOR_LINK_MESSAGES.inactive });
    expect(professorLinkProblem({ professor: { ativo: true }, linkedUsers: [PROF_RAFA] })).toMatchObject({ status: 409, code: 'professor_com_login', error: PROFESSOR_LINK_MESSAGES.taken });
  });

  it('o vínculo da própria pessoa não conta como ocupado, e professor sem o campo ativo serve', () => {
    expect(professorLinkProblem({ professor: { ativo: true }, linkedUsers: [PROF_RAFA], exceptUserId: 'u-rafa' })).toBeNull();
    expect(professorLinkProblem({ professor: {}, linkedUsers: [] })).toBeNull();
    expect(professorLinkProblem({ professor: {}, linkedUsers: [{ id: 'u-x', role: 'consultant', professorId: 'prof-rafa' }] })).toBeNull();
  });
});

describe('textos das recusas', () => {
  it('dizem o nome de quem não pode virar professor e para onde ir', () => {
    expect(PROFESSOR_LINK_MESSAGES.ownsLeads('Ana Souza'))
      .toBe('Ana Souza ainda tem leads na carteira, contando clientes e perdas. Passe os leads em Configurações → Migrar leads, marcando Leads em aberto, Clientes ativos e Perdas, antes de mudar o papel para Professor.');
    expect(PROFESSOR_LINK_MESSAGES.ownsLeads('')).toMatch(/^Essa pessoa ainda tem leads na carteira,/);
    expect(PROFESSOR_LINK_MESSAGES.legacyRecord('Beto')).toMatch(/^Beto tem um cadastro antigo/);
  });

  // O set-role barra qualquer lead da pessoa, e o Migrar leads abre só com
  // "Leads em aberto" marcado. O texto da recusa diz o nome da tela e os três
  // tipos como a tela escreve: se um deles mudar lá, o gestor não acharia.
  it('a recusa da carteira usa os nomes da tela Migrar leads', () => {
    const texto = PROFESSOR_LINK_MESSAGES.ownsLeads('Ana');
    const telaMigrar = SETTINGS_RAIL_GROUPS.flatMap((g) => g.items).find((i) => i.id === 'transfer');
    expect(texto).toContain(`Configurações → ${telaMigrar.label}`);
    const tela = readFileSync(TRANSFER_TAB_PATH, 'utf8');
    for (const tipo of ['Leads em aberto', 'Clientes ativos', 'Perdas']) {
      expect(tela, tipo).toContain(`label: '${tipo}'`);
      expect(texto, tipo).toContain(tipo);
    }
  });

  it('sem travessão nem aspas curvas', () => {
    const textos = Object.values(PROFESSOR_LINK_MESSAGES).map((m) => (typeof m === 'function' ? m('Ana') : m));
    for (const texto of textos) expect(texto, texto).not.toMatch(/[—–“”‘’]/);
  });
});
