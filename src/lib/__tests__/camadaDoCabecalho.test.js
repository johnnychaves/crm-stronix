// O cabeçalho do App fica na frente de tudo que rola na área de conteúdo. O
// z-index dele cria uma camada própria, e o balão da busca, o sino e o menu da
// conta só sobem até ela, por maior que seja o z-index deles. Em 16/10/2026 o
// cabeçalho tinha z-10 e as barras fixas do Operacional, do CRM, do Gerencial e
// dos Relatórios, z-30: a lista de resultados da busca abria atrás da barra.
// O cabeçalho também fica atrás do fundo escuro do menu do celular, que cobre a
// tela inteira quando o menu abre.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const APP = readFileSync(join(SRC, 'App.jsx'), 'utf8');

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

// Os z-index de uma lista de classes, com ou sem variante (md:z-20) e no
// formato arbitrário (z-[35]).
const zOf = (classes) => [...classes.matchAll(/(?:^|\s)(?:[\w-]+:)*z-(?:(\d+)|\[(\d+)\])(?=\s|$)/g)]
  .map((m) => Number(m[1] ?? m[2]));

function classOf(re, what) {
  const found = [...APP.matchAll(re)];
  expect(found, what).toHaveLength(1);
  return found[0][1];
}

// Cada lista de classes, numa linha só, com a palavra sticky e um z-index.
function stickyLayers() {
  const out = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(['"`])([^'"`\n]*?\bsticky\b[^'"`\n]*?)\1/g)) {
      for (const z of zOf(m[2])) {
        out.push({ where: `${relative(SRC, file)}:${text.slice(0, m.index).split('\n').length}`, z });
      }
    }
  }
  return out;
}

describe('camada do cabeçalho do App', () => {
  const header = zOf(classOf(/<header className="([^"]*)"/g, 'o <header> do App'));
  const backdrop = zOf(classOf(/className="(fixed inset-0 bg-black\/60[^"]*)"/g, 'o fundo escuro do menu do celular'));

  it('o cabeçalho e o fundo do menu do celular têm um z-index cada', () => {
    expect(header).toHaveLength(1);
    expect(backdrop).toHaveLength(1);
  });

  it('o cabeçalho fica na frente de toda barra fixa da área de conteúdo', () => {
    const layers = stickyLayers();
    // A varredura enxerga as barras dos painéis e dos Relatórios.
    expect(layers.map((l) => l.where.split(':')[0])).toEqual(expect.arrayContaining([
      'views/dashboard/DashFilterBar.jsx',
      'views/relatorios/RelatoriosToolbar.jsx',
    ]));
    expect(layers.filter((l) => l.z >= header[0]).map((l) => `${l.where} z-${l.z}`)).toEqual([]);
  });

  it('o cabeçalho fica atrás do fundo escuro do menu do celular', () => {
    expect(header[0]).toBeLessThan(backdrop[0]);
  });
});
