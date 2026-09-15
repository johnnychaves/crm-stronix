import { describe, it, expect } from 'vitest';
import { isStageMove, movesByLead, stagePassageOf, lossStagesOf, pipelineNowOf } from '../crm/stages.js';

const T = (d, h = 10) => new Date(2026, 8, d, h);
const MONTH = { start: T(1, 0), end: T(15, 12), asOf: T(15, 12) };
const STAGES = ['Novo lead', 'Contato feito', 'Agendado', 'Negociação'];
const M = (id, leadId, from, to, day, over = {}) => ({
  id, leadId, type: 'status_change', fromStatus: from, toStatus: to, funnelId: 'ven', createdAt: T(day), ...over
});
const LEADS = new Map([
  ['a', { id: 'a', consultantId: 'ana', createdAt: T(1, 9) }],
  ['b', { id: 'b', consultantId: 'diego', createdAt: T(1, 9) }],
  ['c', { id: 'c', consultantId: 'ana', createdAt: T(1, 9), convertedAt: T(12) }]
]);
const leadOf = (id) => LEADS.get(id) || { id, unknown: true };
const all = () => true;
const MOVES = movesByLead([
  M('a1', 'a', 'Novo lead', 'Contato feito', 3),
  M('a2', 'a', 'Contato feito', 'Agendado', 5),
  M('a3', 'a', 'Agendado', 'Perda', 8),
  M('b1', 'b', 'Novo lead', 'Contato feito', 4),
  M('b2', 'b', 'Contato feito', 'Perda', 6),
  M('c1', 'c', 'Novo lead', 'Contato feito', 2),
  M('d1', 'd', 'Novo lead', 'Contato feito', 6, { funnelId: 'ind' }),
  M('e1', 'e', 'Novo lead', 'Visita', 7),
  M('f1', 'f', 'Novo lead', 'Negociação', 9, { funnelId: null })
]);
const passage = (over = {}) => stagePassageOf({
  moves: MOVES, funnelId: 'ven', defaultFunnelId: 'ven', stages: STAGES, ...MONTH, ownerOk: all, leadOf, ...over
});
const table = (r) => r.rows.map((x) => [x.name, x.entered, x.advanced, x.lost, x.medianMin]);

describe('trocas de etapa gravadas', () => {
  it('só status_change com toStatus, em ordem por lead', () => {
    const map = movesByLead([
      M('2', 'a', 'Contato feito', 'Agendado', 5),
      M('1', 'a', 'Novo lead', 'Contato feito', 3),
      { id: '0', leadId: 'a', type: 'status_change', text: 'Movido para a etapa [X] via Kanban.', createdAt: T(2) },
      { id: '9', leadId: 'a', type: 'note', toStatus: 'Agendado', createdAt: T(2) }
    ]);
    expect(map.get('a').map((m) => m.id)).toEqual(['1', '2']);
    expect(isStageMove({ type: 'status_change', toStatus: 'Perda', createdAt: T(1) })).toBe(true);
  });
});

describe('passagem entre etapas', () => {
  it('entraram, avançaram, perderam e a mediana na etapa, com a etapa renomeada no fim', () => {
    const r = passage();
    // Novo lead: saídas de a (49 h), b (73 h) e c (25 h) desde o cadastro.
    expect(table(r)).toEqual([
      ['Novo lead', 0, 0, 0, 2940],
      ['Contato feito', 3, 2, 1, 2880],
      ['Agendado', 1, 0, 1, 4320],
      ['Negociação', 1, 0, 0, null],
      ['Visita', 1, 0, 0, null]
    ]);
    expect(r.worst.name).toBe('Agendado');
  });

  it('com pessoa filtrada as contagens são dela e a mediana continua da academia', () => {
    expect(table(passage({ ownerOk: (l) => l.consultantId === 'ana' }))).toEqual([
      ['Novo lead', 0, 0, 0, 2940],
      ['Contato feito', 2, 2, 0, 2880],
      ['Agendado', 1, 0, 1, 4320],
      ['Negociação', 0, 0, 0, null],
      ['Visita', 0, 0, 0, null]
    ]);
  });

  it('matrícula depois da entrada conta como avanço; avanço depois do corte não conta', () => {
    const moves = movesByLead([M('x1', 'x', 'Novo lead', 'Negociação', 3), M('x2', 'x', 'Negociação', 'Venda', 4)]);
    const row = (asOf) => stagePassageOf({
      moves, funnelId: 'ven', defaultFunnelId: 'ven', stages: STAGES, start: T(1, 0), end: asOf, asOf, ownerOk: all, leadOf
    }).rows.find((x) => x.name === 'Negociação');
    expect(row(T(15, 12))).toMatchObject({ entered: 1, advanced: 1 });
    expect(row(T(3, 12))).toMatchObject({ entered: 1, advanced: 0 });
  });

  it('o avanço por matrícula olha a primeira matrícula: o retorno de ex-cliente não conta', () => {
    const people = new Map([
      ['volta', { id: 'volta', createdAt: T(1, 9), convertedAt: T(12), clienteSince: new Date(2026, 2, 5) }],
      ['nova', { id: 'nova', createdAt: T(1, 9), clienteSince: T(12) }]
    ]);
    const rowOf = (id) => stagePassageOf({
      moves: movesByLead([M(`${id}1`, id, 'Novo lead', 'Negociação', 3)]),
      funnelId: 'ven', defaultFunnelId: 'ven', stages: STAGES, ...MONTH, ownerOk: all, leadOf: (x) => people.get(x)
    }).rows.find((x) => x.name === 'Negociação');
    expect(rowOf('volta')).toMatchObject({ entered: 1, advanced: 0 });
    expect(rowOf('nova')).toMatchObject({ entered: 1, advanced: 1 });
  });
});

