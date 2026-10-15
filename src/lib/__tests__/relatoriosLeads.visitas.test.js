// Visitas e aulas experimentais: os agendamentos do período um por um, os
// números, os recortes, a lista e a planilha. No mês fechado, os números são os
// do painel CRM (metricsOf); no mês em andamento, também, e Marcados soma os que
// ainda vão acontecer.
import { describe, it, expect } from 'vitest';
import { visitasReport, visitasEndOf, VISITAS_COLUMNS } from '../relatorios/leads/visitas.js';
import { metricsOf, crmDelta } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, NOW, D, A } from './fixtures/crmCtx.js';

// Uma visita de quem saiu da equipe (s5), já passada e sem desfecho, com unidade.
const R5 = A('r5', 's5', 'agendada', D(9, 10), D(9, 8), { type: 'visita', unit: 'Centro' });
const ctxOf = () => {
  const c = makeCtx();
  c.months['2026-09'] = { ...c.months['2026-09'], aulas: [...c.months['2026-09'].aulas, R5] };
  return { ...c, sources: [] };
};
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
// Os dias 8 a 13 de setembro, fechados, contra os dias 2 a 7: os dois lados depois da base dos agendamentos.
const semana = periodFromParams({ de: '2026-09-08', ate: '2026-09-13' }, NOW);
const rel = (ctx, extra = {}, period = setembro) => visitasReport(ctx, { period, cmp: previousPeriod(period, NOW), ...extra });
const tile = (r, name) => r.tiles.find((t) => t.name === name);

