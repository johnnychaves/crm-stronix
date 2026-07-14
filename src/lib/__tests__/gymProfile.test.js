import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE, buildTenantProfilePayload, readTenantProfile } from '../gymProfile.js';

describe('gymProfile', () => {
  it('EMPTY_PROFILE tem os 16 campos planos vazios', () => {
    expect(Object.keys(EMPTY_PROFILE).sort()).toEqual([
      'cep', 'city', 'cnpjCpf', 'complement', 'email', 'legalName', 'neighborhood',
      'number', 'phone', 'responsibleBirth', 'responsibleCpf', 'responsibleName',
      'state', 'street', 'tradeName', 'whatsapp',
    ]);
    expect(Object.values(EMPTY_PROFILE).every((v) => v === '')).toBe(true);
  });

  it('buildTenantProfilePayload separa profile / settings / responsiblePhone', () => {
    const form = {
      ...EMPTY_PROFILE,
      cnpjCpf: '11.222.333/0001-44', legalName: 'ACME LTDA', tradeName: 'ACME',
      cep: '90000-000', street: 'Av. X', number: '10', complement: 'sala 2', neighborhood: 'Centro',
      city: 'Porto Alegre', state: 'RS',
      responsibleName: 'Fulano', responsibleCpf: '123.456.789-09', responsibleBirth: '1990-01-01',
      whatsapp: '55 51 99999-9999', email: 'a@b.com', phone: '(51) 3333-3333',
    };
    const out = buildTenantProfilePayload(form);
    expect(out.settings).toEqual({ city: 'Porto Alegre', state: 'RS' });
    expect(out.responsiblePhone).toBe('55 51 99999-9999');
    // profile NÃO carrega city/state/whatsapp (vivem em settings/responsiblePhone)
    expect(out.profile.city).toBeUndefined();
    expect(out.profile.state).toBeUndefined();
    expect(out.profile.whatsapp).toBeUndefined();
    expect(out.profile.cnpjCpf).toBe('11.222.333/0001-44');
    expect(out.profile.responsibleName).toBe('Fulano');
    expect(Object.keys(out.profile).sort()).toEqual([
      'cep', 'cnpjCpf', 'complement', 'email', 'legalName', 'neighborhood',
      'number', 'phone', 'responsibleBirth', 'responsibleCpf', 'responsibleName',
      'street', 'tradeName',
    ]);
  });

  it('readTenantProfile é o inverso: monta o form plano a partir do tenant', () => {
    const tenant = {
      profile: { cnpjCpf: '11.222.333/0001-44', legalName: 'ACME LTDA', street: 'Av. X' },
      settings: { city: 'Porto Alegre', state: 'RS' },
      responsiblePhone: '55 51 99999-9999',
    };
    const form = readTenantProfile(tenant);
    expect(form.cnpjCpf).toBe('11.222.333/0001-44');
    expect(form.city).toBe('Porto Alegre');
    expect(form.state).toBe('RS');
    expect(form.whatsapp).toBe('55 51 99999-9999');
    expect(form.tradeName).toBe(''); // ausente no tenant → vazio, não undefined
  });

  it('readTenantProfile tolera tenant sem profile/settings', () => {
    const form = readTenantProfile({});
    expect(form).toEqual(EMPTY_PROFILE);
  });
});
