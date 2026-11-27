// O plano da importação (src/lib/faltosos/planoImportacao.js): comparação com
// a importação anterior, marcos, tarefas, urgente, presenças por dia, avisos,
// recusas e o que é gravado. As planilhas são falsas, com o cabeçalho das de
// verdade e nomes e telefones inventados. `aplicar` faz o papel da gravação,
// para conferir que a mesma importação duas vezes não muda nada.
import { describe, it, expect } from 'vitest';
import {
  planejarImportacao, e0Da, idDaImportacao, idDaVolta, textoDaVolta, STATUS, TAREFA,
} from '../faltosos/planoImportacao.js';
import { parseFaltantes, parsePresencas } from '../faltosos/nextfitArquivos.js';
import { somarDias } from '../faltosos/dias.js';

const brt = (s) => new Date(`${s}:00-03:00`);
const fimContrato = (dia) => brt(`${dia}T00:00`);
const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

const E1 = '2026-10-06';
const AGORA1 = brt('2026-10-06T10:00');
const E2 = '2026-10-13';
const AGORA2 = brt('2026-10-13T10:00');
const E3 = '2026-10-20';
const AGORA3 = brt('2026-10-20T10:00');

const fone = (n) => `(51) 9 9100-${String(n).padStart(4, '0')}`;
const cliente = (id, name, n, extra = {}) => ({
  id,
  name,
  whatsapp: fone(n),
  lifecycleBucket: 'cliente',
  consultantId: 'cons-1',
  consultantAuthUid: 'uid-cons-1',
  currentContractId: `c-${id}`,
  currentContractStatus: 'ativo',
  currentContractStartsAt: fimContrato('2026-01-10'),
  currentContractEndsAt: fimContrato('2027-06-10'),
  ...extra,
});

// Linha do Faltantes de quem está há `dias` dias sem vir na data `e`.
const linhaF = (nome, n, e, dias, professor = 'Ana Paula Ribeiro') => ({
  Nome: nome,
  Contrato: 'Plano Anual',
  'Qtde de ausências': dias,
  'Última presença': br(somarDias(e, -dias)),
  Telefone: n == null ? '' : fone(n),
  Professor: professor,
  Consultor: 'Carla Mendes',
});
const arquivoF = (linhas) => parseFaltantes(linhas.map((l, i) => ({ __row: i + 2, ...l })));
const linhaP = (nome, dia, hora, tipo = 'Acesso', modalidade = 'offf') => ({
  Cliente: nome, Modalidade: modalidade, Contrato: 'Plano Anual', Tipo: tipo, Data: `${br(dia)} ${hora}`,
});
const arquivoP = (linhas) => parsePresencas(linhas.map((l, i) => ({ __row: i + 2, ...l })));

const PROFESSORES = [
  { id: 'p-ana', nome: 'Ana Paula Ribeiro', ativo: true },
  { id: 'p-bruno', nome: 'Bruno Tavares', ativo: true },
];
const LINKS = [
  { nome: 'Ana Paula Ribeiro', professorId: 'p-ana' },
  { nome: 'Bruno Tavares', professorId: 'p-bruno' },
  { nome: 'Controle (não alterar)', professorId: null },
];
const CONFIG = { marcos: [7, 14, 30, 60], janelaUrgenteDias: 90, professorLinks: LINKS };

const CLIENTES = [
  cliente('ana', 'Ana Teste', 1),
  cliente('bia', 'Bia Teste', 2),
  cliente('caio', 'Caio Teste', 3),
  cliente('duda', 'Duda Teste', 4),
  cliente('edu', 'Edu Teste', 5),
  cliente('fabi', 'Fabi Teste', 6, { currentContractStatus: 'trancado' }),
  cliente('gui', 'Gui Teste', 7, { currentContractEndsAt: fimContrato('2026-10-01') }),
  cliente('helo', 'Helo Teste', 8),
  cliente('ivo', 'Ivo Teste', 9),
];

const SEMANA1 = arquivoF([
  linhaF('Ana Teste', 1, E1, 7),
  linhaF('Bia Teste', 2, E1, 13, 'Bruno Tavares'),
  linhaF('Caio Teste', 3, E1, 20),
  linhaF('Duda Teste', 4, E1, 25, 'Bruno Tavares'),
  linhaF('Edu Teste', 5, E1, 400),
  linhaF('Fabi Teste', 6, E1, 10),
  linhaF('Gui Teste', 7, E1, 8),
  linhaF('Helo Teste', 8, E1, 9, 'Controle (não alterar)'),
  linhaF('Ninguém Teste', 99, E1, 12),
]);

const MUNDO_VAZIO = { estados: {}, presencas: {}, nomes: {}, interacoes: {}, config: CONFIG };

const planejar = (mundo, { faltantes = null, presencas = null, agora, clientes = CLIENTES, manuais = [], links } = {}) => planejarImportacao({
  faltantes,
  presencas,
  estadosAtuais: mundo.estados,
  presencasAtuais: mundo.presencas,
  clientes,
  professores: PROFESSORES,
  ligacoes: { professores: links ?? mundo.config.professorLinks, alunos: mundo.nomes, manuais },
  config: mundo.config,
  agora,
});

// O que a gravação faria com o plano.
const aplicar = (mundo, plano) => {
  expect(plano.recusa).toBeNull();
  const estados = { ...mundo.estados };
  for (const { leadId, doc } of plano.estados) estados[leadId] = doc;
  const presencas = { ...mundo.presencas };
  for (const { id, doc } of plano.presencasPorDoc) presencas[id] = doc;
  const nomes = { ...mundo.nomes };
  for (const { id, doc } of plano.nomesAlunos) nomes[id] = doc;
  const interacoes = { ...mundo.interacoes };
  for (const id of plano.voltasDesfeitas) delete interacoes[id];
  for (const v of plano.voltas) interacoes[v.id] = v;
  return { estados, presencas, nomes, interacoes, config: { ...mundo.config, ...plano.config } };
};

const nadaMuda = (plano) => {
  expect(plano.estados).toEqual([]);
  expect(plano.voltas).toEqual([]);
  expect(plano.voltasDesfeitas).toEqual([]);
  expect(plano.presencasPorDoc).toEqual([]);
  expect(plano.nomesAlunos).toEqual([]);
};

