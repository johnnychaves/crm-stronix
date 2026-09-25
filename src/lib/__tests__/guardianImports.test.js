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
// então "importar" e "exportação" em comentário não casam. Mas a palavra
// solta "import" DENTRO de um comentário casa igual (é código válido pro
// regex), e o `[^'"`;]*?` lazy segue esticando até achar um "from '...'" de
// verdade mais adiante: é assim que "ciclo de import:" no cabeçalho deste
// arquivo já chegou a casar por coincidência com o `from './dates.js'` do
// import de verdade, 300+ caracteres depois. Por isso os comentários são
// removidos ANTES de rodar o regex.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Remove bloco /* */, linha inteira de comentário e comentário de fim de
// linha. O guard `[^:'"\`]` antes de `//` evita apagar um `https://` dentro
// de string (o caractere antes do `//` seria `:`, que fica de fora da
// classe negada). guardian.js tem um, em whatsappHref, e o teste de baixo
// cobre o caso também.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

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

  // Reproduz o bug de verdade achado na re-revisão: um comentário que fala
  // em "ciclo de import" (palavra solta, sem "ar" no fim) casaria com o
  // regex e esticaria, por sorte, até o "from" do import de verdade lá
  // embaixo. Com o comentário removido antes, o único specifier é o real.
  it('comentário que fala em "ciclo de import" não conta: só o import de verdade depois dele', () => {
    const amostra = `
// Nunca importar leads.js daqui: ciclo de import: não importar leads.js,
// senão fecha um ciclo. Várias linhas de comentário depois disso.
import { a } from './dates.js';
`;
    expect(specifiersOf(amostra)).toEqual(['./dates.js']);
  });
});
