// Render das peças da tela do CRM, sem jsdom (renderToString). As tasks
// seguintes acrescentam blocos a este arquivo.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { CrmSection, CrmCard, DashedNote, DeltaPill, ScopeTag } from '../../views/dashboard/CrmParts.jsx';
import { CrmToolbar } from '../../views/dashboard/CrmToolbar.jsx';
import { MonthControl, OperacionalToolbar } from '../../views/dashboard/OperacionalToolbar.jsx';
import { LOSS_PALETTE } from '../../views/dashboard/dashTokens.js';
import { ChannelTable } from '../../views/dashboard/ChannelTable.jsx';
import { CohortMilestones } from '../../views/dashboard/CohortMilestones.jsx';
import { StagePassageTable } from '../../views/dashboard/StagePassageTable.jsx';
import { LossCard } from '../../views/dashboard/LossCard.jsx';
import { PeopleConversionTable } from '../../views/dashboard/PeopleConversionTable.jsx';
import { ProfessorCard } from '../../views/dashboard/ProfessorCard.jsx';
import { FirstContactCard, DaysToEnrollCard } from '../../views/dashboard/SpeedCards.jsx';
import { PipelineNowCard, NoNextContactCard } from '../../views/dashboard/PipelineNowCards.jsx';

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

  it('barra do CRM sem pessoa nem funil: botão "Filtros do CRM", sem o ponto de filtro ativo', () => {
    const noop = () => {};
    const html = render(createElement(CrmToolbar, {
      monthKey: '2026-08', monthOptions: [{ key: '2026-08', label: 'Agosto 2026' }], onMonth: noop,
      canPrev: true, canNext: true, onPrev: noop, onNext: noop,
      compareOn: false, onCompareOn: noop, compareKey: '2026-07', compareOptions: [], onCompare: noop,
      person: 'all', people: [], onPerson: noop, funnel: 'all', funnels: [], onFunnel: noop, note: 'Mês fechado'
    }));
    expect(html).toContain('aria-label="Filtros do CRM"');
    expect(html).not.toContain('há filtro ativo');
    expect(html).not.toContain('size-1.5 rounded-full bg-brand-600');
  });
});

describe('canais e safra', () => {
  it('canais: volume, matrícula e conversão acima da safra em verde', () => {
    const html = render(createElement(ChannelTable, {
      rows: [{ name: 'Instagram', leads: 22, enrolled: 3 }, { name: 'Indicação', leads: 9, enrolled: 4 }],
      cohortConv: 18,
      read: 'Instagram traz o volume e Indicação traz o resultado.'
    }));
    expect(html).toContain('Canais de origem');
    expect(html).toContain('Instagram: 22 leads novos, 3 matricularam (14%)');
    expect(html).toContain('44%');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('Instagram traz o volume');
  });

  it('canais sem lead: cartão vazio', () => {
    expect(render(createElement(ChannelTable, { rows: [], cohortConv: null }))).toContain('Nenhum lead cadastrado neste mês.');
  });

  it('safra: passagens com a queda e o desfecho', () => {
    const html = render(createElement(CohortMilestones, {
      cohort: { leads: 56, sched: 16, came: 12, enrolled: 10, lost: 6, open: 40 },
      monthName: 'setembro',
      running: true
    }));
    expect(html).toContain('Safra de setembro');
    expect(html).toContain('os 56 leads cadastrados no mês, acompanhados até hoje');
    expect(html).toContain('−40 não agendaram');
    expect(html).toContain('−4 não compareceram');
    expect(html).toContain('29% da safra');
    expect(html).toContain('Seguem em jogo');
    expect(html).toContain('ainda está viva');
  });
});

