// Render da faixa de resumo e dos destaques nos formatos do Operacional e do
// CRM, sem jsdom (renderToString), no molde do MetaDaysCalendar.test.js.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { DashSummaryBand } from '../../views/dashboard/DashSummaryBand.jsx';
import { DashHighlights } from '../../views/dashboard/DashHighlights.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

describe('DashSummaryBand', () => {
  it('item do Operacional: sem base não mostra pílula, sem etiqueta nem cartão tracejado', () => {
    const html = render(createElement(DashSummaryBand, {
      items: [
        { key: 'a', label: 'Meta diária', value: '82%', sub: '41 de 50', goodUp: true, delta: { up: true, text: '+8 p.p.' }, series: [1, 2, 3] },
        { key: 'b', label: 'Churn', value: '2%', goodUp: false, delta: { none: true, text: 'sem base' } }
      ]
    }));
    expect(html).toContain('▲ +8 p.p.');
    expect(html).not.toContain('sem base');
    expect(html).not.toContain('incompleto');
    expect(html).toContain('text-brand-600');
  });

  it('item do CRM: etiqueta, pílula sem base, cor da tendência e cartão sem base', () => {
    const html = render(createElement(DashSummaryBand, {
      items: [
        { key: 'ag', label: 'Agendamentos', value: '19', goodUp: true, tone: 'accent', flag: 'incompleto', showNone: true, delta: { none: true, text: 'sem base' }, series: [3, 5] },
        { key: 'cv', label: 'Conversão da safra', value: '18%', goodUp: true, delta: { flat: true, text: '= 0 p.p.' }, emptySeries: 'Sem base antes de agosto de 2026' }
      ]
    }));
    expect(html).toContain('incompleto');
    expect(html).toContain('sem base');
    expect(html).toContain('text-accent-500');
    expect(html).toContain('= 0 p.p.');
    expect(html).toContain('Sem base antes de agosto de 2026');
  });
});

describe('DashHighlights', () => {
  it('item do Operacional: melhorou ou piorou, três colunas', () => {
    const html = render(createElement(DashHighlights, {
      items: [{ text: 'Upgrades: de 2 para 5', delta: '3 vendas', up: true, bad: false }]
    }));
    expect(html).toContain('melhorou');
    expect(html).toContain('▲ 3 vendas');
    expect(html).toContain('grid-cols-3');
  });

  it('item do CRM: veredito com o mês comparado, neutro quando igual, grade do tamanho da lista', () => {
    const html = render(createElement(DashHighlights, {
      fit: true,
      items: [
        { text: '12 dos 56 leads passaram de 24 horas sem primeiro contato', delta: '▼ 20%', tone: 'good', verdict: 'melhor que agosto', rank: 2 },
        { text: 'Indicação converteu 44%, a melhor taxa entre os canais', delta: '= 0 p.p.', tone: 'flat', verdict: 'igual a agosto', rank: 1 }
      ]
    }));
    expect(html).toContain('melhor que agosto');
    expect(html).toContain('igual a agosto');
    expect(html).toContain('▼ 20%');
    expect(html).not.toContain('melhorou');
    expect(html).toContain('repeat(2, minmax(0, 1fr))');
  });

  it('sem item, nada', () => {
    expect(render(createElement(DashHighlights, { items: [] }))).toBe('');
  });
});
