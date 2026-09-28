// Tudo o que o App monta fora do AppErrorBoundary do conteúdo precisa de uma
// proteção de erro própria: os modais do fim do App e as peças do cabeçalho.
// Sem ela, um erro ali desmonta a raiz do React e a página fica branca, como
// em 2026-09-25 (Sentry STRONILEAD-6 e STRONILEAD-8). A varredura lê o
// App.jsx, então um modal novo montado no fim do App já entra na cobrança.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');
const PROTECOES = ['ModalErrorBoundary', 'SilentErrorBoundary'];

// Quantas proteções estão abertas no ponto `idx` do App.jsx.
function protecoesAbertas(idx) {
  const antes = app.slice(0, idx);
  let abertas = 0;
  for (const nome of PROTECOES) {
    abertas += (antes.match(new RegExp(`<${nome}[\\s>]`, 'g')) || []).length;
    abertas -= (antes.match(new RegExp(`</${nome}>`, 'g')) || []).length;
  }
  return abertas;
}

describe('proteção de erro fora do conteúdo da tela', () => {
  it('todo componente montado depois do AppErrorBoundary está dentro de uma proteção', () => {
    const inicio = app.lastIndexOf('</AppErrorBoundary>');
    const fim = app.indexOf('</GeneralConfigContext.Provider>', inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    const montados = [...app.slice(inicio, fim).matchAll(/<([A-Z][\w.]*)[\s>/]/g)]
      .filter((m) => !PROTECOES.includes(m[1]));
    // A afirmação positiva vem antes: sem ela, um trecho vazio passaria.
    expect(montados.map((m) => m[1])).toEqual(expect.arrayContaining([
      'AddLeadModal', 'SuperConsole', 'SupportCenterModal', 'WhatsNewModal', 'WalkthroughModal', 'HelpCenterModal',
    ]));
    const soltos = montados.filter((m) => protecoesAbertas(inicio + m.index) === 0).map((m) => m[1]);
    expect(soltos).toEqual([]);
  });

  it('título, busca, sino e menu da conta do cabeçalho estão dentro de uma proteção', () => {
    const inicio = app.indexOf('<header');
    const fim = app.indexOf('</header>', inicio);
    const cabecalho = app.slice(inicio, fim);
    for (const peca of ['<h2', '<GlobalSearch', '<NotificationBell', '<PersonaMenu']) {
      const idx = cabecalho.indexOf(peca);
      expect(idx, peca).toBeGreaterThan(-1);
      expect(protecoesAbertas(inicio + idx), peca).toBeGreaterThan(0);
    }
  });
});
