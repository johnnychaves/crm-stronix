// Tradutor do navegador. Com lang="en" e o conteúdo em português, o Chrome
// tratava o Stronilead como página em inglês e traduzia a tela. O tradutor
// troca cada texto por <font>, o React perde os nós que ele mesmo criou e, na
// próxima troca de ícone ou de texto, derruba o app com NotFoundError
// (insertBefore ou removeChild). Em 25/09/2026 foi assim que o Novo lead com
// indicação e o cabeçalho deram tela branca para uma academia (Sentry
// STRONILEAD-3 a 8). O index.html declara o português e pede para não
// traduzir; este teste trava as três marcas.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');
const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || '';

describe('index.html fora do tradutor do navegador', () => {
  it('declara a página em português do Brasil', () => {
    expect(htmlTag).toMatch(/\blang="pt-BR"/);
  });

  it('pede para o navegador não traduzir a página', () => {
    expect(htmlTag).toMatch(/\btranslate="no"/);
  });

  it('desliga a oferta de tradução do Chrome', () => {
    expect(html).toMatch(/<meta\s+name="google"\s+content="notranslate"\s*\/?>/i);
  });
});