const estadoDe = (plano, leadId) => plano.estados.find((e) => e.leadId === leadId)?.doc;

const ID1 = 'f2026-10-06';

describe('recusas', () => {
  it('sem arquivo nenhum', () => {
    expect(planejar(MUNDO_VAZIO, { agora: AGORA1 }).recusa).toEqual({ codigo: 'sem_arquivo', mensagem: 'Escolha o relatório Faltantes, o Presenças ou os dois.' });
  });

  it('Faltantes sem nenhuma linha legível', () => {
    const plano = planejar(MUNDO_VAZIO, { faltantes: parseFaltantes([{ __row: 2, Nome: 'X', 'Última presença': 'ontem' }]), agora: AGORA1 });
    expect(plano.recusa.codigo).toBe('faltantes_sem_data');
    expect(plano.estados).toEqual([]);
    expect(plano.prontoParaGravar).toBe(false);
  });

  it('Presenças sozinho sem nenhuma linha legível', () => {
    const plano = planejar(MUNDO_VAZIO, { presencas: parsePresencas([{ __row: 2, Cliente: 'X', Tipo: 'Acesso', Data: 'ontem' }]), agora: AGORA1 });
    expect(plano.recusa).toEqual({
      codigo: 'presencas_sem_data',
      mensagem: 'Nenhuma linha do Presenças tem o cliente, o tipo e a data legíveis. Confira se é o relatório Presenças da Next Fit.',
    });
  });

  it('Faltantes mais antigo que o último importado', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: 'f2026-10-13', dataFaltantes: E2 } } };
    const plano = planejar(mundo, { faltantes: SEMANA1, agora: AGORA2 });
    expect(plano.recusa).toEqual({
      codigo: 'faltantes_antigo',
      mensagem: 'Este Faltantes é de 06/10/2026, mais antigo que o último importado, de 13/10/2026. Exporte o relatório de hoje.',
    });
  });

  it('com a mesma data do último, não é recusado', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1 } } };
    expect(planejar(mundo, { faltantes: SEMANA1, agora: AGORA1 }).recusa).toBeNull();
  });
});

describe('primeira importação', () => {
  const plano = planejar(MUNDO_VAZIO, { faltantes: SEMANA1, agora: AGORA1 });

  it('a data sai do conteúdo, e E0 é E menos 7 dias', () => {
    expect(plano.importacao).toEqual({ id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29', periodoPresencas: null });
    expect(plano.prontoParaGravar).toBe(true);
  });

  it('cada aluno ativo ganha o estado, com a tarefa do marco atravessado', () => {
    expect(estadoDe(plano, 'ana')).toEqual({
      leadId: 'ana',
      professorId: 'p-ana',
      professorNextFit: 'Ana Paula Ribeiro',
      contratoNextFit: 'Plano Anual',
      urgente: false,
      contratoTerminaEm: '2027-06-10',
      atualizadoNaImportacao: ID1,
      ultimaPresenca: '2026-09-29',
      inicioFalta: '2026-09-29',
      status: STATUS.FALTANDO,
      voltouEm: null,
      voltouEntre: null,
      diasNaImportacao: 7,
      querCancelarEm: null,
      tarefa: {
        marco: 7, urgente: false, status: TAREFA.PENDENTE, inicioFalta: '2026-09-29', criadaEm: E1, importacaoId: ID1,
        feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null,
      },
    });
    expect(estadoDe(plano, 'caio').tarefa.marco).toBe(14);
    expect(estadoDe(plano, 'duda').tarefa).toBeNull();
    expect(estadoDe(plano, 'edu').tarefa).toBeNull();
    expect(estadoDe(plano, 'helo')).toMatchObject({ professorId: null, tarefa: { marco: 7 } });
  });

  it('quem está sem contrato ativo ou trancado não ganha estado e aparece na prévia', () => {
    expect(estadoDe(plano, 'fabi')).toBeUndefined();
    expect(estadoDe(plano, 'gui')).toBeUndefined();
    expect(plano.previa.listas.foraSemContrato).toEqual([
      { leadId: 'fabi', nome: 'Fabi Teste', motivo: 'trancado' },
      { leadId: 'gui', nome: 'Gui Teste', motivo: 'sem_contrato_ativo' },
    ]);
  });

  it('os números da prévia', () => {
    expect(plano.previa.numeros).toEqual({
      linhasFaltantes: 9,
      linhasPresencas: 0,
      errosFaltantes: 0,
      errosPresencas: 0,
      ligadosFaltantes: 8,
      naoLigadosFaltantes: 1,
      alunosNoPresencas: 0,
      naoLigadosPresencas: 0,
      duplicados: 0,
      faltando: 6,
      entramNoMarco: { 7: 3, 14: 1, 30: 0, 60: 0 },
      urgentes: 0,
      urgentesNovos: 0,
      tarefasPendentes: 4,
      acompanhamento: 2,
      semProfessor: 1,
      voltaram: 0,
      encerrados: 0,
      foraSemContrato: 2,
      provaveis: 0,
      diasDePresenca: 0,
    });
    expect(plano.previa.porProfessor).toEqual([
      { professorId: 'p-ana', nome: 'Ana Paula Ribeiro', alunos: 3, pendentes: 2, urgentes: 0 },
      { professorId: 'p-bruno', nome: 'Bruno Tavares', alunos: 2, pendentes: 1, urgentes: 0 },
      { professorId: null, nome: null, alunos: 1, pendentes: 1, urgentes: 0 },
    ]);
  });

  it('o não ligado vai para a prévia e para o registro, com o telefone', () => {
    expect(plano.previa.listas.naoLigados.faltantes).toEqual([{
      numero: 10, nome: 'Ninguém Teste', telefone: fone(99), professorNextFit: 'Ana Paula Ribeiro',
      ultimaPresenca: '2026-09-24', ausencias: 12, sugestao: null,
    }]);
    expect(plano.registro.naoLigados).toEqual([{ nome: 'Ninguém Teste', telefone: fone(99), relatorio: 'faltantes' }]);
  });

  it('guarda o nome da Next Fit de quem ligou pelo telefone', () => {
    expect(plano.nomesAlunos).toHaveLength(8);
    expect(plano.nomesAlunos[0]).toEqual({ id: 'ana teste', doc: { nomeNextFit: 'Ana Teste', leadIds: ['ana'], origem: 'telefone' } });
  });

  it('a configuração guarda a última importação, sem Presenças ainda, e o registro leva os números', () => {
    expect(plano.config).toEqual({
      ultimaImportacao: { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29', periodoPresencas: null, ultimoDiaPresencas: null },
    });
    expect(plano.registro).toMatchObject({ dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29', periodoPresencas: null, avisos: [] });
    expect(plano.registro.numeros).toEqual(plano.previa.numeros);
    expect(plano.avisos).toEqual([]);
  });

  it('importar de novo os mesmos arquivos não muda nada', () => {
    const mundo = aplicar(MUNDO_VAZIO, plano);
    const deNovo = planejar(mundo, { faltantes: SEMANA1, agora: AGORA1 });
    nadaMuda(deNovo);
    expect(deNovo.importacao.dataFaltantesAnterior).toBe('2026-09-29');
  });

  it('refazer a mesma data com um aluno ligado à mão dá a ele a tarefa que a primeira teria dado', () => {
    const mundo = aplicar(MUNDO_VAZIO, plano);
    const clientes = [...CLIENTES, cliente('nina', 'Nina Teste', 50)];
    const deNovo = planejar(mundo, { faltantes: SEMANA1, agora: AGORA1, clientes, manuais: [{ nomeNextFit: 'Ninguém Teste', leadId: 'nina' }] });
    expect(deNovo.estados.map((e) => e.leadId)).toEqual(['nina']);
    expect(estadoDe(deNovo, 'nina').tarefa).toMatchObject({ marco: 7, status: TAREFA.PENDENTE });
    expect(deNovo.nomesAlunos).toEqual([{ id: 'ninguem teste', doc: { nomeNextFit: 'Ninguém Teste', leadIds: ['nina'], origem: 'manual' } }]);
  });
});

describe('professor novo', () => {
  it('para no passo curto, com a sugestão, e não deixa gravar', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7, 'Carla Nova Souza'), linhaF('Bia Teste', 2, E1, 8, 'Bruno Tav')]);
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1 });
    expect(plano.prontoParaGravar).toBe(false);
    expect(plano.pendencias.professoresNovos).toEqual([
      { nome: 'Bruno Tav', alunos: 1, sugestao: null },
      { nome: 'Carla Nova Souza', alunos: 1, sugestao: null },
    ]);
    expect(estadoDe(plano, 'ana').professorId).toBeNull();
  });

  it('com as escolhas do passo curto, segue e guarda as ligações novas', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7, 'Carla Nova Souza')]);
    const links = [...LINKS, { nome: 'Carla Nova Souza', professorId: 'p-ana' }];
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1, links });
    expect(plano.prontoParaGravar).toBe(true);
    expect(estadoDe(plano, 'ana').professorId).toBe('p-ana');
    expect(plano.config.professorLinks).toEqual([
      { nome: 'Ana Paula Ribeiro', professorId: 'p-ana' },
      { nome: 'Bruno Tavares', professorId: 'p-bruno' },
      { nome: 'Carla Nova Souza', professorId: 'p-ana' },
      { nome: 'Controle (não alterar)', professorId: null },
    ]);
  });

  it('a ligação trocada em Configurações vale na importação seguinte, e a tarefa pendente vai junto', () => {
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7)]), agora: AGORA1 }));
    expect(mundo.estados.ana.professorId).toBe('p-ana');
    const trocado = { ...mundo, config: { ...mundo.config, professorLinks: LINKS.map((l) => (l.nome === 'Ana Paula Ribeiro' ? { ...l, professorId: 'p-bruno' } : l)) } };
    const plano = planejar(trocado, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14)]), agora: AGORA2 });
    expect(estadoDe(plano, 'ana')).toMatchObject({ professorId: 'p-bruno', professorNextFit: 'Ana Paula Ribeiro', tarefa: { marco: 14, status: TAREFA.PENDENTE } });
    expect(plano.config.professorLinks).toBeUndefined();
  });
});

