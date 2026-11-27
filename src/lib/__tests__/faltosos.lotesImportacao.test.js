// A forma das gravações da importação da Next Fit (src/lib/faltosos/lotesImportacao.js):
// os ids fixos, a linha "Voltou a treinar", a unidade de cada aluno, o fecho,
// os lotes e as conferências que barram plano com defeito. Puro, sem
// Firebase. Os dados são inventados. O último bloco passa o plano de verdade
// (planoImportacao.js), lido de planilhas falsas, pela montagem.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIMITE_POR_LOTE,
  ERRO_OUTRA_IMPORTACAO,
  idValido,
  voltaDoId,
  erroDaGravacao,
  caminhoIndefinido,
  semIndefinidos,
  outraImportacaoEntrou,
  conferirPlano,
  montarVolta,
  montarGravacoes,
  empacotarEmLotes,
} from '../faltosos/lotesImportacao.js';
import { planejarImportacao, idDaImportacao, idDaVolta } from '../faltosos/planoImportacao.js';
import { parseFaltantes, parsePresencas } from '../faltosos/nextfitArquivos.js';
import { PRESENCE_RETURN_TYPE } from '../leads.js';

const TS = 'TS';
const QUEM = { uid: 'uid-g1', id: 'g1', nome: 'Johnny' };
const ID = 'f2026-10-06_p2026-09-29_2026-10-05';
const PERIODO = { de: '2026-09-29', ate: '2026-10-05' };
const IMPORTACAO = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO };
const ULTIMA = { id: ID, dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29', periodoPresencas: PERIODO, ultimoDiaPresencas: '2026-10-05' };
const REGISTRO = {
  dataFaltantes: '2026-10-06',
  dataFaltantesAnterior: '2026-09-29',
  periodoPresencas: PERIODO,
  numeros: { voltaram: 1, entramNoMarco: { 7: 2 } },
  avisos: [],
  naoLigados: [{ nome: 'Fulano de Tal', telefone: '(51) 9 9999-0000', relatorio: 'faltantes' }],
};
const ESTADO = (leadId, extra = {}) => ({
  leadId,
  professorId: 'p1',
  professorNextFit: 'Ana Prof',
  contratoNextFit: 'Clube+ Start',
  ultimaPresenca: '2026-09-25',
  inicioFalta: '2026-09-25',
  status: 'faltando',
  voltouEm: null,
  voltouEntre: null,
  diasNaImportacao: 11,
  urgente: false,
  contratoTerminaEm: '2027-03-01',
  querCancelarEm: null,
  atualizadoNaImportacao: ID,
  tarefa: null,
  ...extra,
});
const LEAD = (id) => ({ id, name: `Aluno ${id}`, consultantId: `c-${id}`, consultantAuthUid: `uid-c-${id}` });
// A volta como o plano manda: sem `type` e sem `hora` (D5). O tipo é da
// gravação.
const VOLTA = (leadId, inicioFalta, extra = {}) => ({
  id: `volta_${leadId}_${inicioFalta}`,
  leadId,
  inicioFalta,
  voltouEm: '2026-10-03',
  voltouEntre: null,
  text: 'Voltou a treinar em 03/10',
  importacaoId: ID,
  lead: LEAD(leadId),
  ...extra,
});
const DIA = (hora, origens = ['catraca'], modalidades = []) => ({ hora, origens, modalidades });
const PRESENCA = (leadId, mes, dias) => ({ id: `${leadId}_${mes}`, doc: { leadId, mes, dias } });
const PLANO = (extra = {}) => ({
  recusa: null,
  prontoParaGravar: true,
  pendencias: { professoresNovos: [] },
  importacao: IMPORTACAO,
  estados: [],
  voltas: [],
  voltasDesfeitas: [],
  presencasPorDoc: [],
  nomesAlunos: [],
  config: { ultimaImportacao: ULTIMA },
  registro: REGISTRO,
  ...extra,
});
const montar = (plano = PLANO(), extra = {}) => montarGravacoes({ plano, quem: QUEM, carimbo: TS, ...extra });
const caminhos = (unidade) => unidade.map((op) => (op.id ? `${op.colecao}/${op.id}` : op.colecao));

describe('ids fixos (decisão D2, do planoImportacao.js)', () => {
  it('a importação tem o id das datas dos arquivos', () => {
    expect(idDaImportacao({ dataFaltantes: '2026-10-06', periodoPresencas: PERIODO })).toBe(ID);
    expect(idDaImportacao({ dataFaltantes: '2026-10-06', periodoPresencas: null })).toBe('f2026-10-06');
    expect(idDaImportacao({ dataFaltantes: null, periodoPresencas: PERIODO })).toBe('p2026-09-29_2026-10-05');
  });

  it('a linha "Voltou a treinar" tem id por aluno e período de falta', () => {
    expect(idDaVolta('L1', '2026-09-25')).toBe('volta_L1_2026-09-25');
    expect(voltaDoId('volta_L1_2026-09-25')).toEqual({ leadId: 'L1', inicioFalta: '2026-09-25' });
    expect(voltaDoId('volta_um_id_com_traco_2026-09-25')).toEqual({ leadId: 'um_id_com_traco', inicioFalta: '2026-09-25' });
  });

  it('id que não é de volta não vira aluno', () => {
    for (const ruim of ['presence_return_L1_2026-09-25', 'volta_L1', 'volta__2026-09-25', 'volta_L1_25/09/2026', null, 7]) {
      expect(voltaDoId(ruim), String(ruim)).toBeNull();
    }
  });

  it('id válido no Firestore', () => {
    expect(idValido('ana souza')).toBe(true);
    for (const ruim of ['', '.', '..', 'a/b', '__x__', null, 7]) expect(idValido(ruim), String(ruim)).toBe(false);
  });
});

describe('a linha "Voltou a treinar"', () => {
  it('a interação: tipo, texto, id fixo, autor, dono do lead e hora do servidor', () => {
    expect(montarVolta({ volta: VOLTA('L1', '2026-09-25'), importacaoId: ID, quem: QUEM, carimbo: TS })).toEqual({
      colecao: 'interacoes',
      id: 'volta_L1_2026-09-25',
      dados: {
        leadId: 'L1',
        leadName: 'Aluno L1',
        type: 'presence_return',
        text: 'Voltou a treinar em 03/10',
        voltouEm: '2026-10-03',
        voltouEntre: null,
        inicioFalta: '2026-09-25',
        importacaoId: ID,
        consultantName: 'Johnny',
        leadConsultantId: 'c-L1',
        leadConsultantAuthUid: 'uid-c-L1',
        actorId: 'g1',
        actorAuthUid: 'uid-g1',
        createdAt: TS,
      },
    });
    expect(PRESENCE_RETURN_TYPE).toBe('presence_return');
  });

  it('não conta no volume de ninguém e não mexe no lead', () => {
    const { dados } = montarVolta({
      volta: VOLTA('L1', '2026-09-25', { voltouEm: null, voltouEntre: { de: '2026-09-26', ate: '2026-10-06' }, text: 'Voltou a treinar entre 26/09 e 06/10' }),
      importacaoId: ID, quem: QUEM, carimbo: TS,
    });
    expect(dados).not.toHaveProperty('volumeKind');
    expect(dados).not.toHaveProperty('lastInteractionAt');
    expect(dados).not.toHaveProperty('interactionsCount');
    expect(dados.voltouEm).toBeNull();
    expect(dados.voltouEntre).toEqual({ de: '2026-09-26', ate: '2026-10-06' });
  });

  it('lead sem dono: os campos de segurança ficam com quem importou, como no logInteraction', () => {
    const { dados } = montarVolta({
      volta: VOLTA('L1', '2026-09-25', { lead: { id: 'L1', name: 'Aluno L1', consultantId: null, consultantAuthUid: null } }),
      importacaoId: ID, quem: QUEM, carimbo: TS,
    });
    expect(dados).toMatchObject({ leadConsultantId: 'g1', leadConsultantAuthUid: 'uid-g1' });
  });
});

describe('montarGravacoes', () => {
  it('cada aluno numa unidade, em ordem de id: o estado, a volta desfeita, a volta e os meses de presença', () => {
    const { importacaoId, unidades } = montar(PLANO({
      estados: [
        { leadId: 'L2', doc: ESTADO('L2') },
        { leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }) },
      ],
      voltas: [VOLTA('L1', '2026-09-25')],
      voltasDesfeitas: ['volta_L2_2026-09-10'],
      presencasPorDoc: [
        PRESENCA('L1', '2026-09', { '2026-09-30': DIA('07:00') }),
        PRESENCA('L1', '2026-10', { '2026-10-03': DIA('07:10') }),
        PRESENCA('L3', '2026-10', { '2026-10-01': DIA('19:00') }),
      ],
    }));
    expect(importacaoId).toBe(ID);
    expect(unidades.map(caminhos)).toEqual([
      ['faltosos/L1', 'interacoes/volta_L1_2026-09-25', 'presencas/L1_2026-09', 'presencas/L1_2026-10'],
      ['faltosos/L2', 'interacoes/volta_L2_2026-09-10'],
      ['presencas/L3_2026-10'],
    ]);
  });

  it('o estado vai inteiro, sem merge; a presença vai com merge; a volta desfeita é apagada', () => {
    const { unidades } = montar(PLANO({
      estados: [{ leadId: 'L2', doc: ESTADO('L2') }],
      voltasDesfeitas: ['volta_L2_2026-09-25'],
      presencasPorDoc: [PRESENCA('L2', '2026-10', { '2026-10-01': DIA(null, ['agenda'], ['Pilates']) })],
    }));
    const [estado, desfeita, mes] = unidades[0];
    expect(estado).toEqual({ colecao: 'faltosos', id: 'L2', dados: ESTADO('L2') });
    expect(estado.merge).toBeUndefined();
    expect(desfeita).toEqual({ colecao: 'interacoes', id: 'volta_L2_2026-09-25', apagar: true });
    expect(mes).toEqual({
      colecao: 'presencas', id: 'L2_2026-10', merge: true,
      dados: { leadId: 'L2', mes: '2026-10', dias: { '2026-10-01': DIA(null, ['agenda'], ['Pilates']) } },
    });
  });

  it('a linha desfeita e gravada de novo no mesmo plano não é apagada antes', () => {
    const { unidades } = montar(PLANO({
      estados: [{ leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-08' }) }],
      voltas: [VOLTA('L1', '2026-09-25', { voltouEm: '2026-10-08', text: 'Voltou a treinar em 08/10' })],
      voltasDesfeitas: ['volta_L1_2026-09-25'],
    }));
    expect(unidades.map(caminhos)).toEqual([['faltosos/L1', 'interacoes/volta_L1_2026-09-25']]);
    expect(unidades[0][1].apagar).toBeUndefined();
  });

  it('duas linhas de volta do mesmo aluno, mesmo de períodos diferentes, não gravam: o plano manda só a mais recente', () => {
    expect(() => montar(PLANO({
      estados: [{ leadId: 'L1', doc: ESTADO('L1', { ultimaPresenca: '2026-10-08', inicioFalta: '2026-09-30', status: 'voltou', voltouEm: '2026-10-08' }) }],
      voltas: [
        VOLTA('L1', '2026-09-20', { voltouEm: null, voltouEntre: { de: '2026-09-21', ate: '2026-09-30' }, text: 'Voltou a treinar entre 21/09 e 30/09' }),
        VOLTA('L1', '2026-09-30', { voltouEm: '2026-10-08', text: 'Voltou a treinar em 08/10' }),
      ],
    }))).toThrow(/duas linhas de volta do aluno L1/);
  });

  it('as ligações vêm primeiro: a lista de professores, com merge, e cada nome da Next Fit', () => {
    const { unidades } = montar(PLANO({
      estados: [{ leadId: 'L2', doc: ESTADO('L2') }],
      nomesAlunos: [{ id: 'caio reis', doc: { nomeNextFit: 'Caio  Reis', leadIds: ['L2', 'L2'], origem: 'telefone' } }],
      config: {
        ultimaImportacao: ULTIMA,
        professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }, { nome: 'Controle (não alterar)', professorId: null }],
      },
    }));
    expect(unidades[0]).toEqual([{
      colecao: 'config',
      merge: true,
      dados: { professorLinks: [{ nome: 'Ana Prof', professorId: 'p1' }, { nome: 'Controle (não alterar)', professorId: null }] },
    }]);
    expect(unidades[1]).toEqual([{
      colecao: 'alunos', id: 'caio reis',
      dados: { nomeNextFit: 'Caio  Reis', leadIds: ['L2'], origem: 'telefone', atualizadoEm: TS },
    }]);
    expect(caminhos(unidades[2])).toEqual(['faltosos/L2']);
  });

  it('sem professorLinks na configuração do plano, a lista de professores não é gravada', () => {
    const { unidades } = montar(PLANO({ estados: [{ leadId: 'L2', doc: ESTADO('L2') }] }));
    expect(unidades.flat().some((op) => op.colecao === 'config')).toBe(false);
  });

  it('o fecho: o registro com quem importou e quando, e a última importação com merge', () => {
    expect(montar().fecho).toEqual([
      {
        colecao: 'importacoes',
        id: ID,
        dados: { ...REGISTRO, importadoPor: 'g1', importadoPorNome: 'Johnny', importadoEm: TS },
      },
      {
        colecao: 'config',
        merge: true,
        dados: { ultimaImportacao: { ...ULTIMA, importadoEm: TS, importadoPorNome: 'Johnny' } },
      },
    ]);
  });

  it('o registro guarda os números da prévia confirmada, e não os do plano refeito', () => {
    const refeito = PLANO({ registro: { ...REGISTRO, numeros: { voltaram: 0 } } });
    expect(montarGravacoes({ plano: refeito, registro: REGISTRO, quem: QUEM, carimbo: TS }).fecho[0].dados.numeros)
      .toEqual(REGISTRO.numeros);
  });

  it('aviso com campo sem valor sai limpo do registro, sem travar a importação', () => {
    const { fecho } = montar(PLANO({ registro: { ...REGISTRO, avisos: [{ codigo: 'buraco_presencas', mensagem: undefined }] } }));
    expect(fecho[0].dados.avisos).toEqual([{ codigo: 'buraco_presencas' }]);
  });

  it('registro que já existe: o fecho só troca os não ligados e diz quando foi refeita', () => {
    expect(montar(PLANO(), { registroJaExiste: true }).fecho).toEqual([{
      colecao: 'importacoes',
      id: ID,
      merge: true,
      dados: { naoLigados: REGISTRO.naoLigados, refeitaEm: TS, refeitaPorNome: 'Johnny' },
    }]);
  });

  it('nunca grava no lead', () => {
    const { unidades, fecho } = montar(PLANO({
      estados: [{ leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }) }],
      voltas: [VOLTA('L1', '2026-09-25')],
      presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-10-03': DIA('07:10') })],
      nomesAlunos: [{ id: 'aluno l1', doc: { nomeNextFit: 'Aluno L1', leadIds: ['L1'], origem: 'telefone' } }],
    }));
    const colecoes = new Set([...unidades.flat(), ...fecho].map((op) => op.colecao));
    expect([...colecoes].sort()).toEqual(['alunos', 'config', 'faltosos', 'importacoes', 'interacoes', 'presencas']);
  });
});

