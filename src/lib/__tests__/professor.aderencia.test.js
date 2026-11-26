import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import { aderenciaDoAno, aderenciaDoSemestre, aderenciaPorSemana, aderenciaResumo, presencasPorSemana } from '../professor/aderencia.js';

const PROF = { id: 'p1', modalidadeIds: ['func'] };
const PLANOS = [{ id: 'move', modalityIds: ['func'] }, { id: 'start', modalityIds: ['musc'] }];
const contrato = (leadId, over = {}) => ({
  id: `c-${leadId}`, leadId, planId: 'move', status: 'ativo', value: 2388,
  startsAt: new Date('2027-01-10T12:00:00'), endsAt: new Date('2028-01-10T12:00:00'),
  createdAt: new Date('2027-01-10T12:00:00'), ...over,
});

describe('aderenciaPorSemana', () => {
  // Semanas de segunda 01/03, 08/03 e 15/03/2027.
  const contratos = normalizeContracts([
    contrato('ana'),
    // Começa na segunda 08/03 às 00:00: a semana de 08/03 é a primeira do contrato.
    contrato('bia', { startsAt: new Date('2027-03-08T00:00:00'), createdAt: new Date('2027-03-08T00:00:00') }),
    // Trancado na terça 09/03.
    contrato('caio', { status: 'trancado', pausedAt: new Date('2027-03-09T10:00:00') }),
    contrato('dani', { planId: 'start' }),
    contrato('edu'),
  ]);
  const leads = [
    { id: 'ana', professorId: 'p1' }, { id: 'bia', professorId: 'p1' }, { id: 'caio', professorId: 'p1' },
    { id: 'dani', professorId: 'p1' }, { id: 'edu', professorId: 'p2' },
  ];
  const presencas = [
    { leadId: 'ana', semana: '2027-03-01', presencas: 3 },
    { leadId: 'caio', semana: '2027-03-01', presencas: 2 },
    { leadId: 'ana', semana: '2027-03-08', presencas: 1 },
    { leadId: 'bia', semana: '2027-03-08', presencas: 4 },
    { leadId: 'dani', semana: '2027-03-08', presencas: 5 },
    { leadId: 'edu', semana: '2027-03-08', presencas: 5 },
    { leadId: 'bia', semana: '2027-03-15', presencas: 2 },
    // Semana que ainda não acabou no corte.
    { leadId: 'ana', semana: '2027-03-22', presencas: 2 },
  ];
  const linhas = aderenciaPorSemana({ presencas, leads, contratos, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00') });

  it('uma linha por semana importada e já acabada, da mais nova para a mais antiga', () => {
    expect(linhas.map((l) => l.semana)).toEqual(['2027-03-15', '2027-03-08', '2027-03-01']);
  });

  it('conta aluno-semanas da carteira, sem a primeira semana do contrato e sem semana trancada', () => {
    expect(linhas).toEqual([
      { semana: '2027-03-15', contam: 2, aderentes: 1, umaPresenca: 0, nenhuma: 1, taxa: 50, umaIds: [], nenhumaIds: ['ana'] },
      { semana: '2027-03-08', contam: 1, aderentes: 0, umaPresenca: 1, nenhuma: 0, taxa: 0, umaIds: ['ana'], nenhumaIds: [] },
      { semana: '2027-03-01', contam: 2, aderentes: 2, umaPresenca: 0, nenhuma: 0, taxa: 100, umaIds: [], nenhumaIds: [] },
    ]);
  });

  it('a barra é parâmetro', () => {
    const com3 = aderenciaPorSemana({ presencas, leads, contratos, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00'), barra: 3 });
    expect(com3.find((l) => l.semana === '2027-03-01')).toMatchObject({ contam: 2, aderentes: 1 });
  });

  it('contrato que começa no meio da semana perde aquela semana e conta na seguinte', () => {
    const quarta = normalizeContracts([contrato('ana', { startsAt: new Date('2027-03-03T12:00:00'), createdAt: new Date('2027-03-03T12:00:00') })]);
    const r = aderenciaPorSemana({
      presencas: [{ leadId: 'ana', semana: '2027-03-01', presencas: 2 }, { leadId: 'ana', semana: '2027-03-08', presencas: 2 }],
      leads: [{ id: 'ana', professorId: 'p1' }], contratos: quarta, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00'),
    });
    expect(r.map((l) => [l.semana, l.contam])).toEqual([['2027-03-08', 1], ['2027-03-01', 0]]);
  });

  it('a renovação emendada não perde a primeira semana', () => {
    const emendada = normalizeContracts([
      contrato('ana', { endsAt: new Date('2027-03-08T00:00:00') }),
      contrato('ana', { id: 'c-ana-r', renewedFromId: 'c-ana', startsAt: new Date('2027-03-08T00:00:00'), endsAt: new Date('2028-03-08T00:00:00'), createdAt: new Date('2027-03-01T12:00:00') }),
    ]);
    const r = aderenciaPorSemana({
      presencas: [{ leadId: 'ana', semana: '2027-03-08', presencas: 2 }],
      leads: [{ id: 'ana', professorId: 'p1' }], contratos: emendada, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00'),
    });
    expect(r).toEqual([{ semana: '2027-03-08', contam: 1, aderentes: 1, umaPresenca: 0, nenhuma: 0, taxa: 100, umaIds: [], nenhumaIds: [] }]);
  });

  it('sem presença importada não há semana', () => {
    expect(aderenciaPorSemana({ presencas: [], leads, contratos, planos: PLANOS, professor: PROF, asOf: new Date('2027-03-24T12:00:00') })).toEqual([]);
  });
});

describe('aderência sem presença importada para a turma', () => {
  it('professor de uma modalidade fora do relatório fica sem dados, não com 0%', () => {
    const contratos = normalizeContracts([contrato('dani', { planId: 'start' })]);
    const leads = [{ id: 'dani', professorId: 'pm' }];
    const presencas = [{ leadId: 'ana', semana: '2027-03-01', presencas: 3 }];
    const linhas = aderenciaPorSemana({ presencas, leads, contratos, planos: PLANOS, professor: { id: 'pm', modalidadeIds: ['musc'] }, asOf: new Date('2027-03-24T12:00:00') });
    expect(linhas).toEqual([]);
    expect(aderenciaResumo(linhas, 2027, new Date('2027-03-24T12:00:00')).taxa).toBeNull();
  });
});

describe('aderenciaDoSemestre e aderenciaDoAno', () => {
  const linhas = [
    { semana: '2027-12-27', contam: 10, aderentes: 0 },
    { semana: '2027-11-29', contam: 10, aderentes: 9 },
    { semana: '2027-08-02', contam: 10, aderentes: 5 },
    { semana: '2027-03-01', contam: 10, aderentes: 7 },
    { semana: '2027-02-01', contam: 10, aderentes: 5 },
  ];

  it('soma aluno-semanas do semestre, pela segunda-feira, sem dezembro', () => {
    expect(aderenciaDoSemestre(linhas, { inicio: new Date('2027-01-01T00:00:00'), fim: new Date('2027-07-01T00:00:00') }))
      .toEqual({ contam: 20, aderentes: 12, taxa: 60 });
    // A semana de segunda 29/11 conta em julho a novembro; a de 27/12, em nenhum.
    expect(aderenciaDoSemestre(linhas, { inicio: new Date('2027-07-01T00:00:00'), fim: new Date('2027-12-01T00:00:00') }))
      .toEqual({ contam: 20, aderentes: 14, taxa: 70 });
  });

  it('nota do ano com os dois semestres fechados, na avaliação de dezembro', () => {
    const r = aderenciaDoAno(linhas, 2027, new Date('2027-12-10T12:00:00'));
    expect(r.nota).toBe(65);
    expect(r.semestres.map((s) => [s.fechado, s.taxa])).toEqual([[true, 60], [true, 70]]);
  });

  it('com um só semestre fechado, vale ele; sem nenhum, não há nota', () => {
    expect(aderenciaDoAno(linhas, 2027, new Date('2027-08-10T12:00:00')).nota).toBe(60);
    expect(aderenciaDoAno(linhas, 2027, new Date('2027-05-10T12:00:00')).nota).toBeNull();
  });

  it('o resumo da lista: a nota do ano, ou o semestre em andamento antes do primeiro fechar', () => {
    expect(aderenciaResumo(linhas, 2027, new Date('2027-12-10T12:00:00'))).toMatchObject({ taxa: 65, emAndamento: false });
    expect(aderenciaResumo(linhas, 2027, new Date('2027-05-10T12:00:00'))).toMatchObject({ taxa: 60, emAndamento: true, nota: null });
    expect(aderenciaResumo([], 2027, new Date('2027-05-10T12:00:00'))).toMatchObject({ taxa: null, emAndamento: false });
  });
});

describe('presencasPorSemana (os documentos por mês da importação da Next Fit)', () => {
  const dia = (hora = '07:00', origens = ['catraca']) => ({ hora, origens, modalidades: [] });
  const ordenar = (lista) => [...lista].sort((a, b) => `${a.leadId}_${a.semana}`.localeCompare(`${b.leadId}_${b.semana}`));

  it('cada dia de segunda a sexta conta uma vez, pela catraca ou pela agenda', () => {
    const docs = [{ leadId: 'l1', mes: '2027-01', dias: {
      '2027-01-11': dia(), '2027-01-12': dia('18:00', ['agenda']), '2027-01-13': dia('07:00', ['catraca', 'agenda']),
      '2027-01-18': dia(),
    } }];
    expect(ordenar(presencasPorSemana(docs))).toEqual([
      { leadId: 'l1', semana: '2027-01-11', presencas: 3 },
      { leadId: 'l1', semana: '2027-01-18', presencas: 1 },
    ]);
  });

  it('sábado e domingo não contam, e a semana só com eles não aparece', () => {
    const docs = [{ leadId: 'l1', mes: '2027-01', dias: { '2027-01-16': dia(), '2027-01-17': dia(), '2027-01-22': dia() } }];
    expect(presencasPorSemana(docs)).toEqual([{ leadId: 'l1', semana: '2027-01-18', presencas: 1 }]);
  });

  it('a semana que atravessa o fim do mês junta os dois documentos', () => {
    const docs = [
      { leadId: 'l1', mes: '2026-11', dias: { '2026-11-30': dia() } },
      { leadId: 'l1', mes: '2026-12', dias: { '2026-12-01': dia(), '2026-12-03': dia() } },
    ];
    expect(presencasPorSemana(docs)).toEqual([{ leadId: 'l1', semana: '2026-11-30', presencas: 3 }]);
  });

  it('cada aluno tem a sua linha, e documento sem lead ou sem dias é ignorado', () => {
    const docs = [
      { leadId: 'l1', mes: '2027-01', dias: { '2027-01-11': dia() } },
      { leadId: 'l2', mes: '2027-01', dias: { '2027-01-11': dia(), '2027-01-14': dia() } },
      { mes: '2027-01', dias: { '2027-01-11': dia() } },
      { leadId: 'l3', mes: '2027-01' },
      null,
    ];
    expect(ordenar(presencasPorSemana(docs))).toEqual([
      { leadId: 'l1', semana: '2027-01-11', presencas: 1 },
      { leadId: 'l2', semana: '2027-01-11', presencas: 2 },
    ]);
  });

  it('a saída é a entrada do aderenciaPorSemana', () => {
    const docs = [{ leadId: 'l1', mes: '2027-01', dias: { '2027-01-18': dia(), '2027-01-19': dia() } }];
    const contratos = normalizeContracts([contrato('l1')]);
    const [linha] = aderenciaPorSemana({
      presencas: presencasPorSemana(docs), leads: [{ id: 'l1', professorId: 'p1' }], contratos, planos: PLANOS,
      professor: PROF, asOf: new Date('2027-02-01T12:00:00'),
    });
    expect(linha).toMatchObject({ semana: '2027-01-18', contam: 1, aderentes: 1 });
  });
});
