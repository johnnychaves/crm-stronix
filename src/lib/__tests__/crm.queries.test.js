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

  it('mês corrente contra o mesmo mês do ano anterior: o comparado entra sozinho, porque é cortado', () => {
    expect(crmMonthKeys({ monthKey: '2026-09', compareOn: true, compareKey: '2025-09', currentKey: '2026-09' }))
      .toEqual(['2025-09', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
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
});

describe('busca incremental do mês corrente', () => {
  it('instante mais novo do campo, em Timestamp ou Date', () => {
    expect(newestTimeOf([{ convertedAt: TS(D(9, 3)) }, { convertedAt: D(9, 5) }, {}], 'convertedAt')).toBe(D(9, 5).getTime());
    expect(newestTimeOf([], 'lostAt')).toBeNull();
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
});
