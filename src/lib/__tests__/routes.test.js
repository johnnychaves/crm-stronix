import { describe, it, expect } from 'vitest';
import { UNSAFE_createBrowserHistory } from 'react-router';
import {
  HOME_SCREEN, SCREENS, SUPER_TABS, FIRST_LEVEL_SEGMENTS,
  isValidLeadId, parseAppPath, hrefFor, canGoBackInApp,
} from '../routes.js';

const T = 'stronix-crm-app';
// Caracteres montados pelo código para o arquivo não ter byte invisível.
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(0x7f);
// Metade de um emoji: o encodeURIComponent não consegue codificar.
const MEIO_EMOJI = String.fromCharCode(0xd800);

// Os mesmos valores de activeTab que o App.jsx usa hoje.
const TELAS = [
  'dashboard', 'dashOperacional', 'dashCrm', 'dashGerencial', 'kanban', 'clientes', 'dailyGoal',
  'leads', 'aulas', 'visitas', 'settings', 'profile', 'billing', 'superadmin', 'ficha',
];

describe('SCREENS', () => {
  it('tem exatamente as telas de hoje, congeladas', () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...TELAS].sort());
    expect(Object.isFrozen(SCREENS)).toBe(true);
    for (const id of TELAS) {
      expect(Object.isFrozen(SCREENS[id]), id).toBe(true);
      expect(Object.isFrozen(SCREENS[id].segs), id).toBe(true);
    }
    expect(HOME_SCREEN).toBe('dashboard');
  });

  it('trava de gestor só em Configurações, Perfil da academia e Plano e faturas; super-admin só na dele', () => {
    const gestor = TELAS.filter((id) => SCREENS[id].gestor === true);
    const superAdmin = TELAS.filter((id) => SCREENS[id].superAdmin === true);
    expect(gestor.sort()).toEqual(['billing', 'profile', 'settings']);
    expect(superAdmin).toEqual(['superadmin']);
  });

  it('títulos da aba sem travessão', () => {
    for (const id of TELAS) expect(SCREENS[id].title, id).not.toMatch(/[—–]/);
    expect(SCREENS.dailyGoal.title).toBe('Meta diária');
    expect(SCREENS.ficha.title).toBe('Ficha');
  });

  it('primeiro segmento de cada tela, sem repetição', () => {
    expect([...FIRST_LEVEL_SEGMENTS].sort()).toEqual([
      'clientes', 'configuracoes', 'ficha', 'leads', 'meta-diaria', 'perfil-da-academia',
      'pipeline', 'plano-e-faturas', 'super-admin', 'visao-geral',
    ]);
    expect(Object.isFrozen(FIRST_LEVEL_SEGMENTS)).toBe(true);
  });

  it('subabas do super-admin em português', () => {
    expect(SUPER_TABS).toEqual({ overview: 'visao-geral', clients: 'clientes', finance: 'financeiro', plans: 'planos' });
  });
});

describe('isValidLeadId', () => {
  it('aceita id automático do Firestore e o que a regra do Firestore aceita', () => {
    for (const id of ['Ab12', 'kX3a9LmQ2rT7vW1yZ0bC', 'João Silva', 'a.b', '...', '___', '100%', 'a'.repeat(128)]) {
      expect(isValidLeadId(id), id).toBe(true);
    }
  });

  it('recusa vazio, barra, . e .., __x__, controle, mais de 128 e o que não é texto', () => {
    for (const id of ['', 'a/b', '/', '.', '..', '__x__', '____', `a${NUL}b`, 'a\nb', DEL, 'a'.repeat(129), null, undefined, 42]) {
      expect(isValidLeadId(id), JSON.stringify(id)).toBe(false);
    }
  });
});

