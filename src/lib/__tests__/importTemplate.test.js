// Modelo de planilha do Stronilead: a tabela de colunas é a fonte única do
// cabeçalho, e a conferência decide se o arquivo que subiu é o modelo.

import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_COLUMNS,
  NOT_TEMPLATE_MESSAGE,
  normalizeHeader,
  templateHeaderLabel,
  checkTemplateHeaders,
  templateMapping,
  buildTemplateSpec,
  uniqueSortedNames
} from '../importTemplate.js';
import { parseRow } from '../clientImport.js';

const LABELS = TEMPLATE_COLUMNS.map(templateHeaderLabel);

// Campos que parseRow (clientImport.js) lê de uma linha, descobertos pelo
// próprio parseRow: um mapeamento espião anota cada campo pedido.
const PARSE_ROW_FIELDS = (() => {
  const read = new Set();
  parseRow({}, new Proxy({}, { get: (_, k) => { if (typeof k === 'string') read.add(k); return undefined; } }), 2, new Date(2026, 8, 24));
  return [...read];
})();

// Cabeçalho da exportação de cadastro do NextFit: divide só Nome e CPF com as
// obrigatórias do modelo.
const NEXTFIT_HEADERS = [
  'Nome', 'E-mail', 'Contrato', 'Telefone', 'Situação do contrato', 'Situação do cliente',
  'CPF', 'RG', 'Data de nascimento', 'Data de cadastro', 'Objetivo', 'Sexo', 'VIP',
  'Endereco', 'Número', 'Bairro', 'Cep', 'Cidade', 'Complemento', 'Consultor', 'Professor'
];

describe('normalizeHeader', () => {
  it('tira acento, caixa, pontuação e o asterisco', () => {
    expect(normalizeHeader('Início da vigência *')).toBe('inicio da vigencia');
    expect(normalizeHeader('  Situação  do_Contrato ')).toBe('situacao do contrato');
    expect(normalizeHeader('E-mail')).toBe('e mail');
  });
});

