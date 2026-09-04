// Presets de importação: a assinatura reconhece o sistema, o mapeamento casa o
// cabeçalho real do arquivo (com acento, caixa e pontuação diferentes) e o que
// nenhum preset conhece cai no chute por sinônimo.

import { describe, it, expect } from 'vitest';
import {
  normalizeHeader,
  detectPreset,
  buildMapping,
  importSourceLabel,
  IMPORT_PRESETS,
  TARGET_FIELDS
} from '../importPresets.js';

const NEXTFIT_HEADERS = [
  'Nome', 'E-mail', 'Contrato', 'Telefone', 'Situação do contrato', 'Situação do cliente',
  'CPF', 'RG', 'Data de nascimento', 'Data de cadastro', 'Objetivo', 'Sexo', 'VIP',
  'Endereco', 'Número', 'Bairro', 'Cep', 'Cidade', 'Complemento', 'Consultor', 'Professor'
];

describe('normalizeHeader', () => {
  it('tira acento, caixa e pontuação e colapsa espaços', () => {
    expect(normalizeHeader('  Situação  do_Contrato ')).toBe('situacao do contrato');
    expect(normalizeHeader('E-mail')).toBe('e mail');
    expect(normalizeHeader('DATA DE NASCIMENTO')).toBe('data de nascimento');
  });
});

describe('detectPreset', () => {
  it('reconhece o NextFit pelos cabeçalhos da exportação de cadastro', () => {
    expect(detectPreset(NEXTFIT_HEADERS)?.id).toBe('nextfit');
  });

  it('reconhece mesmo com caixa e acento diferentes', () => {
    const headers = NEXTFIT_HEADERS.map((h) => h.toUpperCase().replace('Ç', 'C'));
    expect(detectPreset(headers)?.id).toBe('nextfit');
  });

  it('não reconhece um relatório de contratos (falta a assinatura)', () => {
    expect(detectPreset(['Nome', 'CPF', 'Contrato', 'Data de início', 'Data de fim', 'Valor'])).toBeNull();
  });

  it('todo preset tem id, label, assinatura e colunas', () => {
    IMPORT_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.signature.length).toBeGreaterThan(0);
      Object.keys(p.columns).forEach((field) => {
        expect(TARGET_FIELDS.some((f) => f.id === field)).toBe(true);
      });
    });
  });
});

describe('buildMapping', () => {
  it('com o preset do NextFit mapeia os 21 cabeçalhos para os campos certos', () => {
    const m = buildMapping(NEXTFIT_HEADERS, detectPreset(NEXTFIT_HEADERS));
    expect(m.name).toBe('Nome');
    expect(m.whatsapp).toBe('Telefone');
    expect(m.planName).toBe('Contrato');
    expect(m.contractSituation).toBe('Situação do contrato');
    expect(m.clientSituation).toBe('Situação do cliente');
    expect(m.registeredAt).toBe('Data de cadastro');
    expect(m.dor).toBe('Objetivo');
    expect(m.addrStreet).toBe('Endereco');
    expect(m.addrNumber).toBe('Número');
    expect(m.addrCep).toBe('Cep');
    expect(m.consultantName).toBe('Consultor');
    expect(m.professorName).toBe('Professor');
    expect(m.contractEndsAt).toBeNull();
    expect(m.contractStartsAt).toBeNull();
    expect(m.contractValue).toBeNull();
  });

  it('devolve o cabeçalho REAL do arquivo, não o do preset', () => {
    const headers = NEXTFIT_HEADERS.map((h) => h.toUpperCase());
    const m = buildMapping(headers, detectPreset(headers));
    expect(m.name).toBe('NOME');
    expect(m.contractSituation).toBe('SITUAÇÃO DO CONTRATO');
  });

  it('sem preset chuta por sinônimo (relatório de contratos)', () => {
    const headers = ['Nome', 'CPF', 'Contrato', 'Data de início', 'Data de fim', 'Valor', 'Situação do contrato'];
    const m = buildMapping(headers, null);
    expect(m.name).toBe('Nome');
    expect(m.cpf).toBe('CPF');
    expect(m.planName).toBe('Contrato');
    expect(m.contractStartsAt).toBe('Data de início');
    expect(m.contractEndsAt).toBe('Data de fim');
    expect(m.contractValue).toBe('Valor');
    expect(m.contractSituation).toBe('Situação do contrato');
    expect(m.whatsapp).toBeNull();
  });

  it('um cabeçalho nunca alimenta dois campos', () => {
    const m = buildMapping(['Vencimento'], null);
    const used = Object.values(m).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
    expect(m.contractEndsAt).toBe('Vencimento');
  });

  it('todo campo-alvo aparece no mapeamento, mesmo que nulo', () => {
    const m = buildMapping(['Qualquer coisa'], null);
    TARGET_FIELDS.forEach((f) => expect(f.id in m).toBe(true));
  });
});

describe('importSourceLabel', () => {
  it('usa o rótulo do preset ou "planilha" sem preset', () => {
    expect(importSourceLabel(IMPORT_PRESETS[0])).toBe('NextFit');
    expect(importSourceLabel(null)).toBe('planilha');
  });
});