describe('plano com defeito não grava nada', () => {
  const recusa = (extra, opcoes) => expect(() => montar(PLANO(extra), opcoes));

  it('plano com recusa, com professor novo sem ligação ou com o id que não bate com as datas', () => {
    expect(() => conferirPlano(PLANO({ recusa: { codigo: 'faltantes_antigo', mensagem: 'x' } }))).toThrow(/recusa \(faltantes_antigo\)/);
    expect(() => conferirPlano(null)).toThrow(/sem plano/);
    recusa({ prontoParaGravar: false }).toThrow(/professor novo/);
    recusa({ importacao: { ...IMPORTACAO, id: 'outro' } }).toThrow(/não bate com as datas/);
  });

  it('estado sem leadId, repetido, com outro leadId dentro ou com status desconhecido', () => {
    recusa({ estados: [{ leadId: 'a/b', doc: ESTADO('a/b') }] }).toThrow(/estados\[0\] sem leadId/);
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L1') }, { leadId: 'L1', doc: ESTADO('L1') }] }).toThrow(/dois estados/);
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L2') }] }).toThrow(/outro leadId/);
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L1', { status: 'sumiu' }) }] }).toThrow(/status desconhecido/);
  });

  it('volta sem o estado do aluno no mesmo plano', () => {
    recusa({ voltas: [VOLTA('L1', '2026-09-25')] }).toThrow(/sem o estado dele/);
    recusa({ voltasDesfeitas: ['volta_L1_2026-09-25'] }).toThrow(/volta desfeita do aluno L1 sem o estado/);
  });

  it('volta com id fora do formato, sem dia, com dia e intervalo, sem texto ou repetida', () => {
    const estados = [{ leadId: 'L1', doc: ESTADO('L1', { status: 'voltou', voltouEm: '2026-10-03' }) }];
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { id: 'presence_return_L1_2026-09-25' })] }).toThrow(/fora do formato/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { voltouEm: null })] }).toThrow(/um só/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { voltouEntre: { de: '2026-09-26', ate: '2026-10-06' } })] }).toThrow(/um só/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25', { text: ' ' })] }).toThrow(/sem texto/);
    recusa({ estados, voltas: [VOLTA('L1', '2026-09-25'), VOLTA('L1', '2026-09-25')] }).toThrow(/duas linhas/);
    recusa({ estados, voltasDesfeitas: ['volta_L1'] }).toThrow(/voltasDesfeitas\[0\] com id fora do formato/);
  });

  it('presença com id trocado, dia de outro mês, hora fora do formato ou origem desconhecida', () => {
    recusa({ presencasPorDoc: [{ id: 'L1_2026_10', doc: { leadId: 'L1', mes: '2026-10', dias: { '2026-10-01': DIA('07:00') } } }] }).toThrow(/em vez de L1_2026-10/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-09-30': DIA('07:00') })] }).toThrow(/fora do mês/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-10-01': DIA('7h') })] }).toThrow(/hora do dia/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', { '2026-10-01': DIA('07:00', ['portaria']) })] }).toThrow(/origem do dia/);
    recusa({ presencasPorDoc: [PRESENCA('L1', '2026-10', {})] }).toThrow(/sem dias/);
  });

  it('campo sem valor (undefined) em qualquer lugar do estado', () => {
    recusa({ estados: [{ leadId: 'L1', doc: ESTADO('L1', { urgente: undefined }) }] }).toThrow(/undefined.*faltosos\/L1: urgente/);
  });

  it('professor da Next Fit repetido ou sem escolha; nome de aluno sem chave, sem aluno, com origem estranha ou repetido', () => {
    const comLinks = (professorLinks) => ({ config: { ultimaImportacao: ULTIMA, professorLinks } });
    recusa(comLinks([{ nome: 'Ana', professorId: 'p1' }, { nome: 'Ana', professorId: null }])).toThrow(/professorLinks\[1\] repetido/);
    recusa(comLinks([{ nome: 'Ana' }])).toThrow(/Sem professor/);
    recusa(comLinks('Ana')).toThrow(/precisa ser uma lista/);
    const nome = (id, doc) => ({ nomesAlunos: [{ id, doc }] });
    recusa(nome('', { nomeNextFit: 'X', leadIds: ['L1'], origem: 'manual' })).toThrow(/nomesAlunos\[0\] sem chave/);
    recusa(nome('x', { nomeNextFit: 'X', leadIds: [], origem: 'manual' })).toThrow(/sem aluno/);
    recusa(nome('x', { nomeNextFit: 'X', leadIds: ['L1'], origem: 'nome' })).toThrow(/origem/);
    const a = { id: 'x', doc: { nomeNextFit: 'X', leadIds: ['L1'], origem: 'manual' } };
    recusa({ nomesAlunos: [a, a] }).toThrow(/nomesAlunos\[1\] repetido/);
  });

  it('a última importação do plano sem o id desta importação', () => {
    recusa({ config: { ultimaImportacao: { ...ULTIMA, id: 'outra' } } }).toThrow(/última importação/);
  });

  // O erro pode ir para o Sentry: nome de aluno e de professor fica de fora.
  it('a mensagem de erro não leva nome de aluno nem de professor', () => {
    const maria = (doc) => ({ nomesAlunos: [{ id: 'maria souza', doc: { nomeNextFit: 'Maria Souza', leadIds: ['L1'], origem: 'manual', ...doc } }] });
    const casos = [
      [maria({ leadIds: [] })],
      [maria({ origem: 'x' })],
      [{ config: { ultimaImportacao: ULTIMA, professorLinks: [{ nome: 'Rafael Prof', professorId: 'p1' }, { nome: 'Rafael Prof', professorId: 'p2' }] } }],
      [maria({}), { carimbo: undefined }],
    ];
    for (const [extra, opcoes] of casos) {
      let mensagem = '';
      try { montar(PLANO(extra), opcoes); } catch (e) { mensagem = e.message; }
      expect(mensagem).not.toBe('');
      expect(mensagem).not.toMatch(/maria|rafael/i);
    }
  });
});

