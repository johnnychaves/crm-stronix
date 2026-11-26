import { describe, it, expect } from 'vitest';
import { normalizeContracts } from '../operacional/base.js';
import {
  ciclosDaPesquisa, estadoDaPesquisa, fimPassou, novaPesquisa, podeAbrir, npsDoCiclo, paraGravar, PERGUNTA_PRINCIPAL_PADRAO,
  pesquisaEmCurso, problemaDaPesquisa, progressoDaTurma, recebeRespostas, resumoDaPesquisa, turmasDoDia,
} from '../professor/pesquisas.js';
import { somarResposta } from '../professor/nps.js';

const form = (over = {}) => ({
  nome: 'Junho de 2027', inicio: '2027-06-01', fim: '2027-06-20', ciclo: 2027,
  perguntas: [{ texto: PERGUNTA_PRINCIPAL_PADRAO, principal: true }, { texto: 'De 0 a 10, as aulas ajudam?', principal: false }],
  ...over,
});

describe('ciclosDaPesquisa', () => {
  it('junho só conta para o ciclo do ano; dezembro oferece o ano e o ciclo seguinte', () => {
    expect(ciclosDaPesquisa('2027-06-01')).toEqual([2027]);
    expect(ciclosDaPesquisa('2027-12-01')).toEqual([2027, 2028]);
    expect(ciclosDaPesquisa('')).toEqual([]);
    expect(ciclosDaPesquisa('2027-02-30')).toEqual([]);
  });
});

describe('problemaDaPesquisa', () => {
  it('a pesquisa nova já vem com a principal sugerida e pede o nome', () => {
    expect(novaPesquisa().perguntas).toEqual([{ texto: PERGUNTA_PRINCIPAL_PADRAO, principal: true }]);
    expect(problemaDaPesquisa(novaPesquisa())).toMatchObject({ campo: 'nome' });
  });

  it('aceita o formulário certo', () => {
    expect(problemaDaPesquisa(form())).toBeNull();
    expect(problemaDaPesquisa(form({ inicio: '2027-12-01', fim: '2027-12-15', ciclo: 2028 }))).toBeNull();
  });

  it('recusa datas, ciclo e perguntas fora da regra', () => {
    expect(problemaDaPesquisa(form({ inicio: '' }))).toMatchObject({ campo: 'inicio' });
    expect(problemaDaPesquisa(form({ fim: '2027-05-31' }))).toMatchObject({ campo: 'fim' });
    expect(problemaDaPesquisa(form({ ciclo: 2028 }))).toMatchObject({ campo: 'ciclo' });
    expect(problemaDaPesquisa(form({ ciclo: null }))).toMatchObject({ campo: 'ciclo' });
    expect(problemaDaPesquisa(form({ perguntas: [] }))).toMatchObject({ campo: 'perguntas' });
    const seis = Array.from({ length: 6 }, (_, i) => ({ texto: `P${i}`, principal: i === 0 }));
    expect(problemaDaPesquisa(form({ perguntas: seis }))).toMatchObject({ campo: 'perguntas' });
    expect(problemaDaPesquisa(form({ perguntas: [{ texto: 'A', principal: true }, { texto: '  ', principal: false }] }))).toMatchObject({ campo: 'pergunta-1' });
    expect(problemaDaPesquisa(form({ perguntas: [{ texto: 'A', principal: true }, { texto: 'B', principal: true }] }))).toMatchObject({ campo: 'perguntas' });
    expect(problemaDaPesquisa(form({ perguntas: [{ texto: 'A', principal: false }] }))).toMatchObject({ campo: 'perguntas' });
  });
});

describe('paraGravar', () => {
  it('dá às perguntas o id pela posição e apara os textos', () => {
    expect(paraGravar(form({ nome: '  Junho  ', perguntas: [{ texto: ' A ', principal: false }, { texto: 'B', principal: true }] }))).toEqual({
      nome: 'Junho', inicio: '2027-06-01', fim: '2027-06-20', ciclo: 2027,
      perguntas: [{ id: 'p1', texto: 'A', principal: false }, { id: 'p2', texto: 'B', principal: true }],
    });
  });
});

