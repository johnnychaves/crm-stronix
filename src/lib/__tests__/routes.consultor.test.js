// O perfil do consultor (plano de carreira, PR 4): /carreira/consultor/<id>/<aba>,
// atrás do módulo. O gestor abre qualquer um; o consultor só o dele.
import { describe, it, expect } from 'vitest';
import { parseAppPath, hrefFor, canAccess, routeDecision, screenKey } from '../routes.js';
import { screenState } from '../appShell.js';
import { scrubLeadPath } from '../sentryScrub.js';
import { sidebarNav } from '../sidebarNav.js';

const T = 'stronix-crm-app';
const MOD = ['faltosos'];
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: MOD };
const ana = { id: 'ana', authUid: 'uid-ana', role: 'consultant', tenantId: T, tenantModules: MOD };
const anaSemModulo = { ...ana, tenantModules: [] };
const professor = { id: 'u6', authUid: 'uid-6', role: 'professor', professorId: 'P1', tenantId: T, tenantModules: MOD };
const decide = (path, user) => routeDecision(parseAppPath(path), user);

describe('endereço do perfil do consultor', () => {
  it('lê o id e a aba, com Vendas como padrão', () => {
    expect(parseAppPath(`/${T}/carreira/consultor/ana`)).toMatchObject({ screen: 'consultorPerfil', profId: 'ana', sub: null });
    expect(parseAppPath(`/${T}/carreira/consultor/ana/meta-diaria`)).toMatchObject({ screen: 'consultorPerfil', profId: 'ana', sub: 'meta' });
    expect(parseAppPath(`/${T}/carreira/consultor/ana/x`)).toMatchObject({ screen: 'consultorPerfil', subUnknown: true });
    expect(screenState(parseAppPath(`/${T}/carreira/consultor/ana`), null, gestor)).toMatchObject({ activeTab: 'consultorPerfil', profId: 'ana', sub: 'vendas' });
  });

  it('monta o endereço, e o id que não serve some', () => {
    expect(hrefFor(T, 'consultorPerfil', { profId: 'ana' })).toBe(`/${T}/carreira/consultor/ana`);
    expect(hrefFor(T, 'consultorPerfil', { profId: 'ana', sub: 'renovacao' })).toBe(`/${T}/carreira/consultor/ana/renovacao`);
    expect(hrefFor(T, 'consultorPerfil', { profId: 'a/b' })).toBeNull();
  });

  it('a chave da tela é por pessoa e o id sai do Sentry', () => {
    expect(screenKey(parseAppPath(`/${T}/carreira/consultor/ana/vendas`))).toBe('consultorPerfil:ana');
    expect(scrubLeadPath(`/${T}/carreira/consultor/AbC123/vendas`)).toBe(`/${T}/carreira/consultor/:pessoaId/vendas`);
    // A trilha Consultor das Configurações continua com o id da trilha.
    expect(scrubLeadPath(`/${T}/configuracoes/carreira/consultor/regras`)).toBe(`/${T}/configuracoes/carreira/:trilhaId/regras`);
  });
});

describe('quem abre', () => {
  it('o gestor abre qualquer um, o consultor só o dele, o professor nenhum', () => {
    expect(canAccess('consultorPerfil', gestor)).toBe(true);
    expect(canAccess('consultorPerfil', ana)).toBe(true);
    expect(canAccess('consultorPerfil', anaSemModulo)).toBe(false);
    expect(canAccess('consultorPerfil', professor)).toBe(false);
    expect(decide(`/${T}/carreira/consultor/ana`, ana)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/carreira/consultor/bruno/renovacao`, ana)).toMatchObject({ kind: 'redirect', to: `/${T}/carreira/consultor/ana/renovacao`, notice: 'nao-liberada' });
    expect(decide(`/${T}/carreira/consultor/bruno`, gestor)).toEqual({ kind: 'ok' });
  });

  it('o perfil de outra academia cai na lista da sessão', () => {
    expect(decide('/outra-academia/carreira/consultor/ana', gestor)).toMatchObject({ kind: 'redirect', to: `/${T}/carreira` });
  });

  it('o consultor com o módulo tem o Minha carreira', () => {
    expect(sidebarNav(ana).meuPerfil).toBeTruthy();
    expect(sidebarNav(anaSemModulo).meuPerfil).toBeFalsy();
    expect(sidebarNav(gestor).meuPerfil).toBeFalsy();
  });
});
