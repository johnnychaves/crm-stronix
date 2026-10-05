// O menu lateral pergunta ao mesmo canAccess da decisão de rota. O professor
// fica com Meta diária e Clientes (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"), e o resto da equipe vê o menu de sempre. Com o módulo desligado na
// academia, o professor não tem tela nenhuma e o App mostra só o aviso.
import { describe, it, expect } from 'vitest';
import { sidebarNav, professorAccessOff } from '../sidebarNav.js';
import { hrefFor, parseAppPath, routeDecision } from '../routes.js';

const T = 'stronix-crm-app';
const COM_MODULO = ['faltosos'];
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: [] };
const consultor = { id: 'u2', role: 'consultant', tenantId: T, tenantModules: [] };
// Cadastro antigo sem papel conta como consultor (roleOf).
const semPapel = { id: 'u3', tenantId: T };
const professor = { id: 'u4', role: 'professor', professorId: 'p1', tenantId: T, tenantModules: COM_MODULO };
const semLigacao = { id: 'u5', role: 'professor', tenantId: T, tenantModules: COM_MODULO };

const TUDO = { overview: true, kanban: true, clientes: true, dailyGoal: true, leads: true, suporte: true };
const DO_PROFESSOR = { overview: false, kanban: false, clientes: true, dailyGoal: true, leads: false, suporte: false };

// As telas que cada item do menu abre (App.jsx, bloco Workspace).
const TELAS = {
  overview: ['dashOperacional', 'dashCrm', 'dashGerencial'],
  kanban: ['kanban'],
  clientes: ['clientes'],
  dailyGoal: ['dailyGoal'],
  leads: ['leads', 'aulas', 'visitas'],
};

describe('sidebarNav', () => {
  it('gestor, consultor e cadastro sem papel veem o menu inteiro, como antes', () => {
    for (const u of [gestor, consultor, semPapel]) expect(sidebarNav(u), u.id).toEqual(TUDO);
  });

  it('o professor vê só a Meta diária e Clientes, com ou sem professor ligado', () => {
    for (const u of [professor, semLigacao]) expect(sidebarNav(u), u.id).toEqual(DO_PROFESSOR);
  });

  it('todo item aceso abre de primeira, sem aviso de rota', () => {
    for (const u of [gestor, consultor, professor, semLigacao]) {
      const nav = sidebarNav(u);
      for (const [item, ids] of Object.entries(TELAS)) {
        if (!nav[item]) continue;
        for (const id of ids) {
          expect(routeDecision(parseAppPath(hrefFor(T, id)), u), `${u.id} ${id}`).toEqual({ kind: 'ok' });
        }
      }
    }
  });

  it('todo item apagado seria recusado pelo endereço', () => {
    for (const u of [professor, semLigacao]) {
      const nav = sidebarNav(u);
      for (const [item, ids] of Object.entries(TELAS)) {
        if (nav[item]) continue;
        for (const id of ids) {
          expect(routeDecision(parseAppPath(hrefFor(T, id)), u).kind, `${u.id} ${id}`).toBe('redirect');
        }
      }
    }
  });

  it('sem sessão não mostra o Suporte', () => {
    expect(sidebarNav(null).suporte).toBe(false);
  });
});

describe('professorAccessOff', () => {
  it('professor com o módulo ligado entra nas telas dele', () => {
    expect(professorAccessOff(professor)).toBe(false);
    expect(professorAccessOff(semLigacao)).toBe(false);
  });

  it('professor sem o módulo fica só com o aviso, inclusive quando a lista não veio', () => {
    expect(professorAccessOff({ ...professor, tenantModules: [] })).toBe(true);
    expect(professorAccessOff({ ...professor, tenantModules: undefined })).toBe(true);
    expect(professorAccessOff({ ...professor, tenantModules: 'faltosos' })).toBe(true);
    expect(professorAccessOff({ ...professor, tenantModules: ['outro'] })).toBe(true);
  });

  it('gestor, consultor, cadastro sem papel e sessão vazia nunca caem no aviso', () => {
    for (const u of [gestor, consultor, semPapel, null, undefined]) expect(professorAccessOff(u)).toBe(false);
  });
});
