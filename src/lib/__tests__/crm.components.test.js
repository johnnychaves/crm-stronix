import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { CrmSection, CrmCard, DashedNote, DeltaPill, ScopeTag } from '../../views/dashboard/CrmParts.jsx';
import { CrmToolbar } from '../../views/dashboard/CrmToolbar.jsx';
import { MonthControl, OperacionalToolbar } from '../../views/dashboard/OperacionalToolbar.jsx';
import { LOSS_PALETTE } from '../../views/dashboard/dashTokens.js';

const render = (el) => renderToString(createElement(TooltipProvider, null, el));

describe('peças do CRM', () => {
  it('seção com a pergunta e a nota do recorte, ou com a etiqueta', () => {
    const withNote = render(createElement(CrmSection, { title: 'Origem', question: 'de onde vêm os leads?', note: 'Equipe toda · Todos os funis' }, 'corpo'));
    expect(withNote).toContain('>Origem</h3>');
    expect(withNote).toContain('de onde vêm os leads?');
    expect(withNote).toContain('Equipe toda · Todos os funis');
    const withTag = render(createElement(CrmSection, { title: 'Carteira agora', question: 'o que está em jogo neste momento?', tag: 'Agora' }, 'corpo'));
    expect(withTag).toContain('Agora');
  });

  it('card, cartão tracejado e etiqueta', () => {
    const html = render(createElement(CrmCard, { title: 'Perdas', hint: 'nenhuma perda registrada', action: createElement(ScopeTag, { tone: 'amber' }, 'academia inteira') },
      createElement(DashedNote, { title: 'Nenhum lead perdido neste mês.', text: 'Ninguém marcou perda no período.' })));
    expect(html).toContain('>Perdas</h4>');
    expect(html).toContain('nenhuma perda registrada');
    expect(html).toContain('academia inteira');
    expect(html).toContain('Nenhum lead perdido neste mês.');
  });

  it('pílula de diferença onde menor é melhor', () => {
    expect(render(createElement(DeltaPill, { delta: { up: false, text: '40 min' }, lowerBetter: true }))).toContain('text-emerald-700');
    expect(render(createElement(DeltaPill, { delta: { up: true, text: '40 min' }, lowerBetter: true }))).toContain('text-rose-700');
    expect(render(createElement(DeltaPill, { delta: { none: true, text: 'sem base' }, lowerBetter: true }))).toContain('sem base');
    expect(render(createElement(DeltaPill, { delta: null }))).toBe('');
  });

  it('barra de filtros com os quatro controles e a nota do regime', () => {
    const noop = () => {};
    const html = render(createElement(CrmToolbar, {
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      compareOn: true, onCompareOn: noop, compareKey: '2026-08', compareOptions: [{ key: '2026-08', label: 'Agosto 2026' }], onCompare: noop,
      person: 'all', people: [{ id: 'ana', name: 'Ana Ribeiro' }], onPerson: noop,
      funnel: 'ven', funnels: [{ id: 'ven', name: 'Vendas' }], onFunnel: noop,
      note: 'Pró-rata: mesmos 14 primeiros dias de agosto'
    }));
    expect(html).toContain('aria-label="Funil"');
    expect(html).toContain('aria-label="Pessoa"');
    expect(html).toContain('Pró-rata: mesmos 14 primeiros dias de agosto');
    expect(html).toContain('há filtro ativo');
    // No celular o mês fica à vista, compacto; na barra larga, o controle padrão.
    expect(html).toContain('<span class="truncate">Setembro 2026</span>');
    expect(html).toContain('min-w-[150px]');
  });

  it('controle de mês compacto: rótulo curto no botão, sem o "em andamento"; sem compact, o de antes', () => {
    const noop = () => {};
    const props = {
      monthKey: '2026-09', onMonth: noop, canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }, { key: '2026-08', label: 'Agosto 2026' }]
    };
    const compact = render(createElement(MonthControl, { ...props, compact: true }));
    expect(compact).toContain('<span class="truncate">Setembro 2026</span>');
    expect(compact).not.toContain('em andamento');
    expect(compact).toContain('w-full');
    expect(compact).not.toContain('min-w-[150px]');
    const regular = render(createElement(MonthControl, props));
    expect(regular).toContain('min-w-[150px]');
    expect(regular).not.toContain('truncate');
    expect(regular).not.toContain('w-full');
  });

  it('barras do CRM e do Operacional opacas no escuro; filtro do CRM com o ícone do handoff', () => {
    const noop = () => {};
    const base = {
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      compareOn: false, onCompareOn: noop, compareKey: '2026-08', compareOptions: [], onCompare: noop,
      person: 'all', people: [], onPerson: noop, note: ''
    };
    const crm = render(createElement(CrmToolbar, { ...base, funnel: 'all', funnels: [], onFunnel: noop }));
    const op = render(createElement(OperacionalToolbar, base));
    expect(crm).toContain('dark:bg-[#0D1226]');
    expect(op).toContain('dark:bg-[#0D1226]');
    expect(crm).toContain('lucide-list-filter');
    expect(crm).not.toContain('lucide-sliders-horizontal');
    expect(op).toContain('lucide-sliders-horizontal');
  });

  it('sexta cor das perdas: o azul claro do handoff, mais claro no escuro', () => {
    expect(LOSS_PALETTE).toHaveLength(6);
    expect(LOSS_PALETTE[5]).toBe('bg-brand-300 dark:bg-brand-200');
  });
});
