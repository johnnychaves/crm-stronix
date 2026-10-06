// O professor abre só a Meta diária, Clientes e a ficha (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "O que ele
// vê"). A decisão de rota leva qualquer outra tela para a Meta diária, no molde
// do aviso de tela de gestor. O endereço curto da academia, onde o login e o
// Sair caem, leva à Meta sem aviso.
import { describe, it, expect } from 'vitest';
import {
  SCREENS, parseAppPath, canAccess, routeDecision, homeScreenFor, backTarget, ROUTE_NOTICES,
} from '../routes.js';
import { fichaOrigin, logoutDestination, screenState } from '../appShell.js';

const T = 'stronix-crm-app';
const admin = { id: 'u1', role: 'admin', tenantId: T };
const consultor = { id: 'u2', role: 'consultant', tenantId: T };
const professor = { id: 'u6', authUid: 'uid-6', role: 'professor', professorId: 'p1', tenantId: T };
const semLigacao = { id: 'u7', authUid: 'uid-7', role: 'professor', tenantId: T };

const decide = (path, user, opts) => routeDecision(parseAppPath(path), user, opts);
const casa = (to, target, notice = null) => ({ kind: 'redirect', to, target: { leadId: null, superTab: null, sub: null, ...target }, notice });
const meta = (notice = null) => casa(`/${T}/meta-diaria`, { screen: 'dailyGoal' }, notice);

const DELE = ['dailyGoal', 'clientes', 'ficha'];

describe('canAccess: professor', () => {
  it('abre a Meta diária, Clientes e a ficha, e nenhuma outra tela da tabela', () => {
    for (const s of Object.keys(SCREENS)) {
      expect(canAccess(s, professor), s).toBe(DELE.includes(s));
      expect(canAccess(s, semLigacao), s).toBe(DELE.includes(s));
    }
  });

  it('id que não é tela continua passando, como para os outros', () => {
    expect(canAccess(null, professor)).toBe(true);
    expect(canAccess('constructor', professor)).toBe(true);
  });

  it('gestor e consultor continuam como antes', () => {
    for (const s of ['dashboard', 'dashOperacional', 'kanban', 'leads', 'aulas', 'visitas', 'dailyGoal', 'clientes', 'ficha']) {
      expect(canAccess(s, consultor), s).toBe(true);
      expect(canAccess(s, admin), s).toBe(true);
    }
    expect(canAccess('settings', consultor)).toBe(false);
    expect(canAccess('settings', admin)).toBe(true);
  });
});

describe('homeScreenFor', () => {
  it('Visão geral para quem a abre, Meta diária para o professor', () => {
    expect(homeScreenFor(admin)).toBe('dashboard');
    expect(homeScreenFor(consultor)).toBe('dashboard');
    expect(homeScreenFor(null)).toBe('dashboard');
    expect(homeScreenFor(professor)).toBe('dailyGoal');
    expect(homeScreenFor(semLigacao)).toBe('dailyGoal');
  });
});

describe('ROUTE_NOTICES do professor', () => {
  it('textos da spec, sem travessão', () => {
    expect(ROUTE_NOTICES['nao-liberada']).toBe('Essa tela não está liberada para o seu acesso.');
    expect(ROUTE_NOTICES['nao-encontrada-meta']).toBe('Não achamos essa tela. Abrimos a Meta diária.');
    for (const k of ['nao-liberada', 'nao-encontrada-meta']) expect(ROUTE_NOTICES[k]).not.toMatch(/[—–]/);
  });
});

