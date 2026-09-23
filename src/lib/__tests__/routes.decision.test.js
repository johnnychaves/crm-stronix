import { describe, it, expect } from 'vitest';
import {
  SCREENS, parseAppPath, canAccess, routeDecision, ROUTE_NOTICES,
  backTarget, screenKey, documentTitle, routeTemplate, scrollActionFor,
} from '../routes.js';

const T = 'stronix-crm-app';
const admin = { id: 'u1', role: 'admin', tenantId: T };
const consultor = { id: 'u2', role: 'consultor', tenantId: T };
const superMembro = { id: 'u3', role: 'admin', tenantId: T, superAdmin: true };
const superPuro = { id: 'u4', role: 'admin', superAdmin: true, superAdminOnly: true, tenantId: null };
// "Acessar como" a academia-teste: a sessão assumida é admin de lá, sem superAdmin.
const assumida = { id: 'u5', role: 'admin', tenantId: 'academia-teste', impersonating: true };
const legado = { id: 'u9', role: 'admin', tenantId: 'Academia_Legada' };

const decide = (path, user, opts) => routeDecision(parseAppPath(path), user, opts);
const casa = (to, target, notice = null) => ({ kind: 'redirect', to, target: { leadId: null, superTab: null, sub: null, ...target }, notice });

describe('canAccess', () => {
  it('telas de gestor só para quem é admin', () => {
    for (const s of ['settings', 'profile', 'billing']) {
      expect(canAccess(s, admin), s).toBe(true);
      expect(canAccess(s, consultor), s).toBe(false);
      expect(canAccess(s, null), s).toBe(false);
    }
  });

  it('super-admin só com o claim, e nunca na sessão assumida', () => {
    expect(canAccess('superadmin', superMembro)).toBe(true);
    expect(canAccess('superadmin', admin)).toBe(false);
    expect(canAccess('superadmin', assumida)).toBe(false);
  });

  it('o resto passa para qualquer um', () => {
    for (const s of ['dashboard', 'dashOperacional', 'dashCrm', 'dashGerencial', 'kanban', 'clientes', 'dailyGoal', 'leads', 'aulas', 'visitas', 'ficha']) {
      expect(canAccess(s, consultor), s).toBe(true);
    }
    expect(canAccess(null, consultor)).toBe(true);
    expect(canAccess('constructor', consultor)).toBe(true);
  });
});

describe('ROUTE_NOTICES', () => {
  it('textos aprovados, sem travessão', () => {
    expect(ROUTE_NOTICES).toEqual({
      'so-gestor': 'Essa tela é só do gestor.',
      'nao-encontrada': 'Não achamos essa tela. Abrimos o Operacional.',
    });
    for (const txt of Object.values(ROUTE_NOTICES)) expect(txt).not.toMatch(/[—–]/);
    expect(Object.isFrozen(ROUTE_NOTICES)).toBe(true);
  });
});

describe('routeDecision 1: sem sessão', () => {
  it('o login aparece em qualquer endereço e não mexe nele', () => {
    for (const p of ['/', `/${T}/configuracoes`, '/outra/ficha/Ab12', '/xyz', '/pipeline']) {
      expect(decide(p, null), p).toEqual({ kind: 'ok' });
    }
  });
});

