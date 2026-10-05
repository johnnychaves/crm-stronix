// A linha "Outros" da tabela da equipe no Operacional. Ela junta o que não tem
// linha própria, e o professor cai ali (D4 do plano do PR 1). O subtítulo só
// cita os professores na academia com o módulo Professor e faltosos: sem o
// módulo, nenhuma academia vê diferença, e o texto continua o de antes.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TeamMonthTable } from '../../views/dashboard/TeamMonthTable.jsx';

const ANTES = 'fora da equipe ou sem responsável';
const COM_PROFESSORES = 'professores, fora da equipe ou sem responsável';

const ana = { id: 'ana', name: 'Ana Ribeiro', role: 'consultant' };
const metricas = (over) => ({ meta: { pct: 80 }, prosp: { on: true, pct: 50 }, renewal: { rate: 70, cohort: 4 }, entered: 3, upgrades: 1, ...over });

const tabela = (props) => renderToString(createElement(TeamMonthTable, {
  rows: [{ user: ana, m: metricas() }],
  others: metricas({ entered: 2, upgrades: 0, renewal: { rate: null, cohort: 0 } }),
  total: null,
  running: false,
  onPick: () => {},
  ...props,
}));

describe('subtítulo da linha Outros', () => {
  it('sem o módulo, o texto de sempre, sem professores', () => {
    const html = tabela({});
    expect(html).toContain(ANTES);
    expect(html).not.toContain('professores');
    expect(tabela({ withProfessors: false })).toBe(html);
  });

  it('com o módulo, cita os professores', () => {
    const html = tabela({ withProfessors: true });
    expect(html).toContain(COM_PROFESSORES);
  });

  it('o Operacional passa o módulo da academia, lido no login', () => {
    const fonte = readFileSync(fileURLToPath(new URL('../../views/dashboard/DashboardOperacionalView.jsx', import.meta.url)), 'utf8');
    expect(fonte).toContain('withProfessors={hasModule(appUser?.tenantModules, MODULES.FALTOSOS)}');
  });
});