describe('routeDecision: professor', () => {
  it('a raiz e o endereço curto da academia levam à Meta diária sem aviso, porque o login e o Sair caem neles', () => {
    expect(decide('/', professor)).toEqual(meta());
    expect(decide(`/${T}`, professor)).toEqual(meta());
    expect(decide('/Stronix-Crm-App', professor)).toEqual(meta());
    expect(decide('/outra', professor)).toEqual(meta());
    expect(decide('/recuperar-senha', professor)).toEqual(meta());
  });

  it('a raiz leva a query junto, como faz para o consultor', () => {
    expect(decide('/', professor, { search: '?x=1' })).toEqual(casa(`/${T}/meta-diaria?x=1`, { screen: 'dailyGoal' }));
  });

  it('tela fora do acesso dele: Meta diária com o aviso de tela não liberada, sem a query', () => {
    const telas = [
      `/${T}/visao-geral`, `/${T}/visao-geral/operacional`, `/${T}/visao-geral/crm`, `/${T}/visao-geral/gerencial`,
      `/${T}/pipeline`, `/${T}/leads`, `/${T}/leads/aulas`, `/${T}/leads/visitas`,
      `/${T}/configuracoes`, `/${T}/configuracoes/equipe`, `/${T}/configuracoes/xyz`,
      `/${T}/perfil-da-academia`, `/${T}/plano-e-faturas`,
    ];
    for (const p of telas) expect(decide(p, professor, { search: '?mes=2026-09' }), p).toEqual(meta('nao-liberada'));
  });

  it('endereço sem academia ou de outra academia já sai com o aviso, sem passo intermediário', () => {
    expect(decide('/pipeline', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/configuracoes', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/outra/visao-geral/crm', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/STRONIX-CRM-APP/leads/aulas', professor)).toEqual(meta('nao-liberada'));
  });

  it('o super-admin some em silêncio, como para quem não tem o claim', () => {
    expect(decide(`/${T}/super-admin/planos`, professor)).toEqual(meta());
    expect(decide('/super-admin', professor)).toEqual(meta());
  });

  it('endereço desconhecido: Meta diária, com o aviso que fala da Meta', () => {
    for (const p of [`/${T}/xyz`, `/${T}/leads/visita`, `/${T}/visao-geral/xyz`, `/${T}/constructor`]) {
      expect(decide(p, professor), p).toEqual(meta('nao-encontrada-meta'));
    }
  });

  it('Rotinas é do gestor: a lista e o modelo aberto levam o professor à Meta diária com o aviso de tela não liberada', () => {
    for (const p of [`/${T}/rotinas`, `/${T}/rotinas/modelos`, `/${T}/rotinas/modelos/M1`, `/${T}/rotinas/xyz`]) {
      expect(decide(p, professor, { search: '?a=1' }), p).toEqual(meta('nao-liberada'));
      expect(decide(p, semLigacao), p).toEqual(meta('nao-liberada'));
    }
    // Sem academia ou com a de outra, o aviso sai no mesmo passo, e o id do modelo não vai junto.
    expect(decide('/rotinas', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/rotinas/modelos/M1', professor)).toEqual(meta('nao-liberada'));
    expect(decide('/outra/rotinas/modelos/M1', professor)).toEqual(meta('nao-liberada'));
  });

  it('as telas dele abrem de primeira, com a aba da ficha', () => {
    const dele = [
      `/${T}/meta-diaria`, `/${T}/clientes`, `/${T}/ficha`, `/${T}/ficha/AbC`,
      `/${T}/ficha/AbC/crm`, `/${T}/ficha/AbC/contratos`, `/${T}/ficha/AbC/indicacoes`,
    ];
    for (const p of dele) {
      expect(decide(p, professor), p).toEqual({ kind: 'ok' });
      expect(decide(p, semLigacao), p).toEqual({ kind: 'ok' });
    }
  });

  it('a correção de academia mantém a tela dele, com o filtro, e descarta a ficha de outra academia', () => {
    expect(decide('/clientes', professor, { search: '?sit=ativo' })).toEqual(casa(`/${T}/clientes?sit=ativo`, { screen: 'clientes' }));
    expect(decide('/outra/meta-diaria', professor)).toEqual(casa(`/${T}/meta-diaria`, { screen: 'dailyGoal' }));
    expect(decide('/ficha/AbC/crm', professor)).toEqual(casa(`/${T}/ficha/AbC/crm`, { screen: 'ficha', leadId: 'AbC', sub: 'crm' }));
    expect(decide('/outra/ficha/AbC', professor)).toEqual(meta());
  });

  it('aba desconhecida da ficha abre a ficha, sem aviso', () => {
    expect(decide(`/${T}/ficha/AbC/xyz`, professor)).toEqual(casa(`/${T}/ficha/AbC`, { screen: 'ficha', leadId: 'AbC' }));
  });

  it('gestor e consultor não mudam: o endereço curto continua sendo o Operacional', () => {
    expect(decide(`/${T}`, consultor)).toEqual({ kind: 'ok' });
    expect(decide('/', consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }));
    expect(decide('/pipeline', consultor)).toEqual(casa(`/${T}/pipeline`, { screen: 'kanban' }));
    expect(decide(`/${T}/configuracoes`, consultor)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'so-gestor'));
    expect(decide(`/${T}/xyz`, admin)).toEqual(casa(`/${T}`, { screen: 'dashboard' }, 'nao-encontrada'));
  });

  it('o destino de todo redirect do professor é aceito de primeira, e é uma tela dele', () => {
    const caminhos = [
      '/', '/outra', `/${T}`, `/${T}/xyz`, `/${T}/pipeline`, `/${T}/configuracoes`, `/${T}/super-admin/planos`,
      `/${T}/visao-geral/crm`, `/${T}/ficha/a%2Fb`, '/outra/ficha/Ab12', '/pipeline', '/STRONIX-CRM-APP/clientes',
      '/academia-teste/pipeline', '/api', '/%E0%A4%A', `//${T}//pipeline`, `/${T}/ficha/AbC/xyz`,
      `/${T}/rotinas`, `/${T}/rotinas/modelos/M1`, '/outra/rotinas/modelos/M1', '/rotinas/modelos/M1',
    ];
    const retornos = [
      null,
      { fromTenant: 'academia-teste', path: `/${T}/super-admin/clientes` },
      { fromTenant: 'academia-teste', path: `/${T}/clientes` },
    ];
    for (const user of [professor, semLigacao]) {
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
          expect(DELE, rotulo).toContain(d.target.screen);
        }
      }
    }
  });
});