describe('routeDecision 2: super-admin puro', () => {
  it('o console só existe em /', () => {
    expect(decide('/', superPuro)).toEqual({ kind: 'ok' });
    expect(decide('/', superPuro, { search: '?a=1' })).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/pipeline`, superPuro)).toEqual(casa('/', { screen: null }));
    expect(decide('/academia-teste/super-admin/planos', superPuro)).toEqual(casa('/', { screen: null }));
  });
});

describe('routeDecision 3: sessão assumida', () => {
  it('endereço de outra academia vai para a tela inicial da assumida, sem aviso', () => {
    expect(decide(`/${T}/super-admin/clientes`, assumida)).toEqual(casa('/academia-teste', { screen: 'dashboard' }));
    expect(decide(`/${T}/pipeline`, assumida)).toEqual(casa('/academia-teste', { screen: 'dashboard' }));
    expect(decide('/', assumida)).toEqual(casa('/academia-teste', { screen: 'dashboard' }));
  });

  it('F5 durante a visualização fica onde está', () => {
    expect(decide('/academia-teste/pipeline', assumida)).toEqual({ kind: 'ok' });
    expect(decide('/ACADEMIA-TESTE/pipeline', assumida)).toEqual(casa('/academia-teste/pipeline', { screen: 'kanban' }));
  });

  it('assumiu a própria academia: o super-admin some em silêncio', () => {
    const propria = { ...assumida, tenantId: T };
    expect(decide(`/${T}/super-admin/clientes`, propria)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
  });
});

describe('routeDecision 4: volta da visualização', () => {
  const returnTo = { fromTenant: 'academia-teste', path: `/${T}/super-admin/clientes` };

  it('ainda no endereço da academia assumida: volta ao caminho guardado', () => {
    expect(decide('/academia-teste/pipeline', superMembro, { returnTo })).toEqual(
      casa(`/${T}/super-admin/clientes`, { screen: 'superadmin', superTab: 'clients' }),
    );
    expect(decide('/academia-teste', superMembro, { returnTo, search: '?a=1' }).to).toBe(`/${T}/super-admin/clientes`);
  });

  it('já na própria academia ou vindo de uma terceira: o caminho guardado não manda', () => {
    expect(decide(`/${T}/pipeline`, superMembro, { returnTo })).toEqual({ kind: 'ok' });
    expect(decide('/terceira/pipeline', superMembro, { returnTo })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
  });

  it('caminho guardado de outra academia, que a sessão não vê, ou torto: ignorado', () => {
    const outra = { fromTenant: 'academia-teste', path: '/terceira/pipeline' };
    expect(decide('/academia-teste/pipeline', superMembro, { returnTo: outra })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    const deGestor = { fromTenant: 'academia-teste', path: `/${T}/configuracoes` };
    expect(decide('/academia-teste/pipeline', consultor, { returnTo: deGestor })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    const semPath = { fromTenant: 'academia-teste' };
    expect(decide('/academia-teste/pipeline', superMembro, { returnTo: semPath })).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
  });

  it('barra dupla no caminho guardado vira uma barra só (o navigate recusa //host)', () => {
    const torto = { fromTenant: 'academia-teste', path: `//${T}//super-admin/planos` };
    expect(decide('/academia-teste', superMembro, { returnTo: torto }).to).toBe(`/${T}/super-admin/planos`);
  });

  it('returnTo da própria academia nunca prende a pessoa numa tela', () => {
    const proprio = { fromTenant: T, path: `/${T}/pipeline` };
    expect(decide(`/${T}/clientes`, superMembro, { returnTo: proprio })).toEqual({ kind: 'ok' });
  });
});

