// A casca do App lê a tela, a ficha e a subaba do super-admin do endereço
// (src/lib/appShell.js). Estes testes travam o que o menu acende e o que a ficha
// recebe, sem montar o App, que depende do Firebase.

import { describe, it, expect } from 'vitest';
import { parseAppPath } from '../routes.js';
import {
  fichaOrigin, screenState, sessionKeyFor, loginTenantSlug,
  loginBrand, logoutDestination, returnToFrom, savedFunnelKey, readSavedFunnel,
} from '../appShell.js';

const T = 'stronix-crm-app';
const consultor = { id: 'u1', authUid: 'uid-1', role: 'consultor', tenantId: T };
const gestor = { id: 'u2', authUid: 'uid-2', role: 'admin', tenantId: T };
const superMembro = { id: 'u3', authUid: 'uid-3', role: 'admin', tenantId: T, superAdmin: true };

describe('screenState', () => {
  it('tela comum: o menu acende a tela do endereço e não há ficha', () => {
    const s = screenState(parseAppPath(`/${T}/pipeline`), null, consultor);
    expect(s).toEqual({ fichaOpen: false, profileLeadId: null, activeTab: 'kanban', resolvedTab: 'kanban', superTab: 'overview' });
  });

  it('endereço curto da academia abre o Operacional', () => {
    const s = screenState(parseAppPath(`/${T}`), null, consultor);
    expect(s.activeTab).toBe('dashboard');
    expect(s.resolvedTab).toBe('dashOperacional');
  });

  it('ficha aberta a partir de uma tela mantém a tela de origem acesa', () => {
    const s = screenState(parseAppPath(`/${T}/ficha/AbC123`), { from: 'dailyGoal' }, consultor);
    expect(s.fichaOpen).toBe(true);
    expect(s.profileLeadId).toBe('AbC123');
    expect(s.activeTab).toBe('dailyGoal');
    expect(s.resolvedTab).toBe('dailyGoal');
  });

  it('ficha aberta direto numa aba nova vira a tela "ficha"', () => {
    const s = screenState(parseAppPath(`/${T}/ficha/AbC123`), null, consultor);
    expect(s.activeTab).toBe('ficha');
    expect(s.resolvedTab).toBe('ficha');
  });

  it('id de ficha inválido deixa a ficha aberta sem id (painel de não encontrada)', () => {
    const s = screenState(parseAppPath(`/${T}/ficha/..`), null, consultor);
    expect(s.fichaOpen).toBe(true);
    expect(s.profileLeadId).toBeNull();
  });

  it('subaba do super-admin vem do endereço', () => {
    expect(screenState(parseAppPath(`/${T}/super-admin/planos`), null, superMembro).superTab).toBe('plans');
    expect(screenState(parseAppPath(`/${T}/super-admin`), null, superMembro).superTab).toBe('overview');
  });

  it('sem tela conhecida (antes do login, endereço estranho) cai na tela inicial', () => {
    const s = screenState({ screen: null, leadId: null, superTab: null }, null, null);
    expect(s.activeTab).toBe('dashboard');
    expect(s.fichaOpen).toBe(false);
  });
});

describe('fichaOrigin', () => {
  it('aceita tela conhecida que a sessão vê', () => {
    expect(fichaOrigin({ from: 'kanban' }, consultor)).toBe('kanban');
    expect(fichaOrigin({ from: 'dashCrm' }, consultor)).toBe('dashCrm');
  });

  it('tela de gestor só vale para gestor', () => {
    expect(fichaOrigin({ from: 'settings' }, consultor)).toBeNull();
    expect(fichaOrigin({ from: 'settings' }, gestor)).toBe('settings');
  });

  it('recusa a própria ficha, tela desconhecida, nome herdado do objeto e lixo', () => {
    expect(fichaOrigin({ from: 'ficha' }, gestor)).toBeNull();
    expect(fichaOrigin({ from: 'xyz' }, gestor)).toBeNull();
    expect(fichaOrigin({ from: 'toString' }, gestor)).toBeNull();
    expect(fichaOrigin({ from: 42 }, gestor)).toBeNull();
    expect(fichaOrigin(null, gestor)).toBeNull();
    expect(fichaOrigin('kanban', gestor)).toBeNull();
  });
});

describe('sessionKeyFor', () => {
  it('academia mais o uid do login', () => {
    expect(sessionKeyFor(consultor)).toBe(`${T}:uid-1`);
  });

  it('sem authUid usa o id do usuário', () => {
    expect(sessionKeyFor({ id: 'u9', tenantId: T })).toBe(`${T}:u9`);
  });

  it('sem sessão de academia não há chave', () => {
    expect(sessionKeyFor(null)).toBeNull();
    expect(sessionKeyFor({ id: 'x', authUid: 'x', superAdminOnly: true, tenantId: null })).toBeNull();
    expect(sessionKeyFor({ tenantId: T })).toBeNull();
  });
});

