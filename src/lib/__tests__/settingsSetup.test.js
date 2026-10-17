// Testes da regra de progresso/pendências da Visão geral (settingsSetup.js).
// A checagem é a mesma dos dois lados: o que não vira passo concluído tem que
// aparecer como pendência acionável.

import { describe, it, expect } from 'vitest';
import { buildSetupState, railCounts, railSummaries, STEP_ORDER } from '../settingsSetup.js';

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
  it('academia completa dá 7 de 7 e 100%, sem pendência', () => {
    const s = buildSetupState(complete());
    expect(s.doneCount).toBe(7);
    expect(s.total).toBe(7);
    expect(s.percent).toBe(100);
    expect(s.pendings).toEqual([]);
    expect(s.counts).toEqual({});
  });

  // Dias de meta e alerta de lead atrasado já nascem com um valor: concluir os
  // dois não diz nada, então saíram da conta (aparecem em `values`).
  it('dias de meta e alerta de lead atrasado não são passos', () => {
    expect(STEP_ORDER).toEqual(['funnel', 'sources', 'modalities', 'plans', 'loss', 'access', 'prospect']);
    expect(STEP_ORDER).not.toContain('metaDays');
    expect(STEP_ORDER).not.toContain('sla');
    const s = buildSetupState(complete({ metaWeekdays: [], slaOverdueDays: 0 }));
    expect(s.percent).toBe(100);
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

  it('arredonda o percentual (5 de 7 = 71%)', () => {
    // Derruba acessos da equipe e meta de prospecção — os 2 do mockup.
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u2', name: 'Lúcia', role: 'consultant', authUid: '', dailyVolumeTarget: null },
      ],
    }));
    expect(s.doneCount).toBe(5);
    expect(s.percent).toBe(71);
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
  const funis = (nomes, comEtapa = {}) => ({
    funnels: nomes.map((name, i) => ({ id: `f${i}`, name })),
    statuses: nomes.flatMap((_, i) => Array.from({ length: comEtapa[i] ?? 0 }, (__, k) => ({ id: `s${i}-${k}`, funnelId: `f${i}`, name: `Etapa ${k}` }))),
  });

  it('um funil sem etapa vira uma pendência no singular', () => {
    const p = buildSetupState(complete(funis(['Indicação']))).pendings.find(x => x.id === 'thin-funnels');
    expect(p.title).toBe('1 funil sem etapa');
    expect(p.description).toBe('Indicação não abre no Pipeline.');
    expect(p.count).toBe(1);
    expect(p.actionLabel).toBe('Abrir funil');
    expect(p.focusId).toBe('f0');
  });

  it('vários funis sem etapa viram uma pendência só, com o número deles', () => {
    const s = buildSetupState(complete(funis(['Inativos', 'Visitas', 'Migrações'])));
    const rasos = s.pendings.filter(x => x.id.startsWith('thin-funnel'));
    expect(rasos).toHaveLength(1);
    expect(rasos[0].title).toBe('3 funis sem etapa');
    expect(rasos[0].description).toBe('Inativos, Visitas e Migrações não abrem no Pipeline.');
    expect(rasos[0].count).toBe(3);
    expect(rasos[0].actionLabel).toBe('Abrir funis');
    expect(rasos[0].focusId).toBe('f0');
  });

  it('cita até três nomes e conta o resto', () => {
    const p = buildSetupState(complete(funis(['A', 'B', 'C', 'D', 'E']))).pendings.find(x => x.id === 'thin-funnels');
    expect(p.title).toBe('5 funis sem etapa');
    expect(p.description).toBe('A, B, C e mais 2 não abrem no Pipeline.');
  });

  it('mistura de zero e uma etapa diz "menos de duas etapas"', () => {
    const p = buildSetupState(complete(funis(['Sem etapa', 'Uma só'], { 1: 1 }))).pendings.find(x => x.id === 'thin-funnels');
    expect(p.title).toBe('2 funis com menos de duas etapas');
    expect(p.description).toBe('Sem etapa e Uma só precisam de pelo menos duas etapas para desenhar o caminho no Pipeline.');
  });

  it('só funis de uma etapa não são "sem etapa"', () => {
    const p = buildSetupState(complete(funis(['Renovações'], { 0: 1 }))).pendings.find(x => x.id === 'thin-funnels');
    expect(p.title).toBe('1 funil com só uma etapa');
    expect(p.description).toBe('Renovações precisa de pelo menos duas etapas para desenhar o caminho no Pipeline.');
  });

  it('o funil com duas etapas não entra na pendência', () => {
    const s = buildSetupState(complete(funis(['Comercial', 'Inativos'], { 0: 2 })));
    expect(s.pendings.find(x => x.id === 'thin-funnels').title).toBe('1 funil sem etapa');
    expect(s.pendings.find(x => x.id === 'thin-funnels').focusId).toBe('f1');
  });

  it('sem nenhum funil, cobra a criação em vez de listar funis rasos', () => {
    const s = buildSetupState(complete({ funnels: [], statuses: [] }));
    expect(s.pendings.find(x => x.id === 'funnel').actionLabel).toBe('Criar funil');
    expect(s.pendings.some(x => x.id.startsWith('thin-funnel'))).toBe(false);
  });
});

