// src/lib/__tests__/freepassRules.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { freepassAulasPatch } from '../visitante.js';

const rules = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8');
const bloco = (() => {
  const i = rules.indexOf('match /artifacts/{appId}/public/data/stronix_freepass/{id}');
  return i === -1 ? '' : rules.slice(i, rules.indexOf('\n    }', i));
})();

describe('regra de stronix_freepass', () => {
  it('existe', () => { expect(bloco).not.toBe(''); });
  it('lê quem é da academia, o professor não cria e ninguém apaga', () => {
    expect(bloco).toMatch(/allow read: if inTenant\(appId\) && tenantActive\(appId\) && hasModule\(appId, 'faltosos'\);/);
    expect(bloco).toMatch(/allow create: if inTenant\(appId\) && tenantActive\(appId\) && hasModule\(appId, 'faltosos'\)\s*&& !isProfessor\(appId\);/);
    expect(bloco).toMatch(/allow delete: if false;/);
  });
  // O Agendar de aula dentro de um freepass grava no freepass só a recontagem
  // (freepassAulasPatch: aulas e endsAt). É só isso que o professor altera.
  it('o professor atualiza só aulas e endsAt, com o módulo ligado', () => {
    expect(bloco).toMatch(/allow update: if inTenant\(appId\) && tenantActive\(appId\) && hasModule\(appId, 'faltosos'\)\s*&& \(!isProfessor\(appId\) \|\| request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['aulas', 'endsAt'\]\)\)/);
    expect(bloco.match(/allow [\w, ]*\b(create|update|delete|write)\b/g)).toEqual(['allow create', 'allow update', 'allow delete']);
  });
  it('a recontagem do freepass só traz aulas e endsAt', () => {
    const base = { id: 'f1', kind: 'aulas', total: 2, endsAt: null };
    const records = [{ freepassId: 'f1', status: 'agendada', scheduledFor: new Date(2026, 10, 27) }];
    expect(Object.keys(freepassAulasPatch({ freepass: base, records })).sort()).toEqual(['aulas', 'endsAt']);
    expect(Object.keys(freepassAulasPatch({ freepass: { ...base, kind: 'dias' }, records })).sort()).toEqual(['aulas', 'endsAt']);
  });
  it('na atualização, o lead e quem lançou não mudam', () => {
    expect(bloco).toContain('request.resource.data.leadId == resource.data.leadId');
    expect(bloco).toContain("request.resource.data.get('createdByAuthUid', null) == resource.data.get('createdByAuthUid', null)");
  });
});
