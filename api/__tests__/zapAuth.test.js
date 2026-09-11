import { describe, it, expect } from 'vitest';
import { generateZapKey, hashZapKey, verifyZapKey } from '../_zapAuth.js';

describe('generateZapKey', () => {
  it('gera chave com prefixo szk_ e 52 caracteres', () => {
    const { key } = generateZapKey();
    expect(key.startsWith('szk_')).toBe(true);
    expect(key).toHaveLength(52);
  });

  it('devolve o prefixo visível com 12 caracteres', () => {
    const { key, keyPrefix } = generateZapKey();
    expect(keyPrefix).toBe(key.slice(0, 12));
    expect(keyPrefix).toHaveLength(12);
  });

  it('devolve o hash correspondente à chave', () => {
    const { key, keyHash } = generateZapKey();
    expect(keyHash).toBe(hashZapKey(key));
    expect(keyHash).toHaveLength(64);
  });

  it('nunca repete a mesma chave', () => {
    expect(generateZapKey().key).not.toBe(generateZapKey().key);
  });
});

describe('verifyZapKey', () => {
  it('aceita a chave certa', () => {
    const { key, keyHash } = generateZapKey();
    expect(verifyZapKey(key, keyHash)).toBe(true);
  });

  it('recusa chave errada', () => {
    const { keyHash } = generateZapKey();
    expect(verifyZapKey('szk_naoehessa', keyHash)).toBe(false);
  });

  it('recusa quando falta chave ou hash', () => {
    const { key, keyHash } = generateZapKey();
    expect(verifyZapKey(null, keyHash)).toBe(false);
    expect(verifyZapKey(key, null)).toBe(false);
    expect(verifyZapKey(key, 'hash-curto')).toBe(false);
  });
});
