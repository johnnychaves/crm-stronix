// Conversão: a safra do período lead por lead, os números, a rapidez do
// primeiro contato, o comparado, a lista e a planilha. No mês inteiro, os
// números são os do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { conversaoReport, CONVERSAO_COLUMNS, SPEED_BUCKETS } from '../relatorios/leads/conversao.js';
import { metricsOf } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW, L, D } from './fixtures/crmCtx.js';

// Um lead de agosto depois do corte, para o teste provar que o comparado para
// no mesmo ponto.
const A4 = L('a4', { createdAt: D(8, 20) });
// Um lead de agosto com visita marcada no próprio lead: no comparado cortado,
// esse agendamento em aberto não conta (é o retrato de hoje).
const A5 = L('a5', { createdAt: D(8, 6), appointmentScheduledFor: D(9, 20) });
const ctxOf = () => {
  const c = makeCtx();
  c.months['2026-08'] = { ...c.months['2026-08'], leadsCreated: [...c.months['2026-08'].leadsCreated, A4, A5] };
  c.leadsById = new Map([...c.leadsById, ['a4', A4], ['a5', A5]]);
  return { ...c, sources: [] };
};
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}) => conversaoReport(ctx, { period: setembro, cmp: previousPeriod(setembro, NOW), ...extra });
const speedOf = (r) => Object.fromEntries(r.bySpeed.map((b) => [b.id, b.leads]));

describe('Conversão', () => {
  it('a safra do mês, os números e a conversão', () => {
    const r = rel(ctxOf());
    expect(r.totals).toEqual({ leads: 5, sched: 3, came: 1, enrolled: 1, lost: 1, open: 3, conv: 20 });
    expect(r.conversion.value).toBe(20);
    expect(r.tiles.map((t) => [t.key, t.value])).toEqual([
      [null, 5], ['situacao:agendaram', 3], ['situacao:vieram', 1],
      ['situacao:matricularam', 1], ['situacao:perderam', 1], ['situacao:em-aberto', 3],
    ]);
  });

  it('a rapidez do primeiro contato nas faixas do painel, com a conversão de cada uma', () => {
    const r = rel(ctxOf());
    expect(SPEED_BUCKETS.map((b) => b.label)).toEqual(['Até 1 hora', 'De 1 a 24 horas', 'Mais de 24 horas', 'Sem contato']);
    expect(speedOf(r)).toEqual({ 'ate-1h': 1, 'ate-24h': 1, 'mais-24h': 2, 'sem-contato': 1 });
    expect(r.bySpeed.find((b) => b.id === 'ate-1h')).toMatchObject({ enrolled: 1, conv: 100 });
  });

  it('o comparado vai até o mesmo ponto quando o mês está em andamento', () => {
    const ctx = ctxOf();
    const r = rel(ctx);
    const m = metricsOf(ctx, { monthKey: '2026-08', cutEnd: comparisonCut('2026-09', '2026-08', NOW) });
    expect(r.before).toEqual(m.cohort);
    expect(r.conversion.delta.text).toMatch(/p\.p\.$/);
  });

  it('o recorte filtra a lista: quem matriculou, quem agendou, quem ficou sem contato', () => {
    const m = rel(ctxOf(), { recorte: 'situacao:matricularam' });
    expect([m.cut, m.cutLabel, m.rows.map((x) => x.id)]).toEqual(['situacao:matricularam', 'Matricularam', ['s1']]);
    expect(rel(ctxOf(), { recorte: 'situacao:agendaram' }).rows.map((x) => x.id).sort()).toEqual(['s1', 's2', 's4']);
    expect(rel(ctxOf(), { recorte: 'faixa:sem-contato' }).rows.map((x) => x.id)).toEqual(['s4']);
    expect(rel(ctxOf(), { recorte: 'faixa:xyz' }).cut).toBeNull();
  });

  it('a planilha diz o primeiro contato, se agendou e veio, e o desfecho com a data', () => {
    expect(CONVERSAO_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF', 'Origem', 'Consultor', 'Cadastro',
      'Primeiro contato', 'Tempo até o primeiro contato', 'Agendou', 'Veio', 'Desfecho', 'Data do desfecho',
    ]);
    expect(rel(ctxOf(), { recorte: 'situacao:matricularam' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '', origem: 'Instagram', consultor: 'Ana Ribeiro',
      cadastro: '02/09/2026', primeiroContato: '02/09/2026', tempoPrimeiroContato: '30 min', agendou: 'Sim', veio: 'Sim',
      desfecho: 'Matriculou', dataDesfecho: '05/09/2026',
    }]);
  });

  it('no mês inteiro, os números são os do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        for (const [period, key] of [[setembro, '2026-09'], [agosto, '2026-08']]) {
          const tag = `${userId} ${funnelId} ${key}`;
          const r = conversaoReport(ctx, { period, ...extra });
          const m = metricsOf(ctx, { monthKey: key, userId, funnelId });
          expect(r.totals, tag).toEqual(m.cohort);
          expect(speedOf(r), tag).toEqual({
            'ate-1h': m.firstContact.h1, 'ate-24h': m.firstContact.h24, 'mais-24h': m.firstContact.over, 'sem-contato': m.firstContact.none,
          });
          expect(new Map(r.bySource.map((x) => [x.name, [x.leads, x.enrolled]])), tag)
            .toEqual(new Map(m.channels.map((c) => [c.name, [c.leads, c.enrolled]])));
        }
      }
    }
  });
});