describe('Visitas e aulas experimentais', () => {
  it('os números do mês: quem veio, quem faltou, os sem desfecho e os que vão acontecer, e o comparecimento', () => {
    const r = rel(ctxOf());
    expect(r.totals).toEqual({ total: 4, came: 1, missed: 1, pending: 1, upcoming: 1, decided: 2, rate: 50 });
    expect(r.tiles.map((t) => [t.key, t.name, t.value])).toEqual([
      [null, 'Marcados', 4], ['situacao:vieram', 'Vieram', 1], ['situacao:faltaram', 'Faltaram', 1],
      ['situacao:sem-desfecho', 'Sem desfecho', 1], ['situacao:a-acontecer', 'A acontecer', 1],
    ]);
    expect(r.attendance.value).toBe(50);
    expect(r.tiles.filter((t) => t.lowerBetter).map((t) => t.name)).toEqual(['Faltaram', 'Sem desfecho']);
  });

  it('no mês em andamento, Marcados fica sem variação; com o comparado antes de setembro, o resto fica sem base', () => {
    const r = rel(ctxOf());
    expect(r.running).toBe(true);
    expect(tile(r, 'Marcados').delta).toBeNull();
    expect(tile(r, 'A acontecer').delta).toBeUndefined();
    for (const name of ['Vieram', 'Faltaram', 'Sem desfecho']) expect(tile(r, name).delta, name).toEqual({ none: true, text: 'sem base' });
    expect(r.attendance.delta).toEqual({ none: true, text: 'sem base' });
  });

  it('no período fechado com base dos dois lados, cada número tem a variação dele', () => {
    const r = rel(ctxOf(), {}, semana);
    expect(r.running).toBe(false);
    expect(r.before).toMatchObject({ total: 2, came: 1, missed: 1, pending: 0, rate: 50 });
    expect(tile(r, 'Marcados').delta).toEqual(crmDelta(1, 2));
    expect(tile(r, 'Vieram').delta).toEqual(crmDelta(0, 1));
    expect(tile(r, 'Faltaram').delta).toEqual(crmDelta(0, 1));
    // Nenhum sem desfecho no comparado: sem base, como o painel faz com a contagem comparada a zero.
    expect(tile(r, 'Sem desfecho').delta).toEqual({ none: true, text: 'sem base' });
    // Sem desfecho marcado no período, não há comparecimento.
    expect(r.attendance).toEqual({ value: null, delta: { none: true, text: 'sem base' } });
  });

  it('a lista vai até o fim do período, em ordem de data, com o que cada tipo guarda', () => {
    const r = rel(ctxOf());
    expect(r.rows.map((x) => x.id)).toEqual(['r1', 'r2', 'r5', 'r3']);
    const row = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect(row.r1).toMatchObject({ leadId: 's1', type: 'Aula experimental', unit: null, modality: 'Funcional', professor: 'Paula Nunes', owner: 'Ana Ribeiro', outcome: 'veio' });
    expect(row.r2).toMatchObject({ leadId: 's2', type: 'Visita', unit: 'Sem unidade', modality: null, professor: null, owner: 'Diego Santos', outcome: 'faltou' });
    expect(row.r5).toMatchObject({ type: 'Visita', unit: 'Centro', owner: 'Fora da equipe', outcome: 'sem-desfecho' });
    expect(row.r3).toMatchObject({ modality: 'Sem modalidade', outcome: 'a-acontecer' });
    expect(r.window).toEqual({ start: setembro.start, end: setembro.fullEnd });
  });

  it('os recortes: tipo, consultor, unidade só das visitas e modalidade só das aulas', () => {
    const r = rel(ctxOf());
    const pares = (rows) => rows.map((x) => [x.name, x.count]);
    expect(pares(r.byType)).toEqual([['Aulas experimentais', 2], ['Visitas', 2]]);
    expect(pares(r.byOwner)).toEqual([['Diego Santos', 2], ['Ana Ribeiro', 1], ['Outros', 1]]);
    expect(pares(r.byUnit)).toEqual([['Centro', 1], ['Sem unidade', 1]]);
    expect(pares(r.byModality)).toEqual([['Funcional', 1], ['Sem modalidade', 1]]);
  });

  it('o recorte filtra a lista, e o que não existe é ignorado', () => {
    const ids = (recorte) => rel(ctxOf(), { recorte }).rows.map((x) => x.id);
    expect(ids('situacao:faltaram')).toEqual(['r2']);
    expect(ids('situacao:a-acontecer')).toEqual(['r3']);
    expect(ids('tipo:aula')).toEqual(['r1', 'r3']);
    expect(ids('unidade:Centro')).toEqual(['r5']);
    expect(ids('modalidade:Funcional')).toEqual(['r1']);
    expect(rel(ctxOf(), { recorte: 'unidade:Centro' }).cutLabel).toBe('Unidade: Centro');
    expect(rel(ctxOf(), { recorte: 'tipo:aula' }).cutLabel).toBe('Tipo: Aulas experimentais');
    expect(rel(ctxOf(), { recorte: 'situacao:a-acontecer' }).cutLabel).toBe('A acontecer');
    expect(rel(ctxOf(), { recorte: 'motivo:Preço' })).toMatchObject({ cut: null, cutLabel: null });
  });

  it('o desfecho marcado antes da hora já conta, e o treina sozinho aparece como tal', () => {
    const ctx = ctxOf();
    const cedo = A('r6', 's4', 'attended', D(9, 14, 18), D(9, 13), { soloTraining: true, modality: 'Pilates' });
    ctx.months['2026-09'] = { ...ctx.months['2026-09'], aulas: [...ctx.months['2026-09'].aulas, cedo] };
    const r = rel(ctx);
    expect(r.rows.find((x) => x.id === 'r6')).toMatchObject({ outcome: 'veio', professor: 'Treina sozinho' });
    expect(r.totals).toMatchObject({ came: 2, upcoming: 1 });
  });

  it('o registro de um lead que não existe mais entra na equipe toda, com o nome do registro', () => {
    const ctx = ctxOf();
    const apagado = A('r7', 'apagado', 'attended', D(9, 3), D(9, 1), { type: 'visita', leadName: 'Lia Antiga', unit: 'Centro' });
    ctx.months['2026-09'] = { ...ctx.months['2026-09'], aulas: [...ctx.months['2026-09'].aulas, apagado] };
    expect(rel(ctx).rows.find((x) => x.id === 'r7')).toMatchObject({ name: 'Lia Antiga', owner: 'Sem responsável' });
    expect(rel(ctx, { userIds: ['ana'] }).rows.map((x) => x.id)).not.toContain('r7');
  });

  it('a semana que atravessa o fim do mês vai só até o fim do mês atual', () => {
    const quarta = new Date(2026, 8, 30, 15);
    const semanaQueCruza = periodFromParams({ periodo: 'semana' }, quarta);
    expect(semanaQueCruza.fullEnd).toEqual(new Date(2026, 9, 5));
    expect(visitasEndOf(semanaQueCruza, quarta)).toEqual(new Date(2026, 9, 1));
    expect(visitasEndOf(agosto, NOW)).toEqual(agosto.fullEnd);
  });

  it('a planilha tem o contato, o CPF e as colunas da lista, com o dia e a hora inteiros', () => {
    expect(VISITAS_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Tipo', 'Dia e hora', 'Unidade', 'Modalidade', 'Professor', 'Consultor', 'Desfecho',
    ]);
    expect(rel(ctxOf(), { recorte: 'situacao:faltaram' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
      tipo: 'Visita', diaHora: '05/09/2026 10:00', unidade: 'Sem unidade', modalidade: '', professor: '', consultor: 'Diego Santos', desfecho: 'Faltou',
    }]);
  });

  it('no mês fechado os números são os do painel CRM, e no mês em andamento também, com os que vão acontecer em Marcados', () => {
    const ctx = ctxOf();
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    const sem = (t) => ({ total: t.total, came: t.came, missed: t.missed, pending: t.pending, decided: t.decided, rate: t.rate });
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        const tag = `${userId} ${funnelId}`;
        const fechado = visitasReport(ctx, { period: agosto, ...extra });
        expect(sem(fechado.totals), tag).toEqual(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId }).appts);
        expect(fechado.totals.upcoming, tag).toBe(0);
        const aberto = rel(ctx, extra);
        const m = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId }).appts;
        expect({ ...sem(aberto.totals), total: aberto.totals.total - aberto.totals.upcoming }, tag).toEqual(m);
        expect(aberto.before, tag).toEqual({ ...metricsOf(ctx, { monthKey: '2026-08', userId, funnelId, cutEnd: cut }).appts, upcoming: 0 });
      }
    }
  });
});