describe('passagem entre etapas e perdas', () => {
  const passage = {
    rows: [
      { name: 'Novo lead', entered: 47, advanced: 38, lost: 5, medianMin: 240 },
      { name: 'Contato feito', entered: 38, advanced: 16, lost: 9, medianMin: 5760 }
    ],
    worst: { name: 'Contato feito', entered: 38, advanced: 16, lost: 9 }
  };

  it('com funil e base: linhas, porcentagens, mediana e maior vazamento', () => {
    const html = render(createElement(StagePassageTable, {
      passage, needFunnel: false, hasBase: true, funnelName: 'Vendas', monthName: 'setembro', academyMedian: true
    }));
    expect(html).toContain('funil Vendas · movimentos gravados em setembro');
    expect(html).toContain('Contato feito: 38 entraram, 16 avançaram, 9 se perderam, 13 seguem na etapa. Mediana de 4 dias na etapa.');
    expect(html).toContain('42%');
    expect(html).toContain('Maior vazamento: Contato feito, 9 perdidos de 38.');
    expect(html).toContain('mediana da academia');
  });

  it('sem funil e sem base: o cartão explica', () => {
    expect(render(createElement(StagePassageTable, { passage: null, needFunnel: true, hasBase: true, funnelName: '', monthName: 'setembro' })))
      .toContain('Escolha um funil para ver a passagem entre etapas');
    expect(render(createElement(StagePassageTable, { passage: null, needFunnel: false, hasBase: false, funnelName: 'Vendas', monthName: 'julho' })))
      .toContain('A passagem entre etapas começa em setembro de 2026');
  });

  it('no primeiro mês da gravação, a dica diz desde quando', () => {
    const html = render(createElement(StagePassageTable, {
      passage, needFunnel: false, hasBase: true, funnelName: 'Vendas', monthName: 'setembro', since: '14 de setembro'
    }));
    expect(html).toContain('funil Vendas · movimentos gravados desde 14 de setembro');
  });

  it('perdas: motivo mais comum, participação e etapa da perda', () => {
    const html = render(createElement(LossCard, {
      losses: { total: 17, reasons: [{ name: 'Sem interesse', count: 7 }, { name: 'Preço', count: 5 }, { name: 'Não responde', count: 5 }] },
      lossStages: [{ name: 'Contato feito', count: 7 }, { name: 'Novo lead', count: 4 }],
      stageBase: true,
      monthName: 'setembro'
    }));
    expect(html).toContain('17 leads perdidos em setembro');
    expect(html).toContain('Sem interesse');
    expect(html).toContain('7 de 17 · 41%');
    expect(html).toContain('Perdidos na etapa Contato feito: 7 de 11');
  });

  it('perdas sem base de etapa e mês sem perda', () => {
    const noBase = render(createElement(LossCard, {
      losses: { total: 2, reasons: [{ name: 'Preço', count: 2 }] }, lossStages: null, stageBase: false, monthName: 'julho'
    }));
    expect(noBase).toContain('Em julho os motivos estão completos, a etapa não tem base.');
    const empty = render(createElement(LossCard, { losses: { total: 0, reasons: [] }, lossStages: [], stageBase: true, monthName: 'setembro' }));
    expect(empty).toContain('Nenhum lead perdido neste mês.');
    expect(empty).toContain('nenhuma perda registrada');
  });
});

