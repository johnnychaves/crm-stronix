// Testes da regra de progresso/pendências da Visão geral (settingsSetup.js).
// A checagem é a mesma dos dois lados: o que não vira passo concluído tem que
// aparecer como pendência acionável.

import { describe, it, expect } from 'vitest';
import { buildSetupState, STEP_ORDER } from '../settingsSetup.js';

// Academia com tudo no lugar — baseline dos testes.
const complete = (over = {}) => ({
  funnels: [{ id: 'f1', name: 'Comercial' }],
  statuses: [
    { id: 's1', funnelId: 'f1', name: 'Novo lead' },
    { id: 's2', funnelId: 'f1', name: 'Negociação' },
  ],
  sources: [{ id: 'o1', name: 'Instagram' }],
  modalities: [{ id: 'm1', name: 'Musculação' }],
  planos: [{ id: 'p1', name: 'Mensal' }],
  lossReasons: [{ id: 'l1', name: 'Preço' }],
  metaWeekdays: [1, 2, 3, 4, 5],
  slaOverdueDays: 3,
  usersList: [
    { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
    { id: 'u2', name: 'Ana', role: 'consultant', authUid: 'uid-2', dailyVolumeTarget: 25 },
  ],
  ...over,
});

describe('buildSetupState — progresso', () => {
  it('academia completa dá 9 de 9 e 100%, sem pendência', () => {
    const s = buildSetupState(complete());
    expect(s.doneCount).toBe(9);
    expect(s.total).toBe(9);
    expect(s.percent).toBe(100);
    expect(s.pendings).toEqual([]);
    expect(s.attention).toEqual({});
  });

  it('mantém a ordem dos passos do rodapé', () => {
    const s = buildSetupState(complete());
    expect(s.steps.map(x => x.id)).toEqual(STEP_ORDER);
  });

  it('academia zerada não conclui nenhum passo', () => {
    const s = buildSetupState({});
    expect(s.doneCount).toBe(0);
    expect(s.percent).toBe(0);
  });

  it('arredonda o percentual (7 de 9 = 78%)', () => {
    // Derruba acessos da equipe e meta de prospecção — os 2 do mockup.
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u2', name: 'Lúcia', role: 'consultant', authUid: '', dailyVolumeTarget: null },
      ],
    }));
    expect(s.doneCount).toBe(7);
    expect(s.percent).toBe(78);
  });
});

describe('buildSetupState — acessos da equipe', () => {
  it('nomeia o membro quando só um está sem authUid', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u2', name: 'Lúcia Reis', role: 'consultant', authUid: '  ', dailyVolumeTarget: 25 },
      ],
    }));
    const p = s.pendings.find(x => x.id === 'access');
    expect(p.title).toBe('Lúcia Reis está sem acesso vinculado');
    expect(p.section).toBe('team');
    expect(p.focusId).toBe('u2');
  });

  it('agrupa quando mais de um está sem acesso', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Ana', role: 'consultant', authUid: null, dailyVolumeTarget: 25 },
        { id: 'u2', name: 'Lúcia', role: 'consultant', authUid: null, dailyVolumeTarget: 25 },
      ],
    }));
    expect(s.pendings.find(x => x.id === 'access').title)
      .toBe('2 membros da equipe estão sem acesso vinculado');
  });

  it('equipe vazia não conclui o passo nem inventa pendência de acesso', () => {
    const s = buildSetupState(complete({ usersList: [] }));
    expect(s.steps.find(x => x.id === 'access').done).toBe(false);
    expect(s.pendings.find(x => x.id === 'access')).toBeUndefined();
  });
});

describe('buildSetupState — meta de prospecção', () => {
  it('conta só consultores sem alvo (gestor sem alvo não pesa)', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1' },
        { id: 'u2', name: 'Ana', role: 'consultant', authUid: 'uid-2', dailyVolumeTarget: 0 },
        { id: 'u3', name: 'Pedro', role: 'consultant', authUid: 'uid-3' },
        { id: 'u4', name: 'Rita', role: 'consultant', authUid: 'uid-4', dailyVolumeTarget: 25 },
      ],
    }));
    expect(s.pendings.find(x => x.id === 'prospect').title)
      .toBe('2 consultores sem meta de prospecção');
  });

  it('singular quando é só um', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u2', name: 'Ana', role: 'consultant', authUid: 'uid-2' },
      ],
    }));
    expect(s.pendings.find(x => x.id === 'prospect').title)
      .toBe('1 consultor sem meta de prospecção');
  });
});

describe('buildSetupState — funis rasos', () => {
  it('aponta o funil de uma etapa só, citando a etapa', () => {
    const s = buildSetupState(complete({
      funnels: [{ id: 'f1', name: 'Comercial' }, { id: 'f2', name: 'Renovações' }],
      statuses: [
        { id: 's1', funnelId: 'f1', name: 'Novo lead' },
        { id: 's2', funnelId: 'f1', name: 'Negociação' },
        { id: 's3', funnelId: 'f2', name: 'Negociação' },
      ],
    }));
    const p = s.pendings.find(x => x.id === 'thin-funnel:f2');
    expect(p.title).toBe('O funil "Renovações" tem só a etapa Negociação');
    expect(p.focusId).toBe('f2');
  });

  it('funil sem nenhuma etapa tem texto próprio', () => {
    const s = buildSetupState(complete({
      funnels: [{ id: 'f1', name: 'Indicação' }],
      statuses: [],
    }));
    expect(s.pendings.find(x => x.id === 'thin-funnel:f1').title)
      .toBe('O funil "Indicação" não tem nenhuma etapa');
  });

  it('sem nenhum funil, cobra a criação em vez de listar funis rasos', () => {
    const s = buildSetupState(complete({ funnels: [], statuses: [] }));
    expect(s.pendings.find(x => x.id === 'funnel').actionLabel).toBe('Criar funil');
    expect(s.pendings.some(x => x.id.startsWith('thin-funnel'))).toBe(false);
  });
});

describe('buildSetupState — catálogos vazios', () => {
  it('cada catálogo vazio vira pendência apontando pro destino certo', () => {
    const s = buildSetupState(complete({
      sources: [], lossReasons: [], modalities: [], planos: [],
    }));
    const bySection = Object.fromEntries(s.pendings.map(p => [p.id, p.section]));
    expect(bySection.sources).toBe('catalogs');
    expect(bySection.loss).toBe('catalogs');
    expect(bySection.plans).toBe('catalogs');
    expect(bySection.modalities).toBe('sched');
  });

  it('SLA abaixo de 1 dia não conta como configurado', () => {
    expect(buildSetupState(complete({ slaOverdueDays: 0 })).steps.find(x => x.id === 'sla').done).toBe(false);
    expect(buildSetupState(complete({ slaOverdueDays: 1 })).steps.find(x => x.id === 'sla').done).toBe(true);
  });
});

describe('buildSetupState — atenção por seção', () => {
  it('a primeira pendência de cada seção vira o tooltip do trilho', () => {
    const s = buildSetupState(complete({
      sources: [],
      usersList: [{ id: 'u1', name: 'Ana', role: 'consultant', authUid: null }],
    }));
    expect(s.attention.team).toBe('Ana está sem acesso vinculado');
    expect(s.attention.pace).toBe('1 consultor sem meta de prospecção');
    expect(s.attention.catalogs).toBe('Nenhuma origem cadastrada');
    expect(s.attention.overview).toBe('3 itens pedindo atenção');
  });
});
