import { describe, it, expect } from 'vitest';
import { formatCPF, formatPhone } from '../masks.js';

describe('formatCPF', () => {
  it('mascara progressivamente e limita a 11 dígitos', () => {
    expect(formatCPF('034')).toBe('034');
    expect(formatCPF('03456')).toBe('034.56');
    expect(formatCPF('0345678')).toBe('034.567.8');
    expect(formatCPF('03456789012')).toBe('034.567.890-12');
    expect(formatCPF('034567890129999')).toBe('034.567.890-12');
    expect(formatCPF('')).toBe('');
  });
});

describe('formatPhone', () => {
  it('mascara telefone celular com DDD', () => {
    expect(formatPhone('51')).toBe('(51');
    expect(formatPhone('5199530')).toBe('(51) 99530');
    expect(formatPhone('51995304633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('')).toBe('');
  });

  it('tira o 55 de DDI colado (13 dígitos, ou 12 com "+"), sem mexer no DDD 55', () => {
    expect(formatPhone('+55 51 99530-4633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('5551995304633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('51995304633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('5133224455')).toBe('(51) 3 3224-455');
  });

  it('DDD 55 digitado até um dígito a mais não perde o próprio DDD', () => {
    // 12 dígitos, sem "+": uma tecla a mais no número de Santa Maria, não um
    // DDI colado. O dígito extra é só ignorado, igual a qualquer DDD.
    expect(formatPhone('(55) 9 9999-88889')).toBe('(55) 9 9999-8888');
  });

  it('DDI colado num fixo (12 dígitos com "+")', () => {
    expect(formatPhone('+55 51 3322-4455')).toBe('(51) 3 3224-455');
  });
});
