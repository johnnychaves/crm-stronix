// Abrir a ficha é ir para um endereço, então o caminho é sempre um link. Esta
// varredura cobra isso de src/views, src/components, src/modals, src/hooks e
// src/contexts: quem abrir ficha por onClick={() => openProfile(id)} de novo
// derruba o CI. Os modais entraram porque é de lá (AddLeadModal) que sai o
// lead recém-criado, o lugar mais provável de alguém religar o openProfile
// num onClick. Fora da varredura fica só o src/App.jsx, dono do openProfile,
// que o cadastro usa em "Ver ficha". Na lista de exceções ficam a busca
// global (o Enter do teclado navega na mesma aba) e o próprio contexto, que é
// quem serve a função.
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

// As pastas varridas. Pasta nova em src/ que renderize tela entra aqui.
const PASTAS = ['views', 'components', 'modals', 'hooks', 'contexts'];

function usamOpenProfile(pasta) {
  return sourceFiles(join(SRC, pasta))
    .filter((file) => readFileSync(file, 'utf8').includes('openProfile'))
    .map((file) => relative(SRC, file))
    .sort();
}

describe('ficha se abre por link', () => {
  it('em views, components, modals, hooks e contexts, só a busca global e o contexto chamam openProfile', () => {
    expect(PASTAS.flatMap((pasta) => usamOpenProfile(pasta)).sort())
      .toEqual(['components/layout/GlobalSearch.jsx', 'contexts/LeadProfileContext.jsx']);
  });

  it('a varredura não está cega: o App e o contexto continuam com openProfile', () => {
    expect(readFileSync(join(SRC, 'App.jsx'), 'utf8')).toContain('openProfile');
    expect(readFileSync(join(SRC, 'contexts/LeadProfileContext.jsx'), 'utf8')).toContain('openProfile');
  });

  it('a varredura enxerga as pastas novas: modais e hooks têm arquivo para ler', () => {
    // Pasta apagada derruba a leitura e o teste acima quebra sozinho. Pasta
    // esvaziada (os modais indo morar em components, por exemplo) não: a
    // varredura passaria a ler o vazio e continuaria verde sem cobrar nada.
    expect(sourceFiles(join(SRC, 'modals')).length).toBeGreaterThan(0);
    expect(sourceFiles(join(SRC, 'hooks')).length).toBeGreaterThan(0);
  });
});
