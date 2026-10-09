// Peças da tela de Relatórios, sem jsdom (renderToString): números que filtram
// a lista, número grande, recortes em barras, lista, exportar e aviso.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  NumberTiles, HeroNumber, CountBreakdown, ConversionBreakdown, ReportList, ExportButton, ReportNotice, CellText, GREEN_TEXT,
} from '../../views/relatorios/ReportParts.jsx';

const noop = () => {};
const html = (el) => renderToString(el);
// As classes do <span> que traz exatamente este texto.
const classOf = (out, text) => {
  const m = out.match(new RegExp(`class="([^"]*)">${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`));
  return m ? m[1] : '';
};

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

  it('o número sem variação guarda o lugar dela, para ficar alinhado com os outros', () => {
    const tiles = [
      { key: null, name: 'Leads da safra', value: 5, delta: { up: true, value: 25, text: '25%' } },
      { key: 'situacao:em-aberto', name: 'Em aberto', value: 3 },
    ];
    const [com, sem] = html(createElement(NumberTiles, { tiles, cut: null, onCut: noop })).split('<button').slice(1);
    // Depois do número vem a pílula da variação, ou um espaço escondido com a altura dela (h-5).
    expect(com).toContain('▲ 25%');
    expect(com).not.toContain('<span aria-hidden="true" class="h-5">');
    expect(sem).toContain('<span aria-hidden="true" class="h-5"></span>');
  });

  it('o número grande leva a variação e o período comparado', () => {
    const out = html(createElement(HeroNumber, { value: 1280, label: 'leads novos', delta: { up: true, text: '25%' }, compareText: 'vs. Agosto 2026' }));
    expect(out).toContain('1.280');
    expect(out).toContain('leads novos');
    expect(out).toContain('▲ 25%');
    expect(out).toContain('vs. Agosto 2026');
  });

  it('o número grande aceita lowerBetter, e sem base fica apagado em vez de na cor do tom', () => {
    const delta = { up: true, value: 100, text: '100%' };
    const perdas = html(createElement(HeroNumber, { value: 12, label: 'perderam', tone: 'bad', delta, lowerBetter: true }));
    expect(perdas).toContain('bg-rose-50');
    expect(perdas).not.toContain('bg-emerald-50');
    // Sem lowerBetter, o mesmo aumento continua verde.
    expect(html(createElement(HeroNumber, { value: 12, label: 'matricularam', tone: 'good', delta }))).toContain('bg-emerald-50');
    const semBase = html(createElement(HeroNumber, { value: null, label: 'de conversão', percent: true, tone: 'good' }));
    expect(classOf(semBase, 'sem base')).toContain('text-muted-foreground');
    expect(classOf(semBase, 'sem base')).not.toContain('text-emerald');
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

  it('os cartões de recorte são títulos de nível 3, abaixo do título do relatório', () => {
    const contagem = html(createElement(CountBreakdown, { title: 'Por origem', rows: [{ key: 'origem:Instagram', name: 'Instagram', count: 4 }], cut: null, onCut: noop }));
    const conversao = html(createElement(ConversionBreakdown, { title: 'Por origem', rows: [{ key: 'origem:Instagram', name: 'Instagram', leads: 4, enrolled: 1, conv: 25 }], cut: null, onCut: noop }));
    for (const out of [contagem, conversao]) {
      expect(out).toContain('>Por origem</h3>');
      expect(out).not.toContain('<h4');
    }
  });

  it('a linha Outros leva a explicação em letra menor, e o title tem o texto inteiro', () => {
    const outros = { key: 'consultor:__outros__', name: 'Outros', note: 'fora da equipe ou sem responsável' };
    const contagem = html(createElement(CountBreakdown, { title: 'Por consultor', rows: [{ ...outros, count: 1 }], cut: null, onCut: noop }));
    expect(contagem).toContain('title="Outros, fora da equipe ou sem responsável"');
    expect(classOf(contagem, 'fora da equipe ou sem responsável')).toContain('text-[11px]');
    const conversao = html(createElement(ConversionBreakdown, { title: 'Por consultor', rows: [{ ...outros, leads: 1, enrolled: 0, conv: 0 }], cut: null, onCut: noop }));
    expect(conversao).toContain('title="Outros, fora da equipe ou sem responsável"');
    expect(classOf(conversao, 'fora da equipe ou sem responsável')).toContain('text-[11px]');
    // O leitor de tela recebe o nome e a explicação, e a linha sem explicação continua como era.
    expect(conversao).toContain('aria-label="Outros (fora da equipe ou sem responsável): 1 lead, 0 matrículas, 0% de conversão"');
    const comum = html(createElement(CountBreakdown, { title: 'Por consultor', rows: [{ key: 'consultor:ana', name: 'Ana Ribeiro', note: '', count: 2 }], cut: null, onCut: noop }));
    expect(comum).toContain('title="Ana Ribeiro"');
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

describe('linhas dos recortes', () => {
  const conv = [
    { key: 'origem:Instagram', name: 'Instagram', leads: 4, enrolled: 1, conv: 25 },
    { key: 'faixa:sem-contato', name: 'Sem contato', leads: 0, enrolled: 0, conv: null },
    { key: 'origem:Indicação', name: 'Indicação', leads: 1, enrolled: 1, conv: 100 },
  ];
  const conversion = (rows, extra = {}) => html(createElement(ConversionBreakdown, { title: 'Por origem', rows, cut: null, onCut: noop, ...extra }));

  it('a matrícula e a conversão têm o mesmo verde das tabelas do painel, o único verde do texto pequeno', () => {
    expect(GREEN_TEXT).toBe('text-emerald-700 dark:text-emerald-300');
    const out = conversion(conv.slice(0, 1));
    const verde = `font-semibold ${GREEN_TEXT}`;
    expect(classOf(out, '1')).toContain(verde);
    expect(classOf(out, '25%')).toContain(verde);
  });

  it('conversão que falta aparece como traço apagado, e não em branco', () => {
    const out = conversion(conv.slice(1, 2));
    expect(classOf(out, '—')).toContain('text-muted-foreground');
    expect(classOf(out, '—')).not.toContain('text-emerald');
  });

  it('cada linha da conversão se lê inteira, e o cabeçalho visual não se lê', () => {
    const out = conversion(conv);
    expect(out).toContain('aria-label="Instagram: 4 leads, 1 matrícula, 25% de conversão"');
    expect(out).toContain('aria-label="Sem contato: 0 leads, 0 matrículas, sem conversão"');
    expect(out).toContain('aria-label="Indicação: 1 lead, 1 matrícula, 100% de conversão"');
    expect(out).toMatch(/<div aria-hidden="true"[^>]*><span><\/span><span class="text-right">Leads<\/span>/);
  });

  it('sem linhas, a conversão diz que não há nada, como a contagem', () => {
    const vazio = conversion([]);
    expect(vazio).toContain('Nada no período.');
    expect(vazio).not.toContain('<ul');
    expect(vazio).not.toContain('>Leads</span>');
    expect(conversion([], { emptyText: 'Nenhum lead nesta faixa.' })).toContain('Nenhum lead nesta faixa.');
  });

  it('o nome inteiro fica no title, e a linha corta em vez de vazar do cartão', () => {
    const contagem = html(createElement(CountBreakdown, { title: 'Por origem', rows: [{ key: 'origem:Instagram', name: 'Instagram', channel: 'Pago', count: 4 }], cut: null, onCut: noop }));
    const conversao = conversion(conv);
    for (const out of [contagem, conversao]) {
      expect(out).toContain('title="Instagram"');
      const botoes = [...out.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
      expect(botoes.length).toBeGreaterThan(0);
      for (const classes of botoes) {
        expect(classes).toMatch(/\bmin-w-0\b/);
        expect(classes).toMatch(/\boverflow-hidden\b/);
      }
    }
    // O cabeçalho das colunas, que tem a mesma largura fixa, também corta.
    expect(conversao).toMatch(/<div aria-hidden="true" class="[^"]*\boverflow-hidden\b/);
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
    expect(out).toContain('class="block max-w-[11rem] truncate"');
    expect(out).toContain('>Google Meu Negócio - Campanha de inverno</span>');
  });
});
