// Smoke test de render do MetaDaysCalendar, sem JSX (createElement direto) e
// sem jsdom (renderToString) — o projeto não tem ambiente de DOM no vitest.
// Cobre o caso que derrubava a tela: mês de meta com os 7 dias da semana
// começando num domingo (novembro de 2026), onde a régua antiga fazia
// Array(-1) e lançava RangeError. É só para garantir que não lança; a conta
// da grade em si é testada em operacional.routine.test.js (calendarGrid).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { metaDaysOfMonth } from '../operacional/month.js';
import { metaCalendar } from '../operacional/routine.js';
import { MetaDaysCalendar } from '../../views/dashboard/MetaDaysCalendar.jsx';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';

describe('MetaDaysCalendar (render)', () => {
  it('não lança com os 7 dias de meta em novembro de 2026 (mês começa num domingo)', () => {
    const metaDays = metaDaysOfMonth('2026-11', [0, 1, 2, 3, 4, 5, 6], new Date(2026, 10, 15));
    const cells = metaCalendar({ metaDays, hitsBy: new Map(), userId: null });

    const tree = createElement(
      TooltipProvider,
      null,
      createElement(MetaDaysCalendar, { cells, teamSize: 3, person: false })
    );

    expect(() => {
      const html = renderToString(tree);
      expect(html).toEqual(expect.any(String));
      expect(html.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('não lança com cells vazio (meta dos colegas ainda não carregada)', () => {
    const tree = createElement(TooltipProvider, null, createElement(MetaDaysCalendar, { cells: [], teamSize: 0, person: false }));
    expect(() => renderToString(tree)).not.toThrow();
  });
});