describe('empacotarEmLotes', () => {
  const unidade = (n, p = 'u') => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }));

  it('lotes de até 500 gravações, na ordem, sem partir unidade', () => {
    const unidades = Array.from({ length: 300 }, (_, i) => unidade(2, `a${i}-`));
    const lotes = empacotarEmLotes(unidades);
    expect(LIMITE_POR_LOTE).toBe(500);
    expect(lotes.map((l) => l.length)).toEqual([500, 100]);
    expect(lotes.flat()).toEqual(unidades.flat());
  });

  it('a unidade que não cabe no lote começa o seguinte', () => {
    const lotes = empacotarEmLotes([unidade(3, 'a'), unidade(3, 'b'), unidade(3, 'c')], 7);
    expect(lotes.map((l) => l.map((op) => op.id))).toEqual([['a0', 'a1', 'a2', 'b0', 'b1', 'b2'], ['c0', 'c1', 'c2']]);
  });

  it('unidade vazia some, e unidade maior que o lote recusa', () => {
    expect(empacotarEmLotes([[], unidade(1)], 5)).toEqual([[{ id: 'u0' }]]);
    expect(() => empacotarEmLotes([unidade(6)], 5)).toThrow(/acima de 5/);
  });
});

describe('outra importação entrou com a janela aberta', () => {
  it('a última importação no servidor tem de ser a que a janela leu, ou esta mesma', () => {
    expect(outraImportacaoEntrou({ noServidor: { id: 'a' }, lida: { id: 'a' }, importacaoId: ID })).toBe(false);
    expect(outraImportacaoEntrou({ noServidor: { id: ID }, lida: { id: 'a' }, importacaoId: ID })).toBe(false);
    expect(outraImportacaoEntrou({ noServidor: null, lida: null, importacaoId: ID })).toBe(false);
    expect(outraImportacaoEntrou({ noServidor: { id: 'b' }, lida: { id: 'a' }, importacaoId: ID })).toBe(true);
    expect(outraImportacaoEntrou({ noServidor: { id: 'b' }, lida: null, importacaoId: ID })).toBe(true);
  });

  it('o erro tem código, como os do Firestore, para a tela escolher a mensagem', () => {
    const erro = erroDaGravacao(ERRO_OUTRA_IMPORTACAO, 'texto');
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: 'outra-importacao', message: 'texto' });
  });
});

