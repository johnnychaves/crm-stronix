// Onde o login grava a sessão. Com "Manter conectado", tem de ser o MESMO lugar
// que o getAuth escolheu ao abrir a página (o IndexedDB), senão a aba seguinte
// muda a sessão de lugar e derruba a primeira.

import { describe, it, expect } from 'vitest';
import { persistenceKind } from '../authPersistence.js';

describe('persistenceKind', () => {
  it('sem "Manter conectado" a sessão fica só nesta aba', () => {
    expect(persistenceKind({ remember: false, indexedDbOk: true })).toBe('session');
    expect(persistenceKind({ remember: false, indexedDbOk: false })).toBe('session');
  });

  it('com "Manter conectado" usa o IndexedDB, o lugar que o getAuth vigia', () => {
    expect(persistenceKind({ remember: true, indexedDbOk: true })).toBe('indexedDB');
  });

  it('com "Manter conectado" e sem IndexedDB cai para o localStorage', () => {
    expect(persistenceKind({ remember: true, indexedDbOk: false })).toBe('local');
  });
});
