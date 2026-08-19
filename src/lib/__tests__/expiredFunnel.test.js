import { describe, it, expect } from 'vitest';
import {
  EXPIRED_FUNNEL_KIND, EXPIRED_FUNNEL_NAME, EXPIRED_ENTRY_NAME,
  isExpiredFunnel, getExpiredFunnel, getExpiredEntryStage,
  planExpiredSetupOps, expiredStageIdOf, projectExpiredLeads, splitExpiredForBoard,
} from '../expiredFunnel.js';
import { partitionLeadsByStatus } from '../kanban.js';
import { isSystemStage } from '../funnels.js';

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
    expect(plan.createStages.map(s => s.name)).toEqual([EXPIRED_ENTRY_NAME, 'Em contato', 'Em negociação']);
  });

  // Venda e Perda NÃO são etapas: o board as renderiza como colunas especiais em
  // todo funil. Criá-las aqui duplicaria a coluna.
  it('só a entrada nasce protegida; as do meio são livres', () => {
    const stages = planExpiredSetupOps({ funnels: [], statuses: [] }).createStages;
    const by = Object.fromEntries(stages.map(s => [s.name, s]));
    expect(by[EXPIRED_ENTRY_NAME]).toMatchObject({ isSystem: true, isEntry: true });
    expect(by['Em contato'].isSystem).toBeFalsy();
    expect(by['Em negociação'].isSystem).toBeFalsy();
    expect(stages.some(s => s.name === 'Venda' || s.name === 'Perda')).toBe(false);
  });

  it('idempotente: com tudo pronto não cria nada', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [
      { id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true },
      { id: 'b', funnelId: 'f1', name: 'Em contato' },
    ];
    const plan = planExpiredSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages).toEqual([]);
  });

  it('self-heal: funil existe mas alguém apagou a ENTRADA pelo console', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [{ id: 'b', funnelId: 'f1', name: 'Em contato' }];
    const plan = planExpiredSetupOps({ funnels, statuses });
    expect(plan.createFunnel).toBeNull();
    expect(plan.createStages.map(s => s.name)).toEqual([EXPIRED_ENTRY_NAME]);
    expect(plan.createStages[0].funnelId).toBe('f1');
  });

  it('NÃO recria as etapas do meio se a academia apagou (elas são livres)', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [{ id: 'a', funnelId: 'f1', name: EXPIRED_ENTRY_NAME, isSystem: true, isEntry: true }];
    expect(planExpiredSetupOps({ funnels, statuses }).createStages).toEqual([]);
  });

  it('etapas de OUTRO funil não contam como existentes', () => {
    const funnels = [{ id: 'f1', systemKind: EXPIRED_FUNNEL_KIND }];
    const statuses = [{ id: 'x', funnelId: 'outro', name: EXPIRED_ENTRY_NAME, isEntry: true }];
    expect(planExpiredSetupOps({ funnels, statuses }).createStages.map(s => s.name))
      .toEqual([EXPIRED_ENTRY_NAME]);
  });
});

describe('expiredStageIdOf', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Vencido' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];
  it('sem toque, nasce na entrada', () => {
    expect(expiredStageIdOf({}, stages, 'f1')).toBe('entrada');
  });

  it('depois do primeiro arrasto, manda o campo gravado', () => {
    expect(expiredStageIdOf({ reactivationStageId: 'meio', renewalDeclined: true }, stages, 'f1')).toBe('meio');
  });
  it('sem etapas devolve null em vez de quebrar', () => {
    expect(expiredStageIdOf({}, [], 'f1')).toBeNull();
  });
});

describe('projectExpiredLeads', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Vencido' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];

  // Cliente é status 'Venda'. Sem a projeção, TODOS cairiam na coluna Venda.
  it('o status exibido vira o nome da etapa derivada', () => {
    const out = projectExpiredLeads([{ id: 'l1', status: 'Venda' }], stages, 'f1');
    expect(out[0].status).toBe('Vencido');
  });

  it('o status REAL do documento não é alterado', () => {
    const original = { id: 'l1', status: 'Venda' };
    projectExpiredLeads([original], stages, 'f1');
    expect(original.status).toBe('Venda');
  });

  it('quem já foi arrastado vai para a etapa gravada', () => {
    const out = projectExpiredLeads([{ id: 'l1', status: 'Venda', reactivationStageId: 'meio' }], stages, 'f1');
    expect(out[0].status).toBe('Em contato');
  });



  it('marca o card para o handler de drop saber onde gravar', () => {
    expect(projectExpiredLeads([{ id: 'l1' }], stages, 'f1')[0]._expiredCard).toBe(true);
  });

  // Etapa apagada pelo console: o card sumiria numa coluna inexistente.
  it('lead cuja etapa gravada não existe mais é descartado, não quebra', () => {
    const out = projectExpiredLeads([{ id: 'l1', reactivationStageId: 'fantasma' }], stages, 'f1');
    expect(out).toEqual([]);
  });

  it('sem funil devolve lista vazia', () => {
    expect(projectExpiredLeads([{ id: 'l1' }], stages, null)).toEqual([]);
  });
});

