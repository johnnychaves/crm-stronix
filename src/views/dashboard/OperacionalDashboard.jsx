// Corpo da tela Operacional, só apresentação (mockup D, "Duas metas",
// docs/superpowers/specs/mockups/2026-10-15-operacional-d-duas-metas.html):
// a Meta diária e a Meta de prospecção lado a lado no topo, por pessoa; a
// faixa de quatro números; tarefas e marcos; a base no mês; quem vence e por
// que saem. Recebe as métricas prontas de DashboardOperacionalView.
import { fmtNum } from '../../lib/format.js';
import { deltaOf } from '../../lib/operacional/metrics.js';
import { goalAxis, goalRows } from '../../lib/operacional/view.js';
import { CrmTape } from './CrmTape.jsx';
import { OperacionalGoalsHero } from './OperacionalGoalsHero.jsx';
import { TasksBand, MilestonesBand, BaseBand, RenewalBand, ExitReasonsBand } from './OperacionalBands.jsx';

const TWO = 'grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2';
const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
// O tasksByType já traz o total dos tipos; somar os valores contaria dobrado.
const sumTasks = (t) => (t ? t.total : null);

// Props:
//   cur, cmp    metricsOf do mês exibido e do comparado (cmp null sem comparar)
//   series      { active } — clientes ativos nos últimos 6 meses
//   team        [{ user, m }] — uma linha por pessoa no topo
//   compareOn, shownName, cmpName, person, personName
//   milestoneItems  marcos (com placeholder enquanto carrega)
//   onPick      (id) => void
export function OperacionalDashboard({ cur, cmp, series, team, compareOn, shownName, cmpName, person, personName, milestoneItems, onPick }) {
  const d = (a, b, kind) => (compareOn ? deltaOf(a, b, { kind }) : null);
  const running = cur.running;
  const axis = goalAxis(cur.metaDays);
  const rows = goalRows({ rows: team, metaDays: cur.metaDays });

  const lateN = running && cur.late ? (person ? (cur.late.byUser.get(person) ?? 0) : cur.late.total) : null;
  const tasksTotal = sumTasks(cur.tasks);
  const when = running ? 'hoje' : 'no fim do mês';
  const tape = [
    {
      key: 'active', label: 'Clientes ativos', goodUp: true,
      help: `Pessoas com contrato vigente ${when}. Quem está trancado conta à parte.`,
      value: cur.base.active != null ? fmtNum(cur.base.active) : '—',
      delta: d(cur.base.active, cmp?.base.active, 'count'),
      sub: person ? 'base da academia, não da carteira'
        : cur.base.known ? (cur.base.locked > 0 ? `${plural(cur.base.locked, 'trancado', 'trancados')} à parte` : 'nenhum trancado') : 'sem contratos ainda'
    },
    {
      key: 'renew', label: 'Taxa de renovação', goodUp: true,
      help: 'Renovados ÷ vencendo. No mês em andamento, renovados ÷ contratos que já tiveram desfecho.',
      value: cur.renewal.rate != null ? `${cur.renewal.rate}%` : '—',
      delta: d(cur.renewal.rate, cmp?.renewal.rate, 'pp'),
      sub: `${fmtNum(cur.renewal.counts.renew)} de ${fmtNum(cur.renewal.decided)} ${running ? 'com desfecho' : 'vencendo'}`
    },
    {
      key: 'tasks', label: 'Tarefas concluídas', goodUp: true,
      help: 'Tarefas da Meta Diária marcadas como feitas no mês. Cada tarefa conta uma vez por lead e por dia.',
      value: tasksTotal != null ? fmtNum(tasksTotal) : '—',
      delta: d(tasksTotal, sumTasks(cmp?.tasks), 'count'),
      sub: 'tarefas da Meta no mês'
    },
    {
      key: 'late', label: 'Atrasados', flag: running ? 'agora' : null,
      help: 'Contatos que passaram da data sem retorno. É um retrato de agora e não existe para mês fechado.',
      value: lateN != null ? fmtNum(lateN) : '—',
      tone: lateN > 0 ? 'bad' : null,
      delta: null,
      sub: running ? 'contatos sem retorno hoje' : 'só no mês em andamento'
    }
  ];

  const personFirst = person ? (String(personName || '').trim().split(/\s+/)[0] || 'Sem nome') : null;

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-2 md:px-8">
      <OperacionalGoalsHero
        meta={cur.meta || cur.metaHidden ? {
          pct: cur.meta?.pct ?? null,
          done: cur.meta?.done ?? 0,
          total: cur.meta?.total ?? 0,
          hidden: cur.metaHidden && !cur.meta,
          person: Boolean(person),
          delta: d(cur.meta?.pct, cmp?.meta?.pct, 'pp')
        } : null}
        prosp={cur.prosp ? { ...cur.prosp, delta: d(cur.prosp.pct, cmp?.prosp?.pct, 'pp') } : null}
        rows={rows}
        axis={axis}
        cmpName={cmpName}
        picked={person}
        onPick={onPick}
      />

      <CrmTape items={tape} />

      <div className={TWO}>
        <TasksBand tasks={cur.tasks} compareTasks={cmp?.tasks} cmpName={compareOn ? cmpName : null} />
        <MilestonesBand items={milestoneItems} />
      </div>

      <BaseBand
        movement={cur.base.movement}
        known={cur.base.known}
        series={series?.active}
        running={running}
        monthName={shownName}
        person={Boolean(person)}
      />

      <div className={TWO}>
        <RenewalBand
          renewal={cur.renewal}
          running={running}
          monthName={shownName}
          delta={d(cur.renewal.rate, cmp?.renewal.rate, 'pp')}
          personFirst={personFirst}
        />
        <ExitReasonsBand cancels={cur.base.cancels} wont={cur.renewal.wontReasons} />
      </div>
    </div>
  );
}
