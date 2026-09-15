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
