// src/lib/newLead.js roda também na api/ (cadastro pelo Stronizap), com o SDK
// de servidor. Nada no caminho dele pode chegar a pacote nenhum: firebase.js
// inicializa o SDK do navegador, dailyGoal.js puxa lucide-react e funnels.js
// importa writeBatch, e qualquer um deles derruba a função da Vercel. Esta
// varredura segue os imports de verdade, arquivo por arquivo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo leitor de imports de guardianImports.test.js, que tem os autotestes
// do regex e a explicação de por que os comentários saem antes.
const IMPORT_RE = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const specifiersOf = (text) => [...stripComments(text).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const doRepo = (rel) => path.join(REPO, rel);
const relativo = (arquivo) => path.relative(REPO, arquivo).split(path.sep).join('/');

// Todos os arquivos alcançados a partir da entrada e os pacotes importados
// no caminho (specifier que não começa com ponto).
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

describe('o montador do lead novo cabe na api/', () => {
  it('newLead.js não chega a pacote nenhum nem a módulo do navegador', () => {
    const { arquivos, pacotes } = grafoDe(doRepo('src/lib/newLead.js'));
    expect(arquivos).toContain('src/lib/leadDerived.js');
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx'))).toEqual([]);
  });

  it('as regras do cadastro pelo Stronizap (api/_zapLead.js) também não', () => {
    const { arquivos, pacotes } = grafoDe(doRepo('api/_zapLead.js'));
    expect(arquivos).toContain('src/lib/newLead.js');
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx'))).toEqual([]);
  });

  // O agendamento pelo Stronizap usa o patch do assistente, os helpers do
  // registro de aulas e dos professores, e nenhum deles pode puxar o SDK do
  // navegador (aulasWrites.js e interactions.js puxam) nem a Meta Diária.
  it('as regras do agendamento pelo Stronizap (api/_zapSchedule.js) também não', () => {
    const { arquivos, pacotes } = grafoDe(doRepo('api/_zapSchedule.js'));
    expect(arquivos).toEqual(expect.arrayContaining([
      'src/lib/schedulePatch.js', 'src/lib/aulas.js', 'src/lib/professores.js', 'api/_zapCard.js'
    ]));
    expect(pacotes).toEqual([]);
    expect(arquivos.filter((f) => PROIBIDOS.includes(f) || f.endsWith('.jsx'))).toEqual([]);
    expect(arquivos).not.toContain('src/lib/aulasWrites.js');
    expect(arquivos).not.toContain('src/lib/interactions.js');
  });
});
