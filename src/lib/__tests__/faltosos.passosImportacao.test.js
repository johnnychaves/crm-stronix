// Os passos da importação das planilhas da Next Fit
// (src/lib/faltosos/passosImportacao.js), com o leitor e o plano de verdade e
// planilhas falsas com o mesmo cabeçalho das reais. Planilha de verdade, com
// dado de aluno, nunca entra no repositório.
import { describe, it, expect } from 'vitest';
import {
  MOTIVO_FORA, PASSOS, RECUSA_ARQUIVO, SEM_PROFESSOR, alunosParaLigar, cartoesDaPrevia, classificarArquivo,
  colocarArquivo, datasDaPrevia, desfazerLigacao, entradaDoPlano, escolhasIniciais, falhaDaGravacao,
  ligarAMao, linhaDasPresencas, linhasDeFora, linksDasEscolhas, mensagemDeErroDaLeitura, mesesDoPresencas,
  recusaDosArquivos, resumoDoArquivo, textoDoAviso, todosEscolhidos, voltasDaPrevia,
} from '../faltosos/passosImportacao.js';
import { FALTANTES_HEADER, PRESENCAS_HEADER } from '../faltosos/nextfitArquivos.js';
import { planejarImportacao } from '../faltosos/planoImportacao.js';

const AGORA = new Date('2026-10-06T13:00:00Z'); // 06/10/2026, 10h em Brasília
const fimContrato = (dia) => new Date(`${dia}T00:00:00-03:00`);

const faltante = (nome, ausencias, ultima, professor, telefone) => ({
  Nome: nome, Contrato: 'PLANO ANUAL', 'Qtde de ausências': ausencias, 'Última presença': ultima,
  Telefone: telefone, Professor: professor, Consultor: 'BIA',
});
const presenca = (nome, data, tipo = 'Acesso', modalidade = 'offf') => ({ Cliente: nome, Modalidade: modalidade, Contrato: 'PLANO ANUAL', Tipo: tipo, Data: data });

const FALTANTES = {
  nome: 'faltantes.xlsx',
  headers: [...FALTANTES_HEADER],
  rows: [
    faltante('ANA LIMA', 11, '25/09/2026', 'RAFAEL MENEZES DA SILVA SANTO', '(51) 9 9999-0001'),
    faltante('JOAO SEM CADASTRO', 8, '28/09/2026', 'CONTROLE (NAO ALTERAR)', '(51) 9 9999-0002'),
    faltante('CAIO TESTE', 30, '06/09/2026', 'LUANA PRADO', '(51) 9 9999-0003'),
    faltante('DORA SEM PROFESSOR', 9, '27/09/2026', '', '(51) 9 9999-0004'),
    faltante('', 9, '27/09/2026', 'LUANA PRADO', ''),
  ].map((r, i) => ({ __row: i + 2, ...r })),
};
const PRESENCAS = {
  nome: 'presencas.xlsx',
  headers: [...PRESENCAS_HEADER],
  rows: [
    presenca('BIA SOUZA', '30/09/2026 07:00'),
    presenca('BIA SOUZA', '06/10/2026 18:30', 'Agenda', 'Pilates'),
  ].map((r, i) => ({ __row: i + 2, ...r })),
};

const cliente = (id, name, whatsapp, extra = {}) => ({
  id, name, whatsapp, lifecycleBucket: 'cliente', lifecycleStage: 'cliente',
  currentContractId: `c-${id}`, currentContractStatus: 'ativo',
  currentContractStartsAt: fimContrato('2026-01-10'), currentContractEndsAt: fimContrato('2027-06-10'),
  ...extra,
});
const PROFESSORES = [
  { id: 'p-rafa', nome: 'Rafael Menezes da Silva Santos', ativo: true },
  { id: 'p-lu', nome: 'Luana Prado', ativo: true },
];
const BASE = {
  clientes: [
    cliente('l-ana', 'Ana Lima', '51999990001'),
    cliente('l-caio', 'Caio Teste', '51999990003', { currentContractEndsAt: fimContrato('2026-11-30') }),
    cliente('l-dora', 'Dora Sem Professor', '51999990004'),
    cliente('l-bia', 'Bia Souza', '51999990005'),
    cliente('l-joao', 'João Pedro', '51999990009'),
  ],
  estadosAtuais: {},
  nomesGuardados: {},
  presencasAtuais: {},
  configDoc: { professorLinks: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }] },
};

