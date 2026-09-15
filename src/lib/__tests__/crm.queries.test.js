import { describe, it, expect } from 'vitest';
import {
  convertedInMonthSpec, lostInMonthSpec, aulasInMonthSpec, crmMonthKeys, newestTimeOf, currentFieldWindow,
  failedCrmEntry, shouldRememberCrmEntry, mergeCrmCurrent, referencedLeadIds, mergeLeadsById
} from '../crm/queries.js';
import { NEW_LEADS_SLACK_MS } from '../operacional/queries.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const TS = (date) => ({ toDate: () => date });

describe('consultas do CRM', () => {
  it('são de campo único: range e orderBy no mesmo campo, sem igualdade', () => {
    [convertedInMonthSpec(0, 10), lostInMonthSpec(0, 10), aulasInMonthSpec(0, 10)].forEach((s) => {
      expect(new Set(s.wheres.map((w) => w.field))).toEqual(new Set([s.orderBy.field]));
      expect(s.wheres.map((w) => w.op)).toEqual(['>=', '<']);
    });
    expect([convertedInMonthSpec, lostInMonthSpec, aulasInMonthSpec].map((f) => f(0, 10).orderBy.field))
      .toEqual(['convertedAt', 'lostAt', 'scheduledFor']);
  });
});

describe('meses a carregar', () => {
  it('mês corrente contra o anterior: os seis meses da tendência', () => {
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: true, compareKey: '2026-08', currentKey: '2026-09' }))
      .toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('mês corrente contra o mesmo mês do ano anterior: entram o comparado, que é cortado, e o mês seguinte a ele', () => {
    // O agendamento marcado antes do corte pode ser para uma data do mês seguinte.
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: true, compareKey: '2025-09', currentKey: '2026-09' }))
      .toEqual(['2025-09', '2025-10', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('mês fechado: do mais antigo da tendência até o corrente, e do comparado até o corrente', () => {
    expect(crmMonthKeys({ monthKey: '2026-07', compareOn: true, compareKey: '2026-06', currentKey: '2026-09' }))
      .toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(crmMonthKeys({ monthKey: '2026-07', compareOn: true, compareKey: '2025-07', currentKey: '2026-09' })[0]).toBe('2025-07');
  });

  it('sem comparar, o comparado não entra', () => {
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: false, compareKey: '2025-09', currentKey: '2026-09' }))
      .not.toContain('2025-09');
  });

  it('atravessa o ano, e o comparado dentro dos seis meses não acrescenta nada', () => {
    expect(crmMonthKeys({ monthKey: '2027-01', compareOn: true, compareKey: '2026-12', currentKey: '2027-01' }))
      .toEqual(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    expect(crmMonthKeys({ monthKey: '2026-12', compareOn: true, compareKey: '2026-10', currentKey: '2027-01' }))
      .toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
  });

  it('chave malformada não prende o laço: cada trecho tem no máximo 36 meses', () => {
    const keys = crmMonthKeys({ monthKey: '2026-09', compareOn: false, compareKey: null, currentKey: 'xx' });
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.length).toBeLessThanOrEqual(6 + 36);
  });
});

describe('busca incremental do mês corrente', () => {
  it('instante mais novo do campo, em Timestamp ou Date', () => {
    expect(newestTimeOf([{ convertedAt: TS(D(9, 3)) }, { convertedAt: D(9, 5) }, {}], 'convertedAt')).toBe(D(9, 5).getTime());
    expect(newestTimeOf([], 'lostAt')).toBeNull();
    expect(newestTimeOf([{ lostAt: { seconds: 100 } }, { lostAt: { seconds: 50 } }], 'lostAt')).toBe(100000);
  });

  it('sem âncora, o mês inteiro; com âncora, desde ela menos a folga, limitada ao instante da busca', () => {
    const start = D(9, 1, 0).getTime();
    const end = D(10, 1, 0).getTime();
    expect(currentFieldWindow('2026-09', null, null)).toEqual({ from: start, to: end });
    const anchor = D(9, 10).getTime();
    expect(currentFieldWindow('2026-09', anchor, D(9, 12).getTime()).from).toBe(anchor - NEW_LEADS_SLACK_MS);
    expect(currentFieldWindow('2026-09', D(9, 20).getTime(), anchor).from).toBe(anchor - NEW_LEADS_SLACK_MS);
    expect(currentFieldWindow('2026-09', start, null).from).toBe(start);
  });
});

