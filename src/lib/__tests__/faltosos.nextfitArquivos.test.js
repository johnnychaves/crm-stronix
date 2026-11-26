// Os relatórios Faltantes e Presenças da Next Fit
// (src/lib/faltosos/nextfitArquivos.js): reconhecer pelo cabeçalho e ler as
// linhas. As linhas aqui têm o formato que readSpreadsheetFile devolve
// (objetos chaveados pelo cabeçalho, com __row), com o cabeçalho das planilhas
// de verdade e nomes e telefones inventados. Planilha de verdade nunca entra
// no repositório.
import { describe, it, expect } from 'vitest';
import {
  FALTANTES_HEADER, PRESENCAS_HEADER, NAO_E_DA_NEXTFIT, nomeChave, detectReport, lerDiaEHora,
  parseFaltantes, dataDoFaltantes, parsePresencas, periodoDasPresencas, modalidadeDeVerdade,
} from '../faltosos/nextfitArquivos.js';

const faltante = (__row, nome, ultima, ausencias, extra = {}) => ({
  __row,
  Nome: nome,
  Contrato: 'Plano Anual',
  'Qtde de ausências': ausencias,
  'Última presença': ultima,
  Telefone: '(51) 9 9000-0001',
  Professor: 'Ana Paula Ribeiro',
  Consultor: 'Carla Mendes',
  ...extra,
});

const presenca = (__row, nome, data, tipo = 'Acesso', modalidade = 'offf') => ({
  __row, Cliente: nome, Modalidade: modalidade, Contrato: 'Plano Anual', Tipo: tipo, Data: data,
});

describe('nomeChave', () => {
  it('sem acento, minúsculo, só letras e números, espaço único', () => {
    expect(nomeChave('  JOÃO   da Silva-Neto ')).toBe('joao da silva neto');
    expect(nomeChave("D'Ávila")).toBe('d avila');
    expect(nomeChave('Última  presença')).toBe('ultima presenca');
    expect(nomeChave(null)).toBe('');
    expect(nomeChave(0)).toBe('0');
  });
});

describe('detectReport', () => {
  it('reconhece os dois relatórios pelo cabeçalho de verdade', () => {
    expect(detectReport(['Nome', 'Contrato', 'Qtde de ausências', 'Última presença', 'Telefone', 'Professor', 'Consultor'])).toBe('faltantes');
    expect(detectReport(['Cliente', 'Modalidade', 'Contrato', 'Tipo', 'Data'])).toBe('presencas');
    expect(detectReport([...FALTANTES_HEADER])).toBe('faltantes');
    expect(detectReport([...PRESENCAS_HEADER])).toBe('presencas');
  });

  it('ordem, caixa, acento e espaço não importam', () => {
    expect(detectReport(['DATA', 'tipo', ' Cliente ', 'Contrato', 'Modalidade'])).toBe('presencas');
    expect(detectReport(['Nome', 'Contrato', 'Qtde de Ausencias', 'Ultima  presenca', 'Telefone', 'Professor', 'Consultor'])).toBe('faltantes');
  });

  it('coluna a mais não atrapalha', () => {
    expect(detectReport([...PRESENCAS_HEADER, 'Unidade'])).toBe('presencas');
  });

  it('recusa o relatório Acessos, arquivo incompleto e arquivo vazio', () => {
    expect(detectReport(['AcessoLiberado', 'Cliente', 'Contrato', 'Acesso', 'ModoReconhecimento', 'Offline', 'Motivo'])).toBeNull();
    expect(detectReport(['Nome', 'Contrato', 'Telefone'])).toBeNull();
    expect(detectReport([])).toBeNull();
    expect(detectReport(null)).toBeNull();
  });

  it('um arquivo com as colunas dos dois não é nenhum', () => {
    expect(detectReport([...FALTANTES_HEADER, ...PRESENCAS_HEADER])).toBeNull();
  });

  it('a recusa tem a frase da spec', () => {
    expect(NAO_E_DA_NEXTFIT).toBe('Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.');
  });
});