describe('os arquivos', () => {
  it('reconhece o Faltantes pelo cabeçalho e acha a data da exportação', () => {
    const f = classificarArquivo(FALTANTES);
    expect(f.tipo).toBe('faltantes');
    expect(f.linhas).toHaveLength(4);
    expect(f.erros).toHaveLength(1);
    expect(f.dia).toBe('2026-10-06');
    expect(f.divergentes).toBe(0);
    expect(resumoDoArquivo(f)).toBe('4 alunos · exportado em 06/10/2026');
  });

  it('reconhece o Presenças e acha o período, do primeiro ao último dia do arquivo', () => {
    const p = classificarArquivo(PRESENCAS);
    expect(p.tipo).toBe('presencas');
    expect(p.periodo).toEqual({ de: '2026-09-30', ate: '2026-10-06' });
    expect(resumoDoArquivo(p)).toBe('2 presenças · de 30/09 a 06/10');
    expect(mesesDoPresencas(p)).toEqual(['2026-09', '2026-10']);
    expect(mesesDoPresencas(null)).toEqual([]);
  });

  it('recusa o que não é Faltantes nem Presenças, com o texto da spec', () => {
    const acessos = { nome: 'acessos.xlsx', headers: ['AcessoLiberado', 'Cliente', 'Contrato', 'Acesso', 'ModoReconhecimento', 'Offline', 'Motivo'], rows: [] };
    expect(classificarArquivo(acessos)).toEqual({ nome: 'acessos.xlsx', recusa: RECUSA_ARQUIVO });
    expect(RECUSA_ARQUIVO).toBe('Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.');
  });

  it('recusa o relatório sem nenhuma linha que deu para ler', () => {
    expect(classificarArquivo({ ...FALTANTES, rows: [] }).recusa).toBe('Esse Faltantes não tem nenhum aluno que deu para ler.');
    expect(classificarArquivo({ ...PRESENCAS, rows: [] }).recusa).toBe('Esse Presenças não tem nenhuma presença que deu para ler.');
  });

  it('o arquivo novo de um tipo troca o anterior do mesmo tipo', () => {
    const f1 = classificarArquivo(FALTANTES);
    const f2 = { ...f1, nome: 'faltantes-2.xlsx' };
    const p = classificarArquivo(PRESENCAS);
    const juntos = colocarArquivo(colocarArquivo(colocarArquivo({ faltantes: null, presencas: null }, f1), p), f2);
    expect(juntos.faltantes.nome).toBe('faltantes-2.xlsx');
    expect(juntos.presencas.nome).toBe('presencas.xlsx');
  });
});

describe('a recusa antes de ler a base', () => {
  const f = classificarArquivo(FALTANTES);
  const p = classificarArquivo(PRESENCAS);
  const config = (dataFaltantes) => ({ marcos: [7, 14, 30, 60], professorLinks: [], ultimaImportacao: { id: 'x', dataFaltantes } });

  it('sem arquivo nenhum não há o que dizer', () => {
    expect(recusaDosArquivos({ arquivos: { faltantes: null, presencas: null }, config: config(null), agora: AGORA })).toBeNull();
  });

  it('Faltantes mais antigo que o último importado é recusado com o texto do plano; com a mesma data, passa', () => {
    const r = recusaDosArquivos({ arquivos: { faltantes: f, presencas: p }, config: config('2026-10-07'), agora: AGORA });
    expect(r.codigo).toBe('faltantes_antigo');
    expect(r.mensagem).toContain('06/10/2026');
    expect(r.mensagem).toContain('07/10/2026');
    expect(recusaDosArquivos({ arquivos: { faltantes: f, presencas: null }, config: config('2026-10-06'), agora: AGORA })).toBeNull();
  });

  it('o Presenças sozinho não depende da data do último Faltantes', () => {
    expect(recusaDosArquivos({ arquivos: { faltantes: null, presencas: p }, config: config('2026-12-01'), agora: AGORA })).toBeNull();
  });
});