describe('entrada do mês corrente', () => {
  const entry = {
    closed: false, converted: [{ id: 'a', v: 1 }], lost: [{ id: 'x' }], aulas: [{ id: 'r1', status: 'agendada' }],
    fetchedAt: 100, newestConvertedAt: 50, newestLostAt: 40
  };

  it('matrículas e perdas unidas por id, agendamentos trocados pelos da busca mais nova', () => {
    const fresh = {
      converted: [{ id: 'a', v: 2, convertedAt: new Date(200) }, { id: 'b', convertedAt: new Date(300) }],
      lost: [],
      aulas: [{ id: 'r1', status: 'attended' }],
      fetchedAt: 400
    };
    const next = mergeCrmCurrent(entry, fresh);
    expect(next.converted).toEqual([{ id: 'a', v: 2, convertedAt: new Date(200) }, { id: 'b', convertedAt: new Date(300) }]);
    expect(next.lost).toEqual([{ id: 'x' }]);
    expect(next.aulas).toEqual([{ id: 'r1', status: 'attended' }]);
    expect(next).toMatchObject({ fetchedAt: 400, newestConvertedAt: 300, newestLostAt: 40 });
  });

  it('busca mais antiga que chega depois só acrescenta; mês fechado e entrada que falhou ficam como estão', () => {
    const old = mergeCrmCurrent(entry, { converted: [{ id: 'a', v: 0 }, { id: 'c' }], lost: [], aulas: [], fetchedAt: 50 });
    expect(old.converted).toEqual([{ id: 'a', v: 1 }, { id: 'c' }]);
    expect(old.aulas).toEqual(entry.aulas);
    expect(old.fetchedAt).toBe(100);
    const closed = { ...entry, closed: true };
    expect(mergeCrmCurrent(closed, { converted: [], lost: [], aulas: [], fetchedAt: 500 })).toBe(closed);
    const failed = failedCrmEntry(false);
    expect(mergeCrmCurrent(failed, { converted: [], lost: [], aulas: [], fetchedAt: 500 })).toBe(failed);
  });

  it('entrada que falhou não vai para a memória da sessão; o mês só anda de aberto para fechado', () => {
    expect(shouldRememberCrmEntry(null, failedCrmEntry(true))).toBe(false);
    expect(shouldRememberCrmEntry(null, { closed: true, converted: [], lost: [], aulas: [] })).toBe(true);
    expect(shouldRememberCrmEntry({ closed: true }, { closed: false, converted: [], lost: [], aulas: [] })).toBe(false);
  });

  it('entrada sem fetchedAt: a busca nova ganha', () => {
    const noStamp = { closed: false, converted: [{ id: 'a', v: 1 }], lost: [], aulas: [{ id: 'r1' }] };
    const next = mergeCrmCurrent(noStamp, {
      converted: [{ id: 'a', v: 2, convertedAt: new Date(200) }], lost: [], aulas: [{ id: 'r2' }], fetchedAt: 400
    });
    expect(next.converted).toEqual([{ id: 'a', v: 2, convertedAt: new Date(200) }]);
    expect(next).toMatchObject({ aulas: [{ id: 'r2' }], fetchedAt: 400, newestConvertedAt: 200 });
  });
});

describe('leads a buscar por id e a versão mais nova de cada lead', () => {
  const months = {
    '2026-08': {
      leadsCreated: [{ id: 'a', v: 'criado' }], converted: [{ id: 'b', v: 'ago' }], lost: [],
      aulas: [{ id: 'r1', leadId: 'z' }], interactions: []
    },
    '2026-09': {
      leadsCreated: [], converted: [{ id: 'a', v: 'set' }], lost: [],
      aulas: [{ id: 'r2', leadId: 'a' }],
      interactions: [
        { leadId: 'y', type: 'status_change', toStatus: 'Contato feito' },
        { leadId: 'w', type: 'status_change', text: 'Movido para a etapa [X] via Kanban.' },
        { leadId: 'v', type: 'note' }
      ]
    }
  };

  it('só os citados por agendamento ou por troca de etapa gravada que ninguém conhece', () => {
    expect(referencedLeadIds(months, new Set(['a', 'b']))).toEqual(['y', 'z']);
  });

  it('meses fechados em ordem, depois os buscados por id, o mês corrente e os ao vivo', () => {
    const fetched = new Map([['b', { id: 'b', v: 'por id' }], ['a', { id: 'a', v: 'por id' }], ['q', null]]);
    const map = mergeLeadsById({ months, currentKey: '2026-09', fetched, liveLeads: [{ id: 'c', v: 'vivo' }] });
    expect(map.get('a').v).toBe('set');
    expect(map.get('b').v).toBe('por id');
    expect(map.get('c').v).toBe('vivo');
    expect(map.has('q')).toBe(false);
  });

  it('registro sem leadId e registro cancelado não pedem a busca do dono', () => {
    const aulas = [{ id: 'r1' }, { id: 'r2', leadId: 'k', status: 'cancelled' }, { id: 'r3', leadId: 'j', status: 'agendada' }];
    expect(referencedLeadIds({ '2026-09': { aulas, interactions: [] } }, new Set())).toEqual(['j']);
  });

  it('no mesmo mês, a cópia de matrícula ganha da de perda; o lead ao vivo ganha do mês corrente', () => {
    const map = mergeLeadsById({
      months: {
        '2026-08': { leadsCreated: [], lost: [{ id: 'x', v: 'perdido' }], converted: [{ id: 'x', v: 'matriculado' }] },
        '2026-09': { leadsCreated: [{ id: 'y', v: 'mês' }], lost: [], converted: [] }
      },
      currentKey: '2026-09',
      fetched: new Map(),
      liveLeads: [{ id: 'y', v: 'vivo' }]
    });
    expect(map.get('x').v).toBe('matriculado');
    expect(map.get('y').v).toBe('vivo');
  });
});
