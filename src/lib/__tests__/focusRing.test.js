// O anel do foco do teclado dos Relatórios e do seletor de período é uma
// constante só (src/components/focusRing.js). Estes testes não fixam as classes
// do anel: pegam o que a constante disser, então trocar o desenho do anel é
// mudar uma linha dela. Um confere o código (nenhum dos quatro arquivos escreve
// o anel à mão, e o seletor de período não depende de pasta de tela), e o outro
// confere que o anel chega aos controles que o teclado alcança, sem jsdom
// (renderToString).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { FOCUS_RING } from '../../components/focusRing.js';
import { ReportBand, CutTabs, ReportList, ExportButton, PrintButton } from '../../views/relatorios/ReportParts.jsx';
import { RelatoriosToolbar, ConsultoresMenu } from '../../views/relatorios/RelatoriosToolbar.jsx';
import { RelatoriosRail } from '../../views/relatorios/RelatoriosRail.jsx';
import { PeriodControl, PeriodMenu } from '../../components/period/PeriodControl.jsx';
import { periodFromParams } from '../period.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const ARQUIVOS = [
  'views/relatorios/ReportParts.jsx',
  'views/relatorios/RelatoriosToolbar.jsx',
  'views/relatorios/RelatoriosRail.jsx',
  'components/period/PeriodControl.jsx',
];

describe('o anel de foco é uma constante só', () => {
  it('nenhum dos quatro arquivos escreve o anel à mão, e todos importam a constante', () => {
    for (const arquivo of ARQUIVOS) {
      const codigo = read(arquivo);
      expect(codigo, arquivo).not.toMatch(/focus-visible:ring-/);
      expect(codigo, arquivo).toMatch(/import \{ FOCUS_RING \} from '[^']*focusRing\.js';/);
    }
  });

  it('a constante mora fora das telas e não importa nada, e o seletor de período não depende de pasta de tela', () => {
    expect(read('components/focusRing.js')).not.toMatch(/^import /m);
    expect(read('components/period/PeriodControl.jsx')).not.toMatch(/from '[^']*\/views\//);
  });
});

