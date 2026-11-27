// src/lib/__tests__/equipeImports.test.js
// A api/ lê src/lib/equipe/ficha.js e equipe.js: nenhum dos dois pode chegar a
// pacote, a firebase.js ou a dailyGoal.js (que traz lucide-react).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const importsDe = (rel) => [...readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  .matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('imports da equipe', () => {
  it('ficha.js só importa brazilLookups', () => {
    expect(importsDe('../equipe/ficha.js')).toEqual(['../brazilLookups.js']);
  });
  it('equipe.js só importa acesso e ficha', () => {
    expect(importsDe('../equipe/equipe.js').sort()).toEqual(['../acesso.js', './ficha.js']);
  });
  it('brazilLookups.js não importa nada', () => {
    expect(importsDe('../brazilLookups.js')).toEqual([]);
  });
});
