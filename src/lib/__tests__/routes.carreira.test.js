// Configurações → Plano de carreira no endereço (plano
// 2026-11-26-plano-de-carreira-02, tarefa 4): a lista em
// /configuracoes/carreira, a trilha em /configuracoes/carreira/<id> e a aba das
// regras em /<id>/regras, lidas à parte no readScreen, no molde do modelo de
// rotina.
import { describe, it, expect } from 'vitest';
import { hrefFor, parseAppPath, routeDecision, routeTemplate, screenKey } from '../routes.js';
import { screenState } from '../appShell.js';
import { scrubLeadPath } from '../sentryScrub.js';

const T = 'stronix-crm-app';
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: ['faltosos'] };
const decide = (path, user) => routeDecision(parseAppPath(path), user);

describe('endereço do plano de carreira', () => {
  it('a lista, a trilha e a aba das regras', () => {
    expect(parseAppPath(`/${T}/configuracoes/carreira`)).toMatchObject({ screen: 'settings', sub: 'carreira', subUnknown: false });
    expect('trilhaId' in parseAppPath(`/${T}/configuracoes/carreira`)).toBe(false);
    expect(parseAppPath(`/${T}/configuracoes/carreira/professor`)).toMatchObject({ screen: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'metas', subUnknown: false });
    expect(parseAppPath(`/${T}/configuracoes/carreira/trilha-a1b2c3/regras`)).toMatchObject({ sub: 'carreira', trilhaId: 'trilha-a1b2c3', trilhaAba: 'regras' });
    expect(parseAppPath(`/${T}/configuracoes/Carreira/professor/REGRAS`)).toMatchObject({ trilhaId: 'professor', trilhaAba: 'regras' });
  });

  it('segmento a mais é sub-tela desconhecida, e as outras seções não leem id', () => {
    expect(parseAppPath(`/${T}/configuracoes/carreira/professor/x`)).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(parseAppPath(`/${T}/configuracoes/carreira/professor/regras/x`)).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(parseAppPath(`/${T}/configuracoes/equipe/professor`)).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(parseAppPath(`/${T}/configuracoes/equipe`)).toMatchObject({ screen: 'settings', sub: 'team', rest: ['equipe'] });
  });

  it('hrefFor monta os três endereços, e o id que não serve some', () => {
    expect(hrefFor(T, 'settings', { sub: 'carreira' })).toBe(`/${T}/configuracoes/carreira`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'professor' })).toBe(`/${T}/configuracoes/carreira/professor`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'professor', trilhaAba: 'metas' })).toBe(`/${T}/configuracoes/carreira/professor`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'professor', trilhaAba: 'regras' })).toBe(`/${T}/configuracoes/carreira/professor/regras`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'a/b' })).toBe(`/${T}/configuracoes/carreira`);
    expect(hrefFor(T, 'settings', { sub: 'team', trilhaId: 'professor' })).toBe(`/${T}/configuracoes/equipe`);
  });

  it('a trilha não entra na chave da tela nem no molde do Sentry, e o id sai do texto', () => {
    expect(screenKey(parseAppPath(`/${T}/configuracoes/carreira/professor/regras`))).toBe('settings');
    expect(routeTemplate(`/${T}/configuracoes/carreira/professor`)).toBe('/:tenant/configuracoes');
    expect(scrubLeadPath(`/${T}/configuracoes/carreira/professor/regras`)).toBe(`/${T}/configuracoes/carreira/:trilhaId/regras`);
    expect(scrubLeadPath(`/${T}/configuracoes/carreira/trilha-a1b2c3?x=1`)).toBe(`/${T}/configuracoes/carreira/:trilhaId?x=1`);
    expect(scrubLeadPath(`/${T}/configuracoes/carreira`)).toBe(`/${T}/configuracoes/carreira`);
    expect(scrubLeadPath(scrubLeadPath(`/${T}/configuracoes/carreira/professor`))).toBe(`/${T}/configuracoes/carreira/:trilhaId`);
  });

  it('o screenState devolve a trilha e a aba', () => {
    expect(screenState(parseAppPath(`/${T}/configuracoes/carreira/professor/regras`), null, gestor)).toMatchObject({
      activeTab: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'regras',
    });
    expect(screenState(parseAppPath(`/${T}/configuracoes/carreira`), null, gestor)).toMatchObject({ sub: 'carreira', trilhaId: null, trilhaAba: null });
    expect(screenState(parseAppPath(`/${T}/configuracoes/equipe`), null, gestor)).toMatchObject({ trilhaId: null, trilhaAba: null });
  });

  it('o endereço da trilha abre de primeira, e a trilha de outra academia cai na lista da sessão', () => {
    expect(decide(`/${T}/configuracoes/carreira/professor/regras`, gestor)).toEqual({ kind: 'ok' });
    expect(decide('/outra-academia/configuracoes/carreira/professor', gestor)).toMatchObject({ kind: 'redirect', to: `/${T}/configuracoes/carreira` });
  });

  it('a correção de academia leva a trilha e a aba no alvo', () => {
    expect(decide(`/STRONIX-CRM-APP/configuracoes/carreira/professor/regras`, gestor)).toMatchObject({
      kind: 'redirect',
      to: `/${T}/configuracoes/carreira/professor/regras`,
      target: { screen: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'regras' },
    });
  });
});
