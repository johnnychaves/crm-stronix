// Abrir a ficha é ir para um endereço, então o caminho é sempre um link. Esta
// varredura cobra isso de toda tela e todo componente: quem abrir ficha por
// onClick={() => openProfile(id)} de novo derruba o CI. Fora da lista ficam o
// App.jsx (dono do openProfile, que o cadastro usa em "Ver ficha") e a busca
// global (o Enter do teclado navega na mesma aba).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function usamOpenProfile(pasta) {
  return sourceFiles(join(SRC, pasta))
    .filter((file) => readFileSync(file, 'utf8').includes('openProfile'))
    .map((file) => relative(SRC, file))
    .sort();
}

describe('ficha se abre por link', () => {
  it('só a busca global ainda chama openProfile fora do App', () => {
    expect([...usamOpenProfile('views'), ...usamOpenProfile('components')])
      .toEqual(['components/layout/GlobalSearch.jsx']);
  });

  it('a varredura não está cega: o App e o contexto continuam com openProfile', () => {
    expect(readFileSync(join(SRC, 'App.jsx'), 'utf8')).toContain('openProfile');
    expect(readFileSync(join(SRC, 'contexts/LeadProfileContext.jsx'), 'utf8')).toContain('openProfile');
  });
});