describe('passagem: entrada pelo cadastro e trocas que não contam', () => {
  const SINCE = T(2, 0);
  const P = (id, over = {}) => ({ id, consultantId: 'ana', funnelId: 'ven', status: 'Novo lead', createdAt: T(3, 9), ...over });
  const PEOPLE = new Map([
    P('n1'),
    P('n2', { status: 'Contato feito' }),
    P('n3', { status: 'Perda' }),
    P('n4', { createdAt: T(1, 9), status: 'Contato feito' }),
    P('n6', { funnelId: 'ind', status: 'Aguardando ação' }),
    P('n7', { importBatchId: 'lote', source: 'Importação' }),
    P('n9', { createdAtMissing: true })
  ].map((l) => [l.id, l]));
  const byId = (id) => PEOPLE.get(id) || { id, unknown: true };

  it('o lead novo entra na etapa em que nasceu, avança ou se perde pela troca seguinte, e a mediana da primeira etapa vem do cadastro', () => {
    const r = passage({
      moves: movesByLead([
        M('n2a', 'n2', 'Novo lead', 'Contato feito', 4),
        M('n3a', 'n3', 'Novo lead', 'Perda', 5),
        M('n4a', 'n4', 'Novo lead', 'Contato feito', 3)
      ]),
      leadOf: byId, newLeads: [...PEOPLE.values()], trackingSince: SINCE
    });
    // Novo lead: n1 segue, n2 avançou, n3 se perdeu direto da primeira etapa.
    // n4 nasceu antes do registro, n6 em outro funil, n7 veio da importação e
    // n9 não tem data de cadastro. Mediana: n2 (25 h) e n3 (49 h) desde o cadastro.
    expect(table(r)).toEqual([
      ['Novo lead', 3, 1, 1, 2220],
      ['Contato feito', 2, 0, 0, null],
      ['Agendado', 0, 0, 0, null],
      ['Negociação', 0, 0, 0, null]
    ]);
    expect(r.worst.name).toBe('Novo lead');
  });

  it('quem foi cadastrado antes do início do registro não entra pelo cadastro', () => {
    const one = [P('a', { createdAt: T(3, 9) })];
    const row = (since) => passage({ moves: new Map(), leadOf: byId, newLeads: one, trackingSince: since }).rows[0];
    expect(row(T(3, 10))).toMatchObject({ name: 'Novo lead', entered: 0 });
    expect(row(T(3, 9))).toMatchObject({ name: 'Novo lead', entered: 1 });
  });

  it('troca para etapa menor segue na etapa, mesmo com matrícula depois', () => {
    const x = { id: 'x', consultantId: 'ana', createdAt: T(1, 9), convertedAt: T(10) };
    const r = passage({
      moves: movesByLead([M('x1', 'x', 'Novo lead', 'Agendado', 3), M('x2', 'x', 'Agendado', 'Contato feito', 5)]),
      leadOf: (id) => (id === 'x' ? x : { id, unknown: true })
    });
    expect(r.rows.find((row) => row.name === 'Agendado')).toMatchObject({ entered: 1, advanced: 0, lost: 0, medianMin: 2880 });
    // A matrícula sem troca seguinte é avanço de quem estava na etapa de antes dela.
    expect(r.rows.find((row) => row.name === 'Contato feito')).toMatchObject({ entered: 1, advanced: 1 });
  });

  it('troca entre funis com fromFunnelId: é saída do funil de origem e entrada no de destino', () => {
    const moves = movesByLead([
      M('y1', 'y', 'Novo lead', 'Contato feito', 3),
      M('y2', 'y', 'Contato feito', 'Aguardando ação', 5, { funnelId: 'ind', fromFunnelId: 'ven' })
    ]);
    const ven = passage({ moves });
    expect(ven.rows.find((row) => row.name === 'Contato feito')).toMatchObject({ entered: 1, advanced: 0, lost: 0, medianMin: 2880 });
    expect(ven.rows.map((row) => row.name)).not.toContain('Aguardando ação');
    expect(table(passage({ moves, funnelId: 'ind', stages: ['Aguardando ação'] }))).toEqual([['Aguardando ação', 1, 0, 0, null]]);
  });

  it('troca que não muda nada, nem de etapa nem de funil (com o padrão no lugar do vazio), é ignorada em tudo', () => {
    const z = { id: 'z', consultantId: 'ana', funnelId: 'ven', status: 'Contato feito', createdAt: T(2, 9) };
    const r = passage({
      moves: movesByLead([
        M('z0', 'z', 'Novo lead', 'Novo lead', 3, { fromFunnelId: null }),
        M('z1', 'z', 'Novo lead', 'Contato feito', 5)
      ]),
      leadOf: (id) => (id === 'z' ? z : { id, unknown: true }), newLeads: [z], trackingSince: SINCE
    });
    // Nasceu em Novo lead e saiu dele 73 h depois do cadastro.
    expect(table(r).slice(0, 2)).toEqual([
      ['Novo lead', 1, 1, 0, 4380],
      ['Contato feito', 1, 0, 0, null]
    ]);
  });

  it('a perda é das entradas do mês: quem entrou na etapa antes do mês e se perdeu nele não conta', () => {
    const r = passage({
      moves: movesByLead([
        { ...M('w1', 'w', 'Novo lead', 'Contato feito', 1), createdAt: new Date(2026, 7, 20, 10) },
        M('w2', 'w', 'Contato feito', 'Perda', 4)
      ])
    });
    // A saída do mês entra na mediana: 15 dias desde a entrada, em agosto.
    expect(r.rows.find((row) => row.name === 'Contato feito')).toMatchObject({ entered: 0, lost: 0, medianMin: 21600 });
    expect(r.worst).toBeNull();
  });
});

