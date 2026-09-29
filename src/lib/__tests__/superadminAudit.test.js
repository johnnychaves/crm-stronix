import { describe, it, expect } from 'vitest';
import { auditActionLabel } from '../superadmin.js';

describe('auditActionLabel', () => {
  it('troca de senha pelo código de e-mail', () => {
    expect(auditActionLabel({ action: 'password.reset', tenantId: 'academia-teste', details: { via: 'codigo-por-email' } }))
      .toBe('Trocou a senha pelo código · academia-teste');
  });

  it('ação desconhecida continua mostrando o nome cru', () => {
    expect(auditActionLabel({ action: 'outra.coisa', tenantId: 'academia-teste' })).toBe('outra.coisa · academia-teste');
  });
});
