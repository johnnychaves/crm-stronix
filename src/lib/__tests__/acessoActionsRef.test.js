// Toda ação citada como ACTIONS.NOME em src/ e api/ existe em src/lib/acesso.js.
//
// O `can(user, ACTIONS.X)` recusa em silêncio a ação que não está na lista, e
// é bom que seja assim em produção: nada quebra. O preço é que um nome errado
// (ACTIONS.LEAD_CRAIR) vira `can(gestor, undefined)` e esconde o botão do
// gestor e do consultor sem erro nenhum, porque ler propriedade que não existe
// num objeto congelado não dá erro em JS e o lint não enxerga. Esta varredura
// pega o nome errado no CI.
//
// Arquivo que declara um ACTIONS próprio (o ContractOutcomeModal tem o dele)
// fica fora, porque ali o nome não é o da lista de papéis. E ninguém renomeia
// nem desmonta o ACTIONS da lista: com `ACTIONS as A` ou `const { X } =
// ACTIONS`, o nome errado escaparia da varredura.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../acesso.js';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));
const PASTAS = ['src', 'api'];
const ACESSO = join('src', 'lib', 'acesso.js');

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') out.push(...sourceFiles(full));
    } else if (/\.(?:m?js|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// ACTIONS.NOME, ACTIONS?.NOME (também depois de um namespace, como
// acesso.ACTIONS.NOME) e ACTIONS['NOME']. O `\b` antes deixa de fora nomes
// como KEY_ACTIONS.
const REF_RE = /\bACTIONS\s*\??\.\s*([A-Za-z_$][\w$]*)|\bACTIONS\s*\[\s*['"]([^'"]+)['"]\s*\]/g;
const LOCAL_RE = /\b(?:const|let|var|function|class)\s+ACTIONS\b/;
// `ACTIONS as X` no import e `{ ... } = ACTIONS` na desmontagem.
const DESVIO_RE = /\bACTIONS\s+as\b|\}\s*=\s*ACTIONS\b(?!\s*\??[.[])/;

// Comentário não é código: o exemplo de nome errado num comentário (como o de
// acesso.js) não conta. O mesmo corte do acessoImports.test.js; o guard antes
// de `//` evita apagar um `https://` dentro de string.
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const nomesCitados = (text) => [...stripComments(text).matchAll(REF_RE)].map((m) => m[1] ?? m[2]);
const desconhecidos = (text) => nomesCitados(text).filter((nome) => !Object.hasOwn(ACTIONS, nome));

const arquivos = PASTAS.flatMap((pasta) => sourceFiles(join(RAIZ, pasta)))
  .map((file) => ({ caminho: relative(RAIZ, file), texto: stripComments(readFileSync(file, 'utf8')) }));

describe('ACTIONS.NOME aponta para uma ação que existe', () => {
  it('em src/ e api/, todo ACTIONS.NOME está na lista de acesso.js', () => {
    const erros = arquivos
      .filter(({ caminho, texto }) => caminho === ACESSO || !LOCAL_RE.test(texto))
      .flatMap(({ caminho, texto }) => desconhecidos(texto).map((nome) => `${caminho}: ACTIONS.${nome}`));
    expect(erros).toEqual([]);
  });

  it('ninguém renomeia nem desmonta o ACTIONS', () => {
    const desvios = arquivos.filter(({ texto }) => DESVIO_RE.test(texto)).map(({ caminho }) => caminho);
    expect(desvios).toEqual([]);
  });

  it('a varredura tem o que ler em src/ e em api/', () => {
    for (const pasta of PASTAS) {
      expect(arquivos.some(({ caminho }) => caminho.startsWith(`${pasta}/`)), pasta).toBe(true);
    }
    expect(arquivos.some(({ caminho }) => caminho === ACESSO)).toBe(true);
  });

  // Autoteste: o leitor enxerga as formas de citar uma ação, para os testes de
  // cima não passarem por estarem cegos.
  it('o leitor enxerga ACTIONS.NOME, ACTIONS?.NOME, namespace e colchete, pula comentário e acha o nome errado', () => {
    const amostra = `
import { ACTIONS, can } from '../lib/acesso.js';
const a = can(user, ACTIONS.LEAD_CRIAR);
const b = can(user, ACTIONS.LEAD_CRAIR);
const c = can(user, acesso.ACTIONS.SINO_EQUIPE);
const d = can(user, ACTIONS?.LEADS_VER);
const e = can(user, ACTIONS['SUPORTE_ABRIR']);
const f = can(user, ACTIONS
  .clientes_exportar);
const g = KEY_ACTIONS.NAO_E_ESTA;
// Comentário com ACTIONS.EXEMPLO_ERRADO não conta.
/* Nem em bloco: ACTIONS.OUTRO_EXEMPLO. */
const h = can(user, ACTIONS.CADASTRO_EDITAR); // ACTIONS.FIM_DE_LINHA também não
`;
    expect(nomesCitados(amostra)).toEqual(['LEAD_CRIAR', 'LEAD_CRAIR', 'SINO_EQUIPE', 'LEADS_VER', 'SUPORTE_ABRIR', 'clientes_exportar', 'CADASTRO_EDITAR']);
    expect(desconhecidos(amostra)).toEqual(['LEAD_CRAIR', 'clientes_exportar']);
  });

  it('o leitor reconhece um ACTIONS próprio do arquivo e os desvios', () => {
    expect(LOCAL_RE.test('const ACTIONS = { cancelar: {} };')).toBe(true);
    expect(LOCAL_RE.test("import { ACTIONS } from '../lib/acesso.js';")).toBe(false);
    expect(DESVIO_RE.test("import { ACTIONS as A } from '../lib/acesso.js';")).toBe(true);
    expect(DESVIO_RE.test('const { LEAD_CRIAR } = ACTIONS;')).toBe(true);
    expect(DESVIO_RE.test('const x = ACTIONS.LEAD_CRIAR;')).toBe(false);
    expect(DESVIO_RE.test('const todas = Object.values(ACTIONS);')).toBe(false);
  });
});