describe('parseAppPath', () => {
  it('raiz: tudo vazio e não é endereço desconhecido', () => {
    for (const p of ['/', '']) {
      expect(parseAppPath(p)).toEqual({
        pathname: p, tenantSlug: null, screen: null, leadId: null, superTab: null, rest: [], unknown: false,
        sub: null, subUnknown: false,
      });
    }
  });

  it('/<academia> é a tela inicial, com qualquer caixa e barra no fim', () => {
    expect(parseAppPath(`/${T}`)).toMatchObject({ tenantSlug: T, screen: 'dashboard', unknown: false });
    expect(parseAppPath('/STRONIX-CRM-APP/')).toMatchObject({ tenantSlug: T, screen: 'dashboard' });
  });

  it('lê cada endereço da tabela', () => {
    const casos = {
      [`/${T}/visao-geral/operacional`]: 'dashOperacional',
      [`/${T}/visao-geral`]: 'dashOperacional',
      [`/${T}/visao-geral/crm`]: 'dashCrm',
      [`/${T}/visao-geral/gerencial`]: 'dashGerencial',
      [`/${T}/pipeline`]: 'kanban',
      [`/${T}/clientes`]: 'clientes',
      [`/${T}/meta-diaria`]: 'dailyGoal',
      [`/${T}/leads`]: 'leads',
      [`/${T}/leads/aulas`]: 'aulas',
      [`/${T}/leads/visitas`]: 'visitas',
      [`/${T}/configuracoes`]: 'settings',
      [`/${T}/perfil-da-academia`]: 'profile',
      [`/${T}/plano-e-faturas`]: 'billing',
      [`/${T}/super-admin`]: 'superadmin',
      [`/${T}/ficha/Ab12`]: 'ficha',
    };
    for (const [p, screen] of Object.entries(casos)) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: T, screen, unknown: false });
    }
  });

  it('subabas do super-admin', () => {
    expect(parseAppPath(`/${T}/super-admin`).superTab).toBe('overview');
    expect(parseAppPath(`/${T}/super-admin/visao-geral`).superTab).toBe('overview');
    expect(parseAppPath(`/${T}/super-admin/clientes`).superTab).toBe('clients');
    expect(parseAppPath(`/${T}/super-admin/financeiro`).superTab).toBe('finance');
    expect(parseAppPath(`/${T}/super-admin/PLANOS`).superTab).toBe('plans');
  });

  it('segmento de tela ignora caixa; id da ficha não', () => {
    expect(parseAppPath(`/${T}/PIPELINE`).screen).toBe('kanban');
    expect(parseAppPath(`/${T}/Leads/Aulas`).screen).toBe('aulas');
    expect(parseAppPath(`/${T}/Ficha/AbC123xyz`)).toMatchObject({ screen: 'ficha', leadId: 'AbC123xyz' });
  });

  it('ficha: id decodificado; sem id ou com id inválido é não encontrada, não desconhecido', () => {
    expect(parseAppPath(`/${T}/ficha/Jo%C3%A3o%20Silva`).leadId).toBe('João Silva');
    expect(parseAppPath(`/${T}/ficha/100%25`).leadId).toBe('100%');
    for (const p of [`/${T}/ficha`, `/${T}/ficha/a%2Fb`, `/${T}/ficha/%2E%2E`, `/${T}/ficha/__x__`, `/${T}/ficha/%E0%A4%A`]) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: T, screen: 'ficha', leadId: null, unknown: false });
    }
  });

  it('segmento malformado invalida só ele mesmo', () => {
    expect(parseAppPath(`/${T}/%E0%A4%A`)).toMatchObject({ tenantSlug: T, screen: null, unknown: true });
    expect(parseAppPath('/%E0%A4%A/pipeline')).toMatchObject({ tenantSlug: null, screen: null, unknown: true });
    expect(parseAppPath(`/${T}/configuracoes/%E0%A4%A`)).toMatchObject({ screen: 'settings', rest: [null] });
  });

  it('telas-folha guardam o resto para a entrega 2', () => {
    expect(parseAppPath(`/${T}/configuracoes/equipe`)).toMatchObject({ screen: 'settings', rest: ['equipe'] });
    expect(parseAppPath(`/${T}/meta-diaria/equipe`)).toMatchObject({ screen: 'dailyGoal', rest: ['equipe'] });
    expect(parseAppPath(`/${T}/pipeline/a/b`)).toMatchObject({ screen: 'kanban', rest: ['a', 'b'] });
    expect(parseAppPath(`/${T}/ficha/Ab12/contratos`)).toMatchObject({ screen: 'ficha', leadId: 'Ab12', rest: ['contratos'] });
  });

  it('grupo com filho desconhecido ou segmento a mais é endereço desconhecido', () => {
    for (const p of [
      `/${T}/leads/visita`, `/${T}/visao-geral/financeiro`, `/${T}/super-admin/xyz`,
      `/${T}/leads/aulas/x`, `/${T}/visao-geral/crm/x`, `/${T}/super-admin/planos/x`, `/${T}/xyz`,
    ]) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: T, screen: null, unknown: true });
    }
  });

  it('nome de propriedade do JavaScript não vira tela', () => {
    for (const p of [
      `/${T}/constructor`, `/${T}/__proto__`, `/${T}/toString`, `/${T}/leads/constructor`,
      `/${T}/visao-geral/__proto__`, `/${T}/super-admin/hasOwnProperty`,
    ]) {
      expect(parseAppPath(p), p).toMatchObject({ screen: null, unknown: true });
    }
  });

  it('palavra de tela no começo é tela sem academia', () => {
    expect(parseAppPath('/pipeline')).toMatchObject({ tenantSlug: null, screen: 'kanban', unknown: false });
    expect(parseAppPath('/Pipeline')).toMatchObject({ tenantSlug: null, screen: 'kanban' });
    expect(parseAppPath('/visao-geral/crm')).toMatchObject({ tenantSlug: null, screen: 'dashCrm' });
    expect(parseAppPath('/ficha/Ab12')).toMatchObject({ tenantSlug: null, screen: 'ficha', leadId: 'Ab12' });
    expect(parseAppPath('/super-admin/planos')).toMatchObject({ tenantSlug: null, screen: 'superadmin', superTab: 'plans' });
    for (const seg of FIRST_LEVEL_SEGMENTS) expect(parseAppPath(`/${seg}`).tenantSlug, seg).toBeNull();
  });

  it('palavra reservada que não é tela e 1º segmento fora do formato: sem academia e desconhecido', () => {
    for (const p of ['/api', '/assets/index.js', '/i/stronix-crm-app', '/console', '/Foo_Bar/pipeline', '/-abc']) {
      expect(parseAppPath(p), p).toMatchObject({ tenantSlug: null, screen: null, unknown: true });
    }
  });

  it('guarda o caminho original', () => {
    expect(parseAppPath('/STRONIX-CRM-APP/Pipeline').pathname).toBe('/STRONIX-CRM-APP/Pipeline');
  });
});

