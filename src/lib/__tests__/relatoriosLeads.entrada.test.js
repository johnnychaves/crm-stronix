// Entrada de leads: o total, a variação, os recortes, a lista e a planilha. No
// mês inteiro, o total e as origens são os do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { entradaReport, ENTRADA_COLUMNS } from '../relatorios/leads/entrada.js';
import { metricsOf, OTHERS_ID } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';

const SOURCES = [{ name: 'Instagram', channel: 'Pago' }];
const ctxOf = () => ({ ...makeCtx(), sources: SOURCES });
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}) => entradaReport(ctx, { period: setembro, cmp: previousPeriod(setembro, NOW), ...extra });

describe('Entrada de leads', () => {
  it('o total, a variação e os recortes do mês', () => {
    const r = rel(ctxOf());
    expect(r.total).toBe(5);
    expect(r.delta).toMatchObject({ up: true, text: '25%' });
    expect(r.bySource.map((x) => [x.name, x.count, x.channel])).toEqual([['Instagram', 4, 'Pago'], ['Indicação', 1, '']]);
    expect(r.byOwner.map((x) => [x.name, x.count])).toEqual([['Ana Ribeiro', 2], ['Diego Santos', 2], ['Fora da equipe ou sem responsável', 1]]);
    expect(r.byFunnel.map((x) => [x.name, x.count])).toEqual([['Vendas', 4], ['Indicações', 1]]);
  });

  it('a lista, do cadastro mais novo para o mais antigo, com a situação de hoje', () => {
    const r = rel(ctxOf());
    expect(r.rows.map((x) => x.id)).toEqual(['s4', 's1', 's2', 's3', 's5']);
    expect(r.rows.find((x) => x.id === 's1').situation).toBe('Cliente');
    expect(r.rows.find((x) => x.id === 's3').situation).toBe('Perdido');
    expect(r.rows.find((x) => x.id === 's5').owner).toBe('Fora da equipe');
  });

  it('filtros da barra: consultores, origem e funil', () => {
    expect(rel(ctxOf(), { userIds: ['diego'] }).total).toBe(2);
    expect(rel(ctxOf(), { origem: 'Indicação' }).total).toBe(1);
    expect(rel(ctxOf(), { funnelId: 'ind' }).total).toBe(1);
  });

  it('o recorte filtra só a lista, e o que não existe é ignorado', () => {
    const r = rel(ctxOf(), { recorte: 'origem:Instagram' });
    expect([r.cut, r.cutLabel, r.rows.length, r.total]).toEqual(['origem:Instagram', 'Origem: Instagram', 4, 5]);
    const outros = rel(ctxOf(), { recorte: `consultor:${OTHERS_ID}` });
    expect(outros.rows.map((x) => x.id)).toEqual(['s5']);
    expect(outros.cutLabel).toBe('Consultor: Fora da equipe ou sem responsável');
    expect(rel(ctxOf(), { recorte: 'origem:Outdoor' })).toMatchObject({ cut: null, cutLabel: null });
  });

  it('a planilha tem o contato, o CPF e as colunas da lista', () => {
    expect(ENTRADA_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Origem', 'Consultor', 'Funil', 'Etapa', 'Cadastro', 'Situação',
    ]);
    expect(rel(ctxOf(), { recorte: 'funil:ind' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
      origem: 'Indicação', consultor: 'Diego Santos', funil: 'Indicações', etapa: 'Novo lead', cadastro: '02/09/2026', situacao: 'Em aberto',
    }]);
  });

  it('no mês inteiro, o total e as origens são os do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    const cmp = previousPeriod(setembro, NOW);
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        const tag = `${userId} ${funnelId}`;
        const set = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId });
        expect(rel(ctx, extra).total, tag).toBe(set.leads);
        expect(new Map(rel(ctx, extra).bySource.map((x) => [x.name, x.count])), tag)
          .toEqual(new Map(set.channels.map((c) => [c.name, c.leads])));
        expect(entradaReport(ctx, { period: agosto, ...extra }).total, tag)
          .toBe(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId }).leads);
        expect(entradaReport(ctx, { period: cmp, ...extra }).total, tag)
          .toBe(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId, cutEnd: cut }).leads);
      }
    }
  });
});
