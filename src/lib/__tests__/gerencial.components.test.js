// Render das peças da tela Gerencial, sem jsdom (renderToString), no molde do
// crm.components.test.js. Um bloco por componente, na ordem em que a tela
// empilha: venda do mês, carteira, risco, saídas e ranking.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { SoldHeroCard } from '../../views/dashboard/SoldHeroCard.jsx';
import { WalletBand } from '../../views/dashboard/WalletBand.jsx';
import { BlindValueNote, GerencialEmpty } from '../../views/dashboard/GerencialParts.jsx';
import { ExpiryRunway } from '../../views/dashboard/ExpiryRunway.jsx';

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

// Carteira de setembro na Unidade Centro: 628 contratos, R$ 134.200/mês.
const CELLS = [
  { key: 'count', label: 'Contratos vigentes', value: 628, sub: 'inclui os 19 trancados', help: 'Contratos com vigência em curso hoje.' },
  { key: 'monthly', label: 'Valor por mês', value: 134200, money: true, unit: '/mês', sub: 'soma dos tickets mensais vigentes', help: 'Soma do ticket mensal de cada contrato vigente.' },
  { key: 'ticket', label: 'Ticket mensal médio', value: 214, money: true, unit: '/mês', sub: 'valor por mês ÷ contratos com valor' },
  { key: 'locked', label: 'Trancados', value: 19, tone: 'amber', sub: 'R$ 4.100/mês · contam na carteira', help: 'Contrato trancado segue vigente.' }
];

describe('WalletBand', () => {
  it('as quatro células trazem rótulo, número e linha de apoio', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('Contratos vigentes');
    expect(html).toContain('>628<');
    expect(html).toContain('R$ 134.200');
    expect(html).toContain('R$ 214');
    expect(html).toContain('valor por mês ÷ contratos com valor');
    expect(html).toContain('R$ 4.100/mês · contam na carteira');
  });

  it('o sufixo /mês é elemento à parte, e a célula de contagem não ganha sufixo', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('R$ 134.200</span>');
    expect(html).toContain('>/mês</span>');
    expect(html).not.toContain('628</span><span class="num text-[13px]');
  });

  it('a dica só existe na célula que tem texto de ajuda, com o rótulo no aria-label', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('aria-label="O que é &quot;Contratos vigentes&quot;?"');
    expect(html).toContain('aria-label="O que é &quot;Trancados&quot;?"');
    expect(html).not.toContain('aria-label="O que é &quot;Ticket mensal médio&quot;?"');
  });

  it('trancado fica em âmbar, o resto fica neutro', () => {
    const html = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(html).toContain('text-amber-700');
    expect(html.match(/text-amber-700/g)).toHaveLength(1);
  });

  it('as notas viram cartões tracejados, e sem nota nenhuma o bloco some', () => {
    const withNotes = render(createElement(WalletBand, {
      items: CELLS,
      notes: ['A carteira soma contrato, não pessoa: 6 pessoas têm dois contratos vigentes ao mesmo tempo, então o número de contratos é maior que o de gente.']
    }));
    expect(withNotes).toContain('6 pessoas têm dois contratos vigentes');
    expect(withNotes).toContain('border-dashed');
    const bare = render(createElement(WalletBand, { items: CELLS, notes: [] }));
    expect(bare).not.toContain('border-dashed');
  });
});

describe('BlindValueNote', () => {
  it('conta as pessoas sem valor e se distingue pela forma, não pelo tom', () => {
    const html = render(createElement(BlindValueNote, { count: 114, context: 'vencem no período e não entram na conta acima' }));
    expect(html).toContain('114');
    expect(html).toContain('pessoas sem valor');
    expect(html).toContain('vencem no período e não entram na conta acima');
    expect(html).toContain('border-dashed');
    expect(html).not.toContain('amber');
    expect(html).not.toContain('rose');
  });
});

describe('GerencialEmpty', () => {
  it('um painel só, com as frases do handoff e o caminho para o pipeline', () => {
    const html = render(createElement(GerencialEmpty, { onGoToPipeline: () => {} }));
    expect(html).toContain('Ainda não há contratos');
    expect(html).toContain('Esta tela ganha vida na primeira matrícula registrada. Enquanto isso, o funil de leads continua no painel CRM.');
    expect(html).toContain('Ir para o pipeline');
    expect(html).toContain('<button type="button"');
  });
});

// Esteira de vencimento da Unidade Moinhos: 168 contratos com valor e 114
// importados sem valor, contra uma carteira de R$ 134.200 por mês.
const HORIZON = [
  { days: 30, label: 'Em 30 dias', count: 63, v: 13100, blind: 41 },
  { days: 60, label: 'Em 60 dias', count: 48, v: 9800, blind: 35 },
  { days: 90, label: 'Em 90 dias', count: 57, v: 11400, blind: 38 }
];
const CLEAN = HORIZON.map((h) => ({ ...h, blind: 0 }));

describe('ExpiryRunway', () => {
  it('o total, a contagem e a fatia da carteira saem da própria esteira', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    expect(html).toContain('R$ 34.300');
    expect(html).toContain('em 168 contratos');
    expect(html).toContain('26% da carteira'); // 34.300 de 134.200
  });

  it('sem carteira não inventa fatia: a linha some em vez de mostrar 0%', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON }));
    expect(html).not.toContain('da carteira');
  });

  it('cada barra e cada trilha tracejada é focável, com a dica do handoff', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(6);
    expect(html).toContain('aria-label="Em 30 dias: 63 contratos valendo R$ 13.100 por mês"');
    expect(html).toContain('aria-label="Em 30 dias: mais 41 contratos importados sem valor. Contam como pessoas que vencem, não entram no valor por mês."');
  });

  it('a trilha tracejada tem eixo próprio: a largura segue a contagem, não o dinheiro', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    // Barra sólida: 13.100 é o teto e ocupa 74%; 9.800 fica em 55%.
    expect(html).toContain('width:74%');
    expect(html).toContain('width:55%');
    // Trilha: 41 é o teto e ocupa 16%; 35 fica em 14%.
    expect(html).toContain('width:16%');
    expect(html).toContain('width:14%');
  });

  it('a contagem sem valor aparece escrita ao lado da trilha e no cartão do topo', () => {
    const html = render(createElement(ExpiryRunway, { horizon: HORIZON, walletMonthly: 134200 }));
    expect(html).toContain('+41 sem valor');
    expect(html).toContain('114');
    expect(html).toContain('vencem no período e não entram na conta acima');
  });

  it('sem contrato sem valor, somem a trilha, o cartão e o item de legenda', () => {
    const html = render(createElement(ExpiryRunway, { horizon: CLEAN, walletMonthly: 134200 }));
    expect(html.match(/tabindex="0"/g)).toHaveLength(3);
    expect(html).not.toContain('sem valor');
    expect(html).not.toContain('contrato importado');
    expect(html).toContain('valor por mês em risco');
  });
});
