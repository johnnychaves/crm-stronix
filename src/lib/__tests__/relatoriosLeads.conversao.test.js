// Conversão: a safra do período lead por lead, os números, a rapidez do
// primeiro contato, o comparado, a lista e a planilha. No mês inteiro, os
// números são os do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { conversaoReport, CONVERSAO_COLUMNS, SPEED_BUCKETS } from '../relatorios/leads/conversao.js';
import { metricsOf, crmDelta } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW, L, D, N, A } from './fixtures/crmCtx.js';

// Um lead de agosto depois do corte, para o teste provar que o comparado para
// no mesmo ponto.
const A4 = L('a4', { createdAt: D(8, 20) });
// Um lead de agosto com visita marcada no próprio lead: no comparado cortado,
// esse agendamento em aberto não conta (é o retrato de hoje).
const A5 = L('a5', { createdAt: D(8, 6), appointmentScheduledFor: D(9, 20) });
// Um lead de agosto perdido antes do corte e outro que veio antes do corte: com
// eles, a variação de cada um dos cinco números do topo sai diferente das
// outras, e a chave trocada entre dois números aparece no teste.
const A6 = L('a6', { createdAt: D(8, 4), status: 'Perda', lostAt: D(8, 8), lossReason: 'Preço' });
const A7 = L('a7', { createdAt: D(8, 7) });
const R5 = A('r5', 'a7', 'attended', D(8, 9), D(8, 8));
const ctxOf = () => {
  const c = makeCtx();
  c.months['2026-08'] = {
    ...c.months['2026-08'],
    leadsCreated: [...c.months['2026-08'].leadsCreated, A4, A5, A6, A7],
    aulas: [...c.months['2026-08'].aulas, R5],
  };
  c.leadsById = new Map([...c.leadsById, ['a4', A4], ['a5', A5], ['a6', A6], ['a7', A7]]);
  return { ...c, sources: [] };
};
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}) => conversaoReport(ctx, { period: setembro, cmp: previousPeriod(setembro, NOW), ...extra });
const speedOf = (r) => Object.fromEntries(r.bySpeed.map((b) => [b.id, b.leads]));
// Para a segunda parte: um mês sem nada, um lead (com as interações dele) posto
// num mês, e a faixa de primeiro contato da linha de um lead.
const emptyMonth = () => ({ leadsCreated: [], converted: [], lost: [], aulas: [], interactions: [] });
const withLead = (ctx, key, lead, interactions = []) => {
  ctx.months[key].leadsCreated.push(lead);
  ctx.leadsById.set(lead.id, lead);
  ctx.months[key].interactions.push(...interactions);
};
const faixaOf = (r, id) => r.rows.find((x) => x.id === id).cuts.find((c) => c.startsWith('faixa:'));

