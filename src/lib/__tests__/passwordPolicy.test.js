import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, passwordTooShort, passwordTooShortError } from '../passwordPolicy.js';

describe('passwordPolicy', () => {
  // Trava de segurança: o Admin SDK ignora a política do console do Firebase,
  // então este número é a ÚNICA regra que vale nos caminhos de servidor.
  // Abaixar sem querer é o risco que este teste existe para pegar.
  it('exige no minimo 8 caracteres', () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it('recusa senha mais curta que o minimo', () => {
    expect(passwordTooShort('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(true);
  });

  it('aceita senha no tamanho exato do minimo', () => {
    expect(passwordTooShort('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(false);
  });

  it('aceita senha mais longa', () => {
    expect(passwordTooShort('a'.repeat(MIN_PASSWORD_LENGTH + 5))).toBe(false);
  });

  it('trata ausencia de senha como curta demais', () => {
    expect(passwordTooShort(undefined)).toBe(true);
    expect(passwordTooShort(null)).toBe(true);
    expect(passwordTooShort('')).toBe(true);
  });

  it('a mensagem de erro cita o numero em vigor', () => {
    expect(passwordTooShortError()).toContain(String(MIN_PASSWORD_LENGTH));
  });
});
