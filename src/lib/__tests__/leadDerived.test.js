import { describe, it, expect } from 'vitest';
import { buildLeadSearchFields } from '../leadDerived.js';

describe('buildLeadSearchFields — zapMatchKey', () => {
  it('inclui zapMatchKey (DDD + últimos 8 dígitos) quando há whatsapp', () => {
    expect(buildLeadSearchFields({ whatsapp: '51999998888' }).zapMatchKey).toBe('5199998888');
  });

  it('zapMatchKey é null quando não há whatsapp', () => {
    expect(buildLeadSearchFields({}).zapMatchKey).toBeNull();
    expect(buildLeadSearchFields().zapMatchKey).toBeNull();
  });
});