describe('hrefFor', () => {
  it('monta os endereços da tabela', () => {
    expect(hrefFor(T, 'dashboard')).toBe(`/${T}`);
    expect(hrefFor(T, 'dashOperacional')).toBe(`/${T}`);
    expect(hrefFor(T, 'dashCrm')).toBe(`/${T}/visao-geral/crm`);
    expect(hrefFor(T, 'kanban')).toBe(`/${T}/pipeline`);
    expect(hrefFor(T, 'aulas')).toBe(`/${T}/leads/aulas`);
    expect(hrefFor(T, 'billing')).toBe(`/${T}/plano-e-faturas`);
    expect(hrefFor(T, 'ficha', { leadId: 'Ab12' })).toBe(`/${T}/ficha/Ab12`);
    expect(hrefFor(T, 'superadmin')).toBe(`/${T}/super-admin/visao-geral`);
    expect(hrefFor(T, 'superadmin', { superTab: 'plans' })).toBe(`/${T}/super-admin/planos`);
    expect(hrefFor(T, 'superadmin', { superTab: 'xyz' })).toBe(`/${T}/super-admin/visao-geral`);
  });

  it('codifica o id da ficha', () => {
    expect(hrefFor(T, 'ficha', { leadId: 'João Silva' })).toBe(`/${T}/ficha/Jo%C3%A3o%20Silva`);
    expect(hrefFor(T, 'ficha', { leadId: '100%' })).toBe(`/${T}/ficha/100%25`);
    expect(hrefFor(T, 'ficha', { leadId: 'x?y#z' })).toBe(`/${T}/ficha/x%3Fy%23z`);
  });

  it('aceita academia fora do formato, com encode, para o link nunca sair quebrado', () => {
    expect(hrefFor('Academia_Legada', 'kanban')).toBe('/Academia_Legada/pipeline');
    expect(hrefFor('a b', 'clientes')).toBe('/a%20b/clientes');
  });

  it('tela desconhecida vira a inicial', () => {
    expect(hrefFor(T, 'nao-existe')).toBe(`/${T}`);
    expect(hrefFor(T, 'constructor')).toBe(`/${T}`);
    expect(hrefFor(T, undefined)).toBe(`/${T}`);
  });

  it('null quando não dá para montar', () => {
    expect(hrefFor('', 'kanban')).toBeNull();
    expect(hrefFor(null, 'kanban')).toBeNull();
    expect(hrefFor(undefined, 'kanban')).toBeNull();
    expect(hrefFor(T, 'ficha')).toBeNull();
    expect(hrefFor(T, 'ficha', { leadId: 'a/b' })).toBeNull();
    expect(hrefFor(T, 'ficha', { leadId: MEIO_EMOJI })).toBeNull();
  });

  it('terceiro argumento nulo não quebra', () => {
    expect(hrefFor(T, 'kanban', null)).toBe(`/${T}/pipeline`);
  });
});