describe('routeDecision 5: endereço sem a academia da sessão', () => {
  it('raiz vai para a tela inicial, mantendo a query', () => {
    expect(decide('/', consultor, { search: '?x=1' })).toEqual(casa(`/${T}?x=1`, { screen: 'dashboard' }));
  });

  it('mesma academia com outra caixa: troca só o slug e mantém o resto', () => {
    expect(decide('/STRONIX-CRM-APP/ficha/AbC', consultor, { search: '?x=1' })).toEqual(
      casa(`/${T}/ficha/AbC?x=1`, { screen: 'ficha', leadId: 'AbC' }),
    );
    expect(decide('/Stronix-Crm-App', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
  });

  it('tela sem academia ganha a academia na frente', () => {
    expect(decide('/pipeline', consultor)).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    expect(decide('/visao-geral/crm', consultor)).toEqual(casa(`/${T}/visao-geral/crm`, { screen: 'dashCrm' }));
    expect(decide('/ficha/Jo%C3%A3o', consultor)).toEqual(casa(`/${T}/ficha/Jo%C3%A3o`, { screen: 'ficha', leadId: 'João' }));
    expect(decide('/super-admin/planos', superMembro)).toEqual(casa(`/${T}/super-admin/planos`, { screen: 'superadmin', superTab: 'plans' }));
  });

  it('outra academia: mantém a tela e descarta ficha e super-admin', () => {
    expect(decide('/outra/pipeline', consultor)).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    expect(decide('/outra/leads/aulas', consultor)).toEqual(casa(`/${T}/leads/aulas`, { screen: 'aulas' }));
    expect(decide('/outra/configuracoes/equipe', admin)).toEqual(casa(`/${T}/configuracoes/equipe`, { screen: 'settings', sub: 'team' }));
    expect(decide('/outra/ficha/AbC', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    expect(decide('/outra/super-admin/planos', superMembro)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    expect(decide('/outra', consultor, { search: '?x=1' })).toEqual(casa(`/${T}?x=1`, { screen: 'dashboard' }));
  });

  it('palavra reservada que não é tela e endereço torto sem academia: tela inicial, sem aviso', () => {
    for (const p of ['/assets', '/api/x', '/Foo_Bar/pipeline', '/outra/xyz', '/%E0%A4%A']) {
      expect(decide(p, consultor), p).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    }
  });

  it('endereço corrigido que cai numa tela de gestor já sai com o aviso, sem passo intermediário', () => {
    expect(decide('/configuracoes', consultor, { search: '?x=1' })).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide('/outra/plano-e-faturas', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
  });
});

describe('routeDecision 6: trava de acesso', () => {
  it('consultor em tela de gestor cai no Operacional com aviso', () => {
    for (const p of [`/${T}/configuracoes`, `/${T}/perfil-da-academia`, `/${T}/plano-e-faturas`, `/${T}/configuracoes/equipe`]) {
      expect(decide(p, consultor, { search: '?x=1' }), p).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    }
  });

  it('super-admin sem o claim cai no Operacional sem aviso', () => {
    expect(decide(`/${T}/super-admin/planos`, admin)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
  });

  it('quem pode, fica', () => {
    expect(decide(`/${T}/configuracoes`, admin)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/super-admin/planos`, superMembro)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/ficha/Ab12`, consultor)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}`, consultor)).toEqual({ kind: 'ok' });
  });
});

describe('routeDecision 7: endereço desconhecido', () => {
  it('tela inicial com aviso', () => {
    for (const p of [`/${T}/xyz`, `/${T}/leads/visita`, `/${T}/constructor`, `/${T}/%E0%A4%A`, `/${T}/leads/aulas/x`]) {
      expect(decide(p, admin), p).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'nao-encontrada'));
    }
  });

  it('ficha sem id ou com id inválido não é desconhecido: a ficha mostra "não encontrada"', () => {
    expect(decide(`/${T}/ficha`, consultor)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/ficha/a%2Fb`, consultor)).toEqual({ kind: 'ok' });
  });
});

describe('routeDecision: trava contra laço', () => {
  it('academia com id que não relê como ela mesma: o endereço não manda em nada', () => {
    for (const p of ['/', '/academia_legada/pipeline', `/${T}/configuracoes`, '/xyz']) {
      expect(decide(p, legado), p).toEqual({ kind: 'ok' });
      expect(decide(p, { ...legado, impersonating: true }), p).toEqual({ kind: 'ok' });
    }
    expect(decide('/', { id: 'u', role: 'admin', tenantId: 'pipeline' })).toEqual({ kind: 'ok' });
    expect(decide('/', { id: 'u', role: 'admin' })).toEqual({ kind: 'ok' });
  });

  it('o destino de todo redirect é aceito de primeira, com o alvo certo e visível', () => {
    const caminhos = [
      '/', '/outra', `/${T}/xyz`, `/${T}/configuracoes`, `/${T}/super-admin/planos`, `/${T}/ficha/a%2Fb`,
      '/Foo_Bar/pipeline', '/outra/ficha/Ab12', `/${T}/leads/visita`, '/pipeline', '/configuracoes',
      '/STRONIX-CRM-APP/leads/aulas', '/academia-teste/pipeline', '/api', '/%E0%A4%A', `//${T}//pipeline`,
    ];
    const retornos = [null, { fromTenant: 'academia-teste', path: `/${T}/super-admin/clientes` }];
    for (const user of [admin, consultor, superMembro, superPuro, assumida, legado]) {
      for (const returnTo of retornos) {
        for (const p of caminhos) {
          const d = decide(p, user, { search: '?a=1', returnTo });
          if (d.kind !== 'redirect') continue;
          const rotulo = `${user.id} ${p} -> ${d.to}`;
          expect(d.to.startsWith('//'), rotulo).toBe(false);
          const [path] = d.to.split('?');
          expect(decide(path, user, { returnTo }), rotulo).toEqual({ kind: 'ok' });
          const destino = parseAppPath(path);
          expect(d.target, rotulo).toEqual({ screen: destino.screen, leadId: destino.leadId, superTab: destino.superTab, sub: destino.sub });
          if (d.target.screen) expect(canAccess(d.target.screen, user), rotulo).toBe(true);
        }
      }
    }
  });
});

describe('backTarget', () => {
  it('com tela do app antes: voltar do navegador', () => {
    expect(backTarget({ historyState: { idx: 3 }, isClient: true, tenantId: T })).toEqual({ type: 'back' });
  });

  it('aba nova: Clientes para cliente, Pipeline para lead', () => {
    expect(backTarget({ historyState: { idx: 0 }, isClient: true, tenantId: T })).toEqual({ type: 'replace', href: `/${T}/clientes` });
    expect(backTarget({ historyState: null, isClient: false, tenantId: T })).toEqual({ type: 'replace', href: `/${T}/pipeline` });
  });

  it('academia fora do formato ainda tem para onde voltar', () => {
    expect(backTarget({ historyState: { idx: 0 }, isClient: false, tenantId: 'Academia_Legada' })).toEqual({ type: 'replace', href: '/Academia_Legada/pipeline' });
  });
});

describe('screenKey', () => {
  it('/<academia> e /visao-geral/operacional são a mesma tela', () => {
    expect(screenKey(parseAppPath(`/${T}`))).toBe('dashOperacional');
    expect(screenKey(parseAppPath(`/${T}/visao-geral/operacional`))).toBe('dashOperacional');
  });

  it('o resto e a subaba do super-admin não trocam a chave; outra ficha troca', () => {
    expect(screenKey(parseAppPath(`/${T}/configuracoes/equipe`))).toBe('settings');
    expect(screenKey(parseAppPath(`/${T}/ficha/a`))).toBe('ficha:a');
    expect(screenKey(parseAppPath(`/${T}/ficha/a`))).not.toBe(screenKey(parseAppPath(`/${T}/ficha/b`)));
    expect(screenKey(parseAppPath(`/${T}/super-admin/planos`))).toBe('superadmin');
    expect(screenKey(parseAppPath(`/${T}/super-admin/clientes`))).toBe('superadmin');
  });

  it('alvo de redirect e tela vazia', () => {
    expect(screenKey({ screen: 'kanban', leadId: null, superTab: null })).toBe('kanban');
    expect(screenKey({ screen: null })).toBe('dashboard');
    expect(screenKey(null)).toBe('dashboard');
  });
});

describe('documentTitle', () => {
  it('tela, academia e marca', () => {
    expect(documentTitle({ screen: 'dailyGoal', tenantName: 'STRONIX' })).toBe('Meta diária · STRONIX · STRONILEAD');
    expect(documentTitle({ screen: 'ficha', tenantName: 'STRONIX' })).toBe('Ficha · STRONIX · STRONILEAD');
    expect(documentTitle({ screen: 'kanban' })).toBe('Pipeline · STRONILEAD');
  });

  it('antes do login fica igual a hoje', () => {
    expect(documentTitle({ tenantName: 'STRONIX' })).toBe('STRONIX · STRONILEAD');
    expect(documentTitle({})).toBe('STRONILEAD');
    expect(documentTitle()).toBe('STRONILEAD');
    expect(documentTitle({ screen: 'constructor', tenantName: 'STRONIX' })).toBe('STRONIX · STRONILEAD');
  });

  it('todo título de tela existe', () => {
    for (const s of Object.keys(SCREENS)) expect(documentTitle({ screen: s }), s).toBe(`${SCREENS[s].title} · STRONILEAD`);
  });
});

describe('routeTemplate', () => {
  it('moldes com /:tenant e :leadId', () => {
    expect(routeTemplate('/')).toBe('/');
    expect(routeTemplate('')).toBe('/');
    expect(routeTemplate(`/${T}`)).toBe('/:tenant');
    expect(routeTemplate(`/${T}/pipeline`)).toBe('/:tenant/pipeline');
    expect(routeTemplate(`/${T}/leads/aulas`)).toBe('/:tenant/leads/aulas');
    expect(routeTemplate(`/${T}/visao-geral`)).toBe('/:tenant/visao-geral/operacional');
    expect(routeTemplate(`/${T}/ficha/Ab12`)).toBe('/:tenant/ficha/:leadId');
    expect(routeTemplate(`/${T}/ficha/Ab12/contratos`)).toBe('/:tenant/ficha/:leadId');
    expect(routeTemplate(`/${T}/configuracoes/equipe`)).toBe('/:tenant/configuracoes');
    expect(routeTemplate(`/${T}/super-admin`)).toBe('/:tenant/super-admin/visao-geral');
    expect(routeTemplate(`/${T}/xyz/11999990000`)).toBe('/:tenant/*');
    expect(routeTemplate('/ficha/Ab12')).toBe('/ficha/:leadId');
    expect(routeTemplate('/pipeline')).toBe('/pipeline');
    expect(routeTemplate('/i/stronix-crm-app')).toBe('/*');
  });

  it('nunca devolve dado real', () => {
    const caminhos = [
      `/${T}/ficha/Jo%C3%A3o%20Silva`, `/${T}/ficha/11999990000/contratos`, `/${T}/ficha/a%2Fb`,
      `/${T}/configuracoes/joao@x.com`, `/${T}/xyz/joao`, '/ficha/joao', '/joao-da-silva/pipeline', '/i/joao?ref=abc',
    ];
    for (const p of caminhos) {
      const molde = routeTemplate(p);
      expect(molde, p).not.toMatch(/joao|jo%c3|11999990000|stronix|a%2fb|@/i);
    }
  });
});

describe('scrollActionFor', () => {
  it('outra tela vai ao topo; voltar restaura; mesma tela e primeira tela não mexem', () => {
    expect(scrollActionFor({ navigationType: 'PUSH', prevScreenKey: 'kanban', screenKey: 'clientes' })).toBe('top');
    expect(scrollActionFor({ navigationType: 'REPLACE', prevScreenKey: 'settings', screenKey: 'dashOperacional' })).toBe('top');
    expect(scrollActionFor({ navigationType: 'POP', prevScreenKey: 'ficha:a', screenKey: 'kanban' })).toBe('restore');
    expect(scrollActionFor({ navigationType: 'PUSH', prevScreenKey: 'kanban', screenKey: 'kanban' })).toBe('none');
    expect(scrollActionFor({ navigationType: 'POP', prevScreenKey: 'kanban', screenKey: 'kanban' })).toBe('none');
    expect(scrollActionFor({ navigationType: 'POP', prevScreenKey: null, screenKey: 'kanban' })).toBe('none');
  });
});

describe('sub-tela na decisão de rota', () => {
  it('a correção de academia leva a sub-tela no destino e no alvo desenhado', () => {
    expect(decide(`/outra/configuracoes/catalogos`, admin)).toEqual(
      casa(`/${T}/configuracoes/catalogos`, { screen: 'settings', sub: 'catalogs' }),
    );
    expect(decide('/configuracoes/equipe', admin)).toEqual(
      casa(`/${T}/configuracoes/equipe`, { screen: 'settings', sub: 'team' }),
    );
  });

  it('sub-tela desconhecida abre a tela-mãe, com a query e sem aviso', () => {
    expect(decide(`/${T}/configuracoes/xyz`, admin, { search: '?sit=ativo' })).toEqual(
      casa(`/${T}/configuracoes?sit=ativo`, { screen: 'settings' }),
    );
    expect(decide(`/${T}/ficha/AbC/xyz`, consultor)).toEqual(
      casa(`/${T}/ficha/AbC`, { screen: 'ficha', leadId: 'AbC' }),
    );
  });

  it('a trava de tela ganha da sub-tela: consultor em Configurações continua caindo no Operacional com aviso', () => {
    expect(decide(`/${T}/configuracoes/xyz`, consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
  });

  it('endereço com sub-tela conhecida é aceito de primeira', () => {
    expect(decide(`/${T}/configuracoes/funis`, admin)).toEqual({ kind: 'ok' });
    expect(decide(`/${T}/ficha/AbC/contratos`, consultor)).toEqual({ kind: 'ok' });
  });

  it('a sub-tela não entra na screenKey, senão trocar de seção remontaria a tela', () => {
    expect(screenKey(parseAppPath(`/${T}/configuracoes/catalogos`))).toBe('settings');
    expect(screenKey(parseAppPath(`/${T}/ficha/AbC/contratos`))).toBe('ficha:AbC');
  });

  it('a sub-tela continua fora do molde do Sentry', () => {
    expect(routeTemplate(`/${T}/configuracoes/catalogos`)).toBe('/:tenant/configuracoes');
    expect(routeTemplate(`/${T}/ficha/AbC/contratos`)).toBe('/:tenant/ficha/:leadId');
  });

  it('a seção e a aba não trocam a chave da tela, então nada remonta', () => {
    const chaves = [`/${T}/configuracoes`, `/${T}/configuracoes/equipe`, `/${T}/configuracoes/catalogos`];
    for (const p of chaves) expect(screenKey(parseAppPath(p)), p).toBe('settings');
    const daFicha = [`/${T}/ficha/AbC`, `/${T}/ficha/AbC/crm`, `/${T}/ficha/AbC/contratos`];
    for (const p of daFicha) expect(screenKey(parseAppPath(p)), p).toBe('ficha:AbC');
  });

  it('a aba da ficha sobrevive ao mascaramento do id no Sentry', () => {
    expect(routeTemplate(`/${T}/ficha/AbC/indicacoes`)).toBe('/:tenant/ficha/:leadId');
  });

  it('o título da aba do navegador continua sem a sub-tela e sem nome de gente', () => {
    expect(documentTitle({ screen: 'settings', tenantName: 'STRONIX' })).toBe('Configurações · STRONIX · STRONILEAD');
    expect(documentTitle({ screen: 'ficha', tenantName: 'STRONIX' })).toBe('Ficha · STRONIX · STRONILEAD');
  });

  it('a academia corrigida leva a aba da ficha junto', () => {
    expect(decide('/ficha/AbC/contratos', consultor)).toEqual(
      casa(`/${T}/ficha/AbC/contratos`, { screen: 'ficha', leadId: 'AbC', sub: 'contratos' }),
    );
  });

  it('o item do menu aponta para a tela-mãe, e o endereço com seção continua sendo a mesma tela', () => {
    // O item do menu é um AppLink para /configuracoes. Quem está em
    // /configuracoes/catalogos continua na tela `settings`, então o item fica
    // aceso (activeTab) e o clique nele é a volta ao estado zero da tela.
    for (const p of [`/${T}/configuracoes`, `/${T}/configuracoes/catalogos`]) {
      expect(parseAppPath(p).screen, p).toBe('settings');
    }
  });
});

describe('query nos redirects, decidido de propósito', () => {
  it('a correção de academia leva o filtro junto quando a tela continua a mesma', () => {
    expect(decide('/outra/clientes', admin, { search: '?sit=ativo&resp=u1' })).toEqual(
      casa(`/${T}/clientes?sit=ativo&resp=u1`, { screen: 'clientes' }),
    );
    expect(decide('/pipeline', consultor, { search: '?funil=f2&atraso=1' })).toEqual(
      casa(`/${T}/pipeline?funil=f2&atraso=1`, { screen: 'kanban' }),
    );
  });

  it('quem cai na tela inicial por trava ou por endereço desconhecido perde a query', () => {
    expect(decide(`/${T}/configuracoes`, consultor, { search: '?sit=ativo' })).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide(`/${T}/visao-geral/xyz`, consultor, { search: '?mes=2026-08' })).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'nao-encontrada'));
  });

  it('a ficha de outra academia vira a tela inicial e o filtro que sobra é inofensivo, porque tudo é saneado contra a sessão', () => {
    expect(decide('/outra/ficha/AbC', consultor, { search: '?pessoa=u-de-outra' })).toEqual(
      casa(`/${T}?pessoa=u-de-outra`, { screen: 'dashboard' }),
    );
  });
});
