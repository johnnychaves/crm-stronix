// Perdas: os leads perdidos no período, por motivo, etapa, origem e consultor,
// a lista de repescagem e a planilha. No mês inteiro, os números são os do card
// de perdas do painel CRM (metricsOf).
import { describe, it, expect } from 'vitest';
import { perdasReport, stageBaseOf, PERDAS_COLUMNS } from '../relatorios/leads/perdas.js';
import { STAGE_SINCE_TEXT } from '../relatorios/leads/base.js';
import { metricsOf, crmDelta } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';
import { periodFromParams, previousPeriod } from '../period.js';
import { makeCtx, L, D, MV } from './fixtures/crmCtx.js';

// As fixtures param em 14/09 ao meio-dia, antes de a etapa da perda começar a ser
// gravada (14/09, 18h10). Aqui o agora é 20/09, para setembro ter a etapa.
const NOW = D(9, 20, 12);

// Uma perda do Diego em setembro, da etapa Novo lead, e uma de agosto antes do corte do comparado.
const P1 = L('p1', { consultantId: 'diego', source: 'Site', status: 'Perda', lostAt: D(9, 12), lossReason: 'Horário' });
const P2 = L('p2', { createdAt: D(8, 1), status: 'Perda', lostAt: D(8, 10), lossReason: 'Preço' });
// Perdido em setembro e de volta ao funil: a lista de setembro ainda tem a cópia velha, e o lead de
// hoje (leadsById) não tem mais a data nem o motivo da perda.
const P4_VELHO = L('p4', { status: 'Perda', lostAt: D(9, 9), lossReason: 'Preço' });
const P4 = L('p4', { status: 'Contato feito', lostAt: null, lossReason: null });
const ctxOf = () => {
  const c = makeCtx();
  c.months['2026-09'] = {
    ...c.months['2026-09'],
    lost: [...c.months['2026-09'].lost, P1, P4_VELHO],
    interactions: [...c.months['2026-09'].interactions, MV('m5', 'p1', 'Novo lead', 'Perda', D(9, 12))],
  };
  c.months['2026-08'] = { ...c.months['2026-08'], lost: [P2] };
  c.leadsById = new Map([...c.leadsById, ['p1', P1], ['p2', P2], ['p4', P4]]);
  return { ...c, now: NOW, sources: [] };
};
const setembro = periodFromParams({ monthKey: '2026-09' }, NOW);
const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const rel = (ctx, extra = {}, period = setembro) => perdasReport(ctx, { period, cmp: previousPeriod(period, NOW), ...extra });
const pares = (rows) => rows.map((x) => [x.name, x.count]);

