// src/lib/__tests__/freepassRules.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8');
const bloco = (() => {
  const i = rules.indexOf('match /artifacts/{appId}/public/data/stronix_freepass/{id}');
  return i === -1 ? '' : rules.slice(i, rules.indexOf('\n    }', i));
})();

describe('regra de stronix_freepass', () => {
  it('existe', () => { expect(bloco).not.toBe(''); });
  it('lê quem é da academia e o professor não grava', () => {
    expect(bloco).toMatch(/allow read: if inTenant\(appId\) && tenantActive\(appId\) && hasModule\(appId, 'faltosos'\);/);
    expect(bloco).toMatch(/allow create: if inTenant\(appId\) && tenantActive\(appId\) && hasModule\(appId, 'faltosos'\)\s*&& !isProfessor\(appId\);/);
    expect(bloco).toMatch(/allow update: if inTenant\(appId\) && tenantActive\(appId\) && hasModule\(appId, 'faltosos'\)\s*&& !isProfessor\(appId\)/);
    expect(bloco).toMatch(/allow delete: if false;/);
  });
  it('na atualização, o lead e quem lançou não mudam', () => {
    expect(bloco).toContain('request.resource.data.leadId == resource.data.leadId');
    expect(bloco).toContain("request.resource.data.get('createdByAuthUid', null) == resource.data.get('createdByAuthUid', null)");
  });
});
