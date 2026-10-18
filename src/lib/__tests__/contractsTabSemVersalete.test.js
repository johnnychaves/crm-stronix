// A aba Contratos usa rótulos em minúsculas (desenho A2, 16/10/2026). O teste
// lê o código-fonte dos componentes e barra a caixa alta e o espaçamento de
// versalete, que eram o que deixava a aba "gritando" em 9,5 px.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../components/profile/contracts/', import.meta.url));

describe('aba Contratos sem versalete', () => {
  const arquivos = readdirSync(DIR).filter((n) => n.endsWith('.jsx'));

  it('lê os componentes da aba', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(6);
  });

  for (const nome of arquivos) {
    it(`${nome} não usa uppercase nem tracking de versalete`, () => {
      const src = readFileSync(DIR + nome, 'utf8');
      expect(src).not.toMatch(/\buppercase\b/);
      expect(src).not.toMatch(/tracking-\[\.0[58]em\]/);
    });
  }
});
