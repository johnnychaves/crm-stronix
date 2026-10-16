// Movimento reduzido. Quem ligava "reduzir movimento" no sistema
// (prefers-reduced-motion: reduce) continuava vendo os balões do shadcn
// crescerem e deslizarem: o tw-animate-css 1.4.0 não tem regra para isso.
// As entradas próprias do index.css (.fade-in, .animate-fade-in, .pop...)
// também rodavam, e o .fade-in, que fica fora de camada, vencia o
// motion-reduce:animate-none das telas.
//
// O index.css ganhou um bloco só, fora de camada e com !important, que
// desliga essas animações. Com `animation: none` o Radix (Presence) desmonta o
// balão fechado na hora. Este teste lê o index.css e trava o bloco: ele
// existe, desliga a animação e cobre as classes do tw-animate e toda classe
// com animação do próprio index.css, menos as que ficam de propósito (o
// spinner, que avisa que algo está carregando).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8');
const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

// Classes com animação que continuam rodando com movimento reduzido.
const FICAM = new Set(['.spin']);

// Blocos do nível de cima do arquivo: { prelude, corpo }.
function blocos(texto) {
  const out = [];
  let fundo = 0;
  let inicio = 0;
  let abre = -1;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '{') {
      if (fundo === 0) abre = i;
      fundo++;
    } else if (c === '}') {
      fundo--;
      if (fundo === 0) {
        out.push({ prelude: texto.slice(inicio, abre).trim(), corpo: texto.slice(abre + 1, i) });
        inicio = i + 1;
      }
    } else if (c === ';' && fundo === 0) {
      inicio = i + 1; // @import, @custom-variant...
    }
  }
  return out;
}

const topo = blocos(semComentarios);
const guardas = topo.filter((b) => /^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/.test(b.prelude));
const guarda = guardas[0];
const regrasDaGuarda = guarda ? blocos(guarda.corpo) : [];
const seletoresDaGuarda = regrasDaGuarda.flatMap((r) => r.prelude.split(',').map((s) => s.trim()));

// Classes do nível de cima que declaram uma animação (fora a própria guarda).
const classesAnimadas = topo
  .filter((b) => !b.prelude.startsWith('@'))
  .filter((b) => /(^|;)\s*animation(-name)?\s*:/.test(b.corpo))
  .flatMap((b) => b.prelude.split(',').map((s) => s.trim()));

// Imita o seletor de atributo [class*="..."] contra um atributo class.
function pega(seletor, classe) {
  const m = /^\[class\*="([^"]+)"\]$/.exec(seletor);
  if (m) return classe.includes(m[1]);
  return seletor === `.${classe}`;
}

describe('movimento reduzido no index.css', () => {
  it('existe um bloco só de prefers-reduced-motion, no nível de cima e fora de camada', () => {
    expect(guardas).toHaveLength(1);
    // Fora de camada: nenhum @layer do arquivo traz o bloco dentro dele.
    for (const b of topo.filter((x) => x.prelude.startsWith('@layer'))) {
      expect(b.corpo).not.toMatch(/prefers-reduced-motion/);
    }
  });

  it('o bloco desliga a animação com !important', () => {
    expect(regrasDaGuarda.length).toBeGreaterThan(0);
    for (const r of regrasDaGuarda) {
      expect(r.corpo.replace(/\s+/g, ' ').trim()).toBe('animation: none !important;');
    }
  });

  it('cobre as entradas e saídas do tw-animate em qualquer variante', () => {
    for (const classe of [
      'animate-in', 'animate-out',
      'data-[state=open]:animate-in', 'data-[state=closed]:animate-out',
      'group-data-[state=open]:animate-in', 'motion-safe:animate-in',
      'data-[state=open]:animate-accordion-down', 'data-[state=closed]:animate-collapsible-up',
    ]) {
      expect(seletoresDaGuarda.some((s) => pega(s, classe)), classe).toBe(true);
    }
  });

  it('cobre o .fade-in, o .animate-fade-in e o .pop', () => {
    expect(seletoresDaGuarda).toEqual(expect.arrayContaining(['.fade-in', '.animate-fade-in', '.pop']));
  });

  it('toda classe com animação do index.css está no bloco ou na lista das que ficam', () => {
    expect(classesAnimadas.length).toBeGreaterThan(10);
    const fora = classesAnimadas.filter((c) => !FICAM.has(c) && !seletoresDaGuarda.includes(c));
    expect(fora).toEqual([]);
  });

  it('o spinner e o pulse continuam rodando', () => {
    for (const classe of ['spin', 'animate-spin', 'animate-pulse', 'motion-safe:animate-pulse']) {
      expect(seletoresDaGuarda.some((s) => pega(s, classe)), classe).toBe(false);
    }
    expect(classesAnimadas).toContain('.spin');
  });
});