describe('lerDiaEHora', () => {
  it('texto do jeito que a Next Fit exporta', () => {
    expect(lerDiaEHora('25/09/2026')).toEqual({ dia: '2026-09-25', hora: null });
    expect(lerDiaEHora('02/10/2026 07:00')).toEqual({ dia: '2026-10-02', hora: '07:00' });
    expect(lerDiaEHora('2/10/2026 7:05:59')).toEqual({ dia: '2026-10-02', hora: '07:05' });
    expect(lerDiaEHora('2026-10-02T18:30:00')).toEqual({ dia: '2026-10-02', hora: '18:30' });
  });

  it('Date do SheetJS: o relógio da célula nos getters locais', () => {
    expect(lerDiaEHora(new Date(2026, 8, 25))).toEqual({ dia: '2026-09-25', hora: '00:00' });
    expect(lerDiaEHora(new Date(2026, 9, 2, 18, 30))).toEqual({ dia: '2026-10-02', hora: '18:30' });
  });

  it('número de série do Excel, com e sem hora', () => {
    expect(lerDiaEHora(46290)).toEqual({ dia: '2026-09-25', hora: null });
    expect(lerDiaEHora(46297 + 7 / 24)).toEqual({ dia: '2026-10-02', hora: '07:00' });
  });

  it('o que não é data dá null', () => {
    expect(lerDiaEHora('31/02/2026')).toBeNull();
    expect(lerDiaEHora('02/10/2026 25:00')).toEqual({ dia: '2026-10-02', hora: null });
    expect(lerDiaEHora('ontem')).toBeNull();
    expect(lerDiaEHora('')).toBeNull();
    expect(lerDiaEHora(new Date('x'))).toBeNull();
    expect(lerDiaEHora('25/09/26')).toBeNull();
    expect(lerDiaEHora(-1)).toBeNull();
  });
});

describe('parseFaltantes', () => {
  it('lê cada coluna, com a data em texto AAAA-MM-DD', () => {
    const { linhas, erros } = parseFaltantes([faltante(2, '  Fulano  de Teste ', '29/09/2026', 7)]);
    expect(erros).toEqual([]);
    expect(linhas).toEqual([{
      numero: 2,
      nome: 'Fulano de Teste',
      contrato: 'Plano Anual',
      ausencias: 7,
      ultimaPresenca: '2026-09-29',
      telefone: '(51) 9 9000-0001',
      professorNextFit: 'Ana Paula Ribeiro',
      consultorNextFit: 'Carla Mendes',
    }]);
  });

  it('aceita a quantidade em texto e a data como célula de data', () => {
    const { linhas } = parseFaltantes([faltante(2, 'Beltrana Teste', new Date(2026, 8, 25), '11')]);
    expect(linhas[0]).toMatchObject({ ausencias: 11, ultimaPresenca: '2026-09-25' });
  });

  it('campos vazios viram null', () => {
    const { linhas } = parseFaltantes([faltante(2, 'Sicrano Teste', '29/09/2026', 7, { Telefone: '', Professor: '  ', Consultor: null, Contrato: '' })]);
    expect(linhas[0]).toMatchObject({ telefone: null, professorNextFit: null, consultorNextFit: null, contrato: null });
  });

  it('lê pelo cabeçalho de verdade, mesmo com outra caixa', () => {
    const row = { __row: 3, NOME: 'Fulano Teste', contrato: 'Mensal', 'Qtde de Ausencias': 8, 'ULTIMA PRESENCA': '28/09/2026', telefone: '(51) 3333-0000', professor: '', consultor: '' };
    expect(parseFaltantes([row]).linhas[0]).toMatchObject({ nome: 'Fulano Teste', ausencias: 8, ultimaPresenca: '2026-09-28', telefone: '(51) 3333-0000' });
  });

  it('linha sem nome, sem data ou sem quantidade vai para os erros, com o número da linha', () => {
    const { linhas, erros } = parseFaltantes([
      faltante(2, '', '29/09/2026', 7),
      faltante(3, 'Fulano Teste', 'sem data', 7),
      faltante(4, 'Beltrana Teste', '29/09/2026', '7 dias'),
      faltante(5, 'Sicrano Teste', '29/09/2026', -1),
      faltante(6, 'Total: 3', '', ''),
    ]);
    expect(linhas).toEqual([]);
    expect(erros.map((e) => e.numero)).toEqual([2, 3, 4, 5, 6]);
    expect(erros[0]).toEqual({ numero: 2, nome: null, motivo: 'Linha sem nome.' });
    expect(erros[1]).toEqual({ numero: 3, nome: 'Fulano Teste', motivo: 'A última presença não é uma data.' });
    expect(erros[2]).toEqual({ numero: 4, nome: 'Beltrana Teste', motivo: 'A quantidade de ausências não é um número.' });
  });

  it('sem __row, o número é o da linha na planilha, contando o cabeçalho', () => {
    const { __row, ...semNumero } = faltante(0, 'Fulano Teste', '29/09/2026', 7);
    expect(__row).toBe(0);
    expect(parseFaltantes([semNumero]).linhas[0].numero).toBe(2);
  });
});

