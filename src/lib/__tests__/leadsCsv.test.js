// Planilha de Todos os leads (src/lib/leadsCsv.js): o cabeçalho, o que cada
// coluna recebe e o arquivo inteiro. O exportar passou para a planilha única do
// app (csvExport.js), e a spec pede que Todos os leads continue com as mesmas
// colunas de antes: o texto esperado abaixo foi gerado pelo código que a
// LeadsView tinha antes de as colunas irem para este arquivo.
import { describe, it, expect } from 'vitest';
import { LEADS_CSV_COLUMNS, leadCsvRow, leadsToCsv } from '../leadsCsv.js';

const NOW = new Date(2026, 9, 9, 15);

const ADULTO = {
  id: 'l1', name: 'Ana Souza', whatsapp: '(51) 99999-0000', source: 'Instagram', referredByName: 'Bruno Lima',
  status: 'Novo lead', consultantName: 'Carla Dias', createdAt: new Date(2026, 8, 2, 14, 30),
  observation: 'Quer treinar de manhã', lossReason: '',
};
// Criança de 11 anos: quem o consultor chama é a mãe, e o WhatsApp do aluno fica vazio.
const MENOR = {
  id: 'l2', name: 'Pedro Souza', whatsapp: '', isMinor: true, birthDate: new Date(2015, 4, 10),
  guardian: { name: 'Maria Souza', phone: '(51) 98888-7777', relationship: 'Mãe' },
  source: 'Indicação', referredByName: '', status: 'Visita agendada', consultantName: 'Carla Dias',
  createdAt: new Date(2026, 9, 1), observation: '', lossReason: '',
};
// Valores que o Excel executaria, com ponto e vírgula, aspas e quebra de linha.
const ARRISCADO = {
  id: 'l3', name: '=SOMA(1;2)', whatsapp: '+5551999990000', source: 'Site', referredByName: '-Fulano',
  status: 'Perda', consultantName: '@carla', createdAt: new Date(2026, 7, 15),
  observation: 'Disse "não" e;\nvolta depois', lossReason: 'Preço',
};
const VAZIO = { id: 'l4' };

describe('colunas', () => {
  it('o cabeçalho é o de sempre, na ordem de sempre', () => {
    expect(LEADS_CSV_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'Origem', 'Indicado por', 'Fase do Funil',
      'Consultor', 'Data Cadastro', 'Observação', 'Motivo Perda',
    ]);
  });

  it('nada muda em tempo de execução', () => {
    expect(Object.isFrozen(LEADS_CSV_COLUMNS)).toBe(true);
    expect(LEADS_CSV_COLUMNS.every((c) => Object.isFrozen(c))).toBe(true);
  });
});

describe('linha de um lead', () => {
  it('leva uma chave para cada coluna, na mesma ordem, e cada uma com o campo do lead', () => {
    const row = leadCsvRow(ADULTO, NOW);
    expect(Object.keys(row)).toEqual(LEADS_CSV_COLUMNS.map((c) => c.key));
    expect(row).toEqual({
      nome: 'Ana Souza',
      whatsapp: '(51) 99999-0000',
      responsavel: '',
      telefoneResponsavel: '',
      origem: 'Instagram',
      indicadoPor: 'Bruno Lima',
      fase: 'Novo lead',
      consultor: 'Carla Dias',
      cadastro: '02/09/2026',
      observacao: 'Quer treinar de manhã',
      motivoPerda: '',
    });
  });

  it('no menor, o responsável e o telefone dele vão nas colunas do responsável, e o WhatsApp é o do aluno', () => {
    expect(leadCsvRow(MENOR, NOW)).toMatchObject({
      nome: 'Pedro Souza', whatsapp: '', responsavel: 'Maria Souza (mãe)', telefoneResponsavel: '(51) 98888-7777',
    });
    // O mesmo lead, depois dos 18 anos e com WhatsApp próprio, volta a ser o contato.
    const adulto = { ...MENOR, whatsapp: '(51) 97777-6666', birthDate: new Date(2008, 0, 5) };
    expect(leadCsvRow(adulto, NOW)).toMatchObject({ whatsapp: '(51) 97777-6666', responsavel: '', telefoneResponsavel: '' });
  });

  it('lead sem dados vira linha de células vazias, sem a data', () => {
    const row = leadCsvRow(VAZIO, NOW);
    expect(Object.keys(row)).toEqual(LEADS_CSV_COLUMNS.map((c) => c.key));
    expect(Object.values(row).every((v) => v === undefined || v === '')).toBe(true);
    expect(row.cadastro).toBe('');
  });
});

describe('arquivo inteiro', () => {
  it('sai igual ao que a tela montava antes: ; entre as colunas, aspas só quando o valor pede e a proteção contra fórmula', () => {
    expect(leadsToCsv([ADULTO, MENOR, ARRISCADO, VAZIO], NOW)).toBe([
      'Nome;WhatsApp;Responsável do aluno;Telefone do responsável;Origem;Indicado por;Fase do Funil;Consultor;Data Cadastro;Observação;Motivo Perda',
      'Ana Souza;(51) 99999-0000;;;Instagram;Bruno Lima;Novo lead;Carla Dias;02/09/2026;Quer treinar de manhã;',
      'Pedro Souza;;Maria Souza (mãe);(51) 98888-7777;Indicação;;Visita agendada;Carla Dias;01/10/2026;;',
      `"'=SOMA(1;2)";'+5551999990000;;;Site;'-Fulano;Perda;'@carla;15/08/2026;"Disse ""não"" e;\nvolta depois";Preço`,
      ';;;;;;;;;;',
    ].join('\r\n'));
  });

  it('sem leads, só o cabeçalho', () => {
    const header = LEADS_CSV_COLUMNS.map((c) => c.label).join(';');
    expect(leadsToCsv([], NOW)).toBe(header);
    expect(leadsToCsv(null, NOW)).toBe(header);
  });

  it('o relógio entra pelo now: o mesmo lead sai com o responsável na véspera dos 18 anos e com o aluno no dia', () => {
    const lead = { ...MENOR, whatsapp: '(51) 97777-6666', birthDate: new Date(2008, 9, 9) };
    const linha = (now) => leadsToCsv([lead], now).split('\r\n')[1];
    expect(linha(new Date(2026, 9, 8, 23, 59))).toContain(';Maria Souza (mãe);(51) 98888-7777;');
    expect(linha(new Date(2026, 9, 9, 0, 0))).toBe(
      'Pedro Souza;(51) 97777-6666;;;Indicação;;Visita agendada;Carla Dias;01/10/2026;;'
    );
  });
});
