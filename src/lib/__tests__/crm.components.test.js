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
import { crmDelta } from '../crm/metrics.js';
import { ChannelTable } from '../../views/dashboard/ChannelTable.jsx';
import { CrmHero } from '../../views/dashboard/CrmHero.jsx';
import { CrmTape } from '../../views/dashboard/CrmTape.jsx';
import { StageStuckBand } from '../../views/dashboard/StageStuckBand.jsx';
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

  it('o título do card é h4 no painel e muda de nível quando a tela pede', () => {
    const card = (extra) => render(createElement(CrmCard, { title: 'Por origem', ...extra }, 'corpo'));
    // O painel não passa nível e continua em h4.
    expect(card({})).toContain('>Por origem</h4>');
    // Os Relatórios põem os cartões abaixo do título do relatório, que é h2.
    expect(card({ headingLevel: 3 })).toContain('>Por origem</h3>');
    expect(card({ headingLevel: 3 })).not.toContain('<h4');
    // Nível que não é de título volta ao h4, em vez de sair uma tag que não existe.
    for (const headingLevel of [1, 7, 'h3', null, undefined]) expect(card({ headingLevel }), String(headingLevel)).toContain('>Por origem</h4>');
  });

  it('pílula de diferença onde menor é melhor', () => {
    expect(render(createElement(DeltaPill, { delta: { up: false, text: '40 min' }, lowerBetter: true }))).toContain('text-emerald-700');
    expect(render(createElement(DeltaPill, { delta: { up: true, text: '40 min' }, lowerBetter: true }))).toContain('text-rose-700');
    expect(render(createElement(DeltaPill, { delta: { none: true, text: 'sem base' }, lowerBetter: true }))).toContain('sem base');
    expect(render(createElement(DeltaPill, { delta: null }))).toBe('');
    // Em número, com o comparado pequeno: a seta e a cor seguem o lowerBetter.
    expect(render(createElement(DeltaPill, { delta: crmDelta(9, 2), lowerBetter: true }))).toMatch(/text-rose-700.*▲ \+7/);
    expect(render(createElement(DeltaPill, { delta: crmDelta(6, 9), lowerBetter: true }))).toMatch(/text-emerald-700.*▼ −3/);
    expect(render(createElement(DeltaPill, { delta: crmDelta(9, 2) }))).toContain('text-emerald-700');
    expect(render(createElement(DeltaPill, { delta: crmDelta(5, 5) }))).toMatch(/bg-muted.*>=</);
  });

  it('cabeçalho com título, linha do regime e os quatro controles', () => {
    const noop = () => {};
    const html = render(createElement(CrmToolbar, {
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      compareOn: true, onCompareOn: noop, compareKey: '2026-08', compareOptions: [{ key: '2026-08', label: 'Agosto 2026' }], onCompare: noop,
      person: 'all', people: [{ id: 'ana', name: 'Ana Ribeiro' }], onPerson: noop,
      funnel: 'ven', funnels: [{ id: 'ven', name: 'Vendas' }], onFunnel: noop,
      title: 'CRM', subline: '1 a 14 de setembro comparado com os 14 primeiros dias de agosto.'
    }));
    expect(html).toContain('aria-label="Funil"');
    expect(html).toContain('aria-label="Pessoa"');
    expect(html).toContain('>CRM</h2>');
    expect(html).toContain('1 a 14 de setembro comparado com os 14 primeiros dias de agosto.');
    // O mesmo cartão das faixas da página: borda, raio e sombra iguais.
    expect(html).toContain('rounded-[18px] border border-border bg-card');
    expect(html).toContain('há filtro ativo');
    // No celular o mês fica à vista, compacto; na barra larga, o controle padrão.
    expect(html).toContain('<span class="truncate">Setembro 2026</span>');
    expect(html).toContain('min-w-[150px]');
  });

  it('cabeçalho: sem espaço, os controles descem de linha em vez de encolher e cortar o rótulo', () => {
    const noop = () => {};
    const html = render(createElement(CrmToolbar, {
      monthKey: '2026-10', monthOptions: [{ key: '2026-10', label: 'Outubro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      compareOn: true, onCompareOn: noop, compareKey: '2026-09', compareOptions: [{ key: '2026-09', label: 'Setembro 2026' }], onCompare: noop,
      person: 'all', people: [], onPerson: noop, funnel: 'all', funnels: [], onFunnel: noop,
      title: 'CRM', subline: 'Uma linha de apoio longa que, sozinha, ocuparia a largura toda do cartão.'
    }));
    // O cartão quebra linha, o texto tem largura-base e os controles não encolhem.
    expect(html).toContain('md:flex-wrap');
    expect(html).toContain('md:basis-[360px]');
    expect(html).toContain('md:flex-none');
    expect(html).toContain('[&amp;&gt;*]:shrink-0');
    // O chip do funil não quebra "Todos os funis" em duas linhas.
    expect(html).toMatch(/aria-label="Funil"[^>]*class="[^"]*whitespace-nowrap/);
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

  it('barra do Operacional no cartão do CRM; as duas com o ícone de filtro do handoff', () => {
    const noop = () => {};
    const base = {
      monthKey: '2026-09', monthOptions: [{ key: '2026-09', label: 'Setembro 2026 · em andamento' }], onMonth: noop,
      canPrev: true, canNext: false, onPrev: noop, onNext: noop,
      compareOn: false, onCompareOn: noop, compareKey: '2026-08', compareOptions: [], onCompare: noop,
      person: 'all', people: [], onPerson: noop, note: ''
    };
    const crm = render(createElement(CrmToolbar, { ...base, funnel: 'all', funnels: [], onFunnel: noop }));
    const op = render(createElement(OperacionalToolbar, { ...base, title: 'Operacional', subline: '1 a 15 de outubro.' }));
    expect(op).toContain('Operacional');
    expect(op).toContain('1 a 15 de outubro.');
    expect(op).toContain('rounded-[18px]');
    expect(op).toContain('aria-label="Filtros do Operacional"');
    expect(op).not.toContain('há filtro ativo');
    expect(crm).toContain('lucide-list-filter');
    expect(op).toContain('lucide-list-filter');
    expect(crm).not.toContain('lucide-sliders-horizontal');
    expect(op).not.toContain('lucide-sliders-horizontal');
    const picked = render(createElement(OperacionalToolbar, { ...base, person: 'ana', people: [{ id: 'ana', name: 'Ana' }] }));
    expect(picked).toContain('Filtros do Operacional, há filtro ativo');
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

describe('canais', () => {
  it('canais: volume, matrícula e conversão', () => {
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

  it('canais: barra em verde (leads em verde-claro, matrículas em verde), matrícula e conversão em verde', () => {
    const html = render(createElement(ChannelTable, {
      rows: [{ name: 'Instagram', leads: 22, enrolled: 3 }, { name: 'Indicação', leads: 9, enrolled: 4 }],
      cohortConv: 18,
      read: ''
    }));
    // Mesma escala: quem trouxe mais leads vai até o fim; 3 de 22 enche 14%.
    expect(html).toMatch(/bg-emerald-200[^"]*" style="width:100%"/);
    expect(html).toMatch(/bg-success[^"]*" style="width:14%"/);
    // Matrícula e conversão verdes, também abaixo da safra (Instagram, 14% contra 18%).
    expect(html).toMatch(/text-emerald-700[^"]*">3</);
    expect(html).toMatch(/text-emerald-700[^"]*">14%</);
    expect(html).toMatch(/w-\[18px\][^"]*bg-success/);
  });

  it('canais sem lead: cartão vazio', () => {
    expect(render(createElement(ChannelTable, { rows: [], cohortConv: null }))).toContain('Nenhum lead cadastrado neste mês.');
  });
});

describe('onde os leads travam e perdas', () => {
  const passage = {
    rows: [
      { name: 'Novo lead', entered: 47, advanced: 38, lost: 5, medianMin: 240 },
      { name: 'Contato feito', entered: 38, advanced: 16, lost: 9, medianMin: 5760 }
    ],
    worst: { name: 'Contato feito', entered: 38, advanced: 16, lost: 9 }
  };

  const stuck = (over) => render(createElement(StageStuckBand, {
    passage, nowRows: [{ name: 'Contato feito', count: 26 }, { name: 'Novo lead', count: 11 }],
    needFunnel: false, hasBase: true, funnelName: 'Vendas', monthName: 'setembro', ...over
  }));

  it('onde os leads travam: avançaram, perderam e parados por etapa, com o gargalo escrito', () => {
    const html = stuck();
    expect(html).toContain('Onde os leads travam');
    expect(html).toContain('O gargalo é Contato feito.');
    expect(html).toContain('Só 42% dos leads avançam daqui, 9 foram perdidos e 13 seguem parados.');
    expect(html).toContain('Os leads ficam em média 4 dias nessa etapa e hoje há 26 deles lá dentro.');
    expect(html).toContain('>gargalo<');
    expect(html).toContain('Contato feito: 38 entraram, 16 avançaram, 9 se perderam, 13 seguem parados na etapa.');
    expect(html).toContain('>81%<'); // Novo lead: 38 de 47
    expect(html).toContain('>13<');   // parados do Contato feito
  });

  it('a coluna Agora vem da carteira de agora, por etapa', () => {
    const html = stuck();
    expect(html).toContain('>26<');
    expect(html).toContain('>11<');
    expect(stuck({ nowRows: null })).toContain('>—<');
  });

  it('sem funil e sem base: o cartão explica', () => {
    expect(stuck({ passage: null, needFunnel: true, funnelName: '' })).toContain('Escolha um funil para ver onde os leads travam');
    expect(stuck({ passage: null, hasBase: false, monthName: 'julho' })).toContain('Esta análise começa em setembro de 2026');
  });

  it('no primeiro mês da gravação, a dica diz desde quando', () => {
    expect(stuck({ since: '14 de setembro' })).toContain('desde 14 de setembro');
  });

  it('com funil e base mas nenhuma entrada no mês: nota vazia, não a tabela de zeros', () => {
    const zero = { rows: [{ name: 'Novo lead', entered: 0, advanced: 0, lost: 0, medianMin: null }], worst: null };
    const html = stuck({ passage: zero });
    expect(html).toContain('Nenhuma troca de etapa gravada neste mês.');
    expect(html).not.toContain('Tempo na etapa');
  });

  it('amostra pequena ou todos avançando: não aponta gargalo', () => {
    const small = { rows: [{ name: 'Novo lead', entered: 3, advanced: 1, lost: 1, medianMin: 60 }], worst: null };
    const html = stuck({ passage: small, nowRows: null });
    expect(html).toContain('Nenhuma etapa se destaca como gargalo');
    expect(html).not.toContain('>gargalo<');
  });

  it('o tempo na etapa some do tooltip e vira traço quando não há mediana', () => {
    const noMedian = { rows: [{ name: 'Novo lead', entered: 10, advanced: 5, lost: 1, medianMin: null }], worst: null };
    const html = stuck({ passage: noMedian, nowRows: null });
    expect(html).not.toContain('Mediana');
    expect(html).toContain('>—<');
  });

  it('perdas: motivo mais comum, participação e etapa da perda', () => {
    const html = render(createElement(LossCard, {
      losses: { total: 17, reasons: [{ name: 'Sem interesse', count: 7 }, { name: 'Preço', count: 5 }, { name: 'Não responde', count: 5 }] },
      lossStages: [{ name: 'Contato feito', count: 7 }, { name: 'Novo lead', count: 10 }],
      stageBase: true,
      monthName: 'setembro'
    }));
    expect(html).toContain('17 leads perdidos em setembro');
    expect(html).toContain('Sem interesse');
    expect(html).toContain('7 de 17 · 41%');
    expect(html).toContain('Perdidos na etapa Contato feito: 7 de 17');
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
    expect(html).toContain('Ana Ribeiro: 18 leads, 6 agendamentos, comparecimento 83%, 11 matrículas, conversão da safra 22%, primeiro contato 42 min. Filtrar a tela por essa pessoa.');
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

  it('matrícula e conversão em verde, com a barra da conversão', () => {
    const html = render(createElement(PeopleConversionTable, {
      rows: [{ user: users[0], m: m() }], others: null, person: null, personName: null, onPick: () => {}, onClear: () => {}
    }));
    expect(html).toMatch(/text-emerald-700[^"]*">11</);
    expect(html).toMatch(/bg-success[^"]*" style="width:22%"/);
    expect(html).toMatch(/text-emerald-700[^"]*">22%</);
    // Cabeçalho curto para caber numa linha na coluna de 116px.
    expect(html).toContain('>Conv. da safra<');
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
    expect(html).toContain('Paula Nunes: 2 matrículas em 4 aulas realizadas (50%)');
  });

  it('professores: tabela com realizadas, faltas e matrícula, e a barra da conversão em verde', () => {
    const html = render(createElement(ProfessorCard, {
      professors: {
        rows: [{ id: 'p1', name: 'Paula Nunes', solo: false, done: 4, missed: 1, enrolled: 2, conv: 50, mods: [{ name: 'Funcional', count: 4 }] }],
        solo: { id: null, name: 'Treina sozinho', solo: true, done: 1, missed: 0, enrolled: 1, conv: 100, mods: [] },
        done: 5
      },
      monthName: 'setembro',
      scoped: false
    }));
    ['>Professor<', '>Realizadas<', '>Faltas<', '>Matrícula<'].forEach((s) => expect(html).toContain(s));
    // A barra é a própria conversão: 2 de 4 enche metade, em verde.
    expect(html).toMatch(/bg-success[^"]*" style="width:50%"/);
    expect(html).toMatch(/text-emerald-700[^"]*">50%</);
    // Treina sozinho segue cinza, como linha de referência.
    expect(html).toMatch(/bg-slate-400" style="width:100%"/);
    expect(html).toContain('>Funcional<');
    expect(html).not.toContain('matricularam');
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

  it('primeiro contato sem o mês seguinte: nota tracejada, sem pílula de diferença', () => {
    const html = render(createElement(FirstContactCard, { fc: null, delta: { up: false, text: '40 min' } }));
    expect(html).toContain('Tempo até o primeiro contato');
    expect(html).toContain('do cadastro até a primeira interação da equipe');
    // Frase única vai no título da nota, como as outras notas de uma frase dos cards.
    expect(html).toContain('text-foreground/80">Falta o mês seguinte ao do cadastro para medir o primeiro contato.</div>');
    expect(html).not.toContain('text-foreground/80"></div>');
    expect(html).not.toContain('40 min');
    expect(html).not.toContain('Nenhum lead cadastrado neste mês.');
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

describe('herói e faixa de números', () => {
  const COHORT = { leads: 56, sched: 16, came: 12, enrolled: 10, lost: 6, open: 40, conv: 18 };

  it('herói: conversão grande, o caminho da safra com a queda escrita e o desfecho', () => {
    const html = render(createElement(CrmHero, { cohort: COHORT, monthName: 'setembro', delta: { up: true, text: '+2 p.p.' }, cmpName: 'agosto' }));
    expect(html).toContain('Conversão da safra de setembro');
    expect(html).toContain('18%');
    expect(html).toContain('▲ 2 p.p. sobre agosto');
    expect(html).toContain('10 de 56 leads');
    ['Cadastraram', 'Agendaram', 'Compareceram', 'Matricularam'].forEach((t) => expect(html).toContain(t));
    expect(html).toContain('29% dos cadastros agendaram');
    expect(html).toContain('75% dos agendados compareceram');
    expect(html).toContain('83% de quem veio matriculou');
    expect(html).toContain('10 matricularam');
    expect(html).toContain('40 em jogo');
    expect(html).toContain('6 perdidos');
    expect(html).toContain('40 seguem em jogo');
  });

  it('herói sem comparativo, sem base ou sem lead', () => {
    expect(render(createElement(CrmHero, { cohort: COHORT, monthName: 'setembro', delta: null, cmpName: 'agosto' }))).not.toContain('sobre agosto');
    expect(render(createElement(CrmHero, { cohort: COHORT, monthName: 'setembro', delta: { none: true, text: 'sem base' }, cmpName: 'agosto' }))).toContain('sem base');
    const empty = render(createElement(CrmHero, { cohort: { ...COHORT, leads: 0 }, monthName: 'setembro', delta: null, cmpName: 'agosto' }));
    expect(empty).toContain('Nenhum lead cadastrado neste mês.');
    expect(empty).toContain('—');
  });

  it('faixa de números: valor, variação com tom e a linha de apoio de cada um', () => {
    const items = [
      { key: 'leads', label: 'Leads novos', value: '56', sub: 'Instagram lidera com 22', goodUp: true, delta: { up: true, text: '10%' }, help: 'x' },
      { key: 'appts', label: 'Agendamentos', value: '19', sub: '12 vieram', goodUp: true, delta: { up: false, text: '6%' }, flag: 'incompleto' }
    ];
    const html = render(createElement(CrmTape, { items, note: null }));
    expect(html).toContain('Leads novos');
    expect(html).toContain('▲ 10%');
    expect(html).toContain('▼ 6%');
    expect(html).toContain('text-rose-700');
    expect(html).toContain('incompleto');
    expect(html).toContain('Instagram lidera com 22');
  });

  it('faixa de números: a frase da safra só aparece quando há uma', () => {
    const items = [{ key: 'leads', label: 'Leads novos', value: '56', sub: '', goodUp: true, delta: null }];
    expect(render(createElement(CrmTape, { items, note: 'Frase da safra.' }))).toContain('Frase da safra.');
    expect(render(createElement(CrmTape, { items, note: null }))).not.toContain('Frase da safra.');
  });
});
