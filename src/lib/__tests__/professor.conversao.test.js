import { describe, it, expect } from 'vitest';
import { APPTS_COMPLETE_MONTH as DO_CRM } from '../crm/scope.js';
import { APPTS_COMPLETE_MONTH, conversaoDoCiclo, pessoasDasAulas } from '../professor/conversao.js';
const limitesDoCiclo = (ciclo) => ({ inicio: new Date(ciclo - 1, 11, 1), fim: new Date(ciclo, 11, 1) });

const ASOF = new Date('2027-06-15T12:00:00');
let seq = 0;
// Registro de aula experimental com "Compareceu", do professor p1, em março.
const aula = (leadId, over = {}) => ({
  id: `a${(seq += 1)}`, leadId, type: 'aula', status: 'attended', professorId: 'p1', professorName: 'Bruno',
  scheduledFor: new Date('2027-03-10T18:00:00'), converted: false, ...over,
});
const pago = (leadId, over = {}) => ({
  id: `c-${leadId}`, leadId, value: 2388, status: 'ativo',
  startsAt: new Date('2027-03-12T12:00:00'), endsAt: new Date('2028-03-12T12:00:00'), ...over,
});
const conta = (aulas, contratos, opts = {}) => conversaoDoCiclo({ aulas, contratos, professorId: 'p1', periodo: limitesDoCiclo(2027), asOf: ASOF, ...opts });

describe('conversaoDoCiclo', () => {
  it('conta pessoas: quem veio em dois agendamentos com o mesmo professor entra uma vez', () => {
    const r = conta([
      aula('ana', { scheduledFor: new Date('2027-03-03T18:00:00') }),
      aula('ana', { converted: true }),
      aula('bia'),
    ], [pago('ana')]);
    expect(r.professor).toEqual({ vieram: 2, matricularam: 1, taxa: 50 });
  });

  it('matrícula com freepass importado de R$ 0 não conta', () => {
    const importado = { id: 'c-ana', leadId: 'ana', value: 0, importBatchId: 'lote-1', status: 'ativo', startsAt: new Date('2027-03-12T12:00:00') };
    expect(conta([aula('ana', { converted: true })], [importado]).professor).toEqual({ vieram: 1, matricularam: 0, taxa: 0 });
  });

  it('contrato importado com valor e contrato que nunca valeu também não contam', () => {
    const importado = pago('ana', { importSource: 'nextfit' });
    const desistiu = pago('bia', { status: 'cancelado', cancelledAt: new Date('2027-03-12T12:00:00') });
    const r = conta([aula('ana', { converted: true }), aula('bia', { converted: true })], [importado, desistiu]);
    expect(r.professor.matricularam).toBe(0);
  });

  it('aula dos últimos 30 dias fica fora', () => {
    const r = conta([aula('ana', { scheduledFor: new Date('2027-05-20T18:00:00') }), aula('bia', { scheduledFor: new Date('2027-05-10T18:00:00') })], []);
    expect(r.professor.vieram).toBe(1);
    expect(conta([aula('ana', { scheduledFor: new Date('2027-05-20T18:00:00') })], [], { janelaDias: 10 }).professor.vieram).toBe(1);
  });

  it('fora do ciclo, falta, visita e treino sozinho não entram', () => {
    const r = conta([
      aula('a', { scheduledFor: new Date('2026-11-30T18:00:00') }),
      aula('b', { status: 'no_show' }),
      aula('c', { type: 'visita' }),
      aula('d', { soloTraining: true }),
      aula('e', { professorId: null }),
      aula('f', { scheduledFor: { toDate: () => new Date('2026-12-01T09:00:00') } }),
    ], []);
    expect(r.professor.vieram).toBe(1);
    expect(r.academia.vieram).toBe(1);
  });

  it('a matrícula vai para o professor da aula marcada como convertida', () => {
    const aulas = [aula('ana', { professorId: 'p2', scheduledFor: new Date('2027-03-01T18:00:00') }), aula('ana', { converted: true })];
    expect(conta(aulas, [pago('ana')], { professorId: 'p2' }).professor).toEqual({ vieram: 1, matricularam: 0, taxa: 0 });
    expect(conta(aulas, [pago('ana')]).professor).toEqual({ vieram: 1, matricularam: 1, taxa: 100 });
  });

  it('a academia conta cada pessoa uma vez, pelo total', () => {
    const aulas = [
      aula('ana', { professorId: 'p2', scheduledFor: new Date('2027-03-01T18:00:00') }), aula('ana', { converted: true }),
      aula('bia', { professorId: 'p2', converted: true }), aula('caio', { professorId: 'p2' }),
    ];
    expect(conta(aulas, [pago('ana'), pago('bia')]).academia).toEqual({ vieram: 3, matricularam: 2, taxa: 67 });
  });

  it('professor com 3 pessoas tem veredito, sem mínimo', () => {
    const aulas = [
      aula('ana', { converted: true }), aula('bia', { converted: true }), aula('caio'),
      aula('d1', { professorId: 'p2' }), aula('d2', { professorId: 'p2' }), aula('d3', { professorId: 'p2', converted: true }),
    ];
    const r = conta(aulas, [pago('ana'), pago('bia'), pago('d3')]);
    expect(r.professor).toEqual({ vieram: 3, matricularam: 2, taxa: 67 });
    expect(r.academia).toEqual({ vieram: 6, matricularam: 3, taxa: 50 });
    expect(r.passa).toBe(true);
  });

  it('empatar com a academia não passa; a tolerância abre a folga', () => {
    const aulas = [aula('ana', { converted: true }), aula('bia'), aula('d1', { professorId: 'p2', converted: true }), aula('d2', { professorId: 'p2' })];
    const contratos = [pago('ana'), pago('d1')];
    expect(conta(aulas, contratos).passa).toBe(false);
    expect(conta(aulas, contratos, { tolerancia: 5 }).passa).toBe(true);
  });

  it('sem ninguém do professor não há veredito', () => {
    expect(conta([aula('ana', { professorId: 'p2' })], []).passa).toBeNull();
  });

  it('avisa o ciclo que pega os agendamentos incompletos, antes de setembro de 2026', () => {
    expect(conversaoDoCiclo({ aulas: [], contratos: [], professorId: 'p1', periodo: limitesDoCiclo(2026), asOf: ASOF }).incompleto).toBe(true);
    expect(conta([], []).incompleto).toBe(false);
    expect(APPTS_COMPLETE_MONTH).toBe(DO_CRM);
  });
});

