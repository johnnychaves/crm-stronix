// A lista do que cada papel faz (src/lib/acesso.js): o papel do cadastro, quem
// vende, as ações e as telas do professor.
import { describe, it, expect } from 'vitest';
import {
  ROLES, roleOf, isGestor, isProfessor, isSeller, ROLE_LABELS, roleLabel,
  ACTIONS, can, PROFESSOR_SCREENS, canOpenScreen,
} from '../acesso.js';
import { SCREENS } from '../routes.js';

const gestor = { id: 'u1', role: 'admin', authUid: 'uid-1' };
const consultor = { id: 'u2', role: 'consultant', authUid: 'uid-2' };
const professor = { id: 'u3', role: 'professor', professorId: 'p1', authUid: 'uid-3' };
const semPapel = { id: 'u4', authUid: 'uid-4' };
const legado = { id: 'u5', role: 'consultor' };
const superPuro = { id: 'u6', role: 'superadmin', superAdminOnly: true };

describe('roleOf', () => {
  it('lê os três papéis gravados', () => {
    expect(roleOf(gestor)).toBe('admin');
    expect(roleOf(consultor)).toBe('consultant');
    expect(roleOf(professor)).toBe('professor');
  });

  it('sem papel, papel antigo ou desconhecido vale consultor, como sempre foi', () => {
    expect(roleOf(semPapel)).toBe('consultant');
    expect(roleOf(legado)).toBe('consultant');
    expect(roleOf(superPuro)).toBe('consultant');
    expect(roleOf(null)).toBe('consultant');
    expect(roleOf(undefined)).toBe('consultant');
  });

  it('compara exato, como as regras do Firestore', () => {
    expect(roleOf({ role: 'Admin' })).toBe('consultant');
    expect(roleOf({ role: ' admin' })).toBe('consultant');
    expect(roleOf({ role: 'PROFESSOR' })).toBe('consultant');
    expect(roleOf({ role: ['admin'] })).toBe('consultant');
  });
});

describe('isGestor, isProfessor e isSeller', () => {
  it('cada papel no seu lugar', () => {
    const todos = [gestor, consultor, professor];
    expect(todos.map((u) => isGestor(u))).toEqual([true, false, false]);
    expect(todos.map((u) => isProfessor(u))).toEqual([false, false, true]);
    expect(todos.map((u) => isSeller(u))).toEqual([true, true, false]);
  });

  it('cadastro sem papel e cadastro antigo vendem', () => {
    expect(isSeller(semPapel)).toBe(true);
    expect(isSeller(legado)).toBe(true);
  });

  it('sem usuário ninguém vende', () => {
    expect(isSeller(null)).toBe(false);
    expect(isSeller(undefined)).toBe(false);
  });

  it('serve direto no filter de uma lista da equipe', () => {
    expect([gestor, professor, consultor].filter(isSeller).map((u) => u.id)).toEqual(['u1', 'u2']);
  });
});

describe('roleLabel', () => {
  it('o nome do papel na tela', () => {
    expect(roleLabel(gestor)).toBe('Gestor');
    expect(roleLabel(consultor)).toBe('Consultor');
    expect(roleLabel(professor)).toBe('Professor');
    expect(roleLabel(semPapel)).toBe('Consultor');
    expect(roleLabel(undefined)).toBe('Consultor');
  });

  it('tem um nome para cada papel', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(Object.values(ROLES).sort());
  });
});

describe('tabelas', () => {
  it('os nomes das ações não mudam', () => {
    expect(ACTIONS).toEqual({
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
  });

  it('os papéis são os valores gravados no cadastro', () => {
    expect(ROLES).toEqual({ GESTOR: 'admin', CONSULTOR: 'consultant', PROFESSOR: 'professor' });
  });

  it('nada muda em tempo de execução', () => {
    for (const t of [ROLES, ACTIONS, PROFESSOR_SCREENS, ROLE_LABELS]) expect(Object.isFrozen(t)).toBe(true);
  });
});

describe('can', () => {
  const todas = Object.values(ACTIONS);

  it('gestor e consultor fazem todas as ações da lista, como hoje', () => {
    for (const action of todas) {
      expect(can(gestor, action), action).toBe(true);
      expect(can(consultor, action), action).toBe(true);
      expect(can(semPapel, action), action).toBe(true);
    }
  });

  it('professor não faz nenhuma, com ou sem professor ligado', () => {
    const solto = { id: 'u7', role: 'professor' };
    for (const action of todas) {
      expect(can(professor, action), action).toBe(false);
      expect(can(solto, action), action).toBe(false);
    }
  });

  it('as decisões do professor ditas com o nome: sem Suporte, sem leads na busca, sino sem carteira', () => {
    expect(can(professor, ACTIONS.SUPORTE_ABRIR)).toBe(false);
    expect(can(professor, ACTIONS.LEADS_VER)).toBe(false);
    expect(can(professor, ACTIONS.SINO_EQUIPE)).toBe(false);
    expect(can(consultor, ACTIONS.SUPORTE_ABRIR)).toBe(true);
    expect(can(gestor, ACTIONS.SUPORTE_ABRIR)).toBe(true);
  });

  it('sem usuário, nada', () => {
    for (const action of todas) {
      expect(can(null, action)).toBe(false);
      expect(can(undefined, action)).toBe(false);
    }
  });

  it('ação fora da lista é recusada para todos (tela é canOpenScreen, não can)', () => {
    expect(can(gestor, 'tela.pipeline')).toBe(false);
    expect(can(consultor, 'lead.excluir')).toBe(false);
    expect(can(gestor, undefined)).toBe(false);
  });
});

describe('canOpenScreen', () => {
  const telas = Object.keys(SCREENS);

  it('as telas do professor existem na tabela de endereços', () => {
    for (const id of PROFESSOR_SCREENS) expect(telas).toContain(id);
  });

  it('professor abre só a Meta diária, Clientes e a ficha', () => {
    expect(telas.filter((id) => canOpenScreen(professor, id)).sort()).toEqual(['clientes', 'dailyGoal', 'ficha']);
  });

  it('a tela inicial, os painéis, o Pipeline, Leads e as telas do gestor ficam fora para o professor', () => {
    for (const id of ['dashboard', 'dashOperacional', 'dashCrm', 'dashGerencial', 'kanban', 'leads', 'aulas', 'visitas', 'settings', 'profile', 'billing', 'superadmin']) {
      expect(canOpenScreen(professor, id), id).toBe(false);
    }
  });

  it('gestor e consultor passam em toda tela: as travas de gestor continuam no routes.js', () => {
    for (const id of telas) {
      expect(canOpenScreen(gestor, id), id).toBe(true);
      expect(canOpenScreen(consultor, id), id).toBe(true);
    }
  });

  it('sem usuário passa: quem decide o login é o routeDecision', () => {
    expect(canOpenScreen(null, 'kanban')).toBe(true);
  });

  it('id que não é tela fica fora para o professor', () => {
    expect(canOpenScreen(professor, 'constructor')).toBe(false);
    expect(canOpenScreen(professor, undefined)).toBe(false);
  });
});