describe('Perdas', () => {
  it('o total do mês com a variação, e quem voltou ao funil fica fora', () => {
    const r = rel(ctxOf());
    expect(r.total).toBe(2);
    expect(r.delta).toEqual(crmDelta(2, 1));
    expect(r.rows.map((x) => x.id)).toEqual(['p1', 's3']);
  });

  it('os recortes: motivo, etapa, origem e consultor, que somam o mesmo total', () => {
    const r = rel(ctxOf());
    expect(pares(r.byReason)).toEqual([['Horário', 1], ['Preço', 1]]);
    expect(pares(r.byStage)).toEqual([['Contato feito', 1], ['Novo lead', 1]]);
    expect(pares(r.bySource)).toEqual([['Instagram', 1], ['Site', 1]]);
    expect(pares(r.byOwner)).toEqual([['Ana Ribeiro', 1], ['Diego Santos', 1]]);
    for (const k of ['byReason', 'byStage', 'bySource', 'byOwner']) expect(r[k].reduce((s, x) => s + x.count, 0), k).toBe(r.total);
  });

  it('a etapa existe desde 14/09/2026: sem base antes, parcial no período que atravessa a data', () => {
    expect(STAGE_SINCE_TEXT).toBe('14/09/2026');
    expect(stageBaseOf(agosto)).toBe('none');
    expect(stageBaseOf(setembro)).toBe('partial');
    const outubro = new Date(2026, 9, 15, 10);
    expect(stageBaseOf(periodFromParams({ monthKey: '2026-10' }, outubro))).toBe('full');
    expect(stageBaseOf(periodFromParams({ de: '2026-09-01', ate: '2026-09-13' }, NOW))).toBe('none');
    const r = rel(ctxOf(), {}, agosto);
    expect([r.stageBase, r.byStage]).toEqual(['none', []]);
    // Sem base, o recorte de etapa não existe e é ignorado.
    expect(rel(ctxOf(), { recorte: 'etapa:Sem etapa' }, agosto).cut).toBeNull();

    // A etapa vem da troca para Perda dentro do período: a de uma perda anterior (agosto) não vale,
    // e a perda de setembro sem troca gravada fica em "Sem etapa".
    const p5 = L('p5', { status: 'Perda', lostAt: D(9, 15), lossReason: 'Preço' });
    const c = ctxOf();
    c.months['2026-09'] = { ...c.months['2026-09'], lost: [...c.months['2026-09'].lost, p5] };
    c.months['2026-08'] = { ...c.months['2026-08'], interactions: [...c.months['2026-08'].interactions, MV('m6', 'p5', 'Contato feito', 'Perda', D(8, 20))] };
    c.leadsById = new Map([...c.leadsById, ['p5', p5]]);
    expect(rel(c).rows.find((x) => x.id === 'p5').stage).toBe('Sem etapa');
  });

  it('a lista: a perda mais recente primeiro, com o motivo, a etapa e os dias desde a perda', () => {
    const [p1, s3] = rel(ctxOf()).rows;
    expect(p1).toMatchObject({ reason: 'Horário', stage: 'Novo lead', lostAt: D(9, 12), days: 8, source: 'Site', owner: 'Diego Santos' });
    expect(s3).toMatchObject({ reason: 'Preço', stage: 'Contato feito', days: 14, owner: 'Ana Ribeiro' });
  });

  it('o recorte filtra a lista: o motivo dá a lista de repescagem', () => {
    const r = rel(ctxOf(), { recorte: 'motivo:Horário' });
    expect([r.cut, r.cutLabel, r.rows.map((x) => x.id)]).toEqual(['motivo:Horário', 'Motivo: Horário', ['p1']]);
    expect(rel(ctxOf(), { recorte: 'etapa:Contato feito' }).cutLabel).toBe('Etapa: Contato feito');
    expect(rel(ctxOf(), { recorte: 'motivo:Distância' }).cut).toBeNull();
  });

  it('filtros da barra: consultores, origem e funil', () => {
    expect(rel(ctxOf(), { userIds: ['diego'] }).rows.map((x) => x.id)).toEqual(['p1']);
    expect(rel(ctxOf(), { origem: 'Instagram' }).rows.map((x) => x.id)).toEqual(['s3']);
    expect(rel(ctxOf(), { funnelId: 'ind' }).total).toBe(0);
  });

  it('a planilha tem o contato, o CPF e as colunas da lista', () => {
    expect(PERDAS_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Motivo', 'Etapa', 'Data da perda', 'Dias desde a perda', 'Origem', 'Consultor',
    ]);
    expect(rel(ctxOf(), { recorte: 'motivo:Horário' }).exportRows).toEqual([{
      nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
      motivo: 'Horário', etapa: 'Novo lead', dataPerda: '12/09/2026', diasPerda: 8, origem: 'Site', consultor: 'Diego Santos',
    }]);
  });

  it('no mês inteiro, os números são os do card de perdas do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const extra = { userIds: userId ? [userId] : [], funnelId };
        const tag = `${userId} ${funnelId}`;
        const set = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId });
        const r = rel(ctx, extra);
        expect(r.total, tag).toBe(set.losses.total);
        expect(pares(r.byReason), tag).toEqual(pares(set.losses.reasons));
        expect(pares(r.byStage), tag).toEqual(pares(set.lossStages));
        const ago = metricsOf(ctx, { monthKey: '2026-08', userId, funnelId });
        expect(perdasReport(ctx, { period: agosto, ...extra }).total, tag).toBe(ago.losses.total);
        expect(ago.lossStages, tag).toBeNull();
        expect(perdasReport(ctx, { period: previousPeriod(setembro, NOW), ...extra }).total, tag)
          .toBe(metricsOf(ctx, { monthKey: '2026-08', userId, funnelId, cutEnd: cut }).losses.total);
      }
    }
  });
});
