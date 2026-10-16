// As contas do desenho "Duas metas" do Operacional (src/lib/operacional/view.js)
// e a tela inteira renderizada com métricas de verdade (metricsOf num cenário
// pequeno), sem jsdom.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { normalizeContract } from '../operacional/base.js';
import { metaDaysOfMonth } from '../operacional/month.js';
import { metricsOf } from '../operacional/metrics.js';
import {
  shortNames, goalAxis, goalRows, baseBalance, forgottenMilestone, reasonColor, OTHER_REASON_COLOR, unitColumns, UNITS_MAX
} from '../operacional/view.js';
import { OperacionalDashboard } from '../../views/dashboard/OperacionalDashboard.jsx';

const NOW = new Date(2026, 8, 11, 14, 0);
const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const USERS = [
  { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro', dailyVolumeTarget: 2 },
  { id: 'diego', authUid: 'u-diego', name: 'Diego Santos', dailyVolumeTarget: 2 }
];
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo', startsAt: D(1, 1), endsAt: D(12, 31), createdAt: D(1, 1), ...over
});
const done = (cat, leadId, who, day) => ({ type: 'daily_goal_done', dailyGoalCategory: cat, leadId, actorAuthUid: who, createdAt: D(9, day) });
const ctx = {
  now: NOW,
  users: USERS,
  config: { metaWeekdays: [1, 2, 3, 4, 5], renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15 },
  contracts: [
    C('a1'), C('a2', { consultantId: 'diego' }),
    C('novo', { startsAt: D(9, 2), createdAt: D(9, 2), consultantId: 'diego' }),
    C('vence', { endsAt: D(9, 5) })
  ],
  leadsById: new Map([['vence', { id: 'vence', consultantId: 'diego' }]]),
  liveLeads: [{ consultantId: 'ana', status: 'Novo', nextFollowUp: D(9, 1) }],
  months: {
    '2026-09': {
      history: [{ consultantId: 'ana', date: '2026-09-01' }, { consultantId: 'ana', date: '2026-09-02' }, { consultantId: 'diego', date: '2026-09-02' }],
      interactions: [
        done('contato_hoje', 'x', 'u-ana', 2),
        done('novo_24h', 'y', 'u-diego', 3),
        { volumeKind: 'visita', actorAuthUid: 'u-ana', createdAt: D(9, 1) },
        { volumeKind: 'visita', actorAuthUid: 'u-ana', createdAt: D(9, 1, 11) }
      ],
      leadsCreated: []
    },
    '2026-08': { history: [], interactions: [], leadsCreated: [] }
  }
};
const render = (el) => renderToString(createElement(TooltipProvider, null, el));

describe('nome curto das linhas do topo', () => {
  it('primeiro nome; com primeiro nome repetido, a inicial do sobrenome', () => {
    const names = shortNames([
      { id: 'a', name: 'Ana Ribeiro' }, { id: 'b', name: 'ana souza' }, { id: 'c', name: 'Diego' }, { id: 'd', name: '  ' }
    ]);
    expect(names.get('a')).toBe('Ana R.');
    expect(names.get('b')).toBe('ana S.');
    expect(names.get('c')).toBe('Diego');
    expect(names.get('d')).toBe('Sem nome');
  });

  it('com a mesma inicial do sobrenome, o sobrenome inteiro', () => {
    const names = shortNames([{ id: 'a', name: 'Ana Ribeiro' }, { id: 'b', name: 'Ana Rocha' }, { id: 'c', name: 'Ana Souza' }]);
    expect(names.get('a')).toBe('Ana Ribeiro');
    expect(names.get('b')).toBe('Ana Rocha');
    expect(names.get('c')).toBe('Ana S.');
  });
});

describe('régua de dias do topo', () => {
  it('marca o primeiro dia de cada semana e guarda o estado de cada dia', () => {
    const days = metaDaysOfMonth('2026-10', [1, 2, 3, 4, 5], new Date(2026, 9, 15, 12));
    const axis = goalAxis(days);
    const byDay = new Map(axis.map((d) => [d.day, d]));
    expect(axis).toHaveLength(22);
    expect(byDay.get(1).weekStart).toBe(true);
    expect(byDay.get(2).weekStart).toBe(false);
    expect(byDay.get(5).weekStart).toBe(true);
    expect(byDay.get(14).state).toBe('closed');
    expect(byDay.get(15).state).toBe('today');
    expect(byDay.get(16).state).toBe('future');
  });
});

