// A aba Por professor das Visitas e aulas contra o cartão de professores do
// painel CRM (professorsOf), no mês fechado. A aba sai das linhas da lista
// (uma regra só para a linha e para a lista filtrada) e conta o mesmo que o
// painel, com as quatro diferenças escritas em visitas.js: o recorte da barra,
// a aula na matrícula ou depois dela, o professor que só teve falta e a ordem
// de quem treinou sozinho.
import { describe, it, expect } from 'vitest';
import { visitasReport, SOLO_CUT } from '../relatorios/leads/visitas.js';
import { professorsOf } from '../crm/appointments.js';
import { newestRecordsOf } from '../crm/metrics.js';
import { periodFromParams } from '../period.js';
import { makeCtx, NOW, D, A } from './fixtures/crmCtx.js';

const agosto = periodFromParams({ monthKey: '2026-08' }, NOW);
const P2 = { professorId: 'p2', professorName: 'Rui Lopes' };
const P3 = { professorId: 'p3', professorName: 'Lia Prado' };
// Agosto com professores, falta, treino sozinho, visita e cancelada: nada que a aba e o painel contem diferente.
const IGUAIS = [
  A('k1', 'a2', 'attended', D(8, 12), D(8, 10), { ...P2, modality: 'Funcional' }),
  A('k2', 'a3', 'attended', D(8, 14), D(8, 10), { soloTraining: true, modality: 'Musculação' }),
  A('k3', 'o1', 'no_show', D(8, 15), D(8, 10), { ...P2, modality: 'Funcional' }),
  // O o1 matriculou em 08/09: a aula de agosto é de antes da matrícula.
  A('k4', 'o1', 'attended', D(8, 18), D(8, 16), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Pilates', converted: true }),
  A('k5', 'a2', 'attended', D(8, 21), D(8, 19), { ...P3, modality: 'Funcional' }),
  A('k6', 'a3', 'attended', D(8, 22), D(8, 19), { type: 'visita' }),
  A('k7', 'a2', 'cancelled', D(8, 23), D(8, 19), { professorId: 'p1', professorName: 'Paula Nunes' }),
];

const ctxCom = (aulas) => {
  const c = makeCtx();
  return { ...c, sources: [], months: { ...c.months, '2026-08': { ...c.months['2026-08'], aulas: [...c.months['2026-08'].aulas, ...aulas] } } };
};
// O painel, no formato da aba: a chave do recorte e os números de cada linha.
const doPainel = (ctx) => {
  const p = professorsOf(newestRecordsOf(ctx.months, 'aulas'), { start: agosto.start, end: agosto.end });
  return [...p.rows, ...(p.solo ? [p.solo] : [])].map((b) => ({
    key: b.solo ? SOLO_CUT : `professor:${b.id}`, done: b.done, enrolled: b.enrolled, conv: b.conv, mods: b.mods,
  }));
};
const daAba = (ctx, extra = {}) => visitasReport(ctx, { period: agosto, ...extra }).byProfessor
  .map((r) => ({ key: r.key, done: r.leads, enrolled: r.enrolled, conv: r.conv, mods: r.mods }));

describe('Por professor contra o professorsOf do painel', () => {
  it('no mês fechado e sem filtro, a aba conta o mesmo que o painel, linha por linha e na mesma ordem', () => {
    const ctx = ctxCom(IGUAIS);
    const painel = doPainel(ctx);
    // A Paula converte 2 de 2; o Rui e a Lia, 0 de 1, e o nome desempata.
    expect(painel.map((x) => x.key)).toEqual(['professor:p1', 'professor:p3', 'professor:p2', SOLO_CUT]);
    expect(daAba(ctx)).toEqual(painel);
    // A falta do Rui fica no painel (missed) e fora da aba, sem mudar as realizadas.
    expect(painel.find((x) => x.key === 'professor:p2')).toMatchObject({ done: 1, enrolled: 0, conv: 0 });
  });

  it('as diferenças conhecidas: o recorte da barra, a aula depois da matrícula e quem só faltou', () => {
    const ctx = ctxCom([
      ...IGUAIS,
      // Lead do funil Renovações: "Todos os funis" deixa de fora, e o painel conta a academia inteira.
      A('d1', 'ren', 'attended', D(8, 24), D(8, 19), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Pilates' }),
      // O a1 matriculou em 20/08: a aula de 25/08 já é de cliente e sai da lista.
      A('d2', 'a1', 'attended', D(8, 25), D(8, 24), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Pilates' }),
      // Professor só com falta: o painel mostra com zero realizadas, a aba não tem o que contar.
      A('d3', 'a2', 'no_show', D(8, 26), D(8, 24), { professorId: 'p4', professorName: 'Ivo Reis' }),
    ]);
    const painel = doPainel(ctx);
    const aba = daAba(ctx);
    expect(painel.find((x) => x.key === 'professor:p1').done).toBe(aba.find((x) => x.key === 'professor:p1').done + 2);
    expect(painel.find((x) => x.key === 'professor:p4')).toMatchObject({ done: 0 });
    expect(aba.find((x) => x.key === 'professor:p4')).toBeUndefined();
    // Tirando as três aulas, as duas contas voltam a bater.
    expect(aba).toEqual(doPainel(ctxCom(IGUAIS)));
    // O recorte da barra vale na aba: com a Ana, ficam só as aulas dos leads dela (a1 e a3).
    expect(daAba(ctx, { userIds: ['ana'] }).map((x) => [x.key, x.done])).toEqual([['professor:p1', 1], [SOLO_CUT, 1]]);
  });
});
