// A trava do plano de carreira no cadastro da equipe (spec 2026-11-26,
// "Regras do Firestore"): a própria pessoa não troca trilhaId, nivel nem
// nivelDesde; o gestor troca pelo ramo isAdmin. Como o npsRules.test.js, este
// teste lê o texto da regra, que o Johnny publica à mão no console.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

describe('regra do plano de carreira em stronix_users', () => {
  it('carreiraKept compara os três campos', () => {
    const inicio = RULES.indexOf('function carreiraKept()');
    expect(inicio).toBeGreaterThan(-1);
    const fn = RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
    ['trilhaId', 'nivel', 'nivelDesde'].forEach((campo) => {
      expect(fn).toContain(`request.resource.data.get('${campo}', null) == resource.data.get('${campo}', null)`);
    });
  });

  it('o ramo da própria pessoa pede a trava; o do gestor não', () => {
    const bloco = blocoDe('stronix_users');
    const corte = bloco.indexOf('|| (request.auth.uid == userId');
    expect(corte).toBeGreaterThan(-1);
    expect(bloco.slice(corte)).toContain('carreiraKept()');
    expect(bloco.slice(bloco.indexOf('isAdmin(appId)'), corte)).not.toContain('carreiraKept()');
  });
});
