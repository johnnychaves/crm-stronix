// guardian.js roda dentro da api/ (cartão do Stronizap), que usa o SDK de
// servidor e não pode puxar dependência do navegador. Ele também não pode
// importar leads.js, globalSearch.js nem leadDerived.js, porque leads.js já
// importa globalSearch.js, que importa guardian.js — um segundo caminho de
// guardian.js até qualquer um desses fecharia um ciclo de import. Esta
// varredura trava que guardian.js só importa de ./dates.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GUARDIAN_PATH = fileURLToPath(new URL('../guardian.js', import.meta.url));

const IMPORT_RE = /^import\s.*?from\s+['"]([^'"]+)['"];?\s*$/gm;

describe('guardian.js só importa de dates.js', () => {
  it('nenhum outro specifier de import aparece no arquivo', () => {
    const text = readFileSync(GUARDIAN_PATH, 'utf8');
    const specifiers = [...text.matchAll(IMPORT_RE)].map((m) => m[1]);
    expect(specifiers).toEqual(['./dates.js']);
  });
});
