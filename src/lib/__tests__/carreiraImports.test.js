// As contas e as trilhas do plano de carreira (src/lib/carreira/) vão ser
// lidas também pela api/, como as do professor (professorContasImports.test.js).
// Nada no caminho delas pode chegar a pacote: firebase.js inicializa o SDK do
// navegador, dailyGoal.js puxa lucide-react e funnels.js importa writeBatch.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo leitor de imports da guardianImports.test.js.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const PASTA = path.join(REPO, 'src/lib/carreira');
const relativo = (arquivo) => path.relative(REPO, arquivo).split(path.sep).join('/');

function grafoDe(entrada) {
  const arquivos = new Set();
  const pacotes = new Set();
  const visitar = (arquivo) => {
    if (arquivos.has(arquivo)) return;
    arquivos.add(arquivo);
    for (const spec of specifiersOf(readFileSync(arquivo, 'utf8'))) {
      if (spec.startsWith('.')) visitar(path.resolve(path.dirname(arquivo), spec));
      else pacotes.add(spec);
    }
  };
  visitar(entrada);
  return { arquivos: [...arquivos].map(relativo), pacotes: [...pacotes] };
}

const PROIBIDOS = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js'];
const ARQUIVOS = readdirSync(PASTA).filter((f) => f.endsWith('.js')).sort();

describe('as contas da carreira cabem na api/', () => {
  it('a pasta tem os períodos, os números, as trilhas e a validação', () => {
    expect(ARQUIVOS).toEqual(['numeros.js', 'periodo.js', 'trilhas.js', 'validacao.js']);
  });

  for (const arquivo of ARQUIVOS) {
    it(`${arquivo} não chega a pacote nenhum nem a módulo do navegador`, () => {
      const { arquivos, pacotes } = grafoDe(path.join(PASTA, arquivo));
      expect(pacotes).toEqual([]);
      expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx') || f.startsWith('src/lib/crm/scope') || f.startsWith('src/lib/crm/appointments'))).toEqual([]);
    });
  }
});
