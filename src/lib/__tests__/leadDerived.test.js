import { describe, it, expect } from 'vitest';
import { buildLeadSearchFields, buildGuardianSearchFields, buildGuardianPatch, sameContactPhone } from '../leadDerived.js';

describe('buildLeadSearchFields — zapMatchKey', () => {
  it('inclui zapMatchKey (DDD + últimos 8 dígitos) quando há whatsapp', () => {
    expect(buildLeadSearchFields({ whatsapp: '51999998888' }).zapMatchKey).toBe('5199998888');
  });

  it('zapMatchKey é null quando não há whatsapp', () => {
    expect(buildLeadSearchFields({}).zapMatchKey).toBeNull();
    expect(buildLeadSearchFields().zapMatchKey).toBeNull();
  });
});

describe('buildGuardianSearchFields', () => {
  it('dígitos, dígitos invertidos e chave do Zap do telefone do responsável', () => {
    expect(buildGuardianSearchFields({ name: 'Maria', phone: '(11) 9 1234-5678' })).toEqual({
      guardianPhoneDigits: '11912345678',
      guardianPhoneDigitsRev: '87654321911',
      guardianZapMatchKey: '1112345678',
    });
  });

  it('sem responsável: tudo null', () => {
    const vazio = { guardianPhoneDigits: null, guardianPhoneDigitsRev: null, guardianZapMatchKey: null };
    expect(buildGuardianSearchFields(null)).toEqual(vazio);
    expect(buildGuardianSearchFields({ name: 'Maria', phone: '' })).toEqual(vazio);
  });
});

describe('sameContactPhone', () => {
  it('mesmo número formatado diferente -> true', () => {
    expect(sameContactPhone('(51) 9 9530-4633', '51995304633')).toBe(true);
  });

  it('com e sem o nono dígito -> true', () => {
    expect(sameContactPhone('(11) 9 1234-5678', '(11) 1234-5678')).toBe(true);
  });

  it('números diferentes -> false', () => {
    expect(sameContactPhone('(11) 9 1234-5678', '(11) 9 8765-4321')).toBe(false);
  });

  it('vazio ou curto -> false', () => {
    expect(sameContactPhone('', '11912345678')).toBe(false);
    expect(sameContactPhone('123', '11912345678')).toBe(false);
    expect(sameContactPhone('11912345678', '')).toBe(false);
  });
});

describe('buildGuardianPatch', () => {
  it('chave ligada: grava o responsável aparado e os derivados', () => {
    expect(buildGuardianPatch({ isMinor: true, name: ' Maria Souza ', phone: '(11) 9 1234-5678', relationship: 'Mãe' })).toEqual({
      isMinor: true,
      guardian: { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' },
      guardianPhoneDigits: '11912345678',
      guardianPhoneDigitsRev: '87654321911',
      guardianZapMatchKey: '1112345678',
    });
  });

  it('parentesco vazio vira null', () => {
    expect(buildGuardianPatch({ isMinor: true, name: 'Maria', phone: '11912345678', relationship: '' }).guardian.relationship).toBeNull();
  });

  it('chave desligada: apaga o responsável e os derivados', () => {
    expect(buildGuardianPatch({ isMinor: false, name: 'Maria', phone: '11912345678' })).toEqual({
      isMinor: false,
      guardian: null,
      guardianPhoneDigits: null,
      guardianPhoneDigitsRev: null,
      guardianZapMatchKey: null,
    });
  });
});
