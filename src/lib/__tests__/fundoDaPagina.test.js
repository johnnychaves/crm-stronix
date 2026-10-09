// Fundo da página num lugar só. A raiz do App (App.jsx) e toda barra fixa que
// cobre o conteúdo ao rolar pintam o mesmo fundo, o token page de
// src/index.css (paper-50 no claro, neutral-950 no escuro): a barra é opaca e
// tem de ter a cor do que fica atrás dela. Até 09/10/2026 as barras do
// Operacional, do CRM e do Gerencial usavam no escuro um azul-marinho fixo
// (#0D1226), feito para um fundo ink-950 que o App não usa, e apareciam como
// uma faixa azul embaixo do cabeçalho cinza. O bg-background também não serve:
// no escuro ele é o ink-950. Este teste cobra o token, a raiz e toda barra
// fixa de src/, inclusive as que forem criadas depois.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

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

// O corpo de cada bloco do CSS com exatamente esse seletor (`:root`, `.dark`
// ou `@theme inline`). Os blocos de variável não têm chave dentro.
function cssBlocks(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`(?:^|[\\s}])${esc}\\s*\\{([^{}]*)\\}`, 'g'))].map((m) => m[1]);
}
const declared = (blocks, prop) => blocks
  .map((body) => body.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1].trim())
  .filter(Boolean);

// Cada texto entre aspas, apóstrofos ou crases com sticky e top negativo: a
// barra que encosta no cabeçalho do App e cobre o conteúdo ao rolar. O top
// negativo é o recuo da área que rola (p-4 md:p-8), e o sticky comum, como o
// das listas laterais e o dos meses da linha do tempo da ficha, não entra. O
// texto não passa de uma linha: a lista de classes cabe numa, e assim a
// palavra sticky num comentário entre duas aspas de linhas diferentes não
// desencontra as aspas (foi o que escondeu a barra do Operacional na primeira
// versão deste teste).
const STICKY_RE = /(['"`])([^'"`\n]*?\bsticky\b[^'"`\n]*?)\1/g;
const NEGATIVE_TOP_RE = /(?:^|\s)(?:[\w-]+:)*-top-/;
const variants = (c) => c.split(':').slice(0, -1);
const utility = (c) => c.split(':').pop();

function stickyBars() {
  const bars = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(STICKY_RE)) {
      if (!NEGATIVE_TOP_RE.test(m[2])) continue;
      const line = text.slice(0, m.index).split('\n').length;
      bars.push({ file: relative(SRC, file), where: `${relative(SRC, file)}:${line}`, classes: m[2].split(/\s+/).filter(Boolean) });
    }
  }
  return bars;
}

describe('fundo da página num lugar só', () => {
  it('src/index.css define o fundo da página uma vez no claro e uma no escuro, e o expõe como bg-page', () => {
    const css = read('index.css');
    // O claro é o de sempre, e o escuro é o que a raiz do App já pintava.
    expect(declared(cssBlocks(css, ':root'), '--page')).toEqual(['var(--color-paper-50)']);
    expect(declared(cssBlocks(css, '.dark'), '--page')).toEqual(['var(--color-neutral-950)']);
    expect(declared(cssBlocks(css, '@theme inline'), '--color-page')).toEqual(['var(--page)']);
  });

  it('a raiz do App pinta o fundo pelo token, e por nenhuma outra cor de fundo', () => {
    const roots = [...read('App.jsx').matchAll(/<div className="(flex h-\[100dvh\][^"]*)"/g)];
    expect(roots, 'a div da raiz do App (flex h-[100dvh])').toHaveLength(1);
    const backgrounds = roots[0][1].split(/\s+/).filter((c) => /^(?:dark:)?bg-/.test(c));
    expect(backgrounds).toEqual(['bg-page']);
  });

  it('toda barra fixa que encosta no cabeçalho do App pinta, no escuro, o fundo da página', () => {
    const wrong = [];
    for (const bar of stickyBars()) {
      const darkBg = bar.classes.filter((c) => variants(c).includes('dark') && utility(c).startsWith('bg-'));
      const baseBg = bar.classes.filter((c) => variants(c).length === 0 && c.startsWith('bg-'));
      // dark:bg-page para a barra que tem outra cor no claro (bg-card nas da
      // Visão geral), ou só bg-page para a que tem o fundo da página nos dois.
      const darkIsPage = darkBg.length > 0 ? darkBg.length === 1 && darkBg[0] === 'dark:bg-page' : baseBg.includes('bg-page');
      const hardcoded = bar.classes.filter((c) => utility(c).startsWith('bg-['));
      if (!darkIsPage || hardcoded.length > 0) wrong.push(`${bar.where} ${[...darkBg, ...hardcoded].join(' ') || 'sem dark:bg-page'}`);
    }
    expect(wrong).toEqual([]);
  });

  it('a varredura enxerga as barras do Operacional, do CRM e do Gerencial (não está cega)', () => {
    const found = stickyBars().map((b) => b.file);
    for (const file of ['views/dashboard/OperacionalToolbar.jsx', 'views/dashboard/CrmToolbar.jsx', 'views/dashboard/GerencialToolbar.jsx']) {
      expect(found).toContain(file);
    }
  });
});
