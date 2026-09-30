import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditActionLabel } from '../superadmin.js';

describe('auditActionLabel', () => {
  it('troca de senha pelo código de e-mail', () => {
    expect(auditActionLabel({ action: 'password.reset', tenantId: 'academia-teste', details: { via: 'codigo-por-email' } }))
      .toBe('Trocou a senha pelo código · academia-teste');
  });

  it('ação desconhecida continua mostrando o nome cru', () => {
    expect(auditActionLabel({ action: 'outra.coisa', tenantId: 'academia-teste' })).toBe('outra.coisa · academia-teste');
  });
});

// A função recebe a entrada inteira da auditoria. Quem passa só o nome da ação
// (l.action) recebe um rótulo com "undefined" em toda linha: foi assim no
// console do super-admin, e o rótulo da troca de senha nunca aparecia lá.
describe('quem chama o auditActionLabel', () => {
  const SRC = fileURLToPath(new URL('../..', import.meta.url));
  const arquivos = (dir) => readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === '__tests__' ? [] : arquivos(caminho);
    return /\.jsx?$/.test(nome) ? [caminho] : [];
  });
  // Sem os comentários, como a varredura do endereço (filtrosNoEndereco.sweep.test.js):
  // um comentário que cite a chamada errada para explicá-la não derruba o teste.
  const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const chamadas = arquivos(join(SRC, 'views')).flatMap((arquivo) => {
    const codigo = semComentarios(readFileSync(arquivo, 'utf8'));
    return [...codigo.matchAll(/auditActionLabel\(([^)]*)\)/g)].map((m) => ({ arquivo: relative(SRC, arquivo), argumento: m[1] }));
  });

  it('as telas chamam a função, então a varredura olha alguma coisa', () => {
    expect(chamadas.length).toBeGreaterThan(0);
  });

  it('nenhum arquivo de src/views passa só o .action', () => {
    expect(chamadas.filter((c) => /\.action\b/.test(c.argumento))).toEqual([]);
  });
});