describe('Conversão', () => {
  it('a safra do mês, os números com a variação e a conversão', () => {
    const r = rel(ctxOf());
    expect(r.totals).toEqual({ leads: 5, sched: 3, came: 1, enrolled: 1, lost: 1, open: 3, conv: 20 });
    expect(r.conversion.value).toBe(20);
    expect(r.tiles.map((t) => [t.key, t.value])).toEqual([
      [null, 5], ['situacao:agendaram', 3], ['situacao:vieram', 1],
      ['situacao:matricularam', 1], ['situacao:perderam', 1], ['situacao:em-aberto', 3],
    ]);
    // Cada número do topo mostra a variação do próprio número. "Em aberto" não
    // tem, e "Perderam" é o único em que cair é bom.
    const tile = Object.fromEntries(r.tiles.map((t) => [t.name, t]));
    const keyOf = { 'Leads da safra': 'leads', Agendaram: 'sched', Vieram: 'came', Matricularam: 'enrolled', Perderam: 'lost' };
    Object.entries(keyOf).forEach(([name, k]) => expect(tile[name].delta, name).toEqual(crmDelta(r.totals[k], r.before[k])));
    expect(tile['Em aberto'].delta).toBeUndefined();
    expect(r.tiles.filter((t) => t.lowerBetter).map((t) => t.name)).toEqual(['Perderam']);
  });

  it('a rapidez do primeiro contato nas faixas do painel, com a conversão de cada uma', () => {
    const r = rel(ctxOf());
    expect(SPEED_BUCKETS.map((b) => b.label)).toEqual(['Até 1 hora', 'Até 24 horas', 'Mais de 24 horas', 'Sem contato']);
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

  it('no mês inteiro, os números são os do painel CRM, para cada pessoa e funil, e as origens empatadas seguem a ordem dele', () => {
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

    // Duas origens com os mesmos leads e matrículas diferentes: a ordem é a do
    // painel (mais matrículas primeiro), e não a do nome.
    const tie = { ...makeCtx(), sources: [] };
    [
      L('f1', { source: 'Alfa' }), L('f2', { source: 'Alfa' }),
      L('g1', { source: 'Beta', status: 'Venda', isConverted: true, convertedAt: D(9, 5) }), L('g2', { source: 'Beta' }),
    ].forEach((lead) => withLead(tie, '2026-09', lead));
    const order = metricsOf(tie, { monthKey: '2026-09' }).channels.map((c) => c.name);
    expect(order).toEqual(['Instagram', 'Beta', 'Alfa', 'Indicação']);
    expect(conversaoReport(tie, { period: setembro }).bySource.map((x) => x.name)).toEqual(order);
  });
});

// Regras que o painel aplica sem mostrar na tela: o limite do primeiro contato
// de cada lead, o comparado de um mês fechado, as divisas das faixas e o recorte
// por consultor com a planilha de quem perdeu e de quem segue em aberto.
describe('Conversão: regras que o painel não mostra na tela', () => {
  it('o primeiro contato olha até o fim do mês seguinte ao do cadastro de cada lead', () => {
    const ctx = { ...makeCtx(), now: new Date(2026, 9, 20, 12, 0), sources: [] };
    ctx.months['2026-10'] = emptyMonth();
    // cadastrado em 20/08: o limite dele é 01/10; o contato de 02/10 não conta
    withLead(ctx, '2026-08', L('x-ago', { createdAt: D(8, 20) }), [N('c1', 'x-ago', D(10, 2))]);
    // cadastrado em 20/09: o limite dele é 01/11 (ou agora); o contato de 02/10 conta
    withLead(ctx, '2026-09', L('x-set', { createdAt: D(9, 20) }), [N('c2', 'x-set', D(10, 2))]);
    const period = { start: new Date(2026, 7, 1), end: new Date(2026, 9, 1), running: false };
    const r = conversaoReport(ctx, { period });
    expect(faixaOf(r, 'x-ago')).toBe('faixa:sem-contato');
    expect(faixaOf(r, 'x-set')).toBe('faixa:mais-24h');
    // a janela de dois meses é a soma dos dois meses do painel
    const a = metricsOf(ctx, { monthKey: '2026-08' }).firstContact;
    const s = metricsOf(ctx, { monthKey: '2026-09' }).firstContact;
    expect(speedOf(r)).toEqual({
      'ate-1h': a.h1 + s.h1, 'ate-24h': a.h24 + s.h24, 'mais-24h': a.over + s.over, 'sem-contato': a.none + s.none,
    });
  });

  it('o comparado de um mês fechado é acompanhado até agora, não até o fim dele', () => {
    const ctx = { ...makeCtx(), sources: [] };
    ctx.months['2026-07'] = emptyMonth();
    // cadastrado em julho e matriculado em 15/08
    withLead(ctx, '2026-07', L('j1', { createdAt: D(7, 10), status: 'Venda', isConverted: true, convertedAt: D(8, 15) }));
    const cmp = previousPeriod(agosto, NOW);
    const r = conversaoReport(ctx, { period: agosto, cmp });
    expect(r.before).toEqual(metricsOf(ctx, { monthKey: '2026-07' }).cohort);
    expect(r.before.enrolled).toBe(1);
  });

  it('as faixas fecham em 60 e 1440 minutos, como no painel', () => {
    const c = makeCtx();
    const base = D(9, 3, 8, 0);
    [['b60', 60 * 60000], ['b60p', 60 * 60000 + 1], ['b1440', 1440 * 60000], ['b1440p', 1440 * 60000 + 1]].forEach(([id, ms]) => {
      withLead(c, '2026-09', L(id, { createdAt: base }), [N(`n-${id}`, id, new Date(base.getTime() + ms))]);
    });
    const ctx = { ...c, sources: [] };
    const r = conversaoReport(ctx, { period: setembro });
    const f = metricsOf(ctx, { monthKey: '2026-09' }).firstContact;
    expect(speedOf(r)).toEqual({ 'ate-1h': f.h1, 'ate-24h': f.h24, 'mais-24h': f.over, 'sem-contato': f.none });
    expect([faixaOf(r, 'b60'), faixaOf(r, 'b60p'), faixaOf(r, 'b1440'), faixaOf(r, 'b1440p')])
      .toEqual(['faixa:ate-1h', 'faixa:ate-24h', 'faixa:ate-24h', 'faixa:mais-24h']);
  });

  it('o recorte por consultor junta quem saiu da equipe, e a planilha dá o desfecho de quem perdeu e de quem segue em aberto', () => {
    const ctx = { ...makeCtx(), sources: [] };
    const r = conversaoReport(ctx, { period: setembro });
    expect(r.byOwner.map((x) => [x.key, x.name, x.leads, x.enrolled, x.conv])).toEqual([
      ['consultor:ana', 'Ana Ribeiro', 2, 1, 50],
      ['consultor:diego', 'Diego Santos', 2, 0, 0],
      ['consultor:__outros__', 'Fora da equipe ou sem responsável', 1, 0, 0],
    ]);
    const cut = conversaoReport(ctx, { period: setembro, recorte: 'consultor:__outros__' });
    expect([cut.cutLabel, cut.rows.map((x) => x.id)]).toEqual(['Consultor: Fora da equipe ou sem responsável', ['s5']]);
    const lost = conversaoReport(ctx, { period: setembro, recorte: 'situacao:perderam' }).exportRows;
    expect(lost.map((x) => [x.desfecho, x.dataDesfecho])).toEqual([['Perdeu', '06/09/2026']]);
    const open = conversaoReport(ctx, { period: setembro, recorte: 'situacao:em-aberto' }).exportRows;
    expect(open.map((x) => [x.desfecho, x.dataDesfecho])).toEqual([['Em aberto', ''], ['Em aberto', ''], ['Em aberto', '']]);
    const seen = conversaoReport(ctx, { period: setembro, recorte: 'situacao:vieram' });
    expect(seen.rows.map((x) => x.id)).toEqual(['s1']);
  });
});
