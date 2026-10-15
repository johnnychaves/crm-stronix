// Barra dos Relatórios e lista ao lado, sem jsdom (renderToString). O conteúdo
// de Popover e de Select fechados não é renderizado, então o menu de
// consultores é testado pelo ConsultoresMenu direto.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
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
  it('no modo mês: o período numa caixa só, com as setas do mês, e as pílulas de consultor, origem e funil', () => {
    const out = renderToString(createElement(RelatoriosToolbar, { ...base, period: periodFromParams({ monthKey: '2026-09' }, NOW) }));
    for (const l of ['Período', 'Mês anterior', 'Próximo mês', 'Consultor', 'Origem', 'Funil']) expect(out).toContain(`aria-label="${l}"`);
    // O botão do período diz o mês, e a lista dos meses mora no balão dele.
    expect(out).toContain('Setembro 2026 · em andamento</span>');
    expect(out).not.toContain('aria-label="Mês de competência"');
    expect(out).toContain('Equipe toda');
    expect(out).toContain('>Todas</span>');
    expect(out).toContain('>Todos</span>');
  });

  it('fora do modo mês, sem as setas, e a pílula acesa diz o que está escolhido', () => {
    const out = renderToString(createElement(RelatoriosToolbar, {
      ...base, resp: ['u2'], origem: 'Instagram', period: periodFromParams({ periodo: 'hoje' }, NOW),
    }));
    expect(out).not.toContain('aria-label="Mês anterior"');
    expect(out).not.toContain('aria-label="Próximo mês"');
    expect(out).toContain('Hoje · 25 set');
    expect(out).toContain('Bruno Lima');
    expect(out).toContain('>Instagram</span>');
  });

  it('em Leads parados, o corte de dias em botões de escolha única no lugar do período', () => {
    const out = renderToString(createElement(RelatoriosToolbar, {
      ...base, period: periodFromParams({ monthKey: '2026-09' }, NOW), showPeriod: false, dias: 15, onDias: noop,
    }));
    expect(out).not.toContain('aria-label="Período"');
    expect(out).not.toContain('aria-label="Mês anterior"');
    expect(out).toContain('role="radiogroup"');
    for (const d of [3, 7, 15, 30]) expect(out).toContain(`aria-label="${d} dias"`);
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-checked="true" aria-label="15 dias"/);
    // No celular, o texto ao lado do botão de filtros é o corte, e não o período.
    expect(out).toContain('Sem registro há mais de 15 dias');
    expect(out).not.toContain('Setembro 2026 · em andamento</span>');
    for (const l of ['Consultor', 'Origem', 'Funil']) expect(out).toContain(`aria-label="${l}"`);
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
  const hrefOf = (id) => `/acad/relatorios/${id}?mes=2026-09`;
  const numbers = { entrada: { text: '42' }, conversao: { none: true }, parados: { text: '3' } };
  const render = (section) => renderToString(createElement(MemoryRouter, null,
    createElement(RelatoriosRail, { section, onSection: noop, hrefOf, numbers })));

  it('o grupo Leads abre fechado, diz o relatório aberto, e os itens são links com o número', () => {
    const out = render('conversao');
    expect(out).toContain('>Leads</span>');
    expect(out).toContain('Aberto: Conversão');
    expect(out).toContain('aria-expanded="false"');
    // Fechado, o grupo sai da ordem do Tab e da leitura.
    expect(out).toMatch(/<div inert=""/);
    const nav = /<nav\b[\s\S]*?<\/nav>/.exec(out)[0];
    expect(nav.match(/<a\b/g)).toHaveLength(5);
    expect(nav).toContain('href="/acad/relatorios/entrada?mes=2026-09"');
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out.indexOf('aria-current="page"')).toBeGreaterThan(out.indexOf('Entrada de leads'));
    // O número de cada item, e a taxa sem base dita por extenso para o leitor de tela.
    expect(nav).toContain('>42</span>');
    expect(nav).toContain('sem base');
    expect(nav).toContain('>3</span>');
    expect(out).toContain('aria-label="Relatório"');
  });
});