describe('backTarget: professor', () => {
  it('sem tela antes, a ficha de cliente volta para Clientes', () => {
    expect(backTarget({ historyState: { idx: 0 }, isClient: true, tenantId: T, appUser: professor })).toEqual({ type: 'replace', href: `/${T}/clientes` });
  });

  it('sem tela antes, a ficha de lead volta para a Meta diária, porque o Pipeline não é dele', () => {
    expect(backTarget({ historyState: null, isClient: false, tenantId: T, appUser: professor })).toEqual({ type: 'replace', href: `/${T}/meta-diaria` });
    expect(backTarget({ historyState: { idx: 0 }, isClient: false, tenantId: T, appUser: semLigacao })).toEqual({ type: 'replace', href: `/${T}/meta-diaria` });
  });

  it('com tela antes, o voltar do navegador, como para todos', () => {
    expect(backTarget({ historyState: { idx: 2 }, isClient: false, tenantId: T, appUser: professor })).toEqual({ type: 'back' });
  });

  it('consultor e chamada sem appUser continuam indo ao Pipeline na ficha de lead', () => {
    expect(backTarget({ historyState: null, isClient: false, tenantId: T, appUser: consultor })).toEqual({ type: 'replace', href: `/${T}/pipeline` });
    expect(backTarget({ historyState: null, isClient: false, tenantId: T })).toEqual({ type: 'replace', href: `/${T}/pipeline` });
  });
});

describe('casca do App: professor', () => {
  it('a ficha só guarda a origem das telas dele', () => {
    expect(fichaOrigin({ from: 'dailyGoal' }, professor)).toBe('dailyGoal');
    expect(fichaOrigin({ from: 'clientes' }, professor)).toBe('clientes');
    expect(fichaOrigin({ from: 'kanban' }, professor)).toBeNull();
    expect(fichaOrigin({ from: 'dashCrm' }, professor)).toBeNull();
    expect(fichaOrigin({ from: 'leads' }, professor)).toBeNull();
  });

  it('o endereço curto desenha a Meta diária já no render do redirect', () => {
    const d = decide(`/${T}`, professor);
    const s = screenState(d.target, null, professor);
    expect(s.activeTab).toBe('dailyGoal');
    expect(s.resolvedTab).toBe('dailyGoal');
  });

  it('o Sair leva ao login da academia, como os outros, e a volta do login cai na Meta', () => {
    expect(logoutDestination(professor)).toBe(`/${T}`);
    expect(decide(logoutDestination(professor), professor)).toEqual(meta());
  });
});
