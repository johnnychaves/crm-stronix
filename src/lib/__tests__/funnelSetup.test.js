// Configuração de funis com id FIXO (src/lib/funnelSetup.js). Duas abas, dois
// computadores ou dois gestores gravam no mesmo documento, então o resultado é
// sempre um funil só. Id publicado não muda nunca.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FUNNEL_ID, SYSTEM_FUNNEL_IDS, REFERRAL_SOURCE_ID,
  setupStageId, toSetupWrites, planDefaultFunnel, planNegociacaoStages,
} from '../funnelSetup.js';
import { ALL_FUNNELS_ID } from '../funnels.js';
import { planUpgradeSetupOps } from '../upgradeFunnel.js';
import { planReferralSetupOps } from '../referrals.js';
import { planRenewalSetupOps } from '../renewalFunnel.js';

describe('ids fixos', () => {
  it('são estes e não mudam (mudar cria um segundo funil em toda academia)', () => {
    expect(DEFAULT_FUNNEL_ID).toBe('funil-padrao');
    expect(SYSTEM_FUNNEL_IDS).toEqual({
      referral: 'funil-sistema-indicacoes',
      upgrade: 'funil-sistema-upgrade',
      renewal: 'funil-sistema-renovacoes',
      expired: 'funil-sistema-vencidos',
    });
    expect(REFERRAL_SOURCE_ID).toBe('origem-indicacao');
  });

  it('são ids válidos no Firestore e distintos entre si', () => {
    const ids = [DEFAULT_FUNNEL_ID, ...Object.values(SYSTEM_FUNNEL_IDS), REFERRAL_SOURCE_ID];
    for (const id of ids) {
      expect(id).not.toContain('/');
      expect(id).not.toBe('.');
      expect(id).not.toBe('..');
      expect(id).not.toMatch(/^__.*__$/);
      expect(new TextEncoder().encode(id).length).toBeLessThan(1500);
      expect(id).not.toBe(ALL_FUNNELS_ID);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('setupStageId', () => {
  it('a entrada tem id próprio, que não muda quando ela é renomeada', () => {
    expect(setupStageId('f1', { name: 'Vencido', isEntry: true })).toBe('f1--entrada');
    expect(setupStageId('f1', { name: 'Aguardando contato', isEntry: true })).toBe('f1--entrada');
  });

  it('as outras etapas usam o nome sem acento', () => {
    expect(setupStageId('f1', { name: 'Negociação' })).toBe('f1--etapa-negociacao');
    expect(setupStageId('f1', { name: 'Em contato' })).toBe('f1--etapa-em-contato');
  });

  it('uma etapa chamada "Entrada" não colide com a entrada', () => {
    expect(setupStageId('f1', { name: 'Entrada' })).not.toBe(setupStageId('f1', { name: 'X', isEntry: true }));
  });

  it('nome vazio ganha um id estável', () => {
    expect(setupStageId('f1', { name: '' })).toBe('f1--etapa-sem-nome');
  });
});

describe('toSetupWrites', () => {
  it('funil novo leva o id pelo tipo, e as etapas herdam esse id', () => {
    const writes = toSetupWrites(planUpgradeSetupOps({ funnels: [], statuses: [] }), 'ts');
    expect(writes).toEqual([
      {
        collection: 'funnels',
        id: 'funil-sistema-upgrade',
        data: { name: 'Upgrade', systemKind: 'upgrade', order: 97, createdAt: 'ts', updatedAt: 'ts' },
      },
      {
        collection: 'statuses',
        id: 'funil-sistema-upgrade--entrada',
        data: { name: 'Aguardando contato', color: 'slate', order: 0, isSystem: true, isEntry: true, funnelId: 'funil-sistema-upgrade' },
      },
    ]);
  });

  it('etapa de um funil antigo (id aleatório) usa o id dele', () => {
    const legado = { id: 'Ab12Cd', systemKind: 'upgrade', name: 'Upgrade' };
    const writes = toSetupWrites(planUpgradeSetupOps({ funnels: [legado], statuses: [] }), 'ts');
    expect(writes).toHaveLength(1);
    expect(writes[0].id).toBe('Ab12Cd--entrada');
    expect(writes[0].data.funnelId).toBe('Ab12Cd');
  });

  it('a origem Indicação tem id fixo', () => {
    const writes = toSetupWrites(planReferralSetupOps({ funnels: [], statuses: [], sources: [] }), 'ts');
    const origem = writes.find((w) => w.collection === 'sources');
    expect(origem).toEqual({ collection: 'sources', id: 'origem-indicacao', data: { name: 'Indicação', createdAt: 'ts' } });
  });

  it('o carimbo de hora vai no funil e na origem, nunca na etapa', () => {
    const writes = toSetupWrites(planReferralSetupOps({ funnels: [], statuses: [], sources: [] }), 'ts');
    for (const w of writes.filter((x) => x.collection === 'statuses')) {
      expect(w.data).not.toHaveProperty('createdAt');
    }
  });

  it('plano vazio não grava nada', () => {
    const existente = [{ id: 'r', systemKind: 'renewal' }];
    expect(toSetupWrites(planRenewalSetupOps({ funnels: existente }), 'ts')).toEqual([]);
    expect(toSetupWrites(null, 'ts')).toEqual([]);
  });

  it('tipo de funil sem id fixo é erro, não um id inventado', () => {
    expect(() => toSetupWrites({ createFunnel: { systemKind: 'novo' } }, 'ts')).toThrow(/sem id fixo/);
  });

  it('etapa sem funil é erro', () => {
    expect(() => toSetupWrites({ createStages: [{ name: 'X' }] }, 'ts')).toThrow(/sem funil/);
  });
});

describe('planDefaultFunnel (passo 1 da migração de funis)', () => {
  it('um padrão só: mantém e não grava nada', () => {
    expect(planDefaultFunnel([{ id: 'a', isDefault: true }, { id: 'b' }])).toEqual({
      defaultId: 'a', create: null, promoteId: null, demoteIds: [],
    });
  });

  it('vários padrões: fica o criado primeiro e os outros são rebaixados', () => {
    const plan = planDefaultFunnel([
      { id: 'novo', isDefault: true, createdAt: { seconds: 200 }, order: 0 },
      { id: 'velho', isDefault: true, createdAt: { seconds: 100 }, order: 5 },
    ]);
    expect(plan.defaultId).toBe('velho');
    expect(plan.demoteIds).toEqual(['novo']);
    expect(plan.create).toBeNull();
  });

  it('vários padrões com a mesma data: desempata pela menor ordem', () => {
    const plan = planDefaultFunnel([
      { id: 'b', isDefault: true, createdAt: { seconds: 100 }, order: 3 },
      { id: 'a', isDefault: true, createdAt: { seconds: 100 }, order: 1 },
    ]);
    expect(plan.defaultId).toBe('a');
  });

  it('padrão sem data perde para o que tem data', () => {
    const plan = planDefaultFunnel([
      { id: 'semData', isDefault: true },
      { id: 'comData', isDefault: true, createdAt: { toMillis: () => 5 } },
    ]);
    expect(plan.defaultId).toBe('comData');
  });

  it('nenhum padrão: promove o funil próprio de menor ordem, nunca um de sistema', () => {
    const plan = planDefaultFunnel([
      { id: 'sis', systemKind: 'referral', order: 0 },
      { id: 'b', order: 3 },
      { id: 'c', order: 1 },
    ]);
    expect(plan).toEqual({ defaultId: 'c', create: null, promoteId: 'c', demoteIds: [] });
  });

  it('nenhum funil próprio: cria o Comercial com o id fixo', () => {
    const esperado = {
      defaultId: DEFAULT_FUNNEL_ID,
      create: { name: 'Comercial', order: 0, isDefault: true },
      promoteId: null,
      demoteIds: [],
    };
    expect(planDefaultFunnel([])).toEqual(esperado);
    expect(planDefaultFunnel(null)).toEqual(esperado);
    expect(planDefaultFunnel([{ id: 'sis', systemKind: 'expired', order: 99 }])).toEqual(esperado);
  });
});

describe('planNegociacaoStages (passo 4 da migração de funis)', () => {
  it('cria a Negociação no funil próprio que não tem, na última posição', () => {
    const writes = planNegociacaoStages({
      funnels: [{ id: 'f1' }],
      statuses: [{ id: 's1', funnelId: 'f1', name: 'Novo' }, { id: 's2', funnelId: 'f1', name: 'Visita' }],
    });
    expect(writes).toEqual([{
      collection: 'statuses',
      id: 'f1--etapa-negociacao',
      data: { name: 'Negociação', color: 'purple', order: 2, funnelId: 'f1', isSystem: true },
    }]);
  });

  it('pula o funil que já tem Negociação, com espaço ou maiúscula', () => {
    const writes = planNegociacaoStages({
      funnels: [{ id: 'f1' }],
      statuses: [{ id: 's1', funnelId: 'f1', name: '  NEGOCIAÇÃO ' }],
    });
    expect(writes).toEqual([]);
  });

  it('pula todo funil de sistema', () => {
    const writes = planNegociacaoStages({
      funnels: [
        { id: 'i', systemKind: 'referral' },
        { id: 'v', systemKind: 'expired' },
        { id: 'r', systemKind: 'renewal' },
        { id: 'u', systemKind: 'upgrade' },
      ],
      statuses: [],
    });
    expect(writes).toEqual([]);
  });

  it('rodar duas vezes sobre o mesmo estado dá os mesmos ids', () => {
    const estado = { funnels: [{ id: 'f1' }, { id: 'f2' }], statuses: [] };
    expect(planNegociacaoStages(estado).map((w) => w.id)).toEqual(planNegociacaoStages(estado).map((w) => w.id));
  });

  it('funil sem id e entrada vazia não quebram', () => {
    expect(planNegociacaoStages({ funnels: [{ name: 'sem id' }], statuses: [] })).toEqual([]);
    expect(planNegociacaoStages()).toEqual([]);
  });
});
