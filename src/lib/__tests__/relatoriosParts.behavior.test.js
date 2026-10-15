// @vitest-environment jsdom
// Peças dos Relatórios em uso (jsdom): o que o relatoriosParts.test.js, que só
// lê o HTML, não alcança. O texto pequeno das linhas de recorte, o "Mostrar
// mais" e o foco, a lista que volta aos 50 só quando o filtro muda e o foco
// depois de limpar o filtro.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CutTabs, ReportList } from '../../views/relatorios/ReportParts.jsx';
import { FOCUS_RING } from '../../components/focusRing.js';

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

describe('nome e texto pequeno da linha', () => {
  const linhas = [
    { key: 'origem:Instagram', name: 'Instagram', channel: 'Pago' },
    { key: 'consultor:__outros__', name: 'Outros', note: 'fora da equipe ou sem responsável' },
  ];

  it.each([
    ['contagem', 'count', (r) => ({ ...r, count: 1 })],
    ['conversão', 'conv', (r) => ({ ...r, leads: 1, enrolled: 0, conv: 0 })],
  ])('na aba de %s, o texto da linha lê o nome e o texto pequeno separados por um espaço', async (_, kind, comNumeros) => {
    const tabs = [{ value: 'a', label: 'Por consultor', kind, rows: linhas.map(comNumeros) }];
    await montar(h(CutTabs, { tabs, value: 'a', onValueChange: () => {}, activeRow: null, onRow: () => {} }));
    // É o que o leitor de tela encontra no nome: sem o espaço, "InstagramPago" e "Outrosfora da equipe...".
    const texto = (nome) => botao(nome).querySelector('[title]').textContent;
    expect(texto('Instagram')).toBe('Instagram Pago');
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
    // Quem limpou pelo teclado precisa ver onde o foco caiu: o número leva o anel dos botões.
    for (const classe of FOCUS_RING.split(/\s+/)) expect(numero.classList.contains(classe), classe).toBe(true);
  });

  it('o filtro sai antes de o foco chegar ao número: o leitor de tela lê o total novo, e não o antigo', async () => {
    const todos = leads('l', 10);
    function Tela() {
      const [corte, setCorte] = useState('Matricularam');
      const rows = corte ? todos.slice(0, 3) : todos;
      return lista({ listId: corte || '', cutLabel: corte, onClearCut: () => setCorte(null), rows });
    }
    await montar(h(Tela));
    const numero = container.querySelector('[aria-live="polite"]');
    expect(numero.textContent).toBe('3 leads');
    // O que o número diz no instante em que recebe o foco é o que o leitor de tela lê primeiro.
    const aoFocar = [];
    numero.addEventListener('focus', () => aoFocar.push(numero.textContent));
    await clicarComFoco(container.querySelector('[aria-label="Limpar filtro da lista"]'));
    expect(aoFocar).toEqual(['10 leads']);
    expect(document.activeElement).toBe(numero);
  });
});
