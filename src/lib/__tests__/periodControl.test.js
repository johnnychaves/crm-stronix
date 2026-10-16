// Seletor de período, sem jsdom (renderToString). O conteúdo de um Popover
// fechado não é renderizado, então o balão é testado pelo PeriodMenu direto.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PeriodControl, PeriodMenu } from '../../components/period/PeriodControl.jsx';
import { periodFromParams } from '../period.js';

const noop = () => {};
const NOW = new Date(2026, 8, 25, 14, 30);
const TODAY = '2026-09-25';
const mes = periodFromParams({ monthKey: '2026-09' }, NOW);
const hoje = periodFromParams({ periodo: 'hoje' }, NOW);
const intervalo = periodFromParams({ de: '2026-08-28', ate: '2026-09-03' }, NOW);

describe('seletor de período', () => {
  it('no modo mês o botão diz Mês; fora dele, o texto do período, em destaque', () => {
    const m = renderToString(createElement(PeriodControl, { period: mes, todayKey: TODAY, onPeriod: noop, onRange: noop }));
    expect(m).toContain('aria-label="Período"');
    expect(m).toContain('>Mês</span>');
    expect(m).not.toContain('border-brand-600');
    const h = renderToString(createElement(PeriodControl, { period: hoje, todayKey: TODAY, onPeriod: noop, onRange: noop }));
    expect(h).toContain('Hoje · 25 set');
    expect(h).toContain('border-brand-600');
  });

  it('o balão lista os seis itens e marca o atual', () => {
    const html = renderToString(createElement(PeriodMenu, { period: hoje, todayKey: TODAY, onPick: noop, onApply: noop }));
    for (const label of ['Hoje', 'Ontem', 'Esta semana', 'Semana passada', 'Mês', 'Personalizado']) {
      expect(html).toContain(`>${label}</span>`);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    // O item marcado é o do período atual, não qualquer um.
    const marcados = [...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*>(.*?)<\/button>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, ''));
    expect(marcados).toEqual(['Hoje']);
    expect(html).not.toContain('type="date"');
  });

  it('no intervalo o balão já abre nos campos, com as datas dele e os limites da janela', () => {
    const html = renderToString(createElement(PeriodMenu, { period: intervalo, todayKey: TODAY, onPick: noop, onApply: noop }));
    expect(html).toContain('value="2026-08-28"');
    expect(html).toContain('value="2026-09-03"');
    expect(html).toContain('min="2025-10-01"');
    expect(html).toContain(`max="${TODAY}"`);
    expect(html).toContain('>Aplicar</button>');
  });
});
