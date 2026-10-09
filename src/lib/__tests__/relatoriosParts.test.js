// Peças da tela de Relatórios, sem jsdom (renderToString): números que filtram
// a lista, número grande, recortes em barras, lista, exportar e aviso.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  NumberTiles, HeroNumber, CountBreakdown, ConversionBreakdown, ReportList, ExportButton, ReportNotice,
} from '../../views/relatorios/ReportParts.jsx';

const noop = () => {};
const html = (el) => renderToString(el);

describe('números do topo', () => {
  it('o total acende sem recorte, e cada número é um filtro da lista', () => {
    const tiles = [
      { key: null, name: 'Leads da safra', value: 5 },
      { key: 'situacao:matricularam', name: 'Matricularam', value: 1, tone: 'good' },
      { key: 'situacao:perderam', name: 'Perderam', value: 2, tone: 'bad', delta: { up: true, value: 100, text: '100%' }, lowerBetter: true },
    ];
    const semRecorte = html(createElement(NumberTiles, { tiles, cut: null, onCut: noop }));
    expect(semRecorte.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(semRecorte).toContain('text-emerald-600');
    // Perda que sobe é ruim: a variação do Perderam sai vermelha, e nunca verde.
    expect(semRecorte).toContain('bg-rose-50');
    expect(semRecorte).not.toContain('bg-emerald-50');
    const comRecorte = html(createElement(NumberTiles, { tiles, cut: 'situacao:matricularam', onCut: noop }));
    expect(comRecorte.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(comRecorte.indexOf('aria-pressed="true"')).toBeGreaterThan(comRecorte.indexOf('Leads da safra'));
  });

  it('o número grande leva a variação e o período comparado', () => {
    const out = html(createElement(HeroNumber, { value: 1280, label: 'leads novos', delta: { up: true, text: '25%' }, compareText: 'vs. Agosto 2026' }));
    expect(out).toContain('1.280');
    expect(out).toContain('leads novos');
    expect(out).toContain('▲ 25%');
    expect(out).toContain('vs. Agosto 2026');
  });
});

describe('recortes', () => {
  it('a barra mostra o mesmo número que está ao lado, e a linha acesa é o filtro', () => {
    const rows = [
      { key: 'origem:Instagram', name: 'Instagram', channel: 'Pago', count: 4 },
      { key: 'origem:Indicação', name: 'Indicação', count: 1 },
    ];
    const out = html(createElement(CountBreakdown, { title: 'Por origem', rows, cut: 'origem:Indicação', onCut: noop }));
    expect(out).toContain('Por origem');
    expect(out).toContain('width:100%');
    expect(out).toContain('width:25%');
    expect(out).toContain('Pago');
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('na conversão, a barra é a própria conversão, em verde', () => {
    const rows = [
      { key: 'origem:Instagram', name: 'Instagram', leads: 4, enrolled: 1, conv: 25 },
      { key: 'faixa:sem-contato', name: 'Sem contato', leads: 0, enrolled: 0, conv: null },
    ];
    const out = html(createElement(ConversionBreakdown, { title: 'Por origem', rows, cut: null, onCut: noop }));
    for (const h of ['Leads', 'Matr.', 'Conv.']) expect(out).toContain(`>${h}</span>`);
    expect(out).toContain('>25%</span>');
    expect(out).toContain('width:25%');
    expect(out).toContain('bg-emerald-500');
  });
});

describe('lista', () => {
  const columns = [{ key: 'nome', label: 'Nome', render: (r) => r.name }];
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: `l${i}`, name: `Lead ${i}` }));

  it('repete o número, mostra o filtro e 50 nomes por vez', () => {
    const out = html(createElement(ReportList, { total: 60, noun: 'leads', cutLabel: 'Matricularam', onClearCut: noop, columns, rows }));
    expect(out).toContain('>60</span>');
    expect(out).toContain('Matricularam');
    expect(out).toContain('aria-label="Limpar filtro da lista"');
    expect(out).toContain('>Lead 49</td>');
    expect(out).not.toContain('>Lead 50</td>');
    expect(out).toContain('Mostrar mais 10');
    expect(out).toContain('overscroll-x-contain');
  });

  it('lista vazia convida a trocar o período', () => {
    const out = html(createElement(ReportList, {
      total: 0, noun: 'leads', columns, rows: [],
      emptyTitle: 'Nenhum lead chegou neste período.', emptyText: 'Escolha outro período ou limpe os filtros.',
    }));
    expect(out).toContain('Nenhum lead chegou neste período.');
    expect(out).not.toContain('<table');
  });

  it('exportar desligado sem nome na lista, e o aviso do dado', () => {
    expect(html(createElement(ExportButton, { onExport: noop, disabled: true }))).toContain('disabled=""');
    expect(html(createElement(ReportNotice, null, 'Agendamentos incompletos.'))).toContain('Agendamentos incompletos.');
  });
});
