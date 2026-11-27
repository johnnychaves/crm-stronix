// As regras da pesquisa de NPS (plano 2026-11-25-perfil-do-professor-04),
// que o Johnny publica à mão no console. Como o professorRules.test.js, este
// teste lê o texto da regra: as três coleções pedem o módulo, respostas e
// totais não aceitam gravação pelo navegador, o professor só lê os próprios
// totais, e a pesquisa aberta não troca perguntas nem turmas.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}
const allow = (bloco, op) => (bloco.match(new RegExp(`allow ${op}: ([\\s\\S]*?);`)) || [])[1] ?? null;

describe('regras da pesquisa de NPS', () => {
  const pesquisas = blocoDe('stronix_nps_pesquisas');
  const respostas = blocoDe('stronix_nps_respostas');
  const totais = blocoDe('stronix_nps_totais');

  it('toda regra das três coleções pede o módulo', () => {
    [pesquisas, respostas, totais].forEach((bloco) => {
      [...bloco.matchAll(/allow \w+(?:, \w+)*: ([\s\S]*?);/g)].forEach(([, cond]) => {
        if (cond.trim() === 'if false') return;
        expect(cond).toContain("hasModule(appId, 'faltosos')");
      });
    });
  });

  it('a pesquisa: o membro lê, o gestor grava, o rascunho nasce rascunho e só ele se apaga', () => {
    expect(allow(pesquisas, 'read')).not.toContain('isAdmin');
    ['create', 'update', 'delete'].forEach((op) => expect(allow(pesquisas, op)).toContain('isAdmin(appId)'));
    expect(allow(pesquisas, 'create')).toContain("request.resource.data.situacao == 'rascunho'");
    expect(allow(pesquisas, 'delete')).toContain("resource.data.situacao == 'rascunho'");
  });

  it('depois de aberta, só vai para encerrada, sem trocar perguntas nem turmas', () => {
    const update = allow(pesquisas, 'update');
    expect(update).toContain("resource.data.situacao == 'rascunho'");
    expect(update).toContain("request.resource.data.situacao == 'encerrada'");
    expect(update).toContain('request.resource.data.inicio == resource.data.inicio');
    expect(update).toContain('request.resource.data.fim == resource.data.fim');
    expect(update).toContain('request.resource.data.ciclo == resource.data.ciclo');
    expect(update).toContain('request.resource.data.perguntas == resource.data.perguntas');
    expect(update).toContain("request.resource.data.get('turmas', null) == resource.data.get('turmas', null)");
  });

  it('respostas: só o gestor lê, ninguém grava pelo navegador', () => {
    expect(allow(respostas, 'read')).toContain('isAdmin(appId)');
    expect(allow(respostas, 'write')).toBe('if false');
  });

  it('totais: o gestor lê todos, o professor só os dele, ninguém grava pelo navegador', () => {
    const read = allow(totais, 'read');
    expect(read).toContain('isAdmin(appId)');
    expect(read).toContain("isProfessor(appId) && resource.data.professorId == userDoc(appId).data.get('professorId', null)");
    expect(allow(totais, 'write')).toBe('if false');
  });

});
