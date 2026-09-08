import { describe, it, expect } from 'vitest';
import { zapMatchKey } from '../_zapPhone.js';

describe('zapMatchKey', () => {
  it('reduz número com DDI e nono dígito', () => {
    expect(zapMatchKey('5551999998888')).toBe('5199998888');
  });

  it('reduz número com DDI e sem nono dígito ao mesmo valor', () => {
    expect(zapMatchKey('555199998888')).toBe('5199998888');
  });

  it('reduz número sem DDI', () => {
    expect(zapMatchKey('51999998888')).toBe('5199998888');
  });

  it('ignora máscara', () => {
    expect(zapMatchKey('(51) 9 9999-8888')).toBe('5199998888');
  });

  it('não confunde DDD 55 com DDI 55', () => {
    // Santa Maria/RS: 10 dígitos começando com 55, mas é DDD, não país.
    expect(zapMatchKey('5599998888')).toBe('5599998888');
  });

  it('devolve null para entrada vazia ou curta demais', () => {
    expect(zapMatchKey('')).toBeNull();
    expect(zapMatchKey(null)).toBeNull();
    expect(zapMatchKey('99998888')).toBeNull();
  });
});
