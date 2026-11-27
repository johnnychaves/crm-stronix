// As regras das coleções do módulo Professor e faltosos (PR 2 da spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// regras do Firestore"). O Johnny publica o firestore.rules à mão no console,
// e este teste lê o texto da regra e cobra:
//   1. stronix_faltosos e stronix_presencas: todo membro lê, com o módulo
//      ligado; só o gestor grava, com o módulo ligado; ninguém apaga;
//   2. stronix_importacoes_nextfit e stronix_nextfit_alunos: só o gestor lê e
//      grava, com o módulo ligado; ninguém apaga;
//   3. stronix_config continua como era: todo membro lê (o professor acha ali
//      a última importação, em stronix_config/faltosos) e só o gestor grava;
//   4. a linha "Voltou a treinar" (presence_return): o gestor cria, regrava e
//      apaga como qualquer interação, e o professor não cria, porque o tipo não
//      está na lista dele.
// Os leitores do texto são os do professorRules.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROFESSOR_INTERACTION_TYPES } from '../professorWrites.js';
import { PRESENCE_RETURN_TYPE } from '../leads.js';

const RULES = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

// A lista que uma função da regra devolve: `function nome() { return [ ... ]; }`.
function listaDaRegra(nome) {
  const m = new RegExp(`function ${nome}\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\];\\s*\\}`).exec(RULES);
  expect(m, `function ${nome}() no firestore.rules`).not.toBeNull();
  return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// O bloco `match` de uma coleção da academia, até a chave que o fecha.
function blocoDe(colecao) {
  const inicio = RULES.search(new RegExp(`match /artifacts/\\{appId\\}/public/data/${colecao}/\\{\\w+\\} \\{`));
  expect(inicio, colecao).toBeGreaterThan(-1);
  return RULES.slice(inicio, RULES.indexOf('\n    }\n', inicio));
}

// Uma linha `allow` do bloco (com as linhas de continuação), até a próxima
// `allow` ou o fim do bloco. `allow create, update:` serve aos dois.
function regraDe(bloco, op) {
  const m = new RegExp(`allow [\\w, ]*\\b${op}\\b[\\w, ]*:([\\s\\S]*?)(?=\\n\\s*allow |$)`).exec(bloco);
  expect(m, `allow ${op}`).not.toBeNull();
  return m[1];
}

// Os termos do E de cima de uma condição, sem os comentários. Um `||` fora de
// parênteses quer dizer que não há E de cima, e a lista volta vazia.
function termosDoE(condicao) {
  const expr = condicao.replace(/\/\/.*$/gm, '').trim().replace(/^if\s+/, '').replace(/;\s*$/, '');
  const termos = [];
  let nivel = 0;
  let inicio = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '(' || c === '[') nivel += 1;
    else if (c === ')' || c === ']') nivel -= 1;
    else if (nivel === 0 && expr.startsWith('||', i)) return [];
    else if (nivel === 0 && expr.startsWith('&&', i)) {
      termos.push(expr.slice(inicio, i).trim());
      inicio = i + 2;
      i += 1;
    }
  }
  termos.push(expr.slice(inicio).trim());
  return termos;
}

const MODULO = "hasModule(appId, 'faltosos')";
const DE_TODOS = ['stronix_faltosos', 'stronix_presencas'];
const DO_GESTOR = ['stronix_importacoes_nextfit', 'stronix_nextfit_alunos'];

describe.each([...DE_TODOS, ...DO_GESTOR])('%s', (colecao) => {
  // As regras juntam os allow com OU: uma segunda linha de update, ou um
  // allow write, valeria por cima da trava. O PR 3 põe a tarefa do professor
  // como condição na linha de update de stronix_faltosos, nunca numa linha nova.
  it('uma linha allow por operação e nenhum allow write', () => {
    const bloco = blocoDe(colecao).replace(/\/\/.*$/gm, '');
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(bloco.match(new RegExp(`allow [\\w, ]*\\b${op}\\b`, 'g')), `${colecao}: ${op}`).toHaveLength(1);
    }
    expect(bloco).not.toMatch(/allow [\w, ]*\bwrite\b/);
  });

  it('gravar é só do gestor, na academia ativa e com o módulo ligado, no E de cima', () => {
    for (const op of ['create', 'update']) {
      expect(termosDoE(regraDe(blocoDe(colecao), op)), `${colecao}: ${op}`)
        .toEqual(['inTenant(appId)', 'tenantActive(appId)', MODULO, 'isAdmin(appId)']);
    }
  });

  it('o navegador não apaga', () => {
    expect(regraDe(blocoDe(colecao), 'delete').trim()).toBe('if false;');
  });
});

describe.each(DE_TODOS)('%s: leitura', (colecao) => {
  it('todo membro lê, na academia ativa e com o módulo ligado', () => {
    expect(termosDoE(regraDe(blocoDe(colecao), 'read')))
      .toEqual(['inTenant(appId)', 'tenantActive(appId)', MODULO]);
  });
});

describe.each(DO_GESTOR)('%s: leitura', (colecao) => {
  it('só o gestor lê, na academia ativa e com o módulo ligado', () => {
    expect(termosDoE(regraDe(blocoDe(colecao), 'read')))
      .toEqual(['inTenant(appId)', 'tenantActive(appId)', MODULO, 'isAdmin(appId)']);
  });
});

describe('stronix_config, onde mora stronix_config/faltosos', () => {
  it('todo membro lê e só o gestor grava, como antes do módulo', () => {
    const config = blocoDe('stronix_config');
    expect(regraDe(config, 'read').trim()).toBe('if inTenant(appId) && tenantActive(appId);');
    expect(termosDoE(regraDe(config, 'write'))).toEqual(['isAdmin(appId)', 'inTenant(appId)', 'tenantActive(appId)']);
  });
});

describe('a linha "Voltou a treinar" (presence_return)', () => {
  it('o professor não cria a linha: o tipo fica fora da lista dele, na regra e no professorWrites', () => {
    expect(PRESENCE_RETURN_TYPE).toBe('presence_return');
    expect(listaDaRegra('professorInteractionTypes')).not.toContain(PRESENCE_RETURN_TYPE);
    expect(PROFESSOR_INTERACTION_TYPES).not.toContain(PRESENCE_RETURN_TYPE);
  });

  it('o gestor cria como qualquer membro: a criação de interação só trava o professor', () => {
    const interacoes = blocoDe('stronix_interactions');
    expect(termosDoE(regraDe(interacoes, 'create')))
      .toEqual(['inTenant(appId)', 'tenantActive(appId)', '(!isProfessor(appId) || professorInteractionOk(appId))']);
  });

  // A importação refeita regrava a linha no mesmo id (update), e a volta que
  // não aconteceu tem a linha apagada (delete). As duas são do gestor.
  it('o gestor regrava e apaga a linha', () => {
    const interacoes = blocoDe('stronix_interactions');
    for (const op of ['update', 'delete']) {
      const termos = termosDoE(regraDe(interacoes, op));
      expect(termos, op).toContain('(isAdmin(appId) || resource.data.consultantAuthUid == request.auth.uid)');
      expect(termos, op).toContain('!isProfessor(appId)');
    }
  });
});
