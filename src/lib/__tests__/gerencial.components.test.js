// Render das peças da tela Gerencial, sem jsdom (renderToString), no molde do
// crm.components.test.js. Um bloco por componente, na ordem em que a tela
// empilha: venda do mês, carteira, risco, saídas e ranking.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { SoldHeroCard } from '../../views/dashboard/SoldHeroCard.jsx';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

// Setembro na Unidade Centro (README §9): 42 contratos somando R$ 78.400.
const MIX = [
  { type: 'nova', count: 21, value: 34700 },
  { type: 'renovacao', count: 14, value: 29800 },
  { type: 'upgrade', count: 5, value: 10400 },
  { type: 'retorno', count: 2, value: 3500 }
];
const SOLD = { mix: MIX, ticket: 214, discount: { pct: 8, abs: 6800 } };

describe('SoldHeroCard', () => {
  it('o vendido e a contagem saem do mix, e a participação sai do valor de cada tipo', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html).toContain('R$ 78.400');
    expect(html).toContain('42 contratos');
    expect(html).toContain('44%'); // 34.700 de 78.400
    expect(html).toContain('38%'); // 29.800 de 78.400
  });

  it('o sufixo /mês do ticket é um elemento à parte, no mesmo baseline', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html).toContain('R$ 214</span>');
    expect(html).toContain('>/mês</span>');
    expect(html).not.toContain('R$ 214/mês');
  });

  it('cada tipo aparece escrito na legenda, com rótulo, contagem e valor', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    ['Matrícula nova', 'Renovação', 'Upgrade', 'Retorno de ex-cliente'].forEach((label) => {
      expect(html).toContain(label);
    });
    expect(html).toContain('21 vendas');
    expect(html).toContain('2 vendas');
    expect(html).toContain('R$ 34,7 mil');
    expect(html).toContain('R$ 3.500');
  });

  it('cada segmento da cápsula é focável e tem dica com o número', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html.match(/tabindex="0"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Matrícula nova: 21 contratos · R$ 34.700 · 44% do vendido"');
  });

  it('sem comparação, somem a pílula e a linha de base', () => {
    const html = render(createElement(SoldHeroCard, SOLD));
    expect(html).not.toContain('▲');
    expect(html).not.toContain('nos mesmos dias de agosto');
  });

  it('com comparação, a pílula e a linha de base voltam juntas', () => {
    const html = render(createElement(SoldHeroCard, {
      ...SOLD,
      delta: { up: true, text: '9%', baseline: 'R$ 71.900 em 39 contratos nos mesmos dias de agosto' }
    }));
    expect(html).toContain('▲ 9%');
    expect(html).toContain('R$ 71.900 em 39 contratos nos mesmos dias de agosto');
  });

  it('desconto alto fica em âmbar, desconto normal fica neutro', () => {
    const calm = render(createElement(SoldHeroCard, SOLD));
    const loud = render(createElement(SoldHeroCard, { ...SOLD, discount: { pct: 14, abs: 12700 } }));
    expect(calm).toContain('R$ 6.800 abaixo da tabela');
    expect(calm).not.toContain('text-amber-700');
    expect(loud).toContain('text-amber-700');
  });

  it('a nota de venda cancelada só aparece quando há uma', () => {
    const none = render(createElement(SoldHeroCard, SOLD));
    expect(none).not.toContain('já foram canceladas');
    const some = render(createElement(SoldHeroCard, {
      ...SOLD,
      clawback: '2 vendas deste mês já foram canceladas, somando R$ 3.100. O valor continua no total do mês, porque o contrato foi fechado aqui.'
    }));
    expect(some).toContain('já foram canceladas, somando R$ 3.100');
  });

  it('mês sem venda nenhuma não quebra a conta', () => {
    const html = render(createElement(SoldHeroCard, { mix: [], ticket: 0, discount: { pct: 0, abs: 0 } }));
    expect(html).toContain('R$ 0');
    expect(html).toContain('0 contratos');
  });
});
