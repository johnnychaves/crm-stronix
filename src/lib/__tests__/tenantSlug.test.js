import { describe, it, expect } from 'vitest';
import {
  TENANT_SLUG_READ_RE, TENANT_SLUG_CREATE_RE, RESERVED_TENANT_SLUGS,
  isReservedTenantSlug, tenantSlugProblem,
} from '../tenantSlug.js';
import { FIRST_LEVEL_SEGMENTS } from '../routes.js';

// As cinco academias de produção, conferidas em 21/09/2026. Se alguma palavra
// reservada nova bater com uma delas, o link dessa academia quebra.
const PRODUCAO = ['academia-power-club', 'academia-shape-one', 'academia-teste', 'petros-barbell-club', 'stronix-crm-app'];

describe('TENANT_SLUG_READ_RE (leitura do endereço)', () => {
  it('aceita as academias de hoje e slug curto antigo', () => {
    for (const id of [...PRODUCAO, 'a', 'x1', 'abc-']) expect(TENANT_SLUG_READ_RE.test(id), id).toBe(true);
    expect(TENANT_SLUG_READ_RE.test('a'.repeat(64))).toBe(true);
  });

  it('recusa maiúscula, sublinhado, espaço, hífen no começo e mais de 64', () => {
    for (const id of ['Stronix', 'academia_legada', 'a b', '-abc', '', 'a'.repeat(65)]) {
      expect(TENANT_SLUG_READ_RE.test(id), id).toBe(false);
    }
  });
});

describe('TENANT_SLUG_CREATE_RE (academia nova)', () => {
  it('de 3 a 40 caracteres, sem hífen nas pontas', () => {
    for (const id of ['abc', 'a1b', 'corpo-e-movimento', 'a'.repeat(40)]) expect(TENANT_SLUG_CREATE_RE.test(id), id).toBe(true);
    for (const id of ['ab', 'a'.repeat(41), '-abc', 'abc-', 'Abc', 'a_b_c']) expect(TENANT_SLUG_CREATE_RE.test(id), id).toBe(false);
  });
});

describe('RESERVED_TENANT_SLUGS', () => {
  it('é congelada, sem repetição e em minúsculas', () => {
    expect(Object.isFrozen(RESERVED_TENANT_SLUGS)).toBe(true);
    expect(new Set(RESERVED_TENANT_SLUGS).size).toBe(RESERVED_TENANT_SLUGS.length);
    for (const w of RESERVED_TENANT_SLUGS) expect(w, w).toBe(w.toLowerCase());
  });

  it('toda palavra reservada tem o formato de leitura, senão a leitura do endereço nem chegaria a ela', () => {
    for (const w of RESERVED_TENANT_SLUGS) expect(TENANT_SLUG_READ_RE.test(w), w).toBe(true);
  });

  it('traz as obrigatórias: o que a Vercel serve antes do app, o console e a indicação', () => {
    for (const w of ['api', 'assets', 'console', 'super-admin', 'ficha', 'i', 'invite']) {
      expect(RESERVED_TENANT_SLUGS, w).toContain(w);
    }
  });

  it('nenhuma academia de produção está reservada', () => {
    for (const id of PRODUCAO) expect(isReservedTenantSlug(id), id).toBe(false);
  });
});

describe('isReservedTenantSlug', () => {
  it('não diferencia maiúscula e ignora espaço nas pontas', () => {
    expect(isReservedTenantSlug('API')).toBe(true);
    expect(isReservedTenantSlug(' pipeline ')).toBe(true);
    expect(isReservedTenantSlug('Console')).toBe(true);
  });

  it('o que não é texto não é reservado', () => {
    expect(isReservedTenantSlug(null)).toBe(false);
    expect(isReservedTenantSlug(undefined)).toBe(false);
    expect(isReservedTenantSlug(42)).toBe(false);
  });
});

describe('tenantSlugProblem', () => {
  it('academia de produção serve', () => {
    for (const id of PRODUCAO) expect(tenantSlugProblem(id), id).toBeNull();
  });

  it('formato: curto, comprido, hífen na ponta, maiúscula, vazio ou não texto', () => {
    for (const id of ['ab', 'a'.repeat(41), '-abc', 'abc-', 'Console', 'minha academia', '', null, undefined, 123]) {
      expect(tenantSlugProblem(id), String(id)).toBe('formato');
    }
  });

  it('reservado: toda palavra reservada com formato de criação', () => {
    const comFormato = RESERVED_TENANT_SLUGS.filter((w) => TENANT_SLUG_CREATE_RE.test(w));
    expect(comFormato.length).toBeGreaterThan(30);
    for (const w of comFormato) expect(tenantSlugProblem(w), w).toBe('reservado');
  });

  it('palavra reservada curta demais para criar cai no formato', () => {
    expect(tenantSlugProblem('i')).toBe('formato');
  });
});

describe('guarda das telas', () => {
  it('todo primeiro segmento de tela está reservado (tela nova sem reserva quebra aqui)', () => {
    expect(FIRST_LEVEL_SEGMENTS.length).toBeGreaterThan(0);
    for (const seg of FIRST_LEVEL_SEGMENTS) expect(isReservedTenantSlug(seg), seg).toBe(true);
  });
});
