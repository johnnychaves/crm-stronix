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
});