describe('estado da pesquisa', () => {
  const aberta = { situacao: 'aberta', inicio: '2027-06-01', fim: '2027-06-20' };
  it('a aberta encerra sozinha depois do fim, e o último dia ainda recebe', () => {
    expect(estadoDaPesquisa(aberta, '2027-06-20')).toBe('aberta');
    expect(estadoDaPesquisa(aberta, '2027-06-21')).toBe('encerrada');
    expect(estadoDaPesquisa({ situacao: 'encerrada' }, '2027-06-05')).toBe('encerrada');
    expect(estadoDaPesquisa({ situacao: 'rascunho' }, '2027-06-05')).toBe('rascunho');
    expect(estadoDaPesquisa({}, '2027-06-05')).toBe('rascunho');
  });

  it('abre de uma semana antes do início até o último dia, e não depois do fim', () => {
    const r = { inicio: '2027-06-01', fim: '2027-06-20' };
    expect(podeAbrir(r, '2027-05-24')).toBe(false);
    expect(podeAbrir(r, '2027-05-25')).toBe(true);
    expect(podeAbrir(r, '2027-06-20')).toBe(true);
    expect(fimPassou(r, '2027-06-20')).toBe(false);
    expect(fimPassou(r, '2027-06-21')).toBe(true);
    expect(podeAbrir(r, '2027-06-21')).toBe(false);
  });

  it('aberta antes do início não recebe resposta', () => {
    expect(recebeRespostas(aberta, '2027-05-31')).toBe(false);
    expect(recebeRespostas(aberta, '2027-06-01')).toBe(true);
    expect(recebeRespostas(aberta, '2027-06-21')).toBe(false);
  });

  it('a pesquisa em curso ignora a vencida e o rascunho', () => {
    const vencida = { id: 'v', situacao: 'aberta', inicio: '2027-01-01', fim: '2027-01-10' };
    const rascunho = { id: 'r', situacao: 'rascunho', inicio: '2027-06-01', fim: '2027-06-20' };
    expect(pesquisaEmCurso([vencida, rascunho], '2027-06-05')).toBeNull();
    expect(pesquisaEmCurso([vencida, rascunho, { ...aberta, id: 'a' }], '2027-06-05')?.id).toBe('a');
  });
});

describe('turmasDoDia', () => {
  it('conta a carteira em vigor de cada professor ativo, sem o trancado e sem quem não tem aluno', () => {
    const PLANOS = [{ id: 'move', modalityIds: ['func'] }];
    const PROFS = [
      { id: 'p1', modalidadeIds: ['func'] },
      { id: 'p2', modalidadeIds: ['func'], ativo: false },
      { id: 'p3', modalidadeIds: ['func'] },
    ];
    const lead = (id, professorId) => ({ id, professorId });
    const c = (id, leadId, over = {}) => ({
      id, leadId, planId: 'move', status: 'ativo', value: 2388,
      startsAt: new Date('2027-01-10T12:00:00'), endsAt: new Date('2028-01-10T12:00:00'), createdAt: new Date('2027-01-10T12:00:00'), ...over,
    });
    const contratos = normalizeContracts([
      c('c1', 'ana'), c('c2', 'bia'), c('c3', 'caio', { status: 'trancado', pausedAt: new Date('2027-03-01T12:00:00') }), c('c4', 'dani'),
    ]);
    const clientes = [lead('ana', 'p1'), lead('bia', 'p1'), lead('caio', 'p1'), lead('dani', 'p2')];
    expect(turmasDoDia({ clientes, contratos, planos: PLANOS, professores: PROFS, agora: new Date('2027-06-01T12:00:00') })).toEqual({ p1: 2 });
  });
});

describe('progressoDaTurma', () => {
  it('pede 10 respostas e metade da turma', () => {
    expect(progressoDaTurma(20, 9)).toEqual({ pct: 45, vale: false, faltam: 1, nuncaVale: false });
    expect(progressoDaTurma(20, 10)).toMatchObject({ vale: true, faltam: 0 });
    expect(progressoDaTurma(24, 11)).toMatchObject({ vale: false, faltam: 1 });
    expect(progressoDaTurma(24, 12)).toMatchObject({ vale: true, pct: 50 });
  });

  it('turma de menos de 10 nunca vale, e turma zero não divide', () => {
    expect(progressoDaTurma(8, 8)).toMatchObject({ vale: false, nuncaVale: true });
    expect(progressoDaTurma(0, 0)).toEqual({ pct: 0, vale: false, faltam: 10, nuncaVale: true });
  });
});