describe('caminhoIndefinido e semIndefinidos', () => {
  it('acha o undefined em objeto e lista, e trata o resto como folha', () => {
    expect(caminhoIndefinido({ a: 1, b: { c: [1, undefined] } })).toBe('b.c[1]');
    expect(caminhoIndefinido({ a: null, b: [] })).toBeNull();
    class Hora { constructor() { this.x = undefined; } }
    expect(caminhoIndefinido({ quando: new Hora() })).toBeNull();
  });

  it('tira o campo sem valor do objeto e troca o item sem valor da lista por null', () => {
    expect(semIndefinidos({ a: 1, b: undefined, c: [1, undefined, { d: undefined }] })).toEqual({ a: 1, c: [1, null, {}] });
  });
});

// O plano de verdade, das planilhas falsas até as gravações: é aqui que a
// saída do planejarImportacao e a entrada da gravação se encontram.
describe('o plano de verdade vira gravações', () => {
  const brt = (s) => new Date(`${s}:00-03:00`);
  const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
  const fone = (n) => `(51) 9 9100-${String(n).padStart(4, '0')}`;
  const cliente = (id, name, n) => ({
    id, name, whatsapp: fone(n), lifecycleBucket: 'cliente', consultantId: 'cons-1', consultantAuthUid: 'uid-cons-1',
    currentContractId: `c-${id}`, currentContractStatus: 'ativo',
    currentContractStartsAt: brt('2026-01-10T00:00'), currentContractEndsAt: brt('2027-06-10T00:00'),
  });
  const CLIENTES = [cliente('ana', 'Ana Teste', 1), cliente('bia', 'Bia Teste', 2)];
  const PROFESSORES = [{ id: 'p-ana', nome: 'Ana Paula Ribeiro', ativo: true }, { id: 'p-bruno', nome: 'Bruno Tavares', ativo: true }];
  const LINKS = [{ nome: 'Ana Paula Ribeiro', professorId: 'p-ana' }, { nome: 'Bruno Tavares', professorId: 'p-bruno' }];
  const CONFIG = { marcos: [7, 14, 30, 60], janelaUrgenteDias: 90, professorLinks: LINKS };
  // Linha do Faltantes de quem está há `dias` dias sem vir no dia `e`.
  const linhaF = (nome, n, ultimaPresenca, dias, professor) => ({
    Nome: nome, Contrato: 'Plano Anual', 'Qtde de ausências': dias, 'Última presença': br(ultimaPresenca),
    Telefone: fone(n), Professor: professor, Consultor: 'Carla Mendes',
  });
  const arquivoF = (linhas) => parseFaltantes(linhas.map((l, i) => ({ __row: i + 2, ...l })));
  const arquivoP = (linhas) => parsePresencas(linhas.map((l, i) => ({ __row: i + 2, ...l })));
  const planejar = ({ faltantes = null, presencas = null, estados = {}, nomes = {}, ultimaImportacao = null, agora }) => planejarImportacao({
    faltantes,
    presencas,
    estadosAtuais: estados,
    presencasAtuais: {},
    clientes: CLIENTES,
    professores: PROFESSORES,
    ligacoes: { professores: LINKS, alunos: nomes, manuais: [] },
    config: { ...CONFIG, ultimaImportacao },
    agora,
  });

  it('primeira semana e semana seguinte, com a volta e a presença do aluno na mesma unidade', () => {
    // Semana 1, Faltantes de 06/10: Ana sem vir desde 29/09 e Bia desde 23/09.
    const plano1 = planejar({
      faltantes: arquivoF([
        linhaF('Ana Teste', 1, '2026-09-29', 7, 'Ana Paula Ribeiro'),
        linhaF('Bia Teste', 2, '2026-09-23', 13, 'Bruno Tavares'),
      ]),
      agora: brt('2026-10-06T10:00'),
    });
    const g1 = montarGravacoes({ plano: plano1, quem: QUEM, carimbo: TS });
    expect(g1.importacaoId).toBe('f2026-10-06');
    expect(g1.unidades.flat().filter((op) => op.colecao === 'faltosos').map((op) => op.id)).toEqual(['ana', 'bia']);
    expect(g1.fecho.map((op) => (op.id ? `${op.colecao}/${op.id}` : op.colecao))).toEqual(['importacoes/f2026-10-06', 'config']);
    expect(g1.fecho[1].dados.ultimaImportacao).toMatchObject({ id: 'f2026-10-06', dataFaltantes: '2026-10-06', importadoPorNome: 'Johnny' });

    // O que a gravação deixaria no banco.
    const estados = Object.fromEntries(plano1.estados.map((e) => [e.leadId, e.doc]));
    const nomes = Object.fromEntries(plano1.nomesAlunos.map((n) => [n.id, n.doc]));

    // Semana 2: o Faltantes de 13/10 traz só a Bia, e o Presenças mostra a Ana
    // na catraca em 08/10.
    const plano2 = planejar({
      faltantes: arquivoF([linhaF('Bia Teste', 2, '2026-09-23', 20, 'Bruno Tavares')]),
      presencas: arquivoP([{ Cliente: 'Ana Teste', Modalidade: 'offf', Contrato: 'Plano Anual', Tipo: 'Acesso', Data: '08/10/2026 07:10' }]),
      estados,
      nomes,
      ultimaImportacao: plano1.config.ultimaImportacao,
      agora: brt('2026-10-13T10:00'),
    });
    const g2 = montarGravacoes({ plano: plano2, quem: QUEM, carimbo: TS });
    expect(g2.importacaoId).toBe('f2026-10-13_p2026-10-08_2026-10-08');
    const daAna = g2.unidades.find((u) => u.some((op) => op.colecao === 'faltosos' && op.id === 'ana'));
    expect(caminhos(daAna)).toEqual(['faltosos/ana', 'interacoes/volta_ana_2026-09-29', 'presencas/ana_2026-10']);
    expect(daAna[1].dados).toMatchObject({ type: 'presence_return', text: 'Voltou a treinar em 08/10', voltouEm: '2026-10-08', inicioFalta: '2026-09-29' });
    expect(daAna[0].dados).toMatchObject({ status: 'voltou', voltouEm: '2026-10-08' });
  });
});

// Mesmo leitor de imports de guardianImports.test.js e newLeadImports.test.js.
describe('lotesImportacao.js é puro', () => {
  const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
  const stripComments = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
  const REPO = fileURLToPath(new URL('../../../', import.meta.url));

  it('não chega a pacote, ao Firebase, à Meta Diária nem à gravação', () => {
    const arquivos = new Set();
    const pacotes = new Set();
    const visitar = (arquivo) => {
      if (arquivos.has(arquivo)) return;
      arquivos.add(arquivo);
      for (const m of stripComments(readFileSync(arquivo, 'utf8')).matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        if (spec.startsWith('.')) visitar(path.resolve(path.dirname(arquivo), spec));
        else pacotes.add(spec);
      }
    };
    visitar(path.join(REPO, 'src/lib/faltosos/lotesImportacao.js'));
    const relativos = [...arquivos].map((f) => path.relative(REPO, f).split(path.sep).join('/'));
    expect([...pacotes]).toEqual([]);
    const proibidos = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js', 'src/lib/interactions.js', 'src/lib/faltosos/gravarImportacao.js'];
    expect(relativos.filter((f) => proibidos.includes(f) || f.endsWith('.jsx'))).toEqual([]);
  });
});
