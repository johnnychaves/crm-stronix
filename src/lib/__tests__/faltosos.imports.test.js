// O motor da importação dos faltosos (src/lib/faltosos, menos a leitura e a
// gravação) é puro: roda em node nos testes e no navegador, e não pode chegar
// ao SDK do Firebase, à Meta Diária (que puxa lucide-react), a componente de
// tela nem a pacote nenhum. A leitura da base da janela de importação
// (lerImportacao.js, da Task 10) e a gravação (gravarImportacao.js) são os
// únicos arquivos da pasta que tocam o Firestore. Esta varredura segue os
// imports de verdade, arquivo por arquivo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo leitor de imports de guardianImports.test.js e newLeadImports.test.js.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const doRepo = (rel) => path.join(REPO, rel);
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

const PROIBIDOS = ['src/lib/firebase.js', 'src/lib/dailyGoal.js', 'src/lib/funnels.js', 'src/lib/interactions.js'];

const MODULOS = [
  'src/lib/faltosos/dias.js',
  'src/lib/faltosos/nextfitArquivos.js',
  'src/lib/faltosos/ligacaoAlunos.js',
  'src/lib/faltosos/ligacaoProfessores.js',
  'src/lib/faltosos/marcos.js',
  'src/lib/faltosos/urgente.js',
  'src/lib/faltosos/configFaltosos.js',
  'src/lib/faltosos/planoImportacao.js',
];

describe('o motor dos faltosos é puro', () => {
  it.each(MODULOS)('%s não chega a pacote, ao Firebase nem a tela', (modulo) => {
    const { arquivos, pacotes } = grafoDe(doRepo(modulo));
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx') || f.endsWith('gravarImportacao.js'))).toEqual([]);
  });

  it('o plano alcança todos os módulos do motor', () => {
    const { arquivos } = grafoDe(doRepo('src/lib/faltosos/planoImportacao.js'));
    expect(arquivos).toEqual(expect.arrayContaining(MODULOS));
  });
});