// Costura entre projectExpiredLeads e partitionLeadsByStatus: é o caminho real
// que o board percorre para colocar cada card numa coluna. Testado junto porque
// o erro mora exatamente entre os dois — a projeção devolve NOME de etapa e o
// particionador agrupa por `status`.
describe('projeção + particionamento (o caminho do board)', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Vencido' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];
  const colunas = (leads) =>
    partitionLeadsByStatus(projectExpiredLeads(leads, stages, 'f1'), stages.map(s => s.name));

  it('cada card cai na coluna da sua etapa', () => {
    const mapa = colunas([
      { id: 'novo', status: 'Venda' },
      { id: 'trabalhando', status: 'Venda', reactivationStageId: 'meio' },
    ]);
    expect((mapa.get('Vencido') || []).map(l => l.id)).toEqual(['novo']);
    expect((mapa.get('Em contato') || []).map(l => l.id)).toEqual(['trabalhando']);
  });

  // O erro que a projeção existe para evitar: cliente é status 'Venda', então
  // sem ela TODOS cairiam numa coluna Venda e nenhum no funil.
  it('nenhum card vaza para uma coluna "Venda"', () => {
    const mapa = colunas([{ id: 'a', status: 'Venda' }, { id: 'b', status: 'Venda' }]);
    expect(mapa.get('Venda')).toBeUndefined();
    const total = stages.reduce((n, s) => n + (mapa.get(s.name) || []).length, 0);
    expect(total).toBe(2);
  });

  it('base sem cliente vencido devolve colunas vazias, sem quebrar', () => {
    const mapa = colunas([]);
    expect(stages.every(s => (mapa.get(s.name) || []).length === 0)).toBe(true);
  });
});

// isSystemStage (funnels.js) protege automaticamente a etapa chamada exatamente
// 'negociação'. A daqui precisa ficar LIVRE, por isso o nome é "Em negociação".
describe('a etapa de negociação nasce editável', () => {
  it('não usa o nome que dispara a proteção automática', () => {
    const stages = planExpiredSetupOps({ funnels: [], statuses: [] }).createStages;
    const nomes = stages.map(s => s.name.trim().toLowerCase());
    expect(nomes).toContain('em negociação');
    expect(nomes).not.toContain('negociação');
    expect(stages.every(s => !isSystemStage(s) || s.isEntry)).toBe(true);
  });
});

describe('splitExpiredForBoard', () => {
  const stages = [
    { id: 'entrada', funnelId: 'f1', isEntry: true, name: 'Vencido' },
    { id: 'meio', funnelId: 'f1', name: 'Em contato' },
  ];

  it('quem recusou vai para a coluna Perda, fora das etapas', () => {
    const { cards, declined } = splitExpiredForBoard([
      { id: 'ativo', status: 'Venda' },
      { id: 'recusou', status: 'Venda', renewalDeclined: true },
    ], stages, 'f1');
    expect(cards.map(l => l.id)).toEqual(['ativo']);
    expect(declined.map(l => l.id)).toEqual(['recusou']);
  });

  // O ponto que o Johnny confirmou: a coluna Perda deste funil NÃO mexe no
  // ciclo de vida. A pessoa continua cliente, com ficha e contratos.
  it('quem está na Perda continua CLIENTE, sem virar lifecycleBucket perda', () => {
    const { declined } = splitExpiredForBoard(
      [{ id: 'r', status: 'Venda', lifecycleStage: 'cliente', lifecycleBucket: 'cliente', renewalDeclined: true }],
      stages, 'f1'
    );
    expect(declined[0].lifecycleBucket).toBe('cliente');
    expect(declined[0].lifecycleStage).toBe('cliente');
    expect(declined[0].status).toBe('Venda');
  });

  it('marca os dois lados como card de vencido, para o drop bifurcar', () => {
    const { cards, declined } = splitExpiredForBoard([
      { id: 'a' }, { id: 'b', renewalDeclined: true },
    ], stages, 'f1');
    expect(cards[0]._expiredCard).toBe(true);
    expect(declined[0]._expiredCard).toBe(true);
  });

  it('lista vazia não quebra', () => {
    expect(splitExpiredForBoard([], stages, 'f1')).toEqual({ cards: [], declined: [] });
  });
});