describe('professores novos e ligação à mão', () => {
  const novos = [
    { nome: 'CONTROLE (NAO ALTERAR)', alunos: 1, sugestao: null },
    { nome: 'RAFAEL MENEZES DA SILVA SANTO', alunos: 1, sugestao: 'p-rafa' },
  ];

  it('a escolha começa pela sugestão; sem sugestão fica vazia e segura o Continuar', () => {
    const escolhas = escolhasIniciais(novos);
    expect(escolhas).toEqual({ 'CONTROLE (NAO ALTERAR)': '', 'RAFAEL MENEZES DA SILVA SANTO': 'p-rafa' });
    expect(todosEscolhidos(novos, escolhas)).toBe(false);
    expect(todosEscolhidos(novos, { ...escolhas, 'CONTROLE (NAO ALTERAR)': SEM_PROFESSOR })).toBe(true);
  });

  it('as escolhas viram a ligação guardada, com Sem professor como null', () => {
    expect(linksDasEscolhas(novos, { 'CONTROLE (NAO ALTERAR)': SEM_PROFESSOR, 'RAFAEL MENEZES DA SILVA SANTO': 'p-rafa' })).toEqual([
      { nome: 'CONTROLE (NAO ALTERAR)', professorId: null },
      { nome: 'RAFAEL MENEZES DA SILVA SANTO', professorId: 'p-rafa' },
    ]);
    expect(linksDasEscolhas(novos, { 'CONTROLE (NAO ALTERAR)': '' })).toEqual([]);
  });

  it('a ligação à mão é pela chave do nome, e desfazer tira só ela', () => {
    const item = { chave: 'joao sem cadastro', nome: 'JOAO SEM CADASTRO' };
    const m = ligarAMao({}, item, 'l-joao');
    expect(m).toEqual({ 'joao sem cadastro': { nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' } });
    expect(ligarAMao(m, item, 'l-outro')['joao sem cadastro'].leadId).toBe('l-outro');
    expect(desfazerLigacao(m, 'joao sem cadastro')).toEqual({});
    expect(m).toEqual({ 'joao sem cadastro': { nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' } });
  });
});

describe('a entrada do plano', () => {
  const arquivos = { faltantes: classificarArquivo(FALTANTES), presencas: classificarArquivo(PRESENCAS) };

  it('leva os arquivos, a base, as ligações e o instante', () => {
    const e = entradaDoPlano({
      arquivos, base: BASE, professores: PROFESSORES,
      novos: [{ nome: 'RAFAEL MENEZES DA SILVA SANTO', alunos: 1, sugestao: 'p-rafa' }],
      escolhas: { 'RAFAEL MENEZES DA SILVA SANTO': 'p-rafa' },
      manuais: { 'joao sem cadastro': { nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' } },
      agora: AGORA,
    });
    expect(e.faltantes.linhas).toHaveLength(4);
    expect(e.faltantes.erros).toHaveLength(1);
    expect(e.presencas.linhas).toHaveLength(2);
    expect(e.estadosAtuais).toBe(BASE.estadosAtuais);
    expect(e.presencasAtuais).toBe(BASE.presencasAtuais);
    expect(e.clientes).toBe(BASE.clientes);
    expect(e.professores).toBe(PROFESSORES);
    expect(e.config).toBe(BASE.configDoc);
    expect(e.ligacoes).toEqual({
      professores: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }, { nome: 'RAFAEL MENEZES DA SILVA SANTO', professorId: 'p-rafa' }],
      alunos: {},
      manuais: [{ nomeNextFit: 'JOAO SEM CADASTRO', leadId: 'l-joao' }],
    });
    expect(e.agora).toBe(AGORA);
  });

  it('sem base, vai a configuração da tela; sem um dos arquivos, ele vai como null', () => {
    const config = { professorLinks: [] };
    const e = entradaDoPlano({ arquivos: { faltantes: null, presencas: arquivos.presencas }, config, agora: AGORA });
    expect(e.faltantes).toBeNull();
    expect(e.config).toBe(config);
    expect(e.clientes).toEqual([]);
  });
});

describe('a prévia que o plano de verdade monta', () => {
  const arquivos = { faltantes: classificarArquivo(FALTANTES), presencas: classificarArquivo(PRESENCAS) };
  const planejar = (extra = {}) => planejarImportacao(entradaDoPlano({ arquivos, base: BASE, professores: PROFESSORES, agora: AGORA, ...extra }));

  it('pede só os professores novos, com a sugestão pelo nome cortado em 29 letras', () => {
    const p = planejar();
    expect(p.recusa).toBeNull();
    expect(p.prontoParaGravar).toBe(false);
    expect(p.pendencias.professoresNovos.map((n) => [n.nome, n.sugestao])).toEqual([
      ['CONTROLE (NAO ALTERAR)', null],
      ['RAFAEL MENEZES DA SILVA SANTO', 'p-rafa'],
    ]);
  });

  it('com as escolhas, fica pronto para gravar e mostra os números, os não ligados e as presenças', () => {
    const novos = planejar().pendencias.professoresNovos;
    const escolhas = { ...escolhasIniciais(novos), 'CONTROLE (NAO ALTERAR)': SEM_PROFESSOR };
    const p = planejar({ novos, escolhas });
    expect(p.prontoParaGravar).toBe(true);
    expect(datasDaPrevia(p.previa)).toBe('Faltantes de 06/10/2026 · Presenças de 30/09 a 06/10');
    const cartoes = cartoesDaPrevia(p.previa);
    expect(cartoes.map((c) => c.rotulo)).toEqual([
      'Entram no marco de 7 dias', 'Entram no marco de 14 dias', 'Entram no marco de 30 dias', 'Entram no marco de 60 dias',
      'Urgentes', 'Voltaram', 'Encerrados', 'Só acompanhamento',
    ]);
    expect(cartoes.find((c) => c.id === 'urgentes').valor).toBe(1);
    expect(linhaDasPresencas(p.previa)).toBe('2 dias de presença de 1 aluno entram na ficha.');
    expect(alunosParaLigar(p.previa)).toEqual([
      { chave: 'joao sem cadastro', nome: 'JOAO SEM CADASTRO', telefone: '(51) 9 9999-0002', origem: 'faltantes', linhas: 1, sugestao: null, candidatos: [] },
    ]);
    expect(linhasDeFora(p.previa)).toEqual([{ arquivo: 'Faltantes', numero: 6, nome: null, motivo: 'Linha sem nome.' }]);

    // Ligar o João à mão refaz o plano sem ler nada, e ele sai dos não ligados.
    const ligado = planejar({ novos, escolhas, manuais: ligarAMao({}, alunosParaLigar(p.previa)[0], 'l-joao') });
    expect(alunosParaLigar(ligado.previa)).toEqual([]);
  });
});

describe('textos da prévia', () => {
  it('as datas numa linha, e nada quando faltam', () => {
    expect(datasDaPrevia({ dataFaltantes: null, periodoPresencas: { de: '2026-10-01', ate: '2026-10-06' } })).toBe('Presenças de 01/10 a 06/10');
    expect(datasDaPrevia({})).toBe('');
    expect(linhaDasPresencas({ numeros: { diasDePresenca: 0 } })).toBe('');
  });

  it('o mesmo nome nos dois arquivos aparece uma vez, com os candidatos do empate', () => {
    const previa = {
      listas: {
        naoLigados: { faltantes: [{ nome: 'MARIA', telefone: '(51) 9 9999-0007', sugestao: 'l-maria' }], presencas: [{ nome: 'Maria', linhas: 3 }] },
        ambiguos: { faltantes: [], presencas: [{ nome: 'BETO', linhas: 2, candidatos: [{ leadId: 'l-b1', nome: 'Beto Um' }, { leadId: 'l-b2', nome: 'Beto Dois' }] }] },
      },
    };
    expect(alunosParaLigar(previa)).toEqual([
      { chave: 'maria', nome: 'MARIA', telefone: '(51) 9 9999-0007', origem: 'faltantes', linhas: 1, sugestao: 'l-maria', candidatos: [] },
      { chave: 'beto', nome: 'BETO', telefone: null, origem: 'presencas', linhas: 2, sugestao: null, candidatos: [{ leadId: 'l-b1', nome: 'Beto Um' }, { leadId: 'l-b2', nome: 'Beto Dois' }] },
    ]);
  });

  it('quem voltou diz o dia ou o intervalo', () => {
    expect(voltasDaPrevia({ listas: { voltaram: [
      { leadId: 'a', nome: 'Ana', voltouEm: '2026-10-03', voltouEntre: null },
      { leadId: 'b', nome: null, voltouEm: null, voltouEntre: { de: '2026-09-26', ate: '2026-10-06' } },
    ] } })).toEqual([
      { leadId: 'a', nome: 'Ana', quando: 'voltou em 03/10' },
      { leadId: 'b', nome: 'Cliente', quando: 'voltou entre 26/09 e 06/10' },
    ]);
  });

  it('o aviso usa o texto do plano e, sem ele, o texto do código; o motivo de fora tem nome', () => {
    expect(textoDoAviso({ codigo: 'buraco_presencas', mensagem: 'O último Presenças importado vai até 30/09.' })).toBe('O último Presenças importado vai até 30/09.');
    expect(textoDoAviso({ codigo: 'filtro_maior' })).toMatch(/filtro maior que o menor marco/);
    expect(textoDoAviso({ codigo: 'datas_divergentes' })).toMatch(/não batem entre si/);
    expect(textoDoAviso({ codigo: 'outro' })).toBe('Confira os números antes de confirmar.');
    expect(MOTIVO_FORA).toEqual({ sem_contrato_ativo: 'Sem contrato ativo', trancado: 'Contrato trancado' });
  });
});

describe('erros da leitura e da gravação', () => {
  it('a leitura diz o que fazer: permissão, conexão ou tentar de novo', () => {
    expect(mensagemDeErroDaLeitura({ code: 'permission-denied' })).toMatch(/regras novas/);
    expect(mensagemDeErroDaLeitura({ code: 'unavailable' })).toMatch(/Sem conexão/);
    expect(mensagemDeErroDaLeitura(new Error('x'))).toBe('Não deu para ler os dados da academia. Tente de novo.');
  });

  it('a gravação que parou num lote deixa tentar de novo; o plano com defeito, não', () => {
    expect(falhaDaGravacao({ resultado: { ok: false, lote: 3, lotes: 5, erro: new Error('rede') } })).toEqual({
      texto: 'A gravação parou no lote 3 de 5. O que entrou antes fica gravado. Tente de novo: nada se repete.',
      podeTentar: true,
    });
    expect(falhaDaGravacao({ resultado: { ok: false, lote: null, lotes: 0, erro: new Error('rede') } }).texto).toMatch(/nada foi gravado/);
    expect(falhaDaGravacao({ resultado: { ok: false, lote: 1, lotes: 2, erro: { code: 'permission-denied' } } })).toEqual({
      texto: 'O Firestore recusou a gravação. Confira se as regras novas foram publicadas.', podeTentar: true,
    });
    expect(falhaDaGravacao({ lancado: { code: 'unavailable' } }).podeTentar).toBe(true);
    const outra = Object.assign(new Error('Outra importação foi gravada enquanto esta janela estava aberta. Nada foi gravado. Feche a janela e importe os arquivos de novo.'), { code: 'outra-importacao' });
    expect(falhaDaGravacao({ resultado: { ok: false, lote: null, lotes: 0, erro: outra } })).toEqual({ texto: outra.message, podeTentar: false });
    expect(falhaDaGravacao({ lancado: new Error('plano da importação inválido: volta sem leadId') })).toEqual({
      texto: 'A importação não passou na conferência, e nada foi gravado. Feche a janela e importe de novo.', podeTentar: false,
    });
  });

  it('os passos têm nome e nenhum texto tem travessão', () => {
    expect(Object.values(PASSOS)).toEqual(['arquivos', 'lendo', 'professores', 'previa', 'gravando', 'pronto']);
    const textos = [
      RECUSA_ARQUIVO, textoDoAviso({ codigo: 'filtro_maior' }), textoDoAviso({ codigo: 'buraco_presencas' }),
      falhaDaGravacao({ lancado: new Error('x') }).texto, falhaDaGravacao({ resultado: { lote: 1, lotes: 2 } }).texto,
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–]/);
  });
});
