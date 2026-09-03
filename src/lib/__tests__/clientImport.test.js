// Regra pura da importação de clientes. Datas sempre em horário LOCAL.

import { describe, it, expect } from 'vitest';
import {
  normalizePhoneDigits,
  isValidCpf,
  normalizeCpfDigits,
  normalizeName,
  parseImportDate,
  normalizeSexo,
  isTruthyCell,
  contractSituationFromText,
  clientSituationFromText,
  CONTRACT_SITUATION
} from '../clientImport.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 9, 3);

describe('normalizePhoneDigits', () => {
  it('tira o 55 do país e fica com DDD + número', () => {
    expect(normalizePhoneDigits('5571999998888')).toBe('71999998888');
    expect(normalizePhoneDigits('+55 (71) 99999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('557133334444')).toBe('7133334444');
  });

  it('aceita máscara, espaço e fixo de 10 dígitos', () => {
    expect(normalizePhoneDigits('(71) 9 9999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('71 3333-4444')).toBe('7133334444');
  });

  it('fora de 10 ou 11 dígitos não casa', () => {
    expect(normalizePhoneDigits('99998888')).toBeNull();
    expect(normalizePhoneDigits('')).toBeNull();
    expect(normalizePhoneDigits(null)).toBeNull();
    expect(normalizePhoneDigits('123456789012345')).toBeNull();
  });

  it('tira o 0 de tronco legado (0xx DDD)', () => {
    expect(normalizePhoneDigits('(0xx71) 3333-4444')).toBe('7133334444');
    expect(normalizePhoneDigits('(0xx71) 99999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('0 55 3333-4444')).toBe('5533334444');
    expect(normalizePhoneDigits('55 0 71 99999-8888')).toBe('71999998888');
  });
});

describe('isValidCpf / normalizeCpfDigits', () => {
  it('valida pelo dígito verificador', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('12345678909')).toBe(true);
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('rejeita sequência repetida e tamanho errado', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
  });

  it('normaliza com máscara e sinaliza inválido sem barrar', () => {
    expect(normalizeCpfDigits('529.982.247-25')).toEqual({ digits: '52998224725', invalid: false });
    expect(normalizeCpfDigits('000.000.000-00')).toEqual({ digits: null, invalid: true });
    expect(normalizeCpfDigits('')).toEqual({ digits: null, invalid: false });
    expect(normalizeCpfDigits(undefined)).toEqual({ digits: null, invalid: false });
  });
});

describe('normalizeName', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizeName('  João   da SILVA ')).toBe('joao da silva');
    expect(normalizeName(null)).toBe('');
  });
});

describe('parseImportDate', () => {
  it('dd/mm/aaaa, com e sem hora', () => {
    expect(parseImportDate('12/11/2026', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('12/11/2026 00:00:00', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('5/3/1985', NOW)).toEqual(D(1985, 3, 5));
  });

  it('dd/mm/aa com pivô: até ano atual + 10 é 20xx, acima é 19xx', () => {
    expect(parseImportDate('12/11/26', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('01/01/36', NOW)).toEqual(D(2036, 1, 1));
    expect(parseImportDate('05/03/85', NOW)).toEqual(D(1985, 3, 5));
    expect(parseImportDate('01/01/37', NOW)).toEqual(D(1937, 1, 1));
  });

  it('aaaa-mm-dd, com e sem hora', () => {
    expect(parseImportDate('2026-11-12', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('2026-11-12T00:00:00', NOW)).toEqual(D(2026, 11, 12));
  });

  it('serial do Excel e Date do SheetJS viram meia-noite local', () => {
    expect(parseImportDate(46338, NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate(new Date(2026, 10, 12, 15, 30), NOW)).toEqual(D(2026, 11, 12));
  });

  it('vazio, ambíguo ou impossível é null', () => {
    expect(parseImportDate('', NOW)).toBeNull();
    expect(parseImportDate(null, NOW)).toBeNull();
    expect(parseImportDate('novembro', NOW)).toBeNull();
    expect(parseImportDate('31/02/2026', NOW)).toBeNull();
    expect(parseImportDate('12-11-2026', NOW)).toBeNull();
    expect(parseImportDate(0, NOW)).toBeNull();
    expect(parseImportDate(new Date('x'), NOW)).toBeNull();
  });
});

describe('normalizeSexo', () => {
  it('mapeia para os valores do app', () => {
    expect(normalizeSexo('M')).toBe('Masculino');
    expect(normalizeSexo('masculino')).toBe('Masculino');
    expect(normalizeSexo('F')).toBe('Feminino');
    expect(normalizeSexo('FEMININO')).toBe('Feminino');
    expect(normalizeSexo('Outro')).toBe('Outro');
    expect(normalizeSexo('')).toBeNull();
    expect(normalizeSexo('Não informado')).toBe('Não informado');
  });
});

describe('isTruthyCell', () => {
  it('reconhece sim/x/1/true/vip', () => {
    ['Sim', 'S', 'x', 'X', '1', 'true', 'VIP', 'yes'].forEach((v) => expect(isTruthyCell(v)).toBe(true));
    expect(isTruthyCell(1)).toBe(true);
    expect(isTruthyCell(true)).toBe(true);
  });
  it('não/vazio/0 é falso', () => {
    ['Não', 'N', '', '0', 'false'].forEach((v) => expect(isTruthyCell(v)).toBe(false));
    expect(isTruthyCell(0)).toBe(false);
    expect(isTruthyCell(undefined)).toBe(false);
  });
});

describe('contractSituationFromText', () => {
  it('mapeia os textos usuais', () => {
    expect(contractSituationFromText('Ativo')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('ATIVO')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('Vencido')).toBe(CONTRACT_SITUATION.VENCIDO);
    expect(contractSituationFromText('Inativo')).toBe(CONTRACT_SITUATION.VENCIDO);
    expect(contractSituationFromText('A vencer')).toBe(CONTRACT_SITUATION.A_VENCER);
    expect(contractSituationFromText('Cancelado')).toBe(CONTRACT_SITUATION.CANCELADO);
    expect(contractSituationFromText('Trancado')).toBe(CONTRACT_SITUATION.TRANCADO);
    expect(contractSituationFromText('Pré-cancelado')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('Suspenso')).toBe(CONTRACT_SITUATION.TRANCADO);
  });
  it('vazio é null e texto estranho é desconhecido', () => {
    expect(contractSituationFromText('')).toBeNull();
    expect(contractSituationFromText(undefined)).toBeNull();
    expect(contractSituationFromText('Xyz')).toBe(CONTRACT_SITUATION.DESCONHECIDO);
  });
});

describe('clientSituationFromText', () => {
  it('ativo / inativo / null', () => {
    expect(clientSituationFromText('Ativo')).toBe('ativo');
    expect(clientSituationFromText('Inativo')).toBe('inativo');
    expect(clientSituationFromText('Bloqueado')).toBe('inativo');
    expect(clientSituationFromText('')).toBeNull();
    expect(clientSituationFromText('Xyz')).toBeNull();
  });
});