describe('a semana seguinte', () => {
  // A primeira importação gravada, a tarefa da Bia feita pelo professor e o
  // contrato da Helo cancelado depois.
  const depoisDaPrimeira = (() => {
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: SEMANA1, agora: AGORA1 }));
    const bia = mundo.estados.bia;
    return {
      ...mundo,
      estados: { ...mundo.estados, bia: { ...bia, tarefa: { ...bia.tarefa, status: TAREFA.FEITA, feitaPor: 'u-prof', resultado: 'respondeu' } } },
    };
  })();
  const clientes = CLIENTES.map((c) => (c.id === 'helo' ? { ...c, currentContractStatus: 'cancelado' } : c));
  const faltantes = arquivoF([
    linhaF('Ana Teste', 1, E2, 14),
    linhaF('Bia Teste', 2, E2, 20, 'Bruno Tavares'),
    linhaF('Caio Teste', 3, E2, 27),
    linhaF('Ivo Teste', 9, E2, 8),
  ]);
  const presencas = arquivoP([
    linhaP('Duda Teste', '2026-10-09', '07:15'),
    linhaP('Duda Teste', '2026-10-09', '18:00', 'Agenda', 'Pilates'),
    linhaP('Duda Teste', '2026-10-11', '08:00', 'Acesso', ''),
    linhaP('Desconhecido Teste', '2026-10-10', '09:00'),
  ]);
  const plano = planejar(depoisDaPrimeira, { faltantes, presencas, agora: AGORA2, clientes });
  const ID2 = 'f2026-10-13_p2026-10-09_2026-10-11';

  it('E0 é a data do Faltantes anterior', () => {
    expect(plano.importacao).toEqual({ id: ID2, dataFaltantes: E2, dataFaltantesAnterior: E1, periodoPresencas: { de: '2026-10-09', ate: '2026-10-11' } });
  });

  it('a tarefa pendente troca de marco no mesmo card', () => {
    expect(estadoDe(plano, 'ana').tarefa).toEqual({ ...depoisDaPrimeira.estados.ana.tarefa, marco: 14, importacaoId: ID2 });
    expect(estadoDe(plano, 'ana').tarefa.criadaEm).toBe(E1);
  });

  it('com a tarefa do marco anterior feita, nasce a do marco novo', () => {
    expect(estadoDe(plano, 'bia').tarefa).toMatchObject({ marco: 14, status: TAREFA.PENDENTE, criadaEm: E2, importacaoId: ID2 });
  });

  it('sem marco atravessado, a tarefa não muda', () => {
    expect(estadoDe(plano, 'caio').tarefa).toBe(depoisDaPrimeira.estados.caio.tarefa);
    expect(estadoDe(plano, 'caio').diasNaImportacao).toBe(27);
  });

  it('quem sumiu do Faltantes e passou na catraca voltou nesse dia', () => {
    expect(estadoDe(plano, 'duda')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-09', voltouEntre: null, ultimaPresenca: '2026-10-11', urgente: false });
    expect(plano.voltas.find((v) => v.leadId === 'duda')).toEqual({
      id: 'volta_duda_2026-09-11',
      leadId: 'duda',
      inicioFalta: '2026-09-11',
      voltouEm: '2026-10-09',
      voltouEntre: null,
      text: 'Voltou a treinar em 09/10',
      importacaoId: ID2,
      lead: { id: 'duda', name: 'Duda Teste', consultantId: 'cons-1', consultantAuthUid: 'uid-cons-1' },
    });
  });

  it('quem sumiu sem presença e com contrato ativo voltou entre a última presença e o Faltantes', () => {
    expect(estadoDe(plano, 'edu')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: null, voltouEntre: { de: '2025-09-02', ate: E2 } });
    expect(plano.voltas.find((v) => v.leadId === 'edu').text).toBe('Voltou a treinar entre 02/09 e 13/10');
  });

  it('quem sumiu sem contrato ativo fecha como encerrado, sem linha na linha do tempo', () => {
    expect(estadoDe(plano, 'helo')).toMatchObject({ status: STATUS.ENCERRADO, tarefa: { status: TAREFA.ENCERRADA, marco: 7 } });
    expect(plano.voltas.some((v) => v.leadId === 'helo')).toBe(false);
  });

  it('aluno novo no arquivo começa o período e atravessa o primeiro marco', () => {
    expect(estadoDe(plano, 'ivo')).toMatchObject({ inicioFalta: '2026-10-05', tarefa: { marco: 7 } });
  });

  it('presenças por dia: hora menor, catraca e agenda juntas, sem "offf" nem vazio', () => {
    expect(plano.presencasPorDoc).toEqual([{
      id: 'duda_2026-10',
      doc: {
        leadId: 'duda',
        mes: '2026-10',
        dias: {
          '2026-10-09': { hora: '07:15', origens: ['agenda', 'catraca'], modalidades: ['Pilates'] },
          '2026-10-11': { hora: '08:00', origens: ['catraca'], modalidades: [] },
        },
      },
    }]);
    expect(plano.previa.listas.naoLigados.presencas).toEqual([{ nome: 'Desconhecido Teste', linhas: 1 }]);
    // No registro, o nome do Presenças vai sem telefone.
    expect(plano.registro.naoLigados).toEqual([{ nome: 'Desconhecido Teste', telefone: null, relatorio: 'presencas' }]);
  });

  it('os números da semana', () => {
    expect(plano.previa.numeros).toMatchObject({
      entramNoMarco: { 7: 1, 14: 2, 30: 0, 60: 0 },
      voltaram: 2,
      encerrados: 1,
      faltando: 4,
      tarefasPendentes: 4,
      acompanhamento: 0,
      diasDePresenca: 2,
    });
    expect(plano.avisos).toEqual([]);
  });

  it('a configuração passa a lembrar o último dia do Presenças', () => {
    expect(plano.config.ultimaImportacao).toEqual({
      id: ID2, dataFaltantes: E2, dataFaltantesAnterior: E1, periodoPresencas: { de: '2026-10-09', ate: '2026-10-11' }, ultimoDiaPresencas: '2026-10-11',
    });
  });

  it('importar de novo os mesmos arquivos não muda nada', () => {
    const mundo = aplicar(depoisDaPrimeira, plano);
    nadaMuda(planejar(mundo, { faltantes, presencas, agora: AGORA2, clientes }));
  });
});