describe('etapa da perda', () => {
  it('o fromStatus das trocas para Perda do mês, no recorte', () => {
    expect(lossStagesOf({ moves: MOVES, start: MONTH.start, end: MONTH.end, inScope: all, leadOf }))
      .toEqual([{ name: 'Agendado', count: 1 }, { name: 'Contato feito', count: 1 }]);
    expect(lossStagesOf({ moves: MOVES, start: MONTH.start, end: MONTH.end, inScope: (l) => l.consultantId === 'diego', leadOf }))
      .toEqual([{ name: 'Contato feito', count: 1 }]);
  });
});

describe('carteira agora', () => {
  const FUNNELS = [{ id: 'ven', name: 'Vendas', order: 0 }, { id: 'ind', name: 'Indicações', order: 1 }];
  const live = [
    { id: '1', status: 'Novo lead', funnelId: 'ven', consultantId: 'ana', nextFollowUp: T(20) },
    { id: '2', status: 'Contato feito', funnelId: 'ven', consultantId: 'ana', nextFollowUp: null },
    { id: '3', status: 'Contato feito', funnelId: null, consultantId: 'diego', nextFollowUp: null },
    { id: '4', status: 'Aguardando ação', funnelId: 'ind', consultantId: 'ana', nextFollowUp: T(21) },
    { id: '5', status: 'Venda', isConverted: true, funnelId: 'ven', consultantId: 'ana' },
    { id: '6', status: 'Perda', funnelId: 'ven', consultantId: 'ana' },
    { id: '7', status: 'Legado', funnelId: 'ven', consultantId: 'ana', nextFollowUp: T(22) },
    { id: '8', status: 'Novo lead', funnelId: 'apagado', consultantId: 'ana', nextFollowUp: T(20) },
    { id: '1', status: 'Novo lead', funnelId: 'ven', consultantId: 'ana', nextFollowUp: T(20) }
  ];

  it('sem funil: por funil de lead, com quem ficou sem funil à parte, e os sem próximo contato', () => {
    const r = pipelineNowOf(live, { funnelId: null, funnels: FUNNELS, defaultFunnelId: 'ven', stages: [], ownerOk: all, funnelOk: all });
    expect(r).toEqual({
      total: 6,
      noNext: 2,
      rows: [
        { id: 'ven', name: 'Vendas', count: 4 },
        { id: 'ind', name: 'Indicações', count: 1 },
        { id: null, name: 'Sem funil', count: 1 }
      ]
    });
  });

  it('com funil: por etapa na ordem do funil, etapa fora da lista no fim', () => {
    const inVen = (l) => !l.funnelId || l.funnelId === 'ven';
    const r = pipelineNowOf(live, {
      funnelId: 'ven', funnels: FUNNELS, defaultFunnelId: 'ven', stages: ['Novo lead', 'Contato feito', 'Negociação'], ownerOk: all, funnelOk: inVen
    });
    expect(r.rows).toEqual([
      { name: 'Novo lead', count: 1 },
      { name: 'Contato feito', count: 2 },
      { name: 'Negociação', count: 0 },
      { name: 'Legado', count: 1 }
    ]);
    expect(r.total).toBe(4);
    expect(r.noNext).toBe(2);
  });
});
