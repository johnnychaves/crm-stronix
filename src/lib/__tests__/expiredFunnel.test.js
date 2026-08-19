import { describe, it, expect } from 'vitest';
import {
  EXPIRED_FUNNEL_KIND, EXPIRED_FUNNEL_NAME, EXPIRED_ENTRY_NAME,
  isExpiredFunnel, getExpiredFunnel, getExpiredEntryStage,
  planExpiredSetupOps, expiredStageIdOf,
} from '../expiredFunnel.js';

describe('isExpiredFunnel', () => {
  it('casa pela flag, NUNCA pelo nome', () => {
    expect(isExpiredFunnel({ systemKind: 'expired' })).toBe(true);
    // funil que a academia criou à mão com o mesmo nome NÃO é o do sistema
    expect(isExpiredFunnel({ name: 'Vencidos' })).toBe(false);
    expect(isExpiredFunnel(null)).toBe(false);
  });
});

describe('getExpiredFunnel', () => {
  it('duplicata resolve pelo createdAt mais antigo', () => {
    const novo = { id: 'b', systemKind: 'expired', createdAt: 2000 };
    const velho = { id: 'a', systemKind: 'expired', createdAt: 1000 };
    expect(getExpiredFunnel([novo, velho]).id).toBe('a');
  });
  it('sem funil de sistema devolve null', () => {
    expect(getExpiredFunnel([{ id: 'x', name: 'Vencidos' }])).toBeNull();
    expect(getExpiredFunnel([])).toBeNull();
    expect(getExpiredFunnel(null)).toBeNull();
  });
});

describe('getExpiredEntryStage', () => {
  const f = 'f1';
  it('acha pela flag isEntry', () => {
    const st = [{ id: 's1', funnelId: f, isEntry: true }, { id: 's2', funnelId: f }];
    expect(getExpiredEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal: sem isEntry, cai no isSystem com o nome padrão', () => {
    const st = [{ id: 's2', funnelId: f, order: 1 }, { id: 's1', funnelId: f, isSystem: true, name: 'Vencido' }];
    expect(getExpiredEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal final: cai na de menor order', () => {
    const st = [{ id: 's2', funnelId: f, order: 3 }, { id: 's1', funnelId: f, order: 1 }];
    expect(getExpiredEntryStage(st, f).id).toBe('s1');
  });
  it('sem funil ou sem etapa devolve null', () => {
    expect(getExpiredEntryStage([], null)).toBeNull();
    expect(getExpiredEntryStage([], 'f1')).toBeNull();
  });
});

describe('planExpiredSetupOps', () => {
  it('base zerada: cria o funil e as QUATRO etapas', () => {
    const plan = planExpiredSetupOps({ funnels: [], statuses: [] });
    expect(plan.createFunnel).toMatchObject({ name: EXPIRED_FUNNEL_NAME, systemKind: EXPIRED_FUNNEL_KIND });
    expect(plan.createStages.map(s => s.name)).toEqual([EXPIRED_ENTRY_NAME, 'Em contato', 'Venda', 'Perda']);
  });

  it('entrada, Venda e Perda nascem protegidas; a do meio NÃO', () => {
    const by = Object.fromEntries(planExpiredSetupOps({ funnels: [], statuses: [] }).createStages.map(s => [s.name, s]));
    expect(by[EXPIRED_ENTRY_NAME]).toMatchObject({ isSystem: true, isEntry: true });
    expect(by['Venda'].isSystem).toBe(true);
    expect(by['Perda'].isSystem).toBe(true);
    expect(by['Em contato'].isSystem).toBeFalsy();
  });

  it('idempotente: com tudo pronto não cria nada', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'b', funnelId: 'f1', name: 'Em contato' },
      { id: 'c', funnelId: 'f1', name: 'Venda', isSystem: true },
      { id: 'd', funnelId: 'f1', name: 'Perda', isSystem: true },
    ];
    const plan = planExpiredSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages).toEqual([]);
  });

  it('self-heal: funil existe mas alguém apagou a Perda pelo console', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'c', funnelId: 'f1', name: 'Venda', isSystem: true },
    ];
    const plan = planExpiredSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages.map(s => s.name)).toEqual(['Perda']);
    expect(plan.createStages[0].funnelId).toBe('f1');
  });

  it('NÃO recria a etapa do meio se a academia apagou (ela é livre)', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'c', funnelId: 'f1', name: 'Venda', isSystem: true },
      { id: 'd', funnelId: 'f1', name: 'Perda', isSystem: true },
    ];
    expect(planExpiredSetupOps({ funnels, statuses }).createStages).toEqual([]);
  });

  it('etapas de OUTRO funil não contam como existentes', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [{ id: 'x', funnelId: 'outro', name: 'Perda', isSystem: true }];
    expect(planExpiredSetupOps({ funnels, statuses }).createStages.map(s => s.name))
      .toEqual([EXPIRED_ENTRY_NAME, 'Venda', 'Perda']);
  });
});

describe('expiredStageIdOf', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Vencido' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
    { id: 'perda', funnelId: 'f1', isSystem: true, name: 'Perda' },
  ];
  it('sem toque, nasce na entrada', () => {
    expect(expiredStageIdOf({}, stages, 'f1')).toBe('entrada');
  });
  it('quem recusou na Meta já nasce em Perda, sem ninguém mexer', () => {
    expect(expiredStageIdOf({ renewalDeclined: true }, stages, 'f1')).toBe('perda');
  });
  it('depois do primeiro arrasto, manda o campo gravado', () => {
    expect(expiredStageIdOf({ reactivationStageId: 'meio', renewalDeclined: true }, stages, 'f1')).toBe('meio');
  });
  it('sem etapas devolve null em vez de quebrar', () => {
    expect(expiredStageIdOf({}, [], 'f1')).toBeNull();
  });
});
