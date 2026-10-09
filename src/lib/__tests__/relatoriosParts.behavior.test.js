// @vitest-environment jsdom
// Peças dos Relatórios em uso (jsdom): o que o relatoriosParts.test.js, que só
// lê o HTML, não alcança. Número e linha de recorte que filtram e limpam, o
// "Mostrar mais" e o foco, a lista que volta aos 50 só quando o filtro muda, o
// foco depois de limpar o filtro e a cor da variação em cada número.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NumberTiles, CountBreakdown, ConversionBreakdown, ReportList } from '../../views/relatorios/ReportParts.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let container = null;
let avisos = [];
async function montar(el) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
}
const remontar = (el) => act(async () => { root.render(el); });
// Aviso do React (key repetida, aninhamento inválido, act) é defeito: derruba o teste.
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => { avisos.push(args.map(String).join(' ')); });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.restoreAllMocks();
  expect(avisos).toEqual([]);
});

const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const clicar = async (el) => { await act(async () => { el.click(); }); };
// Quem clica com o mouse já deixa o foco no botão: o teste faz o mesmo antes do clique.
const clicarComFoco = async (el) => { el.focus(); await clicar(el); };

describe('números e linhas que filtram a lista', () => {
  const numeros = [
    { key: null, name: 'Leads da safra', value: 5 },
    { key: 'situacao:matricularam', name: 'Matricularam', value: 1, tone: 'good' },
    { key: 'situacao:perderam', name: 'Perderam', value: 2, tone: 'bad' },
  ];
  const contagem = [
    { key: 'origem:Instagram', name: 'Instagram', count: 4 },
    { key: 'origem:Indicação', name: 'Indicação', count: 1 },
  ];
  const conversao = [
    { key: 'origem:Instagram', name: 'Instagram', leads: 4, enrolled: 1, conv: 25 },
    { key: 'origem:Indicação', name: 'Indicação', leads: 1, enrolled: 0, conv: 0 },
  ];

  it('um número filtra, o mesmo número de novo limpa, e o total limpa', async () => {
    const onCut = vi.fn();
    await montar(h(NumberTiles, { tiles: numeros, cut: null, onCut }));
    expect(botao('Leads da safra').getAttribute('aria-pressed')).toBe('true');
    await clicar(botao('Matricularam'));
    expect(onCut).toHaveBeenLastCalledWith('situacao:matricularam');
    // A tela devolve o filtro aceso, e o segundo clique no mesmo número o desliga.
    await remontar(h(NumberTiles, { tiles: numeros, cut: 'situacao:matricularam', onCut }));
    expect(botao('Matricularam').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Leads da safra').getAttribute('aria-pressed')).toBe('false');
    await clicar(botao('Matricularam'));
    expect(onCut).toHaveBeenLastCalledWith(null);
    // O total não tem filtro próprio: clicar nele só limpa o que estiver aceso.
    await clicar(botao('Leads da safra'));
    expect(onCut).toHaveBeenLastCalledWith(null);
    // Com um filtro aceso, outro número troca o filtro.
    await clicar(botao('Perderam'));
    expect(onCut).toHaveBeenLastCalledWith('situacao:perderam');
    expect(onCut).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['contagem', CountBreakdown, contagem],
    ['conversão', ConversionBreakdown, conversao],
  ])('a linha do recorte de %s filtra, clicar de novo limpa, e outra linha troca o filtro', async (_, Recorte, rows) => {
    const onCut = vi.fn();
    const recorte = (cut) => h(Recorte, { title: 'Por origem', rows, cut, onCut });
    await montar(recorte(null));
    await clicar(botao('Instagram'));
    expect(onCut).toHaveBeenLastCalledWith('origem:Instagram');
    await remontar(recorte('origem:Instagram'));
    expect(botao('Instagram').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Indicação').getAttribute('aria-pressed')).toBe('false');
    await clicar(botao('Instagram'));
    expect(onCut).toHaveBeenLastCalledWith(null);
    await clicar(botao('Indicação'));
    expect(onCut).toHaveBeenLastCalledWith('origem:Indicação');
  });

  it('a variação pinta pela regra de cada número: matricular mais é verde, perder mais é vermelho', async () => {
    const tiles = [
      { key: 'situacao:matricularam', name: 'Matricularam', value: 8, tone: 'good', delta: { up: true, value: 20, text: '20%' } },
      { key: 'situacao:perderam', name: 'Perderam', value: 30, tone: 'bad', delta: { up: true, value: 20, text: '20%' }, lowerBetter: true },
    ];
    await montar(h(NumberTiles, { tiles, cut: null, onCut: () => {} }));
    const pilula = (nome) => [...botao(nome).querySelectorAll('span')].find((s) => s.textContent.startsWith('▲'));
    expect(pilula('Matricularam').className).toContain('bg-emerald-50');
    expect(pilula('Matricularam').className).not.toContain('bg-rose-50');
    expect(pilula('Perderam').className).toContain('bg-rose-50');
    expect(pilula('Perderam').className).not.toContain('bg-emerald-50');
  });
});

describe('nome e texto pequeno da linha', () => {
  const linhas = [
    { key: 'origem:Instagram', name: 'Instagram', channel: 'Pago' },
    { key: 'consultor:__outros__', name: 'Outros', note: 'fora da equipe ou sem responsável' },
  ];

  it.each([
    ['contagem', CountBreakdown, (r) => ({ ...r, count: 1 })],
    ['conversão', ConversionBreakdown, (r) => ({ ...r, leads: 1, enrolled: 0, conv: 0 })],
  ])('na %s, o texto da linha lê o nome e o texto pequeno separados por um espaço', async (_, Recorte, comNumeros) => {
    await montar(h(Recorte, { title: 'Por consultor', rows: linhas.map(comNumeros), cut: null, onCut: () => {} }));
    // É o que o leitor de tela encontra no nome: sem o espaço, "InstagramPago" e "Outrosfora da equipe...".
    const texto = (nome) => botao(nome).querySelector('[title]').textContent;
    if (Recorte === CountBreakdown) expect(texto('Instagram')).toBe('Instagram Pago');
    expect(texto('Outros')).toBe('Outros fora da equipe ou sem responsável');
  });
});

describe('lista', () => {
  const colunas = [{ key: 'nome', label: 'Nome', render: (r) => r.name }];
  const leads = (prefixo, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefixo}${i}`, name: `${prefixo.toUpperCase()} ${i}` }));
  const lista = (props) => h(ReportList, { total: props.rows.length, noun: 'leads', columns: colunas, ...props });
  const linhas = () => [...container.querySelectorAll('tbody tr')];

  it('Mostrar mais traz os 50 seguintes e leva o foco à primeira linha nova', async () => {
    await montar(lista({ listId: 'a', rows: leads('l', 120) }));
    expect(linhas()).toHaveLength(50);
    await clicarComFoco(botao('Mostrar mais 50'));
    expect(linhas()).toHaveLength(100);
    expect(document.activeElement).toBe(linhas()[50]);
    expect(document.activeElement.textContent).toBe('L 50');
    // Na última página o botão sai de cena com o foco nele: o foco passa à primeira linha nova, e não ao body.
    await clicarComFoco(botao('Mostrar mais 20'));
    expect(linhas()).toHaveLength(120);
    expect(botao('Mostrar mais')).toBeUndefined();
    expect(document.activeElement).toBe(linhas()[100]);
    expect(document.activeElement.textContent).toBe('L 100');
  });

  it('volta aos 50 quando o listId muda, até ao voltar para um filtro que já tinha aberto', async () => {
    const a = leads('a', 120);
    const b = leads('b', 120);
    await montar(lista({ listId: 'conversao|origem:Instagram', rows: a }));
    await clicar(botao('Mostrar mais'));
    expect(linhas()).toHaveLength(100);
    await remontar(lista({ listId: 'conversao|origem:Indicação', rows: b }));
    expect(linhas()).toHaveLength(50);
    await remontar(lista({ listId: 'conversao|origem:Instagram', rows: a }));
    expect(linhas()).toHaveLength(50);
  });

  it('não volta aos 50 quando só os dados mudam, como um lead novo que chega ao vivo', async () => {
    const a = leads('a', 120);
    await montar(lista({ listId: 'conversao|', rows: a }));
    await clicar(botao('Mostrar mais'));
    const comNovo = [{ id: 'novo', name: 'NOVO' }, ...a];
    await remontar(lista({ listId: 'conversao|', rows: comNovo }));
    expect(linhas()).toHaveLength(100);
    expect(linhas()[0].textContent).toBe('NOVO');
    // Mexer num campo de um lead também não fecha a lista.
    await remontar(lista({ listId: 'conversao|', rows: comNovo.map((r, i) => (i === 70 ? { ...r, name: 'EDITADO' } : r)) }));
    expect(linhas()).toHaveLength(100);
  });

  it('limpar o filtro leva o foco ao número da lista, e não ao body', async () => {
    function Tela() {
      const [corte, setCorte] = useState('Matricularam');
      return lista({ listId: corte || '', cutLabel: corte, onClearCut: () => setCorte(null), rows: leads('l', 3) });
    }
    await montar(h(Tela));
    const limpar = () => container.querySelector('[aria-label="Limpar filtro da lista"]');
    await clicarComFoco(limpar());
    expect(limpar()).toBeNull();
    const numero = container.querySelector('[aria-live="polite"]');
    expect(document.activeElement).toBe(numero);
    expect(numero.textContent).toContain('3');
  });
});