describe('período novo, mesmo período e reabertura', () => {
  const base = (estados, ultimaImportacao) => ({ ...MUNDO_VAZIO, estados, config: { ...CONFIG, ultimaImportacao } });
  const tarefa = (marco, inicioFalta, extra = {}) => ({
    marco, urgente: false, status: TAREFA.PENDENTE, inicioFalta, criadaEm: '2026-09-29', importacaoId: 'f-antiga',
    feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null, ...extra,
  });
  const faltando = (inicioFalta, t) => ({
    leadId: 'ana', professorId: 'p-ana', professorNextFit: 'Ana Paula Ribeiro', contratoNextFit: 'Plano Anual',
    urgente: false, contratoTerminaEm: '2027-06-10', atualizadoNaImportacao: 'f-antiga', ultimaPresenca: inicioFalta,
    inicioFalta, status: STATUS.FALTANDO, voltouEm: null, voltouEntre: null, diasNaImportacao: 10, querCancelarEm: null, tarefa: t,
  });

  it('última presença mais nova: o período de antes fecha como voltou e a tarefa pendente também', () => {
    const mundo = base({ ana: faltando('2026-09-10', tarefa(14, '2026-09-10')) }, { id: 'f2026-10-13', dataFaltantes: E2 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E3, 25)]), agora: AGORA3 });
    expect(plano.voltas).toEqual([expect.objectContaining({
      id: idDaVolta('ana', '2026-09-10'), voltouEm: null, voltouEntre: { de: '2026-09-11', ate: '2026-09-25' }, text: 'Voltou a treinar entre 11/09 e 25/09',
    })]);
    const ana = estadoDe(plano, 'ana');
    expect(ana).toMatchObject({ status: STATUS.FALTANDO, inicioFalta: '2026-09-25', diasNaImportacao: 25 });
    // Sem marco atravessado no período novo: fica a tarefa de antes, fechada.
    expect(ana.tarefa).toMatchObject({ status: TAREFA.VOLTOU, marco: 14, inicioFalta: '2026-09-10' });
    expect(plano.previa.numeros.acompanhamento).toBe(1);
  });

  it('com o Presenças da época, a volta do período de antes tem dia', () => {
    const mundo = base({ ana: faltando('2026-09-10', tarefa(14, '2026-09-10')) }, { id: 'f2026-10-13', dataFaltantes: E2 });
    const plano = planejar(mundo, {
      faltantes: arquivoF([linhaF('Ana Teste', 1, E3, 25)]),
      presencas: arquivoP([linhaP('Ana Teste', '2026-09-15', '06:50'), linhaP('Ana Teste', '2026-09-25', '07:00')]),
      agora: AGORA3,
    });
    expect(plano.voltas).toEqual([expect.objectContaining({ voltouEm: '2026-09-15', voltouEntre: null, text: 'Voltou a treinar em 15/09' })]);
  });

  it('voltou, sumiu de novo e voltou depois do Faltantes: fica só a volta mais recente', () => {
    const mundo = base({ ana: faltando('2026-09-10', tarefa(14, '2026-09-10')) }, { id: 'f2026-10-13', dataFaltantes: E2 });
    const plano = planejar(mundo, {
      faltantes: arquivoF([linhaF('Ana Teste', 1, E3, 25)]),
      presencas: arquivoP([linhaP('Ana Teste', '2026-10-22', '07:00')]),
      agora: brt('2026-10-23T10:00'),
    });
    // Uma linha de volta por aluno em cada importação: a do período que
    // começou em 25/09. A do período de antes não é gravada.
    expect(plano.voltas.map((v) => [v.id, v.voltouEm, v.voltouEntre])).toEqual([
      ['volta_ana_2026-09-25', '2026-10-22', null],
    ]);
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, inicioFalta: '2026-09-25', voltouEm: '2026-10-22', ultimaPresenca: '2026-10-22' });
    expect(plano.previa.listas.voltaram).toEqual([{ leadId: 'ana', nome: 'Ana Teste', voltouEm: '2026-10-22', voltouEntre: null }]);
    expect(plano.previa.numeros.voltaram).toBe(1);
  });

  it('a mesma última presença de quem saiu como "voltou" sem dia reabre o período e desfaz a linha', () => {
    const voltou = {
      ...faltando('2026-09-29', null), status: STATUS.VOLTOU, voltouEntre: { de: '2026-09-30', ate: E1 }, tarefa: tarefa(7, '2026-09-29', { status: TAREFA.VOLTOU }),
    };
    const mundo = base({ ana: voltou }, { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29' });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14)]), agora: AGORA2 });
    expect(plano.voltasDesfeitas).toEqual(['volta_ana_2026-09-29']);
    expect(estadoDe(plano, 'ana')).toMatchObject({
      status: STATUS.FALTANDO, voltouEntre: null, inicioFalta: '2026-09-29', tarefa: { marco: 14, status: TAREFA.PENDENTE },
    });
  });

  it('a mesma última presença de quem fechou como encerrado reabre o período, sem linha a desfazer', () => {
    const encerrado = { ...faltando('2026-09-29', tarefa(7, '2026-09-29', { status: TAREFA.ENCERRADA })), status: STATUS.ENCERRADO };
    const mundo = base({ ana: encerrado }, { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29' });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14)]), agora: AGORA2 });
    expect(plano.voltasDesfeitas).toEqual([]);
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.FALTANDO, inicioFalta: '2026-09-29', tarefa: { marco: 14, status: TAREFA.PENDENTE } });
  });

  it('quem já se sabe que veio depois da data do Faltantes não muda', () => {
    const voltou = { ...faltando('2026-09-29', null), status: STATUS.VOLTOU, voltouEm: '2026-10-08', ultimaPresenca: '2026-10-08' };
    const mundo = base({ ana: voltou }, { id: ID1, dataFaltantes: E1 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7)]), agora: AGORA2 });
    expect(plano.estados).toEqual([]);
    expect(plano.voltas).toEqual([]);
    expect(plano.voltasDesfeitas).toEqual([]);
  });

  it('no arquivo, mas com o contrato trancado: o período aberto fecha como encerrado', () => {
    const mundo = base({ ana: faltando('2026-09-29', tarefa(7, '2026-09-29')) }, { id: ID1, dataFaltantes: E1 });
    const clientes = CLIENTES.map((c) => (c.id === 'ana' ? { ...c, currentContractStatus: 'trancado' } : c));
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14), linhaF('Ivo Teste', 9, E2, 8)]), agora: AGORA2, clientes });
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.ENCERRADO, tarefa: { status: TAREFA.ENCERRADA } });
    expect(plano.previa.listas.foraSemContrato).toEqual([{ leadId: 'ana', nome: 'Ana Teste', motivo: 'trancado' }]);
    expect(plano.voltas).toEqual([]);
  });

  it('o lead que sumiu do Stronilead fecha como encerrado', () => {
    const zeca = { ...faltando('2026-09-29', null), leadId: 'zeca' };
    const mundo = base({ zeca }, { id: ID1, dataFaltantes: E1 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ivo Teste', 9, E2, 8)]), agora: AGORA2 });
    expect(estadoDe(plano, 'zeca')).toMatchObject({ status: STATUS.ENCERRADO });
  });

  it('troca de professor na Next Fit: a tarefa pendente vai junto', () => {
    const mundo = base({ ana: faltando('2026-09-29', tarefa(7, '2026-09-29')) }, { id: ID1, dataFaltantes: E1 });
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ana Teste', 1, E2, 14, 'Bruno Tavares')]), agora: AGORA2 });
    expect(estadoDe(plano, 'ana')).toMatchObject({ professorId: 'p-bruno', professorNextFit: 'Bruno Tavares', tarefa: { marco: 14, status: TAREFA.PENDENTE } });
  });

  it('a mesma pessoa duas vezes no arquivo vale uma, com a presença mais nova', () => {
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 10), linhaF('Ana Teste', 1, E1, 7)]), agora: AGORA1 });
    expect(plano.previa.numeros.duplicados).toBe(1);
    expect(estadoDe(plano, 'ana').inicioFalta).toBe('2026-09-29');
  });
});