describe('loginTenantSlug', () => {
  it('lê a academia do caminho, em minúsculas', () => {
    expect(loginTenantSlug({ pathname: '/Stronix-CRM-App/ficha/AbC', hash: '' })).toBe(T);
    expect(loginTenantSlug({ pathname: `/${T}` })).toBe(T);
  });

  it('palavra de tela no caminho não é academia', () => {
    expect(loginTenantSlug({ pathname: '/pipeline', hash: '' })).toBeNull();
    expect(loginTenantSlug({ pathname: '/', hash: '' })).toBeNull();
  });

  it('mantém o hash dos links antigos', () => {
    expect(loginTenantSlug({ pathname: '/', hash: '#academia-power-club' })).toBe('academia-power-club');
    expect(loginTenantSlug({ pathname: '/', hash: '#/t/petros-barbell-club' })).toBe('petros-barbell-club');
    expect(loginTenantSlug({ pathname: '/', hash: '#/Academia-Shape-One?x=1' })).toBe('academia-shape-one');
  });

  it('hash com palavra reservada ou fora do formato não vale', () => {
    expect(loginTenantSlug({ pathname: '/', hash: '#pipeline' })).toBeNull();
    expect(loginTenantSlug({ pathname: '/', hash: '#ab c' })).toBeNull();
    expect(loginTenantSlug({})).toBeNull();
  });
});

describe('loginBrand', () => {
  it('sem academia no endereço, sem marca', () => {
    expect(loginBrand(null, { slug: T, found: true, displayName: 'STRONIX' })).toBeNull();
  });

  it('carregando até a resposta daquela academia chegar', () => {
    expect(loginBrand(T, null)).toEqual({ slug: T, loading: true });
    expect(loginBrand(T, { slug: 'outra', found: true, displayName: 'Outra' })).toEqual({ slug: T, loading: true });
  });

  it('com a resposta da mesma academia, a resposta', () => {
    const r = { slug: T, found: true, displayName: 'STRONIX' };
    expect(loginBrand(T, r)).toBe(r);
    expect(loginBrand('xyz', { slug: 'xyz', found: false })).toEqual({ slug: 'xyz', found: false });
  });
});

describe('logoutDestination', () => {
  it('membro volta para o login da própria academia', () => {
    expect(logoutDestination(consultor)).toBe(`/${T}`);
    expect(logoutDestination(gestor)).toBe(`/${T}`);
  });

  it('super-admin puro e sessão assumida vão para o login geral', () => {
    expect(logoutDestination({ id: 'x', superAdminOnly: true, tenantId: null })).toBe('/');
    expect(logoutDestination({ ...gestor, tenantId: 'academia-shape-one', impersonating: true })).toBe('/');
  });

  it('sem sessão, login geral', () => {
    expect(logoutDestination(null)).toBe('/');
  });
});

describe('returnToFrom', () => {
  const assumida = { ...gestor, tenantId: 'academia-shape-one', impersonating: true };

  it('guarda a academia assumida e o endereço de onde o super-admin entrou', () => {
    expect(returnToFrom({ viewing: { id: 'academia-shape-one' }, returnPath: `/${T}/super-admin/clientes` }, assumida))
      .toEqual({ fromTenant: 'academia-shape-one', path: `/${T}/super-admin/clientes` });
    expect(returnToFrom({ returnPath: '/' }, assumida)).toEqual({ fromTenant: 'academia-shape-one', path: '/' });
  });

  it('entrada antiga sem returnPath não tem volta', () => {
    expect(returnToFrom({ viewing: { id: 'academia-shape-one' } }, assumida)).toBeNull();
    expect(returnToFrom(null, assumida)).toBeNull();
  });

  it('só aceita caminho do próprio site', () => {
    expect(returnToFrom({ returnPath: '//evil.example/x' }, assumida)).toBeNull();
    expect(returnToFrom({ returnPath: 'https://evil.example/' }, assumida)).toBeNull();
    expect(returnToFrom({ returnPath: '/\\evil.example' }, assumida)).toBeNull();
    expect(returnToFrom({ returnPath: 42 }, assumida)).toBeNull();
  });

  it('sem academia na sessão não há volta', () => {
    expect(returnToFrom({ returnPath: `/${T}` }, null)).toBeNull();
  });
});

describe('funil salvo', () => {
  const storage = (data) => ({ getItem: (k) => (k in data ? data[k] : null) });

  it('a chave é por academia', () => {
    expect(savedFunnelKey('academia-shape-one')).toBe('crm-selected-funnel:academia-shape-one');
  });

  it('lê o funil salvo da academia certa', () => {
    const s = storage({ 'crm-selected-funnel:academia-shape-one': 'f-shape', [`crm-selected-funnel:${T}`]: 'f-stronix' });
    expect(readSavedFunnel(s, 'academia-shape-one')).toBe('f-shape');
    expect(readSavedFunnel(s, T)).toBe('f-stronix');
  });

  it('nada salvo, sem academia ou armazenamento bloqueado dá null', () => {
    expect(readSavedFunnel(storage({}), T)).toBeNull();
    expect(readSavedFunnel(storage({ x: 'y' }), '')).toBeNull();
    expect(readSavedFunnel({ getItem: () => { throw new Error('bloqueado'); } }, T)).toBeNull();
    expect(readSavedFunnel(null, T)).toBeNull();
  });
});
