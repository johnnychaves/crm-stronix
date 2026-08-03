import { describe, it, expect } from 'vitest';
import { maskSensitive, scrubDeep } from '../sentryScrub.js';

describe('maskSensitive', () => {
  it('mascara CPF formatado', () => {
    expect(maskSensitive('cliente 123.456.789-01 nao encontrado'))
      .toBe('cliente [cpf] nao encontrado');
  });

  it('mascara CPF sem pontuacao', () => {
    expect(maskSensitive('doc 12345678901 invalido'))
      .toBe('doc [documento] invalido');
  });

  it('mascara e-mail', () => {
    expect(maskSensitive('falha para joao.silva@academia.com.br'))
      .toBe('falha para [email]');
  });

  it('mascara telefone com DDD e nono digito', () => {
    expect(maskSensitive('whatsapp (11) 98765-4321 recusado'))
      .toBe('whatsapp [telefone] recusado');
  });

  it('mascara telefone sem formatacao', () => {
    expect(maskSensitive('tel 11987654321')).toBe('tel [telefone]');
  });

  it('nao mascara timestamp de 13 digitos', () => {
    expect(maskSensitive('expiresAt 1754246400000')).toBe('expiresAt 1754246400000');
  });

  it('deixa texto sem dado pessoal intacto', () => {
    const msg = 'TypeError: cannot read property status of undefined';
    expect(maskSensitive(msg)).toBe(msg);
  });

  it('devolve valor nao-string sem alterar', () => {
    expect(maskSensitive(42)).toBe(42);
    expect(maskSensitive(null)).toBe(null);
  });
});

describe('scrubDeep', () => {
  it('percorre objeto aninhado', () => {
    const input = { lead: { nome: 'Ana', email: 'ana@x.com' }, ok: true };
    expect(scrubDeep(input)).toEqual({ lead: { nome: 'Ana', email: '[email]' }, ok: true });
  });

  it('percorre array', () => {
    expect(scrubDeep(['a@b.com', 'texto'])).toEqual(['[email]', 'texto']);
  });

  it('preserva numeros e booleanos', () => {
    expect(scrubDeep({ n: 7, b: false })).toEqual({ n: 7, b: false });
  });

  it('para na profundidade maxima sem estourar a pilha', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'x@y.com' } } } } } } };
    expect(() => scrubDeep(deep)).not.toThrow();
  });
});