describe('telefone trocado no Stronilead', () => {
  // A primeira importação gravada. Depois, o WhatsApp da Ana muda no
  // Stronilead, e o Faltantes seguinte ainda traz o número antigo, que não
  // acha mais ninguém.
  const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, {
    faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8)]), agora: AGORA1,
  }));
  const clientes = CLIENTES.map((c) => (c.id === 'ana' ? { ...c, whatsapp: fone(77) } : c));
  const faltantes = arquivoF([linhaF('Ana Teste', 1, E2, 14), linhaF('Bia Teste', 2, E2, 15)]);
  const plano = planejar(mundo, { faltantes, agora: AGORA2, clientes });

  it('o aluno continua faltando como estava, sem linha de volta', () => {
    expect(estadoDe(plano, 'ana')).toBeUndefined();
    expect(plano.voltas.some((v) => v.leadId === 'ana')).toBe(false);
    expect(plano.previa.numeros).toMatchObject({ faltando: 2, voltaram: 0, provaveis: 1 });
  });

  it('vai para a prévia como provável mesma pessoa, e a linha sugere a ligação', () => {
    expect(plano.previa.listas.provaveis).toEqual([{
      leadId: 'ana',
      nome: 'Ana Teste',
      linha: { numero: 2, nome: 'Ana Teste', telefone: fone(1), professorNextFit: 'Ana Paula Ribeiro', ultimaPresenca: '2026-09-29', ausencias: 14 },
    }]);
    expect(plano.previa.listas.naoLigados.faltantes[0]).toMatchObject({ nome: 'Ana Teste', sugestao: 'ana' });
  });

  it('ligado à mão na prévia, segue o período, no marco seguinte', () => {
    const deNovo = planejar(mundo, { faltantes, agora: AGORA2, clientes, manuais: [{ nomeNextFit: 'Ana Teste', leadId: 'ana' }] });
    expect(deNovo.previa.listas.provaveis).toEqual([]);
    expect(estadoDe(deNovo, 'ana').tarefa).toMatchObject({ marco: 14, status: TAREFA.PENDENTE });
  });

  it('sem contrato ativo, fecha como encerrado mesmo com o nome no Faltantes', () => {
    const vencido = clientes.map((c) => (c.id === 'ana' ? { ...c, currentContractEndsAt: fimContrato('2026-10-10') } : c));
    const plano2 = planejar(mundo, { faltantes, agora: AGORA2, clientes: vencido });
    expect(estadoDe(plano2, 'ana')).toMatchObject({ status: STATUS.ENCERRADO });
    expect(plano2.previa.listas.provaveis).toEqual([]);
  });
});