describe('ida e volta hrefFor e parseAppPath', () => {
  it('toda tela volta como ela mesma (o Operacional volta como a tela inicial)', () => {
    for (const screen of TELAS) {
      const extra = screen === 'ficha' ? { leadId: 'Ab12' } : {};
      const href = hrefFor(T, screen, extra);
      const volta = parseAppPath(href);
      expect(volta.tenantSlug, href).toBe(T);
      expect(volta.unknown, href).toBe(false);
      expect(volta.screen, href).toBe(screen === 'dashOperacional' ? 'dashboard' : screen);
    }
  });

  it('toda subaba do super-admin volta igual', () => {
    for (const superTab of Object.keys(SUPER_TABS)) {
      const volta = parseAppPath(hrefFor(T, 'superadmin', { superTab }));
      expect(volta).toMatchObject({ screen: 'superadmin', superTab });
    }
  });

  it('id com espaço, acento, %, ?, # e emoji volta igual', () => {
    const ids = ['Ab12', 'João Silva', 'ação', '100%', '%41', 'a%2Fb', 'x?y#z', 'emoji 😀', '...', 'a'.repeat(128)];
    for (const leadId of ids) {
      const href = hrefFor(T, 'ficha', { leadId });
      expect(parseAppPath(href), leadId).toMatchObject({ tenantSlug: T, screen: 'ficha', leadId });
    }
  });

  it('as cinco academias de produção voltam iguais', () => {
    for (const t of ['academia-power-club', 'academia-shape-one', 'academia-teste', 'petros-barbell-club', 'stronix-crm-app']) {
      expect(parseAppPath(hrefFor(t, 'kanban'))).toMatchObject({ tenantSlug: t, screen: 'kanban' });
    }
  });
});

describe('canGoBackInApp', () => {
  it('só com idx inteiro maior que zero', () => {
    expect(canGoBackInApp({ idx: 1 })).toBe(true);
    expect(canGoBackInApp({ usr: null, key: 'x9k2', idx: 4 })).toBe(true);
    // Aba nova depois do replace da correção de endereço: key nova, idx 0.
    expect(canGoBackInApp({ key: 'x9k2', idx: 0 })).toBe(false);
    for (const s of [null, undefined, {}, { idx: '2' }, { idx: 1.5 }, { idx: -1 }]) {
      expect(canGoBackInApp(s), JSON.stringify(s)).toBe(false);
    }
  });
});

