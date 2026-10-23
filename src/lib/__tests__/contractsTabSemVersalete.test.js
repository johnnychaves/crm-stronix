// A aba Contratos usa rótulos em minúsculas (desenho A2, 16/10/2026). O teste
// lê o código-fonte da pasta (componentes e o tone.js, de onde vêm as cores
// do selo, da contagem e dos botões) e barra a caixa alta, o espaçamento de
// versalete e o texto passado por toUpperCase, que eram o que deixava a aba
// "gritando" em 9,5 px.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../components/profile/contracts/', import.meta.url));

describe('aba Contratos sem versalete', () => {
  const arquivos = readdirSync(DIR).filter((n) => /\.(jsx|js)$/.test(n));

  it('lê os componentes da aba e o tone.js', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(7);
    expect(arquivos).toContain('tone.js');
  });

  for (const nome of arquivos) {
    it(`${nome} não usa uppercase, tracking de versalete nem toUpperCase`, () => {
      const src = readFileSync(DIR + nome, 'utf8');
      expect(src).not.toMatch(/\buppercase\b/);
      expect(src).not.toMatch(/tracking-\[\.0[58]em\]/);
      expect(src).not.toMatch(/\.toUpperCase\(/);
    });
  }
});
