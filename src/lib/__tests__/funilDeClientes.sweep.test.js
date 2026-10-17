// Funil de clientes é Renovações, Vencidos e Upgrade (`isClientFunnel`). O de
// Indicações também tem `systemKind`, mas é funil de lead: tem mês de cadastro,
// etapas contadas no navegador e fica no grupo "Funis de leads". Em 16/10/2026
// o Pipeline separava os dois pelo `systemKind` solto, e a pílula do mês sumia
// só em Indicações. Esta varredura reprova a volta desse atalho nas telas que
// dividem os funis.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const TELAS = {
  'o Pipeline': '../../views/KanbanView.jsx',
  'o seletor de funil': '../../components/layout/FunnelSwitcher.jsx',
  'as abas de funil': '../../components/layout/FunnelTabs.jsx',
};

describe('funil de clientes só pelo isClientFunnel', () => {
  for (const [nome, rel] of Object.entries(TELAS)) {
    it(`${nome} não separa funil por systemKind solto`, () => {
      const src = read(rel);
      expect(src).toMatch(/isClientFunnel/);
      // A nota do menu é uma consulta por tipo, depois de já saber que é de cliente.
      expect(src.replace('CLIENT_NOTES[f.systemKind]', '')).not.toMatch(/systemKind/);
    });
  }
});