describe('npsDoCiclo', () => {
  const pergs = [{ id: 'p1', texto: 'Principal', principal: true }, { id: 'p2', texto: 'Outra', principal: false }];
  const pesquisa = (id, inicio, over = {}) => ({ id, inicio, fim: inicio, ciclo: 2027, situacao: 'encerrada', perguntas: pergs, turmas: { p1: 20 }, ...over });
  const totaisDe = (pesquisaId, notas) => {
    let t = { pesquisaId, professorId: 'p1' };
    notas.forEach((n) => { t = somarResposta(t, { p1: n, p2: 10 }); });
    return t;
  };
  const doze = [10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 8, 8];

  it('fica com as pesquisas do ciclo que abriram e têm turma do professor', () => {
    const r = npsDoCiclo({
      pesquisas: [
        pesquisa('jun', '2027-06-01'),
        pesquisa('rasc', '2027-07-01', { situacao: 'rascunho' }),
        pesquisa('outro', '2026-06-01', { ciclo: 2026 }),
        pesquisa('semTurma', '2027-08-01', { turmas: { p9: 10 } }),
      ],
      totais: [totaisDe('jun', doze)],
      professorId: 'p1',
      ciclo: 2027,
    });
    expect(r.itens.map((i) => i.pesquisa.id)).toEqual(['jun']);
    expect(r).toMatchObject({ nota: 9.33, pesquisas: 1, passa: true, promotores: 83 });
  });

  it('a encerrada antes do dia do início nunca recebeu resposta e fica fora do ciclo', () => {
    const fechou = (iso) => ({ toDate: () => new Date(iso) });
    const r = npsDoCiclo({
      pesquisas: [
        pesquisa('cedo', '2027-06-01', { encerradaEm: fechou('2026-11-25T20:00:00') }),
        pesquisa('jun', '2027-06-01', { encerradaEm: fechou('2027-06-20T20:00:00') }),
      ],
      totais: [],
      professorId: 'p1',
      ciclo: 2027,
    });
    expect(r.itens.map((i) => i.pesquisa.id)).toEqual(['jun']);
  });

  it('a pesquisa sem totais aparece com zero respostas e sem nota', () => {
    const r = npsDoCiclo({ pesquisas: [pesquisa('dez', '2027-12-01', { situacao: 'aberta' })], totais: [], professorId: 'p1', ciclo: 2027 });
    expect(r.itens[0].resultado).toMatchObject({ respostas: 0, turma: 20, valida: false, nota: null });
    expect(r).toMatchObject({ nota: null, pesquisas: 0, promotores: null });
  });

  it('promotores somados das válidas; a inválida fica fora da nota e da porcentagem', () => {
    const r = npsDoCiclo({
      pesquisas: [pesquisa('jun', '2027-06-01'), pesquisa('dez', '2027-12-01'), pesquisa('pouca', '2027-09-01')],
      totais: [totaisDe('jun', doze), totaisDe('dez', [...Array(10).fill(10)]), totaisDe('pouca', [6, 6])],
      professorId: 'p1',
      ciclo: 2027,
    });
    expect(r.itens.map((i) => i.pesquisa.id)).toEqual(['jun', 'pouca', 'dez']);
    expect(r.nota).toBe(9.66); // (9,33 + 10) ÷ 2, com a média de duas casas de cada pesquisa
    expect(r.pesquisas).toBe(2);
    expect(r.promotores).toBe(91);
  });
});

describe('resumoDaPesquisa', () => {
  it('soma as respostas e a turma da pesquisa em curso', () => {
    const p = { id: 'a', situacao: 'aberta', inicio: '2027-06-01', fim: '2027-06-20', turmas: { p1: 20, p2: 24 } };
    const totais = [{ pesquisaId: 'a', professorId: 'p1', respostas: 14 }, { pesquisaId: 'a', professorId: 'p2', respostas: 9 }, { pesquisaId: 'x', professorId: 'p1', respostas: 3 }];
    expect(resumoDaPesquisa([p], totais, '2027-06-10')).toEqual({ pesquisa: p, respostas: 23, turma: 44 });
    expect(resumoDaPesquisa([p], totais, '2027-06-21')).toBeNull();
  });
});
