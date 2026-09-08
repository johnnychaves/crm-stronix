// Testes do funil de sistema UPGRADE (src/lib/upgradeFunnel.js). Espelho dos
// testes do Vencidos: a diferença é que aqui só a entrada nasce, e o card só
// existe depois que alguém grava upgradeStageId.

import { describe, it, expect } from 'vitest';
import {
  UPGRADE_FUNNEL_KIND, UPGRADE_FUNNEL_NAME, UPGRADE_ENTRY_NAME, UPGRADE_FUNNEL_ORDER,
  isUpgradeFunnel, getUpgradeFunnel, getUpgradeEntryStage,
  planUpgradeSetupOps, upgradeStageIdOf, projectUpgradeLeads,
} from '../upgradeFunnel.js';
import { partitionLeadsByStatus } from '../kanban.js';

describe('isUpgradeFunnel', () => {
  it('casa pela flag, NUNCA pelo nome', () => {
    expect(isUpgradeFunnel({ systemKind: 'upgrade' })).toBe(true);
    expect(isUpgradeFunnel({ name: 'Upgrade' })).toBe(false);
    expect(isUpgradeFunnel(null)).toBe(false);
  });
});

describe('getUpgradeFunnel', () => {
  it('duplicata resolve pelo createdAt mais antigo', () => {
    const novo = { id: 'b', systemKind: 'upgrade', createdAt: 2000 };
    const velho = { id: 'a', systemKind: 'upgrade', createdAt: 1000 };
    expect(getUpgradeFunnel([novo, velho]).id).toBe('a');
  });
  it('sem funil de sistema devolve null', () => {
    expect(getUpgradeFunnel([{ id: 'x', name: 'Upgrade' }])).toBeNull();
    expect(getUpgradeFunnel([])).toBeNull();
    expect(getUpgradeFunnel(null)).toBeNull();
  });
});

describe('getUpgradeEntryStage', () => {
  const f = 'f1';
  it('acha pela flag isEntry', () => {
    const st = [{ id: 's1', funnelId: f, isEntry: true }, { id: 's2', funnelId: f }];
    expect(getUpgradeEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal: sem isEntry, cai no isSystem com o nome padrão', () => {
    const st = [{ id: 's2', funnelId: f, order: 1 }, { id: 's1', funnelId: f, isSystem: true, name: 'Aguardando contato' }];
    expect(getUpgradeEntryStage(st, f).id).toBe('s1');
  });
  it('self-heal final: cai na de menor order', () => {
    const st = [{ id: 's2', funnelId: f, order: 3 }, { id: 's1', funnelId: f, order: 1 }];
    expect(getUpgradeEntryStage(st, f).id).toBe('s1');
  });
  it('sem funil ou sem etapa devolve null', () => {
    expect(getUpgradeEntryStage([], null)).toBeNull();
    expect(getUpgradeEntryStage([], 'f1')).toBeNull();
  });
});

describe('planUpgradeSetupOps', () => {
  it('base zerada: cria o funil (ordem 97) e SÓ a entrada', () => {
    const plan = planUpgradeSetupOps({ funnels: [], statuses: [] });
    expect(plan.createFunnel).toEqual({ name: UPGRADE_FUNNEL_NAME, systemKind: UPGRADE_FUNNEL_KIND, order: UPGRADE_FUNNEL_ORDER });
    expect(UPGRADE_FUNNEL_ORDER).toBe(97);
    expect(plan.createStages.map(s => s.name)).toEqual([UPGRADE_ENTRY_NAME]);
    expect(UPGRADE_ENTRY_NAME).toBe('Aguardando contato');
  });

  it('a entrada nasce protegida; Venda e Perda não são etapas', () => {
    const stages = planUpgradeSetupOps({ funnels: [], statuses: [] }).createStages;
    expect(stages[0]).toMatchObject({ isSystem: true, isEntry: true, order: 0 });
    expect(stages.some(s => s.name === 'Venda' || s.name === 'Perda')).toBe(false);
  });

  it('idempotente: com funil e entrada não cria nada', () => {
    const funnels = [{ id: 'f1', systemKind: UPGRADE_FUNNEL_KIND }];
    const statuses = [{ id: 'a', funnelId: 'f1', name: UPGRADE_ENTRY_NAME, isSystem: true, isEntry: true }];
    const plan = planUpgradeSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages).toEqual([]);
  });

  it('self-heal: funil existe mas a ENTRADA sumiu', () => {
    const funnels = [{ id: 'f1', systemKind: UPGRADE_FUNNEL_KIND }];
    const statuses = [{ id: 'b', funnelId: 'f1', name: 'Em contato' }];
    const plan = planUpgradeSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages.map(s => s.name)).toEqual([UPGRADE_ENTRY_NAME]);
    expect(plan.createStages[0].funnelId).toBe('f1');
  });

  it('etapas de OUTRO funil não contam como existentes', () => {
    const funnels = [{ id: 'f1', systemKind: UPGRADE_FUNNEL_KIND }];
    const statuses = [{ id: 'x', funnelId: 'outro', name: UPGRADE_ENTRY_NAME, isEntry: true }];
    expect(planUpgradeSetupOps({ funnels, statuses }).createStages.map(s => s.name)).toEqual([UPGRADE_ENTRY_NAME]);
  });
});

describe('upgradeStageIdOf', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Aguardando contato' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];
  it('manda o campo gravado', () => {
    expect(upgradeStageIdOf({ upgradeStageId: 'meio' }, stages, 'f1')).toBe('meio');
  });
  it('etapa apagada em Configurações cai na entrada', () => {
    expect(upgradeStageIdOf({ upgradeStageId: 'sumiu' }, stages, 'f1')).toBe('entrada');
  });
  it('sem etapas devolve null em vez de quebrar', () => {
    expect(upgradeStageIdOf({ upgradeStageId: 'meio' }, [], 'f1')).toBeNull();
  });
});

describe('projectUpgradeLeads', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Aguardando contato' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];
  const leads = [
    { id: 'l1', name: 'Ana', status: 'Venda', upgradeStageId: 'entrada' },
    { id: 'l2', name: 'Bia', status: 'Venda', upgradeStageId: 'meio' },
  ];

  it('o status EXIBIDO vira o nome da etapa e o card ganha _upgradeCard', () => {
    const cards = projectUpgradeLeads(leads, stages, 'f1');
    expect(cards.map(c => c.status)).toEqual(['Aguardando contato', 'Em contato']);
    expect(cards.every(c => c._upgradeCard === true)).toBe(true);
  });

  it('não muda o objeto original (o status real segue Venda)', () => {
    projectUpgradeLeads(leads, stages, 'f1');
    expect(leads[0].status).toBe('Venda');
  });

  it('sem funil devolve vazio', () => {
    expect(projectUpgradeLeads(leads, stages, null)).toEqual([]);
  });

  it('cai direto nas colunas do board (partitionLeadsByStatus agrupa pelo nome)', () => {
    const by = partitionLeadsByStatus(projectUpgradeLeads(leads, stages, 'f1'));
    expect(by.get('Aguardando contato').map(l => l.id)).toEqual(['l1']);
    expect(by.get('Em contato').map(l => l.id)).toEqual(['l2']);
  });
});
