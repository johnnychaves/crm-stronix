// Peças da tela de Relatórios, sem jsdom (renderToString): lista, exportar,
// aviso e célula de texto. O painel e os recortes em abas estão no
// relatoriosParts.redesenho.behavior.test.js.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ReportList, ExportButton, ReportNotice, CellText } from '../../views/relatorios/ReportParts.jsx';

const noop = () => {};
const html = (el) => renderToString(el);

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

  it('a tabela se chama pelo número da lista, que lê "60 leads" com o espaço', () => {
    const out = html(createElement(ReportList, { total: 60, noun: 'leads', columns, rows }));
    const nome = out.match(/<table[^>]*aria-labelledby="([^"]+)"/);
    expect(nome).not.toBeNull();
    expect(out).toMatch(new RegExp(`<p[^>]*id="${nome[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    expect(out).toContain('>60</span> <span');
  });

  it('as células têm 12px entre as colunas, e a primeira e a última se alinham com o cabeçalho do cartão', () => {
    const out = html(createElement(ReportList, { total: 2, noun: 'leads', columns, rows: rows.slice(0, 2) }));
    // Com 16px de cada lado a coluna do nome ficava estreita e o nome quebrava em várias linhas a 1280px.
    for (const tag of ['th', 'td']) {
      const classes = out.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))[1];
      for (const classe of ['px-3', 'first:pl-[18px]', 'last:pr-[18px]']) expect(classes, `${tag} ${classe}`).toContain(classe);
      expect(classes, tag).not.toContain('px-4');
    }
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

describe('célula de texto', () => {
  it('corta em vez de quebrar a linha, com o texto inteiro no title', () => {
    const out = html(createElement(CellText, { text: 'Google Meu Negócio - Campanha de inverno' }));
    expect(out).toContain('title="Google Meu Negócio - Campanha de inverno"');
    expect(out).toContain('class="block max-w-[9rem] truncate"');
    expect(out).toContain('>Google Meu Negócio - Campanha de inverno</span>');
  });
});