describe('buildSetupState — passo aberto sem outra pendência', () => {
  it('sem consultor, a prospecção vira "Nenhum consultor cadastrado" e leva ao cadastro', () => {
    const s = buildSetupState(complete({
      usersList: [{ id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1' }],
    }));
    expect(s.doneCount).toBe(6);
    const p = s.pendings.find(x => x.id === 'no-consultant');
    expect(p.title).toBe('Nenhum consultor cadastrado');
    expect([p.section, p.focusId]).toEqual(['team', 'new']);
    expect(s.counts.team).toBe(1);
    // Todo passo aberto aparece em alguma linha de "O que falta".
    expect(s.pendings).toHaveLength(s.total - s.doneCount);
  });

  it('equipe vazia pede o cadastro uma vez só, sem a linha do consultor', () => {
    const s = buildSetupState(complete({ usersList: [] }));
    expect(s.pendings.map(x => x.id)).toEqual(['no-team']);
    expect(s.pendings[0].title).toBe('Ninguém cadastrado na equipe');
  });
});

describe('buildSetupState — funis de clientes', () => {
  // O funil Renovações não guarda etapa no banco: as colunas saem dos marcos.
  it('Renovações, Vencidos e Upgrade não contam como funil raso nem como funil criado', () => {
    const sistema = [
      { id: 'r', name: 'Renovações', systemKind: 'renewal' },
      { id: 'v', name: 'Vencidos', systemKind: 'expired' },
      { id: 'u', name: 'Upgrade', systemKind: 'upgrade' },
    ];
    const s = buildSetupState(complete({ funnels: [...complete().funnels, ...sistema] }));
    expect(s.pendings).toEqual([]);
    expect(s.counts).toEqual({});
    const soSistema = buildSetupState(complete({ funnels: sistema }));
    expect(soSistema.steps.find(x => x.id === 'funnel').done).toBe(false);
    expect(soSistema.pendings.map(x => x.id)).toEqual(['funnel']);
  });

  it('o funil de Indicações é de lead e continua na conta', () => {
    const s = buildSetupState(complete({ funnels: [...complete().funnels, { id: 'i', name: 'Indicações', systemKind: 'referral' }] }));
    expect(s.pendings.find(x => x.id === 'thin-funnels').title).toBe('1 funil sem etapa');
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
});

describe('buildSetupState — valores atuais', () => {
  const valoresDe = (over) => Object.fromEntries(buildSetupState(complete(over)).values.map(v => [v.id, v.value]));

  it('diz os dias de meta por extenso e o alerta em dias, os dois apontando para Metas & ritmo', () => {
    const s = buildSetupState(complete());
    expect(s.values.map(v => [v.label, v.value, v.section])).toEqual([
      ['Dias de meta', 'segunda a sexta', 'pace'],
      ['Alerta de lead atrasado', '3 dias', 'pace'],
    ]);
  });

  it('dias soltos, seis dias e nenhum dia', () => {
    expect(valoresDe({ metaWeekdays: [1, 3, 5] }).metaDays).toBe('segundas, quartas e sextas');
    expect(valoresDe({ metaWeekdays: [1, 2, 3, 4, 5, 6] }).metaDays).toBe('segunda a sábado');
    expect(valoresDe({ metaWeekdays: [] }).metaDays).toBe('nenhum dia');
    expect(valoresDe({ metaWeekdays: undefined }).metaDays).toBe('nenhum dia');
  });

  it('um dia de alerta no singular, e valor inválido não inventa número', () => {
    expect(valoresDe({ slaOverdueDays: 1 }).sla).toBe('1 dia');
    expect(valoresDe({ slaOverdueDays: 0 }).sla).toBe('não definido');
    expect(valoresDe({ slaOverdueDays: undefined }).sla).toBe('não definido');
  });
});

describe('buildSetupState — itens que pedem ação por seção', () => {
  it('soma o número de itens de cada seção, e não o de pendências', () => {
    const s = buildSetupState(complete({
      sources: [],
      funnels: [{ id: 'f1', name: 'A' }, { id: 'f2', name: 'B' }, { id: 'f3', name: 'C' }],
      statuses: [],
      usersList: [
        { id: 'u1', name: 'Ana', role: 'consultant', authUid: null },
        { id: 'u2', name: 'Bia', role: 'consultant', authUid: null },
      ],
    }));
    expect(s.counts.team).toBe(2);
    expect(s.counts.pace).toBe(2);
    expect(s.counts.funnels).toBe(3);
    expect(s.counts.catalogs).toBe(1);
    expect(s.counts.overview).toBeUndefined();
  });

  it('seção sem pendência não aparece, e modalidade vazia cai em Agendamento', () => {
    expect(buildSetupState(complete({ modalities: [] })).counts).toEqual({ sched: 1 });
  });

  it('catálogos vazios somam na mesma seção', () => {
    expect(buildSetupState(complete({ sources: [], lossReasons: [], planos: [] })).counts.catalogs).toBe(3);
  });

  it('railCounts soma as indicações sem dono, que vêm dos leads', () => {
    const s = buildSetupState(complete());
    expect(railCounts(s, 0)).toEqual({});
    expect(railCounts(s, 10)).toEqual({ 'referral-owners': 10 });
    expect(s.counts).toEqual({});
  });
});

describe('railSummaries', () => {
  const base = { teamSize: 7, funnelCount: 5, catalogTotal: 27, pendingOwners: 0 };
  const resumo = (over, opts = {}) => railSummaries(buildSetupState(complete(over)), { ...base, ...opts });

  it('sem pendência, cada grupo diz o que há nele e ninguém pede ação', () => {
    const r = resumo({});
    expect(Object.fromEntries(Object.entries(r).map(([id, g]) => [id, g.text]))).toEqual({
      academia: 'Perfil e plano',
      equipe: '7 pessoas',
      dia: 'Metas, agenda e rotinas',
      funil: '5 funis, 27 itens nos catálogos',
      conexoes: 'Stronizap',
      base: 'Migração e importação',
    });
    expect(Object.values(r).every(g => g.pede === false)).toBe(true);
  });

  it('com pendência, o grupo diz o que falta e pede ação', () => {
    const r = resumo({
      funnels: ['A', 'B', 'C', 'D'].map((name, i) => ({ id: `f${i}`, name })),
      statuses: [],
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1' },
        { id: 'u2', name: 'Ana', role: 'consultant', authUid: 'uid-2' },
        { id: 'u3', name: 'Bia', role: 'consultant', authUid: 'uid-3' },
        { id: 'u4', name: 'Davi', role: 'consultant', authUid: '', dailyVolumeTarget: 10 },
      ],
    }, { teamSize: 7, pendingOwners: 10 });
    expect(r.equipe).toEqual({ text: '7 pessoas, 1 sem acesso', pede: true });
    expect(r.dia).toEqual({ text: '2 consultores sem meta', pede: true });
    expect(r.funil).toEqual({ text: '4 funis sem etapa', pede: true });
    expect(r.base).toEqual({ text: '10 indicações sem dono', pede: true });
    expect(r.academia.pede).toBe(false);
    expect(r.conexoes.pede).toBe(false);
  });

  it('singular onde couber', () => {
    const r = resumo({
      funnels: [{ id: 'f0', name: 'A' }], statuses: [],
      usersList: [{ id: 'u2', name: 'Ana', role: 'consultant', authUid: '' }],
    }, { teamSize: 1, funnelCount: 1, catalogTotal: 1, pendingOwners: 1 });
    expect(r.equipe.text).toBe('1 pessoa sem acesso');
    expect(r.dia.text).toBe('1 consultor sem meta');
    expect(r.funil.text).toBe('1 funil sem etapa');
    expect(r.base.text).toBe('1 indicação sem dono');
    expect(resumo({}, { teamSize: 1, funnelCount: 1, catalogTotal: 1 }).funil.text).toBe('1 funil, 1 item nos catálogos');
  });

  it('time inteiro sem acesso não repete o número', () => {
    const r = resumo({
      usersList: [
        { id: 'u1', name: 'Ana', role: 'consultant', authUid: '', dailyVolumeTarget: 10 },
        { id: 'u2', name: 'Bia', role: 'consultant', authUid: '', dailyVolumeTarget: 10 },
      ],
    }, { teamSize: 2 });
    expect(r.equipe.text).toBe('2 pessoas sem acesso');
  });

  // A pendência de Agendamento e a de catálogo não têm frase própria: o grupo
  // mostra a frase de sempre, mas continua pedindo ação (o número está no item).
  it('pendência de Agendamento ou de catálogo mantém a frase e pede ação', () => {
    const r = resumo({ modalities: [], sources: [] });
    expect(r.dia).toEqual({ text: 'Metas, agenda e rotinas', pede: true });
    expect(r.funil).toEqual({ text: '5 funis, 27 itens nos catálogos', pede: true });
  });

  it('não inventa resumo para a Visão geral', () => {
    expect(resumo({}).overview).toBeUndefined();
  });
});

// O professor (módulo Professor e faltosos) não é consultor: não prospecta e
// não ocupa vaga. Mas entra no app, então pesa no passo de acessos.
describe('buildSetupState — professor', () => {
  it('professor sem meta de prospecção não deixa o passo pendente', () => {
    const s = buildSetupState(complete({
      usersList: [
        ...complete().usersList,
        { id: 'u3', name: 'Rafael', role: 'professor', professorId: 'p1', authUid: 'uid-3' },
      ],
    }));
    expect(s.steps.find(x => x.id === 'prospect').done).toBe(true);
    expect(s.pendings.find(x => x.id === 'prospect')).toBeUndefined();
  });

  it('só gestor e professor na equipe: ainda não há consultor para a prospecção', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u3', name: 'Rafael', role: 'professor', professorId: 'p1', authUid: 'uid-3' },
      ],
    }));
    expect(s.steps.find(x => x.id === 'prospect').done).toBe(false);
    expect(s.pendings.find(x => x.id === 'prospect')).toBeUndefined();
  });

  it('professor sem login ainda pesa no passo de acessos', () => {
    const s = buildSetupState(complete({
      usersList: [
        { id: 'u1', name: 'Marcelo', role: 'admin', authUid: 'uid-1', dailyVolumeTarget: 10 },
        { id: 'u3', name: 'Rafael', role: 'professor', professorId: 'p1', authUid: '' },
      ],
    }));
    expect(s.steps.find(x => x.id === 'access').done).toBe(false);
  });
});
