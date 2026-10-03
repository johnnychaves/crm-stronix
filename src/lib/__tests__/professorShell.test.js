// O App.jsx não monta em teste (Firebase, roteador e dezenas de assinaturas).
// Esta varredura lê o código dele e cobra as ligações do professor que os
// módulos puros não enxergam: o aviso de acesso desligado no lugar do app, o
// menu pelo sidebarNav, o Suporte pela lista de permissões e a Meta diária do
// professor no lugar da Meta do consultor (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Tira comentário de bloco e de linha, no molde das outras varreduras: uma
// linha comentada tem o mesmo texto da ligada e não liga nada.
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = semComentarios(readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8'));

describe('casca do App para o professor', () => {
  it('com o módulo desligado, o aviso entra depois do bloqueio da academia e antes do Console e do app', () => {
    const bloqueio = app.indexOf('if (!appUser.superAdminOnly && tenantBlock)');
    const aviso = app.indexOf('if (professorAccessOff(appUser)) {', bloqueio);
    const superPuro = app.indexOf('if (appUser.superAdminOnly) {', bloqueio);
    const casca = app.indexOf('<GeneralConfigContext.Provider', bloqueio);
    expect(bloqueio).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(bloqueio);
    expect(superPuro).toBeGreaterThan(aviso);
    expect(casca).toBeGreaterThan(superPuro);
    expect(app.slice(aviso, superPuro)).toContain('return <ProfessorAccessOffScreen onLogout={handleLogout} />;');
  });

  it('o menu de trabalho mostra cada item pelo sidebarNav', () => {
    expect(app).toContain('const nav = sidebarNav(appUser);');
    const menu = app.slice(app.indexOf('>Workspace</div>'), app.indexOf('>Administração</div>'));
    const itens = [
      ['overview', 'Visão geral'], ['kanban', 'Pipeline'], ['clientes', 'Clientes'],
      ['dailyGoal', 'Meta diária'], ['leads', 'Leads'], ['suporte', 'Suporte'],
    ];
    for (const [chave, rotulo] of itens) {
      const idx = menu.indexOf(`label="${rotulo}"`);
      expect(idx, rotulo).toBeGreaterThan(-1);
      const guarda = menu.lastIndexOf(`{nav.${chave} && `, idx);
      expect(guarda, rotulo).toBeGreaterThan(-1);
      // Entre a guarda e o rótulo não pode haver outro item do menu.
      expect(menu.slice(guarda, idx).match(/label="/g) ?? [], rotulo).toEqual([]);
    }
  });

  it('os chamados do Suporte só são assinados por quem pode abrir o Suporte', () => {
    expect(app).toMatch(/const ticketsOn = [^;]*&& can\(appUser, ACTIONS\.SUPORTE_ABRIR\);/);
  });

  it('a Meta diária do professor é o ProfessorGoalPlaceholder, e a do resto da equipe continua a DailyGoalView', () => {
    expect(app).toMatch(/activeTab === 'dailyGoal' && \(isProfessor\(appUser\)\s*\?\s*<ProfessorGoalPlaceholder appUser=\{appUser\} \/>\s*:\s*<DailyGoalView /);
  });

  it('só quem vende tem a Meta do consultor no selo do menu e nas consultas de renovação e de contato de hoje', () => {
    expect(app).toMatch(/const dailyGoalProgress = useMemo\(\(\) => \{\s*if \(!appUser\?\.id \|\| !isSeller\(appUser\)\) return \{ total: 0, pending: 0 \};/);
    expect(app).toMatch(/useRenewalClients\(\{[^}]*enabled: isSeller\(appUser\) \}\)/);
    expect(app).toMatch(/useClientsWithContactToday\(\{[^}]*enabled: isSeller\(appUser\) \}\)/);
  });
});