describe('pessoasDasAulas', () => {
  it('uma linha por pessoa do professor, com a última aula e a janela marcada', () => {
    const r = pessoasDasAulas({
      aulas: [
        aula('ana', { scheduledFor: new Date('2027-03-03T18:00:00'), leadName: 'Ana', modality: 'Funcional' }),
        aula('ana', { converted: true, leadName: 'Ana', modality: 'Funcional' }),
        aula('bia', { scheduledFor: new Date('2027-06-01T18:00:00'), leadName: 'Bia' }),
        aula('caio', { professorId: 'p2' }),
        aula('dani', { status: 'no_show' }),
      ],
      contratos: [pago('ana')], professorId: 'p1', periodo: limitesDoCiclo(2027), asOf: ASOF,
    });
    expect(r.map((p) => [p.leadId, p.matriculou, p.naJanela])).toEqual([['bia', false, true], ['ana', true, false]]);
    expect(r[1]).toMatchObject({ nome: 'Ana', modalidade: 'Funcional', ultima: new Date('2027-03-10T18:00:00') });
  });

  it('a janela é parâmetro', () => {
    const r = pessoasDasAulas({ aulas: [aula('bia', { scheduledFor: new Date('2027-06-01T18:00:00') })], contratos: [], professorId: 'p1', periodo: limitesDoCiclo(2027), asOf: ASOF, janelaDias: 10 });
    expect(r[0].naJanela).toBe(false);
  });
});
