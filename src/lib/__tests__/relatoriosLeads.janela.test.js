// Carga dos Relatórios de Leads: os meses que a tela pede, os baldes juntados
// sem repetir e os índices, os mesmos do painel CRM.
import { describe, it, expect } from 'vitest';
import { reportMonthKeys, bucketOf, reportIndex, loadState } from '../relatorios/leads/janela.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, D } from './fixtures/crmCtx.js';

// 09/10/2026, sexta. A semana dele começa em 05/10, e a passada em 28/09.
const HOJE = new Date(2026, 9, 9, 15);

describe('meses que a tela pede', () => {
  it('do início do comparado até o mês atual', () => {
    const outubro = periodFromParams({ monthKey: '2026-10' }, HOJE);
    expect(reportMonthKeys(outubro, previousPeriod(outubro, HOJE), '2026-10')).toEqual(['2026-09', '2026-10']);
    const julho = periodFromParams({ monthKey: '2026-07' }, HOJE);
    expect(reportMonthKeys(julho, previousPeriod(julho, HOJE), '2026-10'))
      .toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    const semana = periodFromParams({ periodo: 'semana' }, HOJE);
    expect(reportMonthKeys(semana, previousPeriod(semana, HOJE), '2026-10')).toEqual(['2026-09', '2026-10']);
  });

  it('sem período, só o mês atual', () => {
    expect(reportMonthKeys(null, null, '2026-10')).toEqual(['2026-10']);
  });
});

describe('baldes e índices', () => {
  it('junta os meses sem repetir, com a cópia do mês mais novo', () => {
    const velho = { id: 'r', status: 'agendada' };
    const novo = { id: 'r', status: 'attended' };
    const months = { '2026-08': { aulas: [velho] }, '2026-09': { aulas: [novo, { id: 's' }] } };
    expect(bucketOf(months, 'aulas')).toEqual([novo, { id: 's' }]);
    expect(bucketOf(null, 'aulas')).toEqual([]);
  });

  it('os índices do painel, de todos os meses carregados', () => {
    const idx = reportIndex(makeCtx().months);
    expect(idx.records.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(idx.recordsByLead.get('s1').map((r) => r.id)).toEqual(['r1']);
    expect(idx.contactTimes.get('s1')).toEqual([D(9, 2, 10, 30).getTime(), D(9, 3).getTime(), D(9, 5).getTime()]);
    // As interações entram como no painel (cacheOf): a que veio sem id ainda conta.
    const sem = { '2026-09': { interactions: [{ leadId: 'z', type: 'note', text: 'oi', createdAt: D(9, 3) }] } };
    expect(reportIndex(sem).contactTimes.get('z')).toEqual([D(9, 3).getTime()]);
  });

  it('o índice é o mesmo enquanto os meses são o mesmo objeto, e outro quando os meses são outro objeto', () => {
    const { months } = makeCtx();
    const idx = reportIndex(months);
    expect(reportIndex(months)).toBe(idx);
    // A useCrmSources entrega outro objeto quando chega interação, lead ou registro: o índice é refeito.
    const outro = reportIndex({ ...months });
    expect(outro).not.toBe(idx);
    expect(outro).toEqual(idx);
  });

  it('sem meses, o índice é vazio', () => {
    for (const vazio of [null, undefined, {}]) {
      const idx = reportIndex(vazio);
      expect([idx.records, idx.contactTimes.size, idx.recordsByLead.size, idx.visitOutcomes.size]).toEqual([[], 0, 0, 0]);
    }
  });

  it('a carga fica pronta com todos os meses, e a falha de um aparece', () => {
    expect(loadState({ '2026-09': {} }, ['2026-09', '2026-10'])).toEqual({ ready: false, failed: false });
    expect(loadState({ '2026-09': {}, '2026-10': { failed: true } }, ['2026-09', '2026-10'])).toEqual({ ready: true, failed: true });
  });
});