describe('TEMPLATE_COLUMNS', () => {
  it('traz todos os campos que parseRow lê, menos a situação do cliente, sem repetir', () => {
    const fields = TEMPLATE_COLUMNS.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect([...fields].sort()).toEqual(PARSE_ROW_FIELDS.filter((f) => f !== 'clientSituation').sort());
  });

  it('as obrigatórias são Nome, CPF, WhatsApp, Plano, Início e Fim, e vêm primeiro', () => {
    expect(TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.header))
      .toEqual(['Nome', 'CPF', 'WhatsApp', 'Plano', 'Início da vigência', 'Fim da vigência']);
    expect(TEMPLATE_COLUMNS.slice(0, 6).every((c) => c.required)).toBe(true);
  });

  it('o rótulo da obrigatória leva asterisco', () => {
    expect(LABELS[0]).toBe('Nome *');
    expect(LABELS[6]).toBe('Valor total do contrato');
  });

  it('nenhum cabeçalho colide com outro depois de normalizado', () => {
    const keys = TEMPLATE_COLUMNS.map((c) => normalizeHeader(c.header));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('checkTemplateHeaders', () => {
  it('aceita o modelo como sai do gerador', () => {
    expect(checkTemplateHeaders(LABELS)).toEqual({ ok: true, missing: [], message: null });
  });

  it('aceita outra ordem, sem asterisco, com caixa e acento trocados', () => {
    const headers = [...TEMPLATE_COLUMNS].reverse()
      .map((c) => c.header.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    expect(checkTemplateHeaders(headers).ok).toBe(true);
  });

  it('aceita o modelo sem as colunas opcionais', () => {
    expect(checkTemplateHeaders(TEMPLATE_COLUMNS.filter((c) => c.required).map(templateHeaderLabel)).ok).toBe(true);
  });

  it('recusa a exportação do NextFit como "não é o modelo"', () => {
    expect(checkTemplateHeaders(NEXTFIT_HEADERS)).toMatchObject({ ok: false, message: NOT_TEMPLATE_MESSAGE });
  });

  it('recusa arquivo sem cabeçalho', () => {
    expect(checkTemplateHeaders([])).toMatchObject({ ok: false, message: NOT_TEMPLATE_MESSAGE });
  });

  it('nomeia a obrigatória que falta', () => {
    const headers = LABELS.filter((h) => h !== 'Fim da vigência *');
    expect(checkTemplateHeaders(headers))
      .toEqual({ ok: false, missing: ['Fim da vigência'], message: 'Falta a coluna Fim da vigência.' });
  });

  it('nomeia todas quando faltam duas', () => {
    const headers = LABELS.filter((h) => h !== 'Plano *' && h !== 'Fim da vigência *');
    expect(checkTemplateHeaders(headers))
      .toMatchObject({ ok: false, message: 'Faltam as colunas Plano e Fim da vigência.' });
  });

  it('com três obrigatórias faltando deixa de reconhecer o arquivo', () => {
    const gone = ['Plano *', 'Início da vigência *', 'Fim da vigência *'];
    expect(checkTemplateHeaders(LABELS.filter((h) => !gone.includes(h))).message).toBe(NOT_TEMPLATE_MESSAGE);
  });
});

describe('templateMapping', () => {
  it('devolve o cabeçalho REAL do arquivo para cada campo', () => {
    const m = templateMapping(LABELS.map((h) => h.toUpperCase()));
    expect(m.name).toBe('NOME *');
    expect(m.contractEndsAt).toBe('FIM DA VIGÊNCIA *');
    expect(m.contractValue).toBe('VALOR TOTAL DO CONTRATO');
  });

  it('coluna opcional apagada fica nula', () => {
    expect(templateMapping(LABELS.filter((h) => h !== 'Cidade')).addrCity).toBeNull();
  });

  it('com dois cabeçalhos que viram a mesma chave, vale o primeiro', () => {
    const m = templateMapping(['NOME', ...LABELS]);
    expect(m.name).toBe('NOME');
  });

  it('a cópia renomeada pelo leitor ("Plano * (2)") nunca toma o lugar da coluna certa', () => {
    const m = templateMapping([...LABELS, 'Plano * (2)']);
    expect(m.planName).toBe('Plano *');
  });

  it('alimenta parseRow sem ajuste nenhum', () => {
    const row = {
      __row: 2,
      'Nome *': 'Ana Teste',
      'CPF *': '012.345.678-90',
      'WhatsApp *': '(71) 99999-0001',
      'Plano *': 'Trimestral',
      'Início da vigência *': '12/08/2026',
      'Fim da vigência *': '12/11/2026',
      'Valor total do contrato': '1.200,50',
      'Situação do contrato': 'Trancado',
      'Consultor': 'Bia',
      'VIP': 'Sim'
    };
    const c = parseRow(row, templateMapping(LABELS), 2, new Date(2026, 8, 24));
    expect(c).toMatchObject({
      name: 'Ana Teste',
      cpfDigits: '01234567890',
      whatsappDigits: '71999990001',
      planName: 'Trimestral',
      value: 1200.5,
      contractSituation: 'trancado',
      consultantName: 'Bia',
      vip: true
    });
    expect(c.startsAt).toEqual(new Date(2026, 7, 12));
    expect(c.endsAt).toEqual(new Date(2026, 10, 12));
  });
});

describe('uniqueSortedNames', () => {
  it('tira repetido pelo nome normalizado, apara espaço e ordena em pt-BR', () => {
    expect(uniqueSortedNames([{ name: 'Trimestral' }, { name: 'Ágil' }, { name: '  trimestral ' }, { name: 'Anual' }, { name: '' }, null]))
      .toEqual(['Ágil', 'Anual', 'Trimestral']);
  });
});

describe('buildTemplateSpec', () => {
  const NOW = new Date(2026, 8, 24, 15, 30);
  const spec = buildTemplateSpec({
    planos: [{ id: 'p2', name: 'Trimestral' }, { id: 'p1', name: 'Anual' }, { id: 'p3', name: ' trimestral ' }],
    users: [{ id: 'u2', name: 'Bia' }, { id: 'u1', name: 'Ana' }],
    professores: [],
    windowDays: 15,
    tenantId: 'Academia Teste',
    now: NOW
  });
  const col = (field) => spec.columns.find((c) => c.field === field);

  it('nome do arquivo com a academia e o dia', () => {
    expect(spec.fileName).toBe('modelo-stronilead-academia-teste-2026-09-24.xlsx');
  });

  it('a aba Clientes é a primeira', () => {
    expect(spec.sheets).toEqual({ CLIENTES: 'Clientes', AJUDA: 'Como preencher', LISTAS: 'Listas' });
    expect(Object.values(spec.sheets)[0]).toBe('Clientes');
  });

  it('listas sem nome repetido e em ordem alfabética', () => {
    const byTitle = Object.fromEntries(spec.lists.map((l) => [l.title, l]));
    expect(byTitle.Planos).toEqual({ letter: 'A', title: 'Planos', names: ['Anual', 'Trimestral'] });
    expect(byTitle.Equipe.names).toEqual(['Ana', 'Bia']);
    expect(byTitle.Professores.names).toEqual([]);
  });

  it('colunas na ordem da tabela, com letra, rótulo e intervalo até a linha 5001', () => {
    expect(spec.columns.map((c) => c.field)).toEqual(TEMPLATE_COLUMNS.map((c) => c.field));
    expect(spec.columns.slice(0, 3).map((c) => c.letter)).toEqual(['A', 'B', 'C']);
    expect(col('addrCity').letter).toBe('W');
    expect(col('name').label).toBe('Nome *');
    expect(col('cpf').range).toBe('B2:B5001');
  });

  it('texto fica como texto, data como data e valor em reais', () => {
    expect(col('cpf').numFmt).toBe('@');
    expect(col('whatsapp').numFmt).toBe('@');
    expect(col('addrCep').numFmt).toBe('@');
    expect(col('addrNumber').numFmt).toBe('@');
    expect(col('contractStartsAt').numFmt).toBe('dd/mm/yyyy');
    expect(col('contractEndsAt').numFmt).toBe('dd/mm/yyyy');
    expect(col('contractValue').numFmt).toBe('"R$" #,##0.00');
  });

  it('plano e consultor apontam para a aba Listas e só avisam', () => {
    expect(col('planName').validation).toMatchObject({ type: 'list', formulae: ['Listas!$A$2:$A$3'], errorStyle: 'warning', allowBlank: true, showErrorMessage: true });
    expect(col('consultantName').validation).toMatchObject({ type: 'list', formulae: ['Listas!$B$2:$B$3'], errorStyle: 'warning' });
    expect(col('planName').validation.error).toBe('Esse nome não está na lista. Se continuar, ele é acertado na importação.');
  });

  it('lista vazia fica sem validação', () => {
    expect(col('professorName').validation).toBeNull();
  });

  it('situação, sexo e VIP são listas fixas e travadas', () => {
    expect(col('contractSituation').validation).toMatchObject({ type: 'list', formulae: ['"Ativo,Trancado"'], errorStyle: 'stop' });
    expect(col('sexo').validation.formulae).toEqual(['"Masculino,Feminino,Outro"']);
    expect(col('vip').validation.formulae).toEqual(['"Sim,Não"']);
  });

  it('datas travadas entre 1900 e 2100, em número serial do Excel', () => {
    expect(col('contractStartsAt').validation).toMatchObject({ type: 'date', operator: 'between', formulae: [1, 73415], errorStyle: 'stop', error: 'Digite uma data, como 15/03/2026.' });
    expect(col('birthDate').validation.type).toBe('date');
  });

  it('o fim exige data igual ou depois do início da mesma linha', () => {
    expect(col('contractEndsAt').validation).toMatchObject({
      type: 'custom',
      formulae: ['AND(ISNUMBER(F2),OR(E2="",F2>=E2))'],
      errorStyle: 'stop',
      error: 'O fim precisa ser uma data igual ou depois do início, como 15/03/2026.'
    });
  });

  it('valor aceita só número maior ou igual a zero', () => {
    expect(col('contractValue').validation).toMatchObject({ type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], errorStyle: 'stop' });
  });

  it('texto livre fica sem validação', () => {
    expect(col('name').validation).toBeNull();
    expect(col('email').validation).toBeNull();
  });

  it('"Como preencher" traz a academia, o dia e a janela de Vencidos', () => {
    const text = spec.help.lines.map((l) => l.text).join('\n');
    expect(text).toContain('Gerado para Academia Teste em 24/09/2026.');
    expect(text).toContain('venceu há no máximo 15 dias');
    expect(text).not.toMatch(/[—–]/);
  });

  it('o exemplo usa as nove primeiras colunas e o primeiro plano da lista', () => {
    expect(spec.help.example.headers).toEqual(spec.columns.slice(0, 9).map((c) => c.label));
    expect(spec.help.example.rows).toHaveLength(2);
    expect(spec.help.example.rows.every((r) => r.length === 9)).toBe(true);
    expect(spec.help.example.rows[0][3]).toBe('Anual');
    expect(spec.help.example.rows[0][8]).toBe('Ana');
  });

  it('sem academia no claim o arquivo e o texto não quebram', () => {
    const s = buildTemplateSpec({ planos: [{ name: 'Mensal' }], users: [], professores: [], windowDays: 15, tenantId: null, now: NOW });
    expect(s.fileName).toBe('modelo-stronilead-academia-2026-09-24.xlsx');
    expect(s.help.lines[1].text).toBe('Gerado para a academia em 24/09/2026.');
  });
});