describe('telefone de outra pessoa', () => {
  it('a linha que o telefone acha só na mãe vai para os ambíguos, com o nome dela', () => {
    const clientes = [...CLIENTES, cliente('rita', 'Rita Souza', 30)];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Joao Souza', 30, E1, 9)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'rita')).toBeUndefined();
    expect(plano.previa.listas.ambiguos.faltantes).toEqual([{
      numero: 3, nome: 'Joao Souza', telefone: fone(30), professorNextFit: 'Ana Paula Ribeiro', ultimaPresenca: '2026-09-27', ausencias: 9,
      candidatos: [{ leadId: 'rita', nome: 'Rita Souza' }],
    }]);
    expect(plano.previa.numeros.naoLigadosFaltantes).toBe(1);
    expect(plano.registro.naoLigados).toEqual([{ nome: 'Joao Souza', telefone: fone(30), relatorio: 'faltantes' }]);
  });
});

describe('o Presenças', () => {
  const depoisDaPrimeira = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: SEMANA1, agora: AGORA1 }));

  it('sozinho, devolve quem passou na catraca e guarda o Faltantes de antes', () => {
    const plano = planejar(depoisDaPrimeira, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-08', '07:30', 'Acesso', 'Musculação')]), agora: brt('2026-10-08T12:00') });
    expect(plano.estados.map((e) => e.leadId)).toEqual(['ana']);
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-08', ultimaPresenca: '2026-10-08' });
    expect(estadoDe(plano, 'ana').tarefa.status).toBe(TAREFA.VOLTOU);
    expect(plano.voltas.map((v) => v.text)).toEqual(['Voltou a treinar em 08/10']);
    expect(plano.config.ultimaImportacao).toEqual({
      id: 'p2026-10-08_2026-10-08', dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29',
      periodoPresencas: { de: '2026-10-08', ate: '2026-10-08' }, ultimoDiaPresencas: '2026-10-08',
    });
  });

  it('junta com o mês já guardado: o mesmo dia conta uma vez e fica a hora menor', () => {
    const mundo = { ...depoisDaPrimeira, presencas: { 'ana_2026-10': { leadId: 'ana', mes: '2026-10', dias: { '2026-10-02': { hora: '06:40', origens: ['catraca'], modalidades: [] } } } } };
    const presencas = arquivoP([
      linhaP('Ana Teste', '2026-10-02', '07:10'),
      linhaP('Ana Teste', '2026-10-02', '18:30', 'Agenda', 'Pilates'),
      linhaP('Ana Teste', '2026-09-30', '07:00'),
    ]);
    const plano = planejar(mundo, { presencas, agora: AGORA1 });
    expect(plano.presencasPorDoc).toEqual([
      { id: 'ana_2026-09', doc: { leadId: 'ana', mes: '2026-09', dias: { '2026-09-30': { hora: '07:00', origens: ['catraca'], modalidades: [] } } } },
      { id: 'ana_2026-10', doc: { leadId: 'ana', mes: '2026-10', dias: { '2026-10-02': { hora: '06:40', origens: ['agenda', 'catraca'], modalidades: ['Pilates'] } } } },
    ]);
  });

  it('o mês já guardado igual não é gravado de novo', () => {
    const mundo = { ...depoisDaPrimeira, presencas: { 'ana_2026-10': { leadId: 'ana', mes: '2026-10', dias: { '2026-10-02': { hora: '07:10', origens: ['catraca'], modalidades: [] } } } } };
    const plano = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-02', '07:10')]), agora: AGORA1 });
    expect(plano.presencasPorDoc).toEqual([]);
  });

  it('entre dois Presenças, a configuração fica com o que termina depois', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: 'p2026-10-01_2026-10-12', periodoPresencas: { de: '2026-10-01', ate: '2026-10-12' } } } };
    const plano = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-09-20', '07:00')]), agora: AGORA2 });
    expect(plano.config.ultimaImportacao).toEqual({
      id: 'p2026-09-20_2026-09-20', dataFaltantes: null, dataFaltantesAnterior: null,
      periodoPresencas: { de: '2026-10-01', ate: '2026-10-12' }, ultimoDiaPresencas: '2026-10-12',
    });
    expect(plano.registro.periodoPresencas).toEqual({ de: '2026-09-20', ate: '2026-09-20' });
  });

  it('presença depois da data do Faltantes, de quem está no arquivo: voltou, sem tarefa', () => {
    const plano = planejar(MUNDO_VAZIO, {
      faltantes: arquivoF([linhaF('Ana Teste', 1, E1, 7)]),
      presencas: arquivoP([linhaP('Ana Teste', '2026-10-07', '07:00')]),
      agora: brt('2026-10-07T12:00'),
    });
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-07', tarefa: null });
    expect(plano.previa.numeros.entramNoMarco[7]).toBe(0);
    expect(plano.voltas.map((v) => v.id)).toEqual(['volta_ana_2026-09-29']);
  });

  it('agenda que o Faltantes não viu: a presença vale e o período recomeça nela', () => {
    const tarefa14 = { marco: 14, urgente: false, status: TAREFA.PENDENTE, inicioFalta: '2026-09-20', criadaEm: E1, importacaoId: ID1, feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null };
    const mundo = {
      ...MUNDO_VAZIO,
      estados: { ana: { leadId: 'ana', status: STATUS.FALTANDO, inicioFalta: '2026-09-20', ultimaPresenca: '2026-09-20', professorId: 'p-ana', tarefa: tarefa14 } },
      config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1, ultimoDiaPresencas: E1 } },
    };
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E2, 23), linhaF('Ivo Teste', 9, E2, 8)]);
    const plano = planejar(mundo, { faltantes, presencas: arquivoP([linhaP('Ana Teste', '2026-10-02', '18:00', 'Agenda', 'Pilates')]), agora: AGORA2 });
    expect(plano.voltas.find((v) => v.leadId === 'ana')).toMatchObject({ voltouEm: '2026-10-02', inicioFalta: '2026-09-20' });
    expect(estadoDe(plano, 'ana')).toMatchObject({
      status: STATUS.FALTANDO, inicioFalta: '2026-10-02', diasNaImportacao: 11, tarefa: { marco: 7, status: TAREFA.PENDENTE, inicioFalta: '2026-10-02' },
    });
  });

  it('agenda recente que o Faltantes não viu: nenhum período abre', () => {
    const mundo = {
      ...MUNDO_VAZIO,
      estados: { ana: { leadId: 'ana', status: STATUS.FALTANDO, inicioFalta: '2026-09-20', ultimaPresenca: '2026-09-20', professorId: 'p-ana', tarefa: null } },
      config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1, ultimoDiaPresencas: E1 } },
    };
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E2, 23), linhaF('Ivo Teste', 9, E2, 8)]);
    const plano = planejar(mundo, { faltantes, presencas: arquivoP([linhaP('Ana Teste', '2026-10-09', '18:00', 'Agenda', 'Pilates')]), agora: AGORA2 });
    expect(estadoDe(plano, 'ana')).toMatchObject({ status: STATUS.VOLTOU, voltouEm: '2026-10-09', ultimaPresenca: '2026-10-09' });
  });
});

