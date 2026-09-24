// Modelo de planilha do Stronilead: a tabela de colunas é a fonte única do
// cabeçalho, e a conferência decide se o arquivo que subiu é o modelo.

import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_COLUMNS,
  NOT_TEMPLATE_MESSAGE,
  normalizeHeader,
  templateHeaderLabel,
  checkTemplateHeaders,
  templateMapping
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
