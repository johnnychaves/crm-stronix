// Todos os leads e Configurações leem a coleção inteira de leads. Desde
// 09/10/2026 leem ao vivo (useLiveLeads), com a mesma consulta e a mesma chave,
// e só com a tela aberta e o portão de inatividade ligado. Voltar à leitura
// única (usePagedLeads, getDocs) faz cada visita custar a coleção inteira de
// novo: eram umas 12 mil leituras por dia nas duas telas.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const TELAS = {
  'Todos os leads': '../../views/LeadsView.jsx',
  'Configurações': '../../views/settings/SettingsView.jsx',
};

describe('listas inteiras de leads ao vivo', () => {
  for (const [nome, arquivo] of Object.entries(TELAS)) {
    it(`${nome} lê ao vivo, com a chave comum e o portão de inatividade`, () => {
      const src = ler(arquivo);
      expect(src).toMatch(/import \{ useLiveLeads \} from '[./]+hooks\/useLiveLeads\.js'/);
      expect(src).not.toMatch(/usePagedLeads/);
      expect(src).toMatch(/useLiveLeads\(\{[\s\S]*?specKey: ALL_LEADS_KEY[\s\S]*?enabled: !!db && listenersActive/);
    });
  }

  it('o App passa o portão de inatividade às duas telas', () => {
    const app = ler('../../App.jsx');
    expect(app).toMatch(/<LeadsView [^\n]*listenersActive=\{listenersActive\}/);
    expect(app).toMatch(/<SettingsView [^\n]*listenersActive=\{listenersActive\}/);
  });
});
