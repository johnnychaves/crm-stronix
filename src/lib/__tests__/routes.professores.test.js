// Telas de Professores (spec docs/superpowers/specs/2026-11-24-perfil-do-professor-design.md,
// PR 3): a lista e as metas do gestor e o perfil, que o professor abre só no
// dele. As duas pedem o módulo da STRONIX (Stronix 2.0, chave `faltosos`).
import { describe, it, expect } from 'vitest';
import { parseAppPath, hrefFor, canAccess, routeDecision, screenKey } from '../routes.js';
import { screenState } from '../appShell.js';
import { scrubLeadPath } from '../sentryScrub.js';

const T = 'stronix-crm-app';
const MOD = ['faltosos'];
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: MOD };
const gestorSemModulo = { id: 'u1', role: 'admin', tenantId: T, tenantModules: [] };
const consultor = { id: 'u2', role: 'consultant', tenantId: T, tenantModules: MOD };
const professor = { id: 'u6', authUid: 'uid-6', role: 'professor', professorId: 'P1', tenantId: T, tenantModules: MOD };
const semLigacao = { id: 'u7', authUid: 'uid-7', role: 'professor', tenantId: T, tenantModules: MOD };

const decide = (path, user) => routeDecision(parseAppPath(path), user);

describe('endereço das telas de professores', () => {
  it('lista e metas', () => {
    expect(parseAppPath(`/${T}/professores`)).toMatchObject({ screen: 'professores', sub: null, subUnknown: false, unknown: false });
    expect(parseAppPath(`/${T}/professores/metas`)).toMatchObject({ screen: 'professores', sub: 'metas' });
    expect(parseAppPath(`/${T}/professores/xyz`)).toMatchObject({ screen: 'professores', subUnknown: true });
    expect(hrefFor(T, 'professores', { sub: 'metas' })).toBe(`/${T}/professores/metas`);
    expect(hrefFor(T, 'professores')).toBe(`/${T}/professores`);
  });

  it('perfil, com o id e a aba', () => {
    expect(parseAppPath(`/${T}/professores/perfil/P1`)).toMatchObject({ screen: 'professorPerfil', profId: 'P1', sub: null });
    expect(parseAppPath(`/${T}/professores/perfil/P1/aulas`)).toMatchObject({ screen: 'professorPerfil', profId: 'P1', sub: 'aulas' });
    expect(parseAppPath(`/${T}/professores/perfil/P1/x`)).toMatchObject({ screen: 'professorPerfil', profId: 'P1', subUnknown: true });
    expect(parseAppPath(`/${T}/professores/perfil`)).toMatchObject({ screen: 'professorPerfil', profId: null });
    expect('profId' in parseAppPath(`/${T}/professores`)).toBe(false);
    expect(hrefFor(T, 'professorPerfil', { profId: 'P1', sub: 'aulas' })).toBe(`/${T}/professores/perfil/P1/aulas`);
    expect(hrefFor(T, 'professorPerfil', { profId: 'P1' })).toBe(`/${T}/professores/perfil/P1`);
    expect(hrefFor(T, 'professorPerfil', { profId: 'a/b' })).toBeNull();
    expect(hrefFor(T, 'professorPerfil', {})).toBeNull();
  });

  it('a chave da tela é por professor e não muda com a aba', () => {
    expect(screenKey(parseAppPath(`/${T}/professores/perfil/P1`))).toBe('professorPerfil:P1');
    expect(screenKey(parseAppPath(`/${T}/professores/perfil/P1/aulas`))).toBe('professorPerfil:P1');
    expect(screenKey(parseAppPath(`/${T}/professores/metas`))).toBe('professores');
  });

  it('o screenState devolve o id do perfil', () => {
    expect(screenState(parseAppPath(`/${T}/professores/perfil/P1`), null, gestor)).toMatchObject({ activeTab: 'professorPerfil', profId: 'P1', sub: 'carteira' });
    expect(screenState(parseAppPath(`/${T}/professores`), null, gestor)).toMatchObject({ activeTab: 'professores', profId: null, sub: 'lista' });
  });

  it('o id do perfil sai do Sentry', () => {
    expect(scrubLeadPath(`/${T}/professores/perfil/AbC123/carteira`)).toBe(`/${T}/professores/perfil/:profId/carteira`);
  });
});

describe('quem abre', () => {
  it('a lista é do gestor com o módulo', () => {
    expect(canAccess('professores', gestor)).toBe(true);
    expect(canAccess('professores', gestorSemModulo)).toBe(false);
    expect(canAccess('professores', consultor)).toBe(false);
    expect(canAccess('professores', professor)).toBe(false);
  });

  it('o perfil é do gestor e do professor, com o módulo', () => {
    expect(canAccess('professorPerfil', gestor)).toBe(true);
    expect(canAccess('professorPerfil', professor)).toBe(true);
    expect(canAccess('professorPerfil', gestorSemModulo)).toBe(false);
    expect(canAccess('professorPerfil', consultor)).toBe(false);
    expect(canAccess('professorPerfil', { ...professor, tenantModules: [] })).toBe(false);
  });
});

describe('decisão de rota', () => {
  it('o professor no perfil de outro vai para o dele, com o aviso de tela não liberada', () => {
    expect(decide(`/${T}/professores/perfil/P2`, professor)).toMatchObject({ kind: 'redirect', to: `/${T}/professores/perfil/P1`, notice: 'nao-liberada' });
    expect(decide(`/${T}/professores/perfil/P2/aulas`, professor)).toMatchObject({ to: `/${T}/professores/perfil/P1/aulas` });
    expect(decide(`/${T}/professores/perfil/P1`, professor)).toEqual({ kind: 'ok' });
  });

  it('o professor sem cadastro ligado vai para a inicial com aviso', () => {
    expect(decide(`/${T}/professores/perfil/P1`, semLigacao)).toMatchObject({ kind: 'redirect', to: `/${T}/meta-diaria`, notice: 'nao-liberada' });
  });

  it('o gestor abre qualquer perfil, e sem o módulo não abre nada', () => {
    expect(decide(`/${T}/professores/perfil/P2`, gestor)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/professores`, gestorSemModulo)).toMatchObject({ kind: 'redirect', to: `/${T}`, notice: 'nao-encontrada' });
    expect(decide(`/${T}/professores/perfil/P1`, { ...professor, tenantModules: [] })).toMatchObject({ kind: 'redirect', to: `/${T}/meta-diaria`, notice: 'nao-encontrada-meta' });
    expect(decide(`/${T}/professores`, consultor)).toMatchObject({ kind: 'redirect', notice: 'so-gestor' });
  });

  it('o perfil de outra academia cai na lista da sessão, sem o id', () => {
    expect(decide('/outra-academia/professores/perfil/P1', gestor)).toMatchObject({ kind: 'redirect', to: `/${T}/professores` });
  });
});
