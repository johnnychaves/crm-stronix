// Gesto de voltar do trackpad. Com endereço por tela sempre existe uma tela
// anterior dentro do app, e rolar um quadro para o lado até a borda e
// insistir fazia o navegador voltar de tela no meio do trabalho. Todo
// rolador horizontal leva overscroll-x-contain, que segura o gesto dentro
// dele. Esta varredura cobra isso de todo overflow-x-auto de src/, inclusive
// dos que forem criados depois.
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

// Cada texto entre aspas, apóstrofos ou crases que liga a rolagem lateral.
const SCROLL_X_RE = /(['"`])([^'"`]*?\boverflow-x-(?:auto|scroll)\b[^'"`]*?)\1/g;
const CONTAINED_RE = /\boverscroll-x-(?:contain|none)\b/;

describe('rolagem lateral segura o gesto de voltar do navegador', () => {
  it('todo overflow-x-auto vem com overscroll-x-contain na mesma lista de classes', () => {
    const faltando = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(SCROLL_X_RE)) {
        if (!CONTAINED_RE.test(m[2])) {
          const line = text.slice(0, m.index).split('\n').length;
          faltando.push(`${relative(SRC, file)}:${line}`);
        }
      }
    }
    expect(faltando).toEqual([]);
  });

  it('a varredura enxerga o board do Pipeline (não está cega)', () => {
    const text = readFileSync(join(SRC, 'views/KanbanView.jsx'), 'utf8');
    expect([...text.matchAll(SCROLL_X_RE)].length).toBeGreaterThan(0);
  });
});
