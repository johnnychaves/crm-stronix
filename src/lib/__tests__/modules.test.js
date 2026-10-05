// Módulos por academia (src/lib/modules.js). O super-admin liga no console, a
// api/tenant-status.js grava a lista em tenants/{id}.modules, o app lê no
// login e as regras do Firestore leem pela hasModule. Este teste trava a conta
// do lado do app e da api e confere que as regras, quando chamam a hasModule,
// falam dos mesmos módulos.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MODULES, KNOWN_MODULES, normalizeModules, hasModule } from '../modules.js';

const rules = readFileSync(fileURLToPath(new URL('../../../firestore.rules', import.meta.url)), 'utf8');

describe('MODULES e KNOWN_MODULES', () => {
  it('o módulo do professor e dos faltosos se chama faltosos', () => {
    expect(MODULES.FALTOSOS).toBe('faltosos');
  });

  it('KNOWN_MODULES lista os valores de MODULES', () => {
    expect([...KNOWN_MODULES].sort()).toEqual(Object.values(MODULES).sort());
    expect(KNOWN_MODULES).toContain('faltosos');
  });

  it('as duas listas são congeladas', () => {
    expect(Object.isFrozen(MODULES)).toBe(true);
    expect(Object.isFrozen(KNOWN_MODULES)).toBe(true);
  });
});

describe('normalizeModules', () => {
  it('o que não é lista vira lista vazia', () => {
    for (const raw of [undefined, null, '', 'faltosos', 1, true, {}, { faltosos: true }]) {
      expect(normalizeModules(raw), JSON.stringify(raw)).toEqual([]);
    }
  });

  it('fica só com os módulos conhecidos', () => {
    expect(normalizeModules(['faltosos', 'catraca', '', null, undefined, 7, { id: 'faltosos' }, ['faltosos']])).toEqual(['faltosos']);
  });

  it('não corrige caixa nem espaço: a api recusa antes de gravar', () => {
    expect(normalizeModules(['Faltosos', ' faltosos', 'faltosos '])).toEqual([]);
  });

  it('repetido vira um só', () => {
    expect(normalizeModules(['faltosos', 'faltosos', 'faltosos'])).toEqual(['faltosos']);
  });

  it('sai em ordem, qualquer que seja a ordem de entrada', () => {
    expect(normalizeModules([...KNOWN_MODULES].reverse())).toEqual([...KNOWN_MODULES].sort());
  });

  it('devolve lista nova e não mexe na recebida', () => {
    const entrada = ['faltosos', 'catraca'];
    const saida = normalizeModules(entrada);
    expect(entrada).toEqual(['faltosos', 'catraca']);
    expect(saida).not.toBe(entrada);
  });
});

describe('hasModule', () => {
  it('lê o documento da academia', () => {
    expect(hasModule({ displayName: 'STRONIX', modules: ['faltosos'] }, MODULES.FALTOSOS)).toBe(true);
    expect(hasModule({ displayName: 'Shape One', modules: [] }, MODULES.FALTOSOS)).toBe(false);
    expect(hasModule({ displayName: 'Power Club' }, MODULES.FALTOSOS)).toBe(false);
  });

  it('lê a lista direto, como a do appUser.tenantModules', () => {
    expect(hasModule(['faltosos'], MODULES.FALTOSOS)).toBe(true);
    expect(hasModule([], MODULES.FALTOSOS)).toBe(false);
  });

  it('lê as vagas do getSeatUsage, que trazem modules junto', () => {
    expect(hasModule({ plan: 'starter', managers: 1, consultants: 3, modules: ['faltosos'] }, MODULES.FALTOSOS)).toBe(true);
  });

  it('academia sem documento ou com o campo fora do formato: sem módulo', () => {
    for (const t of [null, undefined, {}, { modules: 'faltosos' }, { modules: { faltosos: true } }, { modules: null }]) {
      expect(hasModule(t, MODULES.FALTOSOS), JSON.stringify(t)).toBe(false);
    }
  });

  it('chave desconhecida nunca está ligada, mesmo gravada', () => {
    expect(hasModule({ modules: ['faltosos', 'catraca'] }, 'catraca')).toBe(false);
    expect(hasModule(['faltosos'], 'faltoso')).toBe(false);
    expect(hasModule(['faltosos'], 'Faltosos')).toBe(false);
    expect(hasModule(['faltosos'], undefined)).toBe(false);
  });
});

describe('firestore.rules: as chamadas da hasModule', () => {
  // As regras têm a própria hasModule(appId, key), que lê o mesmo campo. Toda
  // chamada fora da definição passa o módulo escrito por extenso, e o texto
  // precisa ser um dos de MODULES, senão a regra confere um módulo que o
  // console nunca liga. Comentário não conta. Sem chamada nenhuma, não há o
  // que conferir.
  const semComentario = rules.replace(/\/\/.*$/gm, '');
  // Espaço antes do parêntese também é chamada: `hasModule (appId, 'x')`.
  const chamadasEm = (texto) => [...texto.matchAll(/(function\s+)?\bhasModule\s*\(([^)]*)\)/g)]
    .filter((m) => !m[1])
    .map((m) => m[2].trim());
  const chamadas = chamadasEm(semComentario);

  it('a busca acha a chamada com espaço antes do parêntese e pula a definição', () => {
    expect(chamadasEm("function hasModule (appId, key) { } hasModule (appId, 'x') && hasModule(appId, 'y')"))
      .toEqual(["appId, 'x'", "appId, 'y'"]);
  });

  it('toda chamada passa um módulo conhecido, entre aspas', () => {
    for (const args of chamadas) {
      const literal = args.match(/^\w+\s*,\s*'([^']*)'$/)?.[1];
      expect(literal, args).toBeDefined();
      expect(KNOWN_MODULES, args).toContain(literal);
    }
  });
});
