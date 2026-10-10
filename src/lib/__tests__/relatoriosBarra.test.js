// Barra dos Relatórios e lista ao lado, sem jsdom (renderToString). O conteúdo
// de Popover e de Select fechados não é renderizado, então o menu de
// consultores é testado pelo ConsultoresMenu direto.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { RelatoriosToolbar, ConsultoresMenu } from '../../views/relatorios/RelatoriosToolbar.jsx';
import { RelatoriosRail } from '../../views/relatorios/RelatoriosRail.jsx';
import { periodFromParams } from '../period.js';

const noop = () => {};
const NOW = new Date(2026, 8, 25, 14, 30);
const people = [{ id: 'u1', name: 'Ana Ribeiro' }, { id: 'u2', name: 'Bruno Lima' }];
const base = {
  todayKey: '2026-09-25', onPeriod: noop, onRange: noop,
  monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
  canPrev: true, canNext: false, onPrev: noop, onNext: noop,
  resp: [], people, onResp: noop, origem: null, origens: ['Instagram'], onOrigem: noop,
  funnel: 'all', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop,
};

describe('barra dos Relatórios', () => {
  it('no modo mês: período, mês, consultores, origem e funil', () => {
    const out = renderToString(createElement(RelatoriosToolbar, { ...base, period: periodFromParams({ monthKey: '2026-09' }, NOW) }));
    for (const l of ['Período', 'Mês de competência', 'Consultores', 'Origem', 'Funil']) expect(out).toContain(`aria-label="${l}"`);
    expect(out).toContain('Equipe toda');
    expect(out).toContain('Todas as origens');
    expect(out).toContain('Todos os funis');
  });

  it('fora do modo mês, sem o seletor de mês, e o filtro aceso diz o que está escolhido', () => {
    const out = renderToString(createElement(RelatoriosToolbar, {
      ...base, resp: ['u2'], origem: 'Instagram', period: periodFromParams({ periodo: 'hoje' }, NOW),
    }));
    expect(out).not.toContain('aria-label="Mês de competência"');
    expect(out).toContain('Hoje · 25 set');
    expect(out).toContain('Bruno Lima');
    expect(out).toContain('>Instagram</span>');
  });

  it('o menu de consultores marca a equipe toda ou cada pessoa', () => {
    const toda = renderToString(createElement(ConsultoresMenu, { resp: [], people, onResp: noop }));
    expect(toda.match(/aria-pressed="true"/g)).toHaveLength(1);
    const uma = renderToString(createElement(ConsultoresMenu, { resp: ['u1'], people, onResp: noop }));
    expect(uma).toContain('aria-checked="true"');
    expect(uma).not.toContain('aria-pressed="true"');
  });
});

describe('lista ao lado', () => {
  it('o título Leads, os submenus com a pergunta, e o aceso é o do endereço', () => {
    const out = renderToString(createElement(RelatoriosRail, { section: 'conversao', onSection: noop }));
    expect(out).toContain('>Leads</div>');
    expect(out).toContain('Entrada de leads');
    expect(out).toContain('Quantos viraram matrícula');
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out.indexOf('aria-current="page"')).toBeGreaterThan(out.indexOf('Entrada de leads'));
    expect(out).toContain('aria-label="Relatório"');
  });
});