// Contrato do idx: o Voltar da ficha depende do idx que o React Router grava em
// window.history.state. Ele é detalhe interno da biblioteca, então este teste
// roda o createBrowserHistory de verdade (o mesmo que o <BrowserRouter> usa,
// com v5Compat) contra uma janela falsa. Se quebrar depois de atualizar o
// react-router, confira o getUrlBasedHistory da versão nova antes de mexer no
// teste: com o idx errado, o Voltar cai sempre na lista de reserva.
function janelaFalsa(caminho) {
  const origem = 'https://stronilead.com.br';
  const entradas = [{ state: null }];
  let atual = 0;
  const location = { origin: origem, href: origem + caminho, pathname: caminho, search: '', hash: '' };
  const irPara = (url) => {
    if (!url) return;
    const u = new URL(url, origem);
    Object.assign(location, { href: u.href, pathname: u.pathname, search: u.search, hash: u.hash });
  };
  const history = {
    get state() { return entradas[atual].state; },
    get length() { return entradas.length; },
    // Igual ao navegador: o state é copiado, e o push descarta o "avançar".
    pushState(state, _titulo, url) {
      entradas.splice(atual + 1);
      entradas.push({ state: structuredClone(state) });
      atual += 1;
      irPara(url);
    },
    replaceState(state, _titulo, url) {
      entradas[atual] = { state: structuredClone(state) };
      irPara(url);
    },
    go() {},
  };
  return { location, history, addEventListener() {}, removeEventListener() {} };
}

describe('contrato do idx com o react-router instalado', () => {
  const historico = (janela) => UNSAFE_createBrowserHistory({ window: janela, v5Compat: true });

  it('a carga grava idx 0 sem trocar o endereço', () => {
    const w = janelaFalsa(`/${T}/pipeline`);
    historico(w);
    expect(w.history.state.idx).toBe(0);
    expect(w.location.pathname).toBe(`/${T}/pipeline`);
    expect(canGoBackInApp(w.history.state)).toBe(false);
  });

  it('o push soma 1 e leva o state da tela de origem', () => {
    const w = janelaFalsa(`/${T}/pipeline`);
    const h = historico(w);
    h.push(`/${T}/ficha/Ab12`, { from: 'kanban' });
    expect(w.history.state.idx).toBe(1);
    expect(w.history.state.usr).toEqual({ from: 'kanban' });
    expect(w.location.pathname).toBe(`/${T}/ficha/Ab12`);
    expect(canGoBackInApp(w.history.state)).toBe(true);
  });

  it('o replace mantém o idx, mesmo trocando a key', () => {
    const w = janelaFalsa('/');
    const h = historico(w);
    expect(h.location.key).toBe('default');
    h.replace(`/${T}`); // a correção de / para /<academia> numa aba nova
    expect(h.location.key).not.toBe('default');
    expect(w.history.state.idx).toBe(0);
    expect(canGoBackInApp(w.history.state)).toBe(false);
    h.push(`/${T}/clientes`);
    h.replace(`/${T}/clientes`);
    expect(w.history.state.idx).toBe(1);
  });

  it('o F5 mantém o idx da entrada', () => {
    const w = janelaFalsa(`/${T}/pipeline`);
    historico(w).push(`/${T}/ficha/Ab12`, { from: 'kanban' });
    historico(w); // a página carrega de novo na mesma entrada
    expect(w.history.state.idx).toBe(1);
    expect(w.history.state.usr).toEqual({ from: 'kanban' });
  });
});