describe('urgente', () => {
  const vence = (dia) => ({ currentContractEndsAt: fimContrato(dia) });

  it('aluno faltando com contrato terminando em até 90 dias: a tarefa nasce com o selo', () => {
    const clientes = [cliente('uri', 'Uri Teste', 21, vence('2026-11-05'))];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Uri Teste', 21, E1, 7)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'uri')).toMatchObject({ urgente: true, contratoTerminaEm: '2026-11-05', tarefa: { marco: 7, urgente: true } });
    expect(plano.previa.numeros).toMatchObject({ urgentes: 1, urgentesNovos: 1 });
    expect(plano.previa.porProfessor).toEqual([{ professorId: 'p-ana', nome: 'Ana Paula Ribeiro', alunos: 1, pendentes: 1, urgentes: 1 }]);
  });

  it('quem já renovou não fica urgente: vale o fim da renovação', () => {
    const renovou = {
      currentContractId: 'c-vic-2',
      currentContractStartsAt: fimContrato('2026-10-21'),
      currentContractEndsAt: fimContrato('2027-10-21'),
      inUseContractId: 'c-vic',
      inUseContractStatus: 'ativo',
      inUseContractEndsAt: fimContrato('2026-10-20'),
    };
    const clientes = [cliente('vic', 'Vic Teste', 25, renovou)];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Vic Teste', 25, E1, 7)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'vic')).toMatchObject({ urgente: false, contratoTerminaEm: '2027-10-21', tarefa: { marco: 7, urgente: false } });
  });

  it('depois do último marco, só o urgente cria tarefa', () => {
    const clientes = [cliente('vera', 'Vera Teste', 22, vence('2026-12-01'))];
    const plano = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Vera Teste', 22, E1, 100)]), agora: AGORA1, clientes });
    expect(estadoDe(plano, 'vera').tarefa).toMatchObject({ marco: 60, urgente: true, status: TAREFA.PENDENTE });
  });

  it('a tarefa pendente de marco que vira urgente ganha o selo, sem tarefa nova; e uma vez por período', () => {
    const longe = [cliente('wil', 'Wil Teste', 23)];
    const perto = [cliente('wil', 'Wil Teste', 23, vence('2026-12-01'))];
    const semana1 = planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Wil Teste', 23, E1, 15)]), agora: AGORA1, clientes: longe });
    expect(estadoDe(semana1, 'wil').tarefa).toMatchObject({ marco: 14, urgente: false });
    const mundo1 = aplicar(MUNDO_VAZIO, semana1);

    const semana2 = planejar(mundo1, { faltantes: arquivoF([linhaF('Wil Teste', 23, E2, 22)]), agora: AGORA2, clientes: perto });
    expect(estadoDe(semana2, 'wil').tarefa).toEqual({ ...mundo1.estados.wil.tarefa, urgente: true });
    expect(semana2.previa.numeros.urgentesNovos).toBe(1);
    const mundo2 = aplicar(mundo1, semana2);

    const semana3 = planejar(mundo2, { faltantes: arquivoF([linhaF('Wil Teste', 23, E3, 29)]), agora: AGORA3, clientes: perto });
    expect(estadoDe(semana3, 'wil').tarefa).toBe(mundo2.estados.wil.tarefa);
    expect(semana3.previa.numeros.urgentesNovos).toBe(0);
  });

  it('a tarefa urgente já feita não volta enquanto o período segue', () => {
    const perto = [cliente('xuxa', 'Xuxa Teste', 24, vence('2026-12-01'))];
    const mundo1 = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: arquivoF([linhaF('Xuxa Teste', 24, E1, 15)]), agora: AGORA1, clientes: perto }));
    const feita = { ...mundo1, estados: { xuxa: { ...mundo1.estados.xuxa, tarefa: { ...mundo1.estados.xuxa.tarefa, status: TAREFA.FEITA } } } };
    const semana2 = planejar(feita, { faltantes: arquivoF([linhaF('Xuxa Teste', 24, E2, 22)]), agora: AGORA2, clientes: perto });
    expect(estadoDe(semana2, 'xuxa').tarefa.status).toBe(TAREFA.FEITA);
  });
});

