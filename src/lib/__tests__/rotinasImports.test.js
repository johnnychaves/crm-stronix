// rotinas.js roda também dentro da api/ (admin-users.js grava a versão do dia
// do modelo quando quem o segue vira professor ou é excluído), com o SDK de
// servidor. Ele não pode puxar pacote nem arquivo do navegador (firebase.js,
// lucide-react, dailyGoal.js): só importa acesso.js e operacional/month.js. O
// month.js não importa nada, e o acesso.js é travado pelo acessoImports.test.js.
// Mesmo leitor do teamRolesImports.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROTINAS_PATH = fileURLToPath(new URL('../rotinas.js', import.meta.url));
const MONTH_PATH = fileURLToPath(new URL('../operacional/month.js', import.meta.url));
const TELA_PATH = fileURLToPath(new URL('../rotinasTela.js', import.meta.url));
const WRITES_PATH = fileURLToPath(new URL('../rotinasWrites.js', import.meta.url));
// A aba Hoje é de quem acompanha: o gestor nunca marca nem desmarca o check de ninguém.
const HOJE_PATHS = ['TodayTab.jsx', 'PersonDayCard.jsx', 'TodayAside.jsx']
  .map((name) => fileURLToPath(new URL(`../../components/rotinas/${name}`, import.meta.url)));

// `import ... from '...'` e `export ... from '...'` (grupo 1, inclusive
// multilinha), e `import '...'` ou `import('...')` (grupo 2).
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Comentário sai antes do regex: a palavra import num comentário casaria. O
// `[^:'"\`]` antes do `//` protege um `https://` dentro de texto.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

describe('rotinas.js só importa módulos puros', () => {
  it('importa só ./acesso.js e ./operacional/month.js', () => {
    const text = readFileSync(ROTINAS_PATH, 'utf8');
    expect(specifiersOf(text).sort()).toEqual(['./acesso.js', './operacional/month.js']);
  });

  it('operacional/month.js não importa nada', () => {
    const text = readFileSync(MONTH_PATH, 'utf8');
    expect(specifiersOf(text)).toEqual([]);
  });

  // As contas da tela Rotinas (src/lib/rotinasTela.js) leem a regra do dia e
  // não podem ter outra: só importam rotinas.js.
  it('rotinasTela.js só importa ./rotinas.js', () => {
    const text = readFileSync(TELA_PATH, 'utf8');
    expect(specifiersOf(text)).toEqual(['./rotinas.js']);
  });

  // A aba Hoje só lê. Nenhum dos três arquivos importa rotinasWrites.js nem usa,
  // pelo nome, qualquer coisa que ele exporta (markDone, undoMark, saveMarkNote,
  // setPersonModel e o resto). A lista de nomes sai do próprio rotinasWrites.js.
  it('TodayTab, PersonDayCard e TodayAside nunca importam rotinasWrites.js, nem pelo nome', () => {
    const writes = readFileSync(WRITES_PATH, 'utf8');
    const names = [...writes.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
    expect(names).toEqual(expect.arrayContaining(['markDone', 'undoMark', 'saveMarkNote', 'setPersonModel']));
    for (const path of HOJE_PATHS) {
      const text = readFileSync(path, 'utf8');
      expect(specifiersOf(text).filter((spec) => /rotinasWrites/.test(spec)), path).toEqual([]);
      const code = stripComments(text);
      for (const name of names) {
        expect(new RegExp(`(?<![A-Za-z0-9_$])${name.replace(/\$/g, '\\$')}(?![A-Za-z0-9_$])`).test(code), `${path} usa ${name}`).toBe(false);
      }
    }
  });

  // Autoteste: o regex enxerga as formas de import que deveria pegar.
  it('o regex enxerga import multilinha, import de efeito, export from, import() e ignora comentário', () => {
    const amostra = `
// Comentário que fala em import { x } from './comentario.js' não conta.
import {
  a,
} from './leads.js';
import 'lucide-react';
export * from './re.js';
const x = await import('./dyn.js'); // e o import('./fim-de-linha.js') também não
`;
    expect(specifiersOf(amostra)).toEqual(['./leads.js', 'lucide-react', './re.js', './dyn.js']);
  });
});