describe('sub-tela no caminho', () => {
  it('Configurações lê as dez seções e devolve o id interno', () => {
    const pares = [
      ['visao-geral', 'overview'], ['equipe', 'team'], ['transferencia', 'transfer'],
      ['indicacoes', 'referral-owners'], ['importacao', 'import'], ['ritmo', 'pace'],
      ['agenda', 'sched'], ['funis', 'funnels'], ['catalogos', 'catalogs'], ['stronizap', 'zap'],
    ];
    for (const [seg, id] of pares) {
      const r = parseAppPath(`/${T}/configuracoes/${seg}`);
      expect([r.screen, r.sub, r.subUnknown], seg).toEqual(['settings', id, false]);
    }
  });

  it('a ficha lê as quatro abas', () => {
    const pares = [['linha-do-tempo', 'timeline'], ['crm', 'crm'], ['contratos', 'contratos'], ['indicacoes', 'referrals']];
    for (const [seg, id] of pares) {
      const r = parseAppPath(`/${T}/ficha/AbC/${seg}`);
      expect([r.screen, r.leadId, r.sub], seg).toEqual(['ficha', 'AbC', id]);
    }
  });

  it('sem sub-tela no endereço, sub é null e subUnknown é false', () => {
    for (const p of [`/${T}/configuracoes`, `/${T}/ficha/AbC`]) {
      const r = parseAppPath(p);
      expect([r.sub, r.subUnknown], p).toEqual([null, false]);
    }
  });

  it('segmento de sub-tela ignora caixa, como o de tela', () => {
    expect(parseAppPath(`/${T}/configuracoes/EQUIPE`).sub).toBe('team');
    expect(parseAppPath(`/${T}/ficha/AbC/Contratos`).sub).toBe('contratos');
  });

  it('sub-tela desconhecida e segmento a mais marcam subUnknown, sem virar endereço desconhecido', () => {
    for (const p of [`/${T}/configuracoes/xyz`, `/${T}/configuracoes/equipe/demais`, `/${T}/ficha/AbC/xyz`, `/${T}/ficha/AbC/crm/demais`]) {
      const r = parseAppPath(p);
      expect([r.sub, r.subUnknown, r.unknown], p).toEqual([null, true, false]);
    }
  });

  it('tela sem tabela de sub-tela continua ignorando o resto calado', () => {
    const r = parseAppPath(`/${T}/pipeline/a/b`);
    expect([r.screen, r.rest, r.sub, r.subUnknown, r.unknown]).toEqual(['kanban', ['a', 'b'], null, false, false]);
  });

  it('o rest cru continua como era, para o id da ficha nunca ser reescrito', () => {
    expect(parseAppPath(`/${T}/configuracoes/equipe`).rest).toEqual(['equipe']);
    expect(parseAppPath(`/${T}/ficha/AbC/contratos`).rest).toEqual(['contratos']);
  });

  it('hrefFor monta a sub-tela e cai na tela-mãe quando o valor não existe', () => {
    expect(hrefFor(T, 'settings', { sub: 'catalogs' })).toBe(`/${T}/configuracoes/catalogos`);
    expect(hrefFor(T, 'settings', { sub: 'team' })).toBe(`/${T}/configuracoes/equipe`);
    expect(hrefFor(T, 'settings')).toBe(`/${T}/configuracoes`);
    expect(hrefFor(T, 'settings', { sub: 'xyz' })).toBe(`/${T}/configuracoes`);
    expect(hrefFor(T, 'ficha', { leadId: 'AbC', sub: 'contratos' })).toBe(`/${T}/ficha/AbC/contratos`);
    expect(hrefFor(T, 'ficha', { leadId: 'AbC', sub: 'xyz' })).toBe(`/${T}/ficha/AbC`);
    expect(hrefFor(T, 'kanban', { sub: 'equipe' })).toBe(`/${T}/pipeline`);
  });

  it('ida e volta: todo segmento montado relê como o mesmo id', () => {
    for (const id of Object.keys(SCREENS.settings.subs)) {
      expect(parseAppPath(hrefFor(T, 'settings', { sub: id })).sub, id).toBe(id);
    }
    for (const id of Object.keys(SCREENS.ficha.subs)) {
      expect(parseAppPath(hrefFor(T, 'ficha', { leadId: 'AbC', sub: id })).sub, id).toBe(id);
    }
  });

  it('a tabela de sub-telas é congelada e o padrão de cada uma existe nela', () => {
    for (const id of ['settings', 'ficha']) {
      expect(Object.isFrozen(SCREENS[id].subs), id).toBe(true);
      expect(Object.keys(SCREENS[id].subs), id).toContain(SCREENS[id].subPadrao);
    }
  });

  it('nenhuma outra tela tem sub-tela nesta entrega', () => {
    const comSub = Object.keys(SCREENS).filter((id) => SCREENS[id].subs);
    expect(comSub.sort()).toEqual(['ficha', 'settings']);
  });
});