describe('o anel chega aos controles do teclado', () => {
  const tokens = FOCUS_RING.split(/\s+/).filter(Boolean);
  const tagsOf = (html, nome) => [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, 'g'))].map((m) => m[0]);
  const classesOf = (tag) => new Set((/\bclass="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/));
  const comAnel = (tag) => tokens.every((t) => classesOf(tag).has(t));
  const semAnel = (tags) => tags.filter((tag) => !comAnel(tag));
  const noop = () => {};
  const NOW = new Date(2026, 8, 25, 14, 30);
  const TODAY = '2026-09-25';
  const mes = periodFromParams({ monthKey: '2026-09' }, NOW);
  const hoje = periodFromParams({ periodo: 'hoje' }, NOW);
  const botaoDe = (html, rotulo) => tagsOf(html, 'button').filter((tag) => tag.includes(`aria-label="${rotulo}"`));

  it('a constante tem alguma classe, para o teste não passar vazio', () => {
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('células do painel, abas e linhas de recorte, lista, exportar e imprimir', () => {
    const cells = [
      { key: 'total', label: 'Leads', value: 5, onClick: noop },
      { key: 'situacao:matricularam', label: 'Matricularam', value: 1, onClick: noop, arrow: true },
    ];
    const html = renderToString(createElement(ReportBand, { label: 'Conversão', value: 20, percent: true, cells }));
    expect(tagsOf(html, 'button')).toHaveLength(2);
    expect(semAnel(tagsOf(html, 'button'))).toEqual([]);

    // Duas abas e uma linha na aba aberta: os dois botões das abas e o da linha levam o anel.
    const abas = (kind, rows) => renderToString(createElement(CutTabs, {
      tabs: [{ value: 'a', label: 'Por origem', kind, rows }, { value: 'b', label: 'Por consultor', kind, rows: [] }],
      value: 'a', onValueChange: noop, activeRow: null, onRow: noop,
    }));
    const contagem = abas('count', [{ key: 'origem:Instagram', name: 'Instagram', count: 4 }]);
    const conversao = abas('conv', [{ key: 'origem:Instagram', name: 'Instagram', leads: 4, enrolled: 1, conv: 25 }]);
    for (const recorte of [contagem, conversao]) {
      expect(tagsOf(recorte, 'button')).toHaveLength(3);
      expect(semAnel(tagsOf(recorte, 'button'))).toEqual([]);
    }

    // Com filtro e mais de 50 nomes: o número da lista, o limpar e o Mostrar mais.
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, name: `Aluno ${i}` }));
    const lista = renderToString(createElement(ReportList, {
      listId: 'a', total: 60, noun: 'leads', cutLabel: 'Origem: Instagram', onClearCut: noop,
      columns: [{ key: 'nome', label: 'Nome', render: (r) => r.name }], rows, emptyTitle: 'x', emptyText: 'y',
    }));
    expect(tagsOf(lista, 'button')).toHaveLength(2);
    expect(semAnel(tagsOf(lista, 'button'))).toEqual([]);
    const numero = tagsOf(lista, 'p').filter((tag) => tag.includes('tabindex="-1"'));
    expect(numero).toHaveLength(1);
    expect(comAnel(numero[0])).toBe(true);

    expect(semAnel(tagsOf(renderToString(createElement(ExportButton, { onExport: noop })), 'button'))).toEqual([]);
    expect(semAnel(tagsOf(renderToString(createElement(PrintButton, { onPrint: noop })), 'button'))).toEqual([]);
  });

  it('a lista ao lado: o cabeçalho do grupo e os links dos submenus', () => {
    const html = renderToString(createElement(MemoryRouter, null, createElement(RelatoriosRail, {
      section: 'entrada', onSection: noop, hrefOf: (id) => `/acad/relatorios/${id}`, numbers: null,
    })));
    const nav = /<nav\b[\s\S]*?<\/nav>/.exec(html)[0];
    expect(tagsOf(nav, 'button')).toHaveLength(1);
    expect(tagsOf(nav, 'a')).toHaveLength(5);
    expect(semAnel([...tagsOf(nav, 'button'), ...tagsOf(nav, 'a')])).toEqual([]);
  });

  it('o seletor de período e os itens do balão dele', () => {
    const botao = renderToString(createElement(PeriodControl, { period: mes, todayKey: TODAY, onPeriod: noop, onRange: noop }));
    expect(botaoDe(botao, 'Período')).toHaveLength(1);
    expect(semAnel(botaoDe(botao, 'Período'))).toEqual([]);
    expect(semAnel(tagsOf(renderToString(createElement(PeriodControl, {
      period: hoje, todayKey: TODAY, onPeriod: noop, onRange: noop, compact: true,
    })), 'button'))).toEqual([]);

    const menu = renderToString(createElement(PeriodMenu, { period: hoje, todayKey: TODAY, onPick: noop, onApply: noop }));
    const itens = tagsOf(menu, 'button').filter((tag) => tag.includes('aria-pressed'));
    expect(itens).toHaveLength(6);
    expect(semAnel(itens)).toEqual([]);
  });

  it('a barra: os filtros, o botão do balão do celular e o menu de consultores', () => {
    const people = [{ id: 'u1', name: 'Ana Ribeiro' }];
    const barra = renderToString(createElement(RelatoriosToolbar, {
      period: mes, todayKey: TODAY, onPeriod: noop, onRange: noop,
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      resp: [], people, onResp: noop, origem: null, origens: ['Instagram'], onOrigem: noop,
      funnel: 'all', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop,
    }));
    for (const rotulo of ['Consultor', 'Origem', 'Funil', 'Período', 'Mês anterior', 'Próximo mês', 'Filtros dos relatórios']) {
      expect(botaoDe(barra, rotulo), rotulo).toHaveLength(1);
      expect(semAnel(botaoDe(barra, rotulo)), rotulo).toEqual([]);
    }
    // Em Leads parados, o corte de dias também leva o anel.
    const parados = renderToString(createElement(RelatoriosToolbar, {
      period: mes, todayKey: TODAY, onPeriod: noop, onRange: noop, showPeriod: false, dias: 7, onDias: noop,
      resp: [], people, onResp: noop, origem: null, origens: ['Instagram'], onOrigem: noop,
      funnel: 'all', funnels: [{ id: 'f1', name: 'Vendas' }], onFunnel: noop,
    }));
    const cortes = tagsOf(parados, 'button').filter((tag) => tag.includes('role="radio"'));
    expect(cortes).toHaveLength(4);
    expect(semAnel(cortes)).toEqual([]);
    const menu = renderToString(createElement(ConsultoresMenu, { resp: [], people, onResp: noop }));
    const equipe = tagsOf(menu, 'button').filter((tag) => tag.includes('aria-pressed'));
    expect(equipe).toHaveLength(1);
    expect(semAnel(equipe)).toEqual([]);
  });
});