describe('avisos da prévia', () => {
  it('as datas do Faltantes que não batem', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8), { ...linhaF('Caio Teste', 3, E1, 20), 'Qtde de ausências': 19 }]);
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1 });
    expect(plano.avisos).toEqual([{
      codigo: 'datas_divergentes',
      mensagem: 'Em 1 linha do Faltantes, a última presença mais as ausências não dá 06/10. Valeu 06/10, o dia da maioria das linhas.',
      divergentes: 1,
    }]);
    expect(plano.registro.avisos).toEqual([{ codigo: 'datas_divergentes', mensagem: plano.avisos[0].mensagem }]);
  });

  it('a linha com a última presença depois da data do Faltantes fica fora do estado', () => {
    const faltantes = arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8), linhaF('Caio Teste', 3, '2026-10-08', 0)]);
    const plano = planejar(MUNDO_VAZIO, { faltantes, agora: AGORA1 });
    expect(plano.importacao.dataFaltantes).toBe(E1);
    expect(estadoDe(plano, 'caio')).toBeUndefined();
    expect(plano.previa.numeros).toMatchObject({ ligadosFaltantes: 2, faltando: 2 });
    expect(plano.avisos.map((a) => a.codigo)).toEqual(['datas_divergentes']);
  });

  it('o Faltantes que parece ter saído com filtro maior', () => {
    const primeira = arquivoF([
      linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8), linhaF('Caio Teste', 3, E1, 9),
      linhaF('Duda Teste', 4, E1, 20), linhaF('Edu Teste', 5, E1, 30),
    ]);
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: primeira, agora: AGORA1 }));
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Duda Teste', 4, E2, 27), linhaF('Edu Teste', 5, E2, 37)]), agora: AGORA2 });
    expect(plano.avisos).toEqual([{
      codigo: 'filtro_maior',
      mensagem: 'O Faltantes parece ter saído com um filtro maior que 7 dias: ninguém aparece com até 10 dias sem vir, e 3 dos 5 faltosos da importação anterior sumiram dele. Se seguir, 3 vão ser marcados como "voltou". Exporte de novo com 7 dias.',
      sumiram: 3,
      anteriores: 5,
      viramVoltou: 3,
    }]);
  });

  it('com alguém perto do menor marco, não há aviso de filtro', () => {
    const primeira = arquivoF([linhaF('Ana Teste', 1, E1, 7), linhaF('Bia Teste', 2, E1, 8)]);
    const mundo = aplicar(MUNDO_VAZIO, planejar(MUNDO_VAZIO, { faltantes: primeira, agora: AGORA1 }));
    const plano = planejar(mundo, { faltantes: arquivoF([linhaF('Ivo Teste', 9, E2, 10)]), agora: AGORA2 });
    expect(plano.avisos.map((a) => a.codigo)).toEqual([]);
  });

  it('o buraco no Presenças', () => {
    const mundo = { ...MUNDO_VAZIO, config: { ...CONFIG, ultimaImportacao: { id: ID1, dataFaltantes: E1, ultimoDiaPresencas: '2026-10-01' } } };
    const buraco = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-05', '07:00')]), agora: AGORA1 });
    expect(buraco.avisos).toEqual([{
      codigo: 'buraco_presencas',
      mensagem: 'O último Presenças importado vai até 01/10, e este começa em 05/10. Os dias entre eles podem ter ficado sem presença. Exporte o Presenças a partir de 02/10.',
      ultimoDia: '2026-10-01',
      primeiroDia: '2026-10-05',
    }]);
    const emenda = planejar(mundo, { presencas: arquivoP([linhaP('Ana Teste', '2026-10-03', '07:00')]), agora: AGORA1 });
    expect(emenda.avisos).toEqual([]);
  });
});

describe('peças do plano', () => {
  it('E0: a data anterior, a mesma de antes quando a data se repete, ou E menos 7', () => {
    expect(e0Da(E2, { id: ID1, dataFaltantes: E1 })).toBe(E1);
    expect(e0Da(E1, { id: ID1, dataFaltantes: E1, dataFaltantesAnterior: '2026-09-29' })).toBe('2026-09-29');
    expect(e0Da(E1, { id: ID1, dataFaltantes: E1 })).toBe('2026-09-29');
    expect(e0Da(E1, null)).toBe('2026-09-29');
  });

  it('id da importação pelas datas dos arquivos, e id da volta por aluno e período', () => {
    expect(idDaImportacao({ dataFaltantes: E1, periodoPresencas: { de: '2026-09-30', ate: E1 } })).toBe('f2026-10-06_p2026-09-30_2026-10-06');
    expect(idDaImportacao({ dataFaltantes: E1, periodoPresencas: null })).toBe('f2026-10-06');
    expect(idDaImportacao({ dataFaltantes: null, periodoPresencas: { de: '2026-09-30', ate: E1 } })).toBe('p2026-09-30_2026-10-06');
    expect(idDaImportacao({ dataFaltantes: null, periodoPresencas: null })).toBeNull();
    expect(idDaVolta('ana', '2026-09-29')).toBe('volta_ana_2026-09-29');
  });

  it('texto da volta', () => {
    expect(textoDaVolta({ voltouEm: '2026-10-03' })).toBe('Voltou a treinar em 03/10');
    expect(textoDaVolta({ voltouEntre: { de: '2026-09-26', ate: E1 } })).toBe('Voltou a treinar entre 26/09 e 06/10');
  });
});
