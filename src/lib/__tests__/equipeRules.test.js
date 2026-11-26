// src/lib/__tests__/equipeRules.test.js
// A ficha da equipe guarda CPF, endereço e o motivo do desligamento: só o
// gestor da academia lê e grava (spec 2026-11-26-cadastro-da-equipe). A regra
// é publicada à mão no console; este teste cobra o texto do firestore.rules.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EQUIPE_PATH } from '../firebase.js';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

function bloco() {
  const inicio = RULES.search(/match \/artifacts\/\{appId\}\/public\/data\/stronix_equipe\/\{\w+\} \{/);
  expect(inicio, 'bloco de stronix_equipe').toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

describe('regra de stronix_equipe', () => {
  it('o caminho do app é o mesmo da regra', () => {
    expect(EQUIPE_PATH).toBe('stronix_equipe');
  });

  it('só o gestor da academia ativa lê e grava, numa linha só', () => {
    const allows = bloco().split('\n').filter((l) => l.trim().startsWith('allow'));
    expect(allows).toHaveLength(1);
    expect(allows[0]).toMatch(/allow read, write: if isAdmin\(appId\) && inTenant\(appId\) && tenantActive\(appId\);/);
  });
});
