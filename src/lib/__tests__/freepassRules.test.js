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
    expect(bloco).toMatch(/allow read: if inTenant\(appId\) && tenantActive\(appId\);/);
    expect(bloco).toMatch(/allow create: if inTenant\(appId\) && tenantActive\(appId\)\s*&& !isProfessor\(appId\);/);
    expect(bloco).toMatch(/allow update: if inTenant\(appId\) && tenantActive\(appId\)\s*&& !isProfessor\(appId\);/);
    expect(bloco).toMatch(/allow delete: if false;/);
  });
});
