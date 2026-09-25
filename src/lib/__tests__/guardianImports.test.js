// guardian.js roda dentro da api/ (cartão do Stronizap), que usa o SDK de
// servidor e não pode puxar dependência do navegador. Ele também não pode
// importar leads.js, globalSearch.js nem leadDerived.js, porque leads.js já
// importa globalSearch.js, que importa guardian.js: um segundo caminho de
// guardian.js até qualquer um desses fecharia um ciclo de import. Esta
// varredura trava que guardian.js só importa de ./dates.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GUARDIAN_PATH = fileURLToPath(new URL('../guardian.js', import.meta.url));

// Pega `import ... from '...'` e `export ... from '...'` (grupo 1, inclusive
// multilinha e export * from) e `import('...')` estático ou dinâmico, com ou
// sem parênteses (grupo 2). \bimport\b e \bexport\b exigem a palavra inteira,
// então "importar" e "exportação" em comentário não casam.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

const specifiersOf = (text) => [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

describe('guardian.js só importa de dates.js', () => {
  it('nenhum outro specifier de import aparece no arquivo', () => {
    const text = readFileSync(GUARDIAN_PATH, 'utf8');
    expect(specifiersOf(text)).toEqual(['./dates.js']);
  });

  // Autoteste: prova que o regex acima realmente enxerga as formas de import
  // que ele deveria pegar, para o teste de cima não passar por estar cego.
  it('o regex enxerga import multilinha, import só de efeito, export * e import() dinâmico', () => {
    const amostra = `
// Isto é só um comentário: nunca vamos importar nada daqui sem querer.
import {
  a,
} from './leads.js';
import './side.js';
export * from './re.js';
const x = await import('./dyn.js');
`;
    expect(specifiersOf(amostra)).toEqual(['./leads.js', './side.js', './re.js', './dyn.js']);
  });
});