describe('linhas por pessoa', () => {
  const cur = metricsOf(ctx, { monthKey: '2026-09' });
  const rows = goalRows({ rows: USERS.map((u) => ({ user: u, m: metricsOf(ctx, { monthKey: '2026-09', userId: u.id }) })), metaDays: cur.metaDays });

  it('uma linha por pessoa, com o nome curto e as duas metas nos mesmos dias', () => {
    expect(rows.map((r) => r.short)).toEqual(['Ana', 'Diego']);
    const ana = rows[0];
    expect(ana.meta.cells).toHaveLength(cur.metaDays.length);
    expect(ana.prosp.cells).toHaveLength(cur.metaDays.length);
    expect(ana.meta.cells.find((c) => c.day === 1).hit).toBe(true);
    expect(ana.meta.cells.find((c) => c.day === 3).hit).toBe(false);
    expect(ana.meta.cells.find((c) => c.state === 'future').hit).toBeNull();
    expect(ana.prosp.cells.find((c) => c.day === 1).value).toBe(2);
    expect(ana.prosp.cells.find((c) => c.state === 'future').value).toBeNull();
    expect(ana.prosp.dailyTarget).toBe(2);
  });

  it('sem número de meta, a linha fica sem pontos; alvo 0 é prospecção desligada', () => {
    const [row] = goalRows({
      rows: [{ user: { id: 'x', name: 'Xavier' }, m: { meta: null, calendar: [], prosp: { on: false, pct: null, dailyTarget: 0, days: [], perDay: [] } } }],
      metaDays: cur.metaDays
    });
    expect(row.meta).toBeNull();
    expect(row.prosp.on).toBe(false);
  });
});

describe('balanço da base', () => {
  it('entradas e saídas pelos passos da ponte, com o trancamento como saldo', () => {
    const b = baseBalance({
      startCount: 512, endCount: 523,
      steps: { entraram: 24, voltaram: 5, importados: 0, cancelaram: 7, venceram: 9, trancamentos: -2 }
    });
    expect(b.net).toBe(11);
    expect(b.entries.map((e) => [e.label, e.n])).toEqual([['Matrículas', 24], ['Voltaram', 5]]);
    expect(b.exits.map((e) => [e.label, e.n])).toEqual([['Cancelaram', 7], ['Venceram sem renovar', 9], ['Trancaram', 2]]);
    expect([b.entered, b.left]).toEqual([29, 18]);
  });

  it('saldo de trancamento positivo entra como Destrancaram; passo zerado não aparece', () => {
    const b = baseBalance({ startCount: 10, endCount: 13, steps: { entraram: 0, voltaram: 0, importados: 2, cancelaram: 0, venceram: 0, trancamentos: 1 } });
    expect(b.entries.map((e) => e.key)).toEqual(['importados', 'destrancaram']);
    expect(b.exits).toEqual([]);
    expect(b.net).toBe(3);
  });
});

describe('marco mais esquecido', () => {
  it('o de menor taxa abaixo de 70%, com quantos ficaram sem contato', () => {
    expect(forgottenMilestone([
      { days: 90, done: 41, total: 58, pct: 71 },
      { days: 60, done: 38, total: 61, pct: 62 },
      { days: 30, done: 49, total: 57, pct: 86 }
    ])).toEqual({ days: 60, missed: 23, pct: 62 });
  });

  it('nenhum abaixo de 70%, sem número ou sem cliente: sem aviso', () => {
    expect(forgottenMilestone([{ days: 90, done: 8, total: 10, pct: 80 }])).toBeNull();
    expect(forgottenMilestone([{ days: 90, done: null, total: null, pct: null }])).toBeNull();
    expect(forgottenMilestone([{ days: 90, done: 0, total: 0, pct: 0 }])).toBeNull();
  });
});

describe('cores dos motivos e grade de contratos', () => {
  it('a cor segue o motivo; Outro e motivo fora da lista ficam em cinza', () => {
    expect(reasonColor('Financeiro')).toBe('#2B59FF');
    expect(reasonColor('Foi para outra academia')).toBe('#C2409A');
    expect(reasonColor('Outro')).toBe(OTHER_REASON_COLOR);
    expect(reasonColor('Mudou de país')).toBe(OTHER_REASON_COLOR);
  });

  it('mais colunas quando há mais contratos', () => {
    expect(unitColumns(64)).toBe(16);
    expect(unitColumns(65)).toBe(20);
    expect(unitColumns(UNITS_MAX)).toBe(30);
  });
});