describe('dataDoFaltantes', () => {
  it('é a última presença mais as ausências, igual em todas as linhas', () => {
    const { linhas } = parseFaltantes([
      faltante(2, 'A Teste', '29/09/2026', 7),
      faltante(3, 'B Teste', '22/09/2026', 14),
      faltante(4, 'C Teste', '06/08/2026', 61),
    ]);
    expect(dataDoFaltantes(linhas)).toEqual({ dia: '2026-10-06', divergentes: 0 });
  });

  it('com linhas que não batem, vale o dia mais comum e as outras são contadas', () => {
    const { linhas } = parseFaltantes([
      faltante(2, 'A Teste', '29/09/2026', 7),
      faltante(3, 'B Teste', '22/09/2026', 14),
      faltante(4, 'C Teste', '22/09/2026', 13),
    ]);
    expect(dataDoFaltantes(linhas)).toEqual({ dia: '2026-10-06', divergentes: 1 });
  });

  it('no empate, o dia mais novo', () => {
    const { linhas } = parseFaltantes([faltante(2, 'A Teste', '29/09/2026', 7), faltante(3, 'B Teste', '29/09/2026', 6)]);
    expect(dataDoFaltantes(linhas)).toEqual({ dia: '2026-10-06', divergentes: 1 });
  });

  it('sem linha, sem dia', () => {
    expect(dataDoFaltantes([])).toEqual({ dia: null, divergentes: 0 });
    expect(dataDoFaltantes(null)).toEqual({ dia: null, divergentes: 0 });
  });
});

describe('parsePresencas', () => {
  it('Acesso é catraca, Agenda é agenda, e a hora vem da célula', () => {
    const { linhas, erros } = parsePresencas([
      presenca(2, 'Fulano Teste', '02/10/2026 07:00', 'Acesso', 'Musculação'),
      presenca(3, 'Beltrana Teste', '02/10/2026 18:30', 'Agenda', 'Pilates'),
    ]);
    expect(erros).toEqual([]);
    expect(linhas).toEqual([
      { numero: 2, nome: 'Fulano Teste', contrato: 'Plano Anual', modalidade: 'Musculação', origem: 'catraca', dia: '2026-10-02', hora: '07:00' },
      { numero: 3, nome: 'Beltrana Teste', contrato: 'Plano Anual', modalidade: 'Pilates', origem: 'agenda', dia: '2026-10-02', hora: '18:30' },
    ]);
  });

  it('"offf", "off" e vazio não são modalidade', () => {
    expect(modalidadeDeVerdade('offf')).toBeNull();
    expect(modalidadeDeVerdade(' OFF ')).toBeNull();
    expect(modalidadeDeVerdade('')).toBeNull();
    expect(modalidadeDeVerdade('Funcional')).toBe('Funcional');
    const { linhas } = parsePresencas([presenca(2, 'Fulano Teste', '02/10/2026 07:00', 'Acesso', 'offf')]);
    expect(linhas[0].modalidade).toBeNull();
  });

  it('tipo desconhecido, data ilegível e linha sem nome vão para os erros', () => {
    const { linhas, erros } = parsePresencas([
      presenca(2, 'Fulano Teste', '02/10/2026 07:00', 'Liberação manual'),
      presenca(3, 'Beltrana Teste', 'amanhã', 'Acesso'),
      presenca(4, '', '02/10/2026 07:00', 'Acesso'),
      presenca(5, 'Sicrano Teste', '02/10/2026 07:00', ''),
    ]);
    expect(linhas).toEqual([]);
    expect(erros.map((e) => e.motivo)).toEqual([
      'O tipo "Liberação manual" não é Acesso nem Agenda.', 'A data não dá para ler.', 'Linha sem nome do cliente.', 'Linha sem tipo.',
    ]);
  });

  it('o período vai do primeiro ao último dia do arquivo', () => {
    const { linhas } = parsePresencas([
      presenca(2, 'A Teste', '02/10/2026 12:51'),
      presenca(3, 'B Teste', '01/10/2026 06:03'),
      presenca(4, 'C Teste', '01/10/2026 19:00', 'Agenda', 'Pilates'),
    ]);
    expect(periodoDasPresencas(linhas)).toEqual({ de: '2026-10-01', ate: '2026-10-02' });
    expect(periodoDasPresencas([])).toBeNull();
  });
});