describe('pessoas e professores', () => {
  const m = (over) => ({ leads: 18, appts: { total: 6, rate: 83 }, enroll: 11, cohort: { conv: 22 }, firstContact: { median: 42 }, ...over });
  const users = [{ id: 'ana', name: 'Ana Ribeiro', role: 'consultant' }, { id: 'marcos', name: 'Marcos Lima', role: 'admin' }];

  it('uma linha por pessoa, clicável, com a conversão da safra e o primeiro contato', () => {
    const html = render(createElement(PeopleConversionTable, {
      rows: [{ user: users[0], m: m() }, { user: users[1], m: m({ firstContact: { median: 300 } }) }],
      others: m({ leads: 0, appts: { total: 0, rate: null }, enroll: 0 }),
      person: null, personName: null, onPick: () => {}, onClear: () => {}
    }));
    expect(html).toContain('clique numa linha para filtrar a tela por essa pessoa');
    expect(html).toContain('Filtrar a tela por Ana Ribeiro');
    expect(html).toContain('Gestor');
    expect(html).toContain('42 min');
    expect(html).toContain('5 h');
    expect(html).toContain('text-rose-700');
    expect(html).not.toContain('fora da equipe ou sem responsável');
  });

  it('com pessoa escolhida: o botão para voltar à equipe toda', () => {
    const html = render(createElement(PeopleConversionTable, {
      rows: [{ user: users[0], m: m() }], others: null, person: 'ana', personName: 'Ana Ribeiro', onPick: () => {}, onClear: () => {}
    }));
    expect(html).toContain('Ver a equipe toda');
    expect(html).toContain('aria-pressed="true"');
  });

  it('professores: ranking, treina sozinho à parte e a etiqueta da academia', () => {
    const html = render(createElement(ProfessorCard, {
      professors: {
        rows: [{ id: 'p1', name: 'Paula Nunes', solo: false, done: 4, missed: 1, enrolled: 2, conv: 50, mods: [{ name: 'Funcional', count: 3 }, { name: 'Musculação', count: 1 }] }],
        solo: { id: null, name: 'Treina sozinho', solo: true, done: 1, missed: 0, enrolled: 1, conv: 100, mods: [{ name: 'Musculação', count: 1 }] },
        done: 5
      },
      monthName: 'setembro',
      scoped: true
    }));
    expect(html).toContain('5 aulas realizadas em setembro');
    expect(html).toContain('4 realizadas · 1 falta · Funcional 3 · Musculação 1');
    expect(html).toContain('Treina sozinho');
    expect(html).toContain('academia inteira');
    expect(html).toContain('2/4');
  });

  it('professores sem aula no mês', () => {
    expect(render(createElement(ProfessorCard, { professors: { rows: [], solo: null, done: 0 }, monthName: 'julho', scoped: false })))
      .toContain('Nenhuma aula experimental realizada neste mês.');
  });
});

describe('velocidade e carteira agora', () => {
  it('primeiro contato: mediana, diferença e as quatro faixas', () => {
    const html = render(createElement(FirstContactCard, {
      fc: { total: 56, h1: 21, h24: 23, over: 5, none: 7, median: 130 },
      delta: { up: false, text: '40 min' }
    }));
    expect(html).toContain('2 h 10 min');
    expect(html).toContain('▼ 40 min');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('Até 1 hora: 21 leads de 56 (38%)');
    expect(html).toContain('Sem contato');
  });

  it('dias até a matrícula: histograma e leitura', () => {
    const html = render(createElement(DaysToEnrollCard, {
      dte: { total: 29, median: 6, buckets: [5, 6, 8, 5, 3, 2] },
      delta: { none: true, text: 'sem base' }
    }));
    expect(html).toContain('6 dias');
    expect(html).toContain('sem base');
    expect(html).toContain('4 a 7 dias entre cadastro e matrícula: 8 de 29 matrículas (28%)');
    expect(html).toContain('19 das 29 matrículas fecharam em até 7 dias.');
  });

  it('carteira agora por funil e o card de sem próximo contato', () => {
    const html = render(createElement(PipelineNowCard, {
      now: { total: 87, noNext: 23, rows: [{ id: 'ven', name: 'Vendas', count: 72 }, { id: 'ind', name: 'Indicações', count: 15 }] },
      funnelName: null,
      personName: null
    }));
    expect(html).toContain('Em jogo por funil');
    expect(html).toContain('87 leads abertos agora');
    expect(html).toContain('Funil Vendas: 72 leads em jogo agora');
    const red = render(createElement(NoNextContactCard, { count: 23, total: 87 }));
    expect(red).toContain('Sem próximo contato');
    expect(red).toContain('de 87 em jogo');
    expect(red).toContain('até alguém marcar o próximo contato');
  });
});