describe('tela Operacional (render)', () => {
  const cur = metricsOf(ctx, { monthKey: '2026-09' });
  const cmp = metricsOf(ctx, { monthKey: '2026-08' });
  const team = USERS.map((u) => ({ user: u, m: metricsOf(ctx, { monthKey: '2026-09', userId: u.id }) }));
  const props = {
    cur, cmp: null, series: { active: [] }, team, compareOn: false, shownName: 'setembro', cmpName: 'agosto',
    person: null, personName: '', milestoneItems: cur.milestones || [], onPick: () => {}
  };

  it('as duas metas no topo, com o nome de cada pessoa, e as faixas abaixo', () => {
    const html = render(createElement(OperacionalDashboard, props));
    ['Meta diária', 'Meta de prospecção', '>Ana</button>', '>Diego</button>', 'Tarefas concluídas', 'Contatos nos marcos', 'A base no mês', 'Quem vence em setembro', 'Por que saem']
      .forEach((t) => expect(html).toContain(t));
    expect(html).toContain('Clique num nome para ver a tela só daquela pessoa.');
    expect(html).not.toContain('Equipe no mês');
    expect(html).not.toContain('próximos 90 dias');
  });

  it('tarefas concluídas usa o total pronto, sem contar dobrado', () => {
    expect(cur.tasks.total).toBe(2);
    const html = render(createElement(OperacionalDashboard, props));
    expect(html).toContain('2 tarefas da Meta feitas no mês');
  });

  it('com pessoa filtrada, o topo mostra só a linha dela', () => {
    const ana = metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' });
    const html = render(createElement(OperacionalDashboard, {
      ...props, cur: ana, team: [team[0]], person: 'ana', personName: 'Ana Ribeiro'
    }));
    expect(html).toContain('>Ana</button>');
    expect(html).not.toContain('>Diego</button>');
    expect(html).toContain('Clique no nome de novo para voltar à equipe toda.');
    expect(html).toContain('base da academia, não da carteira');
  });

  it('quem avisou sem motivo vira a fatia "Sem motivo" da rosca', () => {
    const html = render(createElement(OperacionalDashboard, {
      ...props,
      cur: { ...cur, renewal: { ...cur.renewal, wontReasons: { total: 3, items: [{ name: 'Financeiro', count: 1 }] } } }
    }));
    expect(html).toContain('Sem motivo');
    expect(html).toContain('3 avisaram: Financeiro 1, Sem motivo 2');
  });

  it('no fim de semana do mês em andamento, a prospecção continua "até hoje"', () => {
    // 12/09/2026 é sábado: nenhum dia de meta tem o estado de hoje.
    const sat = metricsOf({ ...ctx, now: new Date(2026, 8, 12, 14) }, { monthKey: '2026-09' });
    expect(sat.metaDays.some((d) => d.state === 'today')).toBe(false);
    const html = render(createElement(OperacionalDashboard, { ...props, cur: sat }));
    expect(html).toMatch(/ações até hoje/);
    expect(html).not.toContain('até o fim do mês');
  });

  it('o nome acessível do botão começa pelo nome que aparece', () => {
    const html = render(createElement(OperacionalDashboard, props));
    expect(html).toContain('aria-label="Ana. Ana Ribeiro: bateu a meta');
  });

  it('o balanço da base conta quem trancou e destrancou no mês', () => {
    const base = { ...cur.base, known: true, movement: { ...cur.base.movement, startCount: 10, endCount: 10, steps: { entraram: 1, cancelaram: 1, trancamentos: 0 }, trancaram: 2, destrancaram: 2 } };
    const html = render(createElement(OperacionalDashboard, { ...props, cur: { ...cur, base } }));
    expect(html).toContain('Trancamentos no mês: 2 contratos trancados e 2 destrancados.');
  });

  it('mês fechado: sem atrasados de agora', () => {
    const html = render(createElement(OperacionalDashboard, { ...props, cur: cmp, team: [] }));
    expect(html).toContain('só no mês em andamento');
  });
});
