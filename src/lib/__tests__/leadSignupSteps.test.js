import { describe, it, expect } from 'vitest';
import { signupFlow, firstOpenStep, missingText } from '../leadSignupSteps.js';

describe('passos do Novo lead', () => {
  it('o adulto tem 5 passos e o menor ganha o do responsável, antes da origem; o funil vem por último', () => {
    expect(signupFlow({ isMinor: false })).toEqual(['contato', 'nome', 'origem', 'dor', 'funil']);
    expect(signupFlow({ isMinor: true })).toEqual(['contato', 'nome', 'responsavel', 'origem', 'dor', 'funil']);
    expect(signupFlow()).toEqual(['contato', 'nome', 'origem', 'dor', 'funil']);
  });

  it('a modalidade de interesse só entra quando a academia tem modalidade, antes do funil', () => {
    expect(signupFlow({ isMinor: false, withModality: true })).toEqual(['contato', 'nome', 'origem', 'dor', 'modalidade', 'funil']);
    expect(signupFlow({ isMinor: true, withModality: true })).toEqual(['contato', 'nome', 'responsavel', 'origem', 'dor', 'modalidade', 'funil']);
    expect(signupFlow({ isMinor: false, withModality: false })).not.toContain('modalidade');
    const flow = signupFlow({ withModality: true });
    expect(firstOpenStep(flow, { contato: true, nome: true, origem: true, dor: true })).toBe('modalidade');
    expect(missingText(flow, { contato: true, nome: true, origem: true, dor: true })).toBe('modalidade e funil');
  });

  it('o aberto é o primeiro que não está feito, mesmo com um de baixo já preenchido', () => {
    const flow = signupFlow({ isMinor: false });
    expect(firstOpenStep(flow, {})).toBe('contato');
    expect(firstOpenStep(flow, { contato: true, nome: true })).toBe('origem');
    // Voltou e apagou o nome: o passo reabre, e a dor feita continua feita.
    expect(firstOpenStep(flow, { contato: true, nome: false, origem: true, dor: true, funil: true })).toBe('nome');
    expect(firstOpenStep(flow, { contato: true, nome: true, origem: true, dor: true })).toBe('funil');
    expect(firstOpenStep(flow, { contato: true, nome: true, origem: true, dor: true, funil: true })).toBeNull();
  });

  it('o texto do que falta segue a ordem dos passos', () => {
    const flow = signupFlow({ isMinor: true });
    expect(missingText(flow, {})).toBe('WhatsApp, nome, responsável, origem, dor e funil');
    expect(missingText(flow, { contato: true, nome: true, responsavel: true, origem: true })).toBe('dor e funil');
    expect(missingText(flow, { contato: true, nome: true, responsavel: true, origem: true, dor: true })).toBe('funil');
    expect(missingText(flow, { contato: true, nome: true, responsavel: true, origem: true, dor: true, funil: true })).toBe('');
    expect(missingText(signupFlow(), { contato: true, nome: true, dor: true })).toBe('origem e funil');
  });
});
