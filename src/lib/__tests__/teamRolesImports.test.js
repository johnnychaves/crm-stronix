// teamRoles.js roda também dentro da api/ (convite, aceite, cadastro e troca
// de papel), com o SDK de servidor. Ele não pode puxar pacote nem arquivo do
// navegador (firebase.js, lucide-react, dailyGoal.js): só importa acesso.js e
// modules.js, que não importam nada (quem cobra os dois é o teste de import
// da Task 2). Mesmo leitor do guardianImports.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEAM_ROLES_PATH = fileURLToPath(new URL('../teamRoles.js', import.meta.url));

// `import ... from '...'` e `export ... from '...'` (grupo 1, inclusive
// multilinha), e `import '...'` ou `import('...')` (grupo 2).
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Comentário sai antes do regex: a palavra import num comentário casaria. O
// `[^:'"\`]` antes do `//` protege um `https://` dentro de texto.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

describe('teamRoles.js só importa módulos puros', () => {
  it('importa só ./acesso.js e ./modules.js', () => {
    const text = readFileSync(TEAM_ROLES_PATH, 'utf8');
    expect(specifiersOf(text).sort()).toEqual(['./acesso.js', './modules.js']);
  });

  // Autoteste: o regex enxerga as formas de import que deveria pegar.
  it('o regex enxerga import multilinha, import de efeito, export from, import() e ignora comentário', () => {
    const amostra = `
// Comentário que fala em import { x } from './comentario.js' não conta.
import {
  a,
} from './leads.js';
import 'lucide-react';
export * from './re.js';
const x = await import('./dyn.js'); // e o import('./fim-de-linha.js') também não
`;
    expect(specifiersOf(amostra)).toEqual(['./leads.js', 'lucide-react', './re.js', './dyn.js']);
  });
});
