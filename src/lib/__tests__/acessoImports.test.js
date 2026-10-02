// acesso.js (o que cada papel faz) e modules.js (os módulos da academia) rodam
// também dentro da api/, nas funções da Vercel, que usam o SDK de servidor e
// não podem puxar pacote nem módulo do navegador. Os dois ficam sem import
// nenhum: assim a api/ lê os mesmos textos de papel e de módulo que o app, e
// nenhum ciclo de import pode nascer deles. Esta varredura trava isso.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// O mesmo leitor do guardianImports.test.js. Pega `import ... from '...'` e
// `export ... from '...'` (grupo 1, inclusive multilinha e export * from) e
// `import('...')` estático ou dinâmico (grupo 2). Os comentários saem antes:
// a palavra "import" solta num comentário casaria com o regex e esticaria até
// o próximo "from '...'" de verdade.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Remove bloco /* */, linha inteira de comentário e comentário de fim de
// linha. O guard antes de `//` evita apagar um `https://` dentro de string.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const ler = (nome) => readFileSync(fileURLToPath(new URL(`../${nome}`, import.meta.url)), 'utf8');

describe('acesso.js e modules.js não importam nada', () => {
  for (const nome of ['acesso.js', 'modules.js']) {
    it(`${nome} não tem import nem export ... from`, () => {
      expect(specifiersOf(ler(nome))).toEqual([]);
    });
  }

  // Autoteste: o leitor enxerga as formas de import, para o teste de cima não
  // passar por estar cego.
  it('o leitor enxerga import multilinha, import só de efeito, export * e import() dinâmico', () => {
    const amostra = `
// Comentário que fala em import: não conta.
import {
  a,
} from './leads.js';
import './side.js';
export * from './re.js';
const x = await import('./dyn.js');
const y = 'https://exemplo.com.br'; // comentário de fim de linha com import
`;
    expect(specifiersOf(amostra)).toEqual(['./leads.js', './side.js', './re.js', './dyn.js']);
  });

  it('comentário que fala em "sem import" não conta como import', () => {
    const amostra = `
// Arquivo puro e sem import: a api/ usa este arquivo direto.
/* Nada de import from './firebase.js' aqui. */
export const A = 1;
`;
    expect(specifiersOf(amostra)).toEqual([]);
  });
});
