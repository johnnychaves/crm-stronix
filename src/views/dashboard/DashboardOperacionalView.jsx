// Tela OPERACIONAL (Visão geral · Operacional): o trabalho feito e a saúde da
// base de clientes, por mês de competência, igual para todos os perfis, com
// comparativo e filtro de pessoa. Visual e textos: handoff do Claude Design
// (docs/superpowers/specs/handoff-operacional/). Toda a matemática vem de
// src/lib/operacional/ (metricsOf); aqui é só orquestração e apresentação.

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Lock, TrendingDown, UserX } from 'lucide-react';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { useOperacionalSources } from '../../hooks/useOperacionalSources.js';
import { normalizeContracts } from '../../lib/operacional/base.js';
import { monthKeyOf, addMonthsToKey, comparisonCut, compareOptions, monthLabel } from '../../lib/operacional/month.js';
import { metricsOf, deltaOf, buildHighlights, seriesOf, OTHERS_ID } from '../../lib/operacional/metrics.js';
import { TASK_ROWS } from '../../lib/operacional/routine.js';
import { fmtNum } from '../../lib/format.js';
import { cn } from '../../lib/utils.js';
import { BreakdownCard, DashHelpTip } from './DashPrimitives.jsx';
import { dashInitials } from './dashTokens.js';
import { ChartMark } from './ChartMark.jsx';
import { OperacionalToolbar } from './OperacionalToolbar.jsx';
import { DashSummaryBand } from './DashSummaryBand.jsx';
import { DashHighlights } from './DashHighlights.jsx';
import { ProspectionByDay } from './ProspectionByDay.jsx';
import { MetaDaysCalendar } from './MetaDaysCalendar.jsx';
import { BaseBridge } from './BaseBridge.jsx';
import { RenewalOutcomeBar } from './RenewalOutcomeBar.jsx';
import { MilestoneBars } from './MilestoneBars.jsx';
import { TeamMonthTable } from './TeamMonthTable.jsx';

// Padrões fora do componente: um array novo a cada render mudaria os memos.
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const DEFAULT_CHECKPOINTS = [90, 60, 30];

const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortOf = (key) => SHORT[Number(key.slice(5, 7)) - 1];

// Mês em texto corrido: "agosto", ou "setembro de 2025" quando o ano é outro.
const monthName = (key, refKey) => {
  const name = monthLabel(key, { capitalized: false, withYear: false });
  return key.slice(0, 4) === refKey.slice(0, 4) ? name : `${name} de ${key.slice(0, 4)}`;
};

const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const pctFmt = (v) => `${String(v).replace('.', ',')}%`;
// Largura relativa ao maior valor, com piso de 2% (mesmo helper do handoff).
const barPct = (v, max) => `${max > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0}%`;

const CARD = 'rounded-2xl border border-border bg-card shadow-card';
const RULE = 'border-slate-100 dark:border-white/[0.06]';
const UPCOMING = [
  { key: 'd30', label: 'até 30 dias' },
  { key: 'd60', label: '31 a 60 dias' },
  { key: 'd90', label: '61 a 90 dias' }
];

// Título de seção com a pergunta e a régua de 2px (README §2).
function SectionTitle({ title, question }) {
  return (
    <div className="mb-3.5 flex items-baseline gap-[11px] border-b-2 border-border pb-[9px]">
      <h3 className="m-0 font-display text-[16px] font-bold tracking-[-0.01em]">{title}</h3>
      <span className="text-[12.5px] text-muted-foreground">{question}</span>
    </div>
  );
}

function NowTag() {
  return (
    <span className="flex h-[19px] items-center whitespace-nowrap rounded-md bg-muted px-[7px] text-[9.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
      Agora
    </span>
  );
}

// No mês fechado, no lugar do retrato do agora, diz por que ele sumiu
// (handoff linhas 315 a 325 e 569 a 579).
function ClosedMonthCard({ title, text }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-slate-50 p-[18px] dark:bg-white/[0.03]">
      <span className="grid size-8 flex-none place-items-center rounded-[10px] bg-muted text-muted-foreground">
        <Lock size={15} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-foreground/80">{title}</div>
        <div className="mt-0.5 text-[11.5px] leading-normal text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}

// Prospecção do mês ainda carregando: a mesma casca, para a grade da Rotina
// não trocar de trilha quando o dado chegar.
function ProspectionPending() {
  return (
    <div className={cn(CARD, 'px-[18px] pt-4 pb-3.5')}>
      <span className="text-[13.5px] font-semibold">Prospecção por dia</span>
      <div className="mt-4 h-[132px]" />
      <div className={cn('mt-[7px] h-[22px] border-t', RULE)} />
    </div>
  );
}

// Tarefas concluídas por tipo, com a marca fina e a coluna de diferença do mês
// comparado (handoff linhas 259 a 285). Sem fonte ainda, os números ficam "—".
function TasksCard({ tasks, compareTasks, compareName, className }) {
  const showCompare = compareName != null;
  const rows = TASK_ROWS.map((r) => ({
    ...r,
    v: tasks ? tasks[r.id] : null,
    c: showCompare && compareTasks ? compareTasks[r.id] : null
  }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.v || 0, r.c || 0]));
  return (
    <div className={cn(CARD, 'px-[18px] pt-4 pb-3.5', className)}>
      <div className="mb-[13px] flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold">Tarefas concluídas por tipo</span>
        <div className="flex-1" />
        {showCompare && (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
            <span className="h-3 w-0.5 bg-foreground/80" />
            {compareName}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-[9px]">
        {rows.map((r) => {
          const diff = r.v != null && r.c != null ? r.v - r.c : null;
          return (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-[124px] flex-none truncate text-[12px] text-foreground/80">{r.label}</span>
              <div className="relative h-4 min-w-0 flex-1">
                {r.v != null && (
                  <ChartMark
                    tip={`${r.label}: ${fmtNum(r.v)} concluídas`}
                    className="absolute inset-y-0 left-0 rounded bg-brand-600"
                    style={{ width: barPct(r.v, max) }}
                  />
                )}
                {r.c != null && (
                  <ChartMark
                    tip={`${compareName}: ${fmtNum(r.c)}`}
                    className="absolute -inset-y-0.5 w-0.5 bg-foreground/80"
                    style={{ left: barPct(r.c, max) }}
                  />
                )}
              </div>
              <span className="num w-[34px] flex-none text-right text-[12.5px] font-semibold">{r.v != null ? fmtNum(r.v) : '—'}</span>
              {showCompare && (
                <span
                  className={cn(
                    'num w-10 flex-none text-right text-[11px] font-semibold',
                    diff == null || diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                  )}
                >
                  {diff == null ? '—' : diff === 0 ? '=' : `${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff))}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Atrasados agora de uma pessoa: só com pessoa filtrada, porque com a equipe o
// número vai para a coluna da tabela (handoff linhas 287 a 313). `late` é o
// retrato da equipe inteira, com o número de cada um em byUser.
function LateCard({ late, user, className }) {
  const n = late ? (late.byUser.get(user.id) ?? 0) : null;
  const max = late ? Math.max(1, ...late.byUser.values()) : 1;
  const name = user.name || 'Sem nome';
  return (
    <div className={cn(CARD, 'px-[18px] pt-4 pb-3.5', className)}>
      <div className="flex items-baseline gap-2">
        <span className="text-[13.5px] font-semibold">Atrasados agora</span>
        <DashHelpTip
          text="Contatos que passaram da data sem retorno. É um retrato de agora e não existe para mês fechado."
          label='O que é "Atrasados agora"?'
        />
        <div className="flex-1" />
        <NowTag />
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="num font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-rose-700 dark:text-rose-300">
          {n != null ? fmtNum(n) : '—'}
        </span>
        <span className="text-[12px] text-muted-foreground">{n === 1 ? 'contato sem retorno' : 'contatos sem retorno'}</span>
      </div>
      {n != null && (
        <div className={cn('mt-3.5 flex flex-col gap-[7px] border-t pt-3', RULE)}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 flex-none place-items-center rounded-full bg-muted text-[9px] font-bold text-foreground/80">
              {dashInitials(name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{name}</span>
            <div className="flex h-1.5 w-[74px] flex-none overflow-hidden rounded-full bg-muted">
              <ChartMark
                tip={`${name}: ${plural(n, 'contato atrasado', 'contatos atrasados')}`}
                className="rounded-full bg-danger dark:bg-[#E11D48]"
                style={{ width: barPct(n, max) }}
              />
            </div>
            <span className={cn('num w-5 flex-none text-right text-[12px] font-semibold', n >= 8 ? 'text-rose-700 dark:text-rose-300' : 'text-foreground')}>
              {fmtNum(n)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Upgrades (do vendedor no contrato) e saldo de trancamentos (da academia),
// handoff linhas 406 a 427.
function UpgradesLocksCard({ upgrades, delta, movement }) {
  const saldo = movement?.steps?.trancamentos ?? 0;
  const trancaram = movement?.trancaram || 0;
  const destrancaram = movement?.destrancaram || 0;
  const deltaTone = !delta || delta.none || delta.flat ? 'text-muted-foreground'
    : delta.up ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300';
  return (
    <div className={cn(CARD, 'flex flex-1 items-stretch px-[18px] py-4')}>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Upgrades</div>
        <div className="mt-[9px] flex items-baseline gap-[7px]">
          <span className="num font-display text-[24px] font-bold leading-none tracking-[-0.03em]">{upgrades != null ? fmtNum(upgrades) : '—'}</span>
          {delta && <span className={cn('num text-[11.5px] font-semibold', deltaTone)}>{delta.text}</span>}
        </div>
        <div className="mt-[5px] text-[11px] text-muted-foreground">vendas pelo funil Upgrade</div>
      </div>
      <span className="mx-[18px] w-px flex-none bg-slate-100 dark:bg-white/[0.06]" />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Trancamentos</div>
        <div className="mt-[9px] flex items-baseline gap-[7px]">
          <span className="num font-display text-[24px] font-bold leading-none tracking-[-0.03em]">
            {saldo === 0 ? '0' : `${saldo > 0 ? '+' : '−'}${fmtNum(Math.abs(saldo))}`}
          </span>
          <span className="num text-[11.5px] font-semibold text-muted-foreground">saldo</span>
        </div>
        <div className="num mt-[5px] text-[11px] text-muted-foreground">
          {`${plural(trancaram, 'trancou', 'trancaram')} · ${plural(destrancaram, 'destrancou', 'destrancaram')}`}
        </div>
      </div>
    </div>
  );
}

// A vencer: retrato de agora, só no mês em andamento (handoff linhas 549 a 567).
// As faixas não se sobrepõem, daí os rótulos "até 30", "31 a 60" e "61 a 90".
function UpcomingCard({ upcoming }) {
  return (
    <div className={cn(CARD, 'px-[18px] pt-4 pb-3.5')}>
      <div className="flex items-baseline gap-2">
        <span className="text-[13.5px] font-semibold">A vencer</span>
        <div className="flex-1" />
        <NowTag />
      </div>
      <div className="mt-4 flex items-stretch">
        {UPCOMING.map((u, i) => (
          <div key={u.key} className={cn('min-w-0 flex-1 border-l text-center', i === 0 ? 'border-transparent' : RULE)}>
            <div className="num font-display text-[24px] font-bold leading-none tracking-[-0.03em]">
              {upcoming ? fmtNum(upcoming[u.key]) : '—'}
            </div>
            <div className="num mt-[5px] text-[11px] text-muted-foreground">{u.label}</div>
          </div>
        ))}
      </div>
      <div className={cn('mt-[13px] border-t pt-[11px] text-[10.5px] leading-normal text-muted-foreground', RULE)}>
        Contratos com fim nos próximos 30, 60 e 90 dias. Serve para planejar o contato, não entra na taxa do mês.
      </div>
    </div>
  );
}

function DashboardOperacionalView({ appUser, usersList, liveLeads, interactions, db, listenersActive = true }) {
  const {
    contratos,
    metaWeekdays = DEFAULT_WEEKDAYS,
    renewalCheckpoints = DEFAULT_CHECKPOINTS,
    renewalGraceDays = 15
  } = useGeneralConfig();

  // Relógio da tela: vira o minuto (marca de hoje, mês em andamento, pró-rata).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = mês anterior
  const [person, setPerson] = useState('all');
  const userId = person === 'all' ? null : person;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
  // A lista de meses vai até 11 meses atrás; a seta não passa dela.
  const oldestKey = addMonthsToKey(currentKey, -11);

  const seriesKeys = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonthsToKey(monthKey, i - 5)), [monthKey]);
  // Mês exibido fechado: cada marco conta até o marco seguinte, que passa do
  // fim do mês, e o metricsOf deixa os marcos sem número sem as interações do
  // mês seguinte. Por isso ele entra na carga.
  const monthKeys = useMemo(() => {
    const keys = [...seriesKeys, cmpKey];
    const next = addMonthsToKey(monthKey, 1);
    if (monthKey < currentKey && next <= currentKey) keys.push(next);
    return [...new Set(keys)];
  }, [seriesKeys, cmpKey, monthKey, currentKey]);
  // A lista inteira de uma vez: a pausa do contrato trancado que ganhou
  // sucessor só fecha olhando os outros contratos da pessoa.
  const contracts = useMemo(() => normalizeContracts(contratos), [contratos]);
  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const personUser = userId ? users.find((u) => u.id === userId) || null : null;

  const sources = useOperacionalSources({
    db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads, contracts, appUser
  });

  const config = useMemo(
    () => ({ metaWeekdays, renewalCheckpoints, renewalGraceDays }),
    [metaWeekdays, renewalCheckpoints, renewalGraceDays]
  );
  const ctx = useMemo(() => ({
    now, users, contracts, liveLeads, config,
    leadsById: sources.leadsById,
    months: sources.months
  }), [now, users, contracts, liveLeads, config, sources.leadsById, sources.months]);

  const curLoaded = useMemo(() => metricsOf(ctx, { monthKey, userId }), [ctx, monthKey, userId]);
  const cmpLoaded = useMemo(
    () => (compareOn ? metricsOf(ctx, { monthKey: cmpKey, userId, cutEnd: comparisonCut(monthKey, cmpKey, now) }) : null),
    [compareOn, ctx, cmpKey, userId, monthKey, now]
  );
  const seriesLoaded = useMemo(() => ({
    meta: seriesOf(ctx, { monthKey, userId, pick: (m) => m.meta?.pct ?? null }),
    prosp: seriesOf(ctx, { monthKey, userId, pick: (m) => (m.prosp?.on ? m.prosp.pct : null) }),
    active: seriesOf(ctx, { monthKey, pick: (m) => m.base.active }),
    churn: seriesOf(ctx, { monthKey, pick: (m) => m.base.churn.pct }),
    renew: seriesOf(ctx, { monthKey, userId, pick: (m) => m.renewal.rate })
  }), [ctx, monthKey, userId]);
  // Com "Equipe toda": uma linha por pessoa e a de quem está fora da equipe.
  const teamLoaded = useMemo(() => (userId ? null : {
    rows: users.map((u) => ({ user: u, m: metricsOf(ctx, { monthKey, userId: u.id }) })),
    others: metricsOf(ctx, { monthKey, userId: OTHERS_ID })
  }), [ctx, monthKey, userId, users]);

  // Trocar de mês pede a fonte de novo (interações, leads, histórico); até ela
  // chegar, o mês novo tem hasSource falso e todo campo que depende dela
  // (calendário, prospecção, tarefas, marcos) vem vazio — sem isto a tela
  // mostrava o mês vazio na hora, o calendário encolhia e o layout saltava.
  // Mantém o último retrato completo (cur+cmp+series+team) que tinha fonte na
  // tela, sob a mesma opacidade de 35% e o fio de progresso que já existiam
  // (README "Carregando"), até o mês novo ter fonte.
  // Ajuste de estado durante o render, guardado por condição (padrão aceito
  // pelo React para "adaptar estado numa troca de props/seleção" sem efeito):
  // um useEffect chamando setState seria pego pelo react-hooks/set-state-in-
  // effect, e um useRef lido/escrito aqui seria pego pelo react-hooks/refs —
  // os dois testados e recusados por este lint antes desta escolha.
  const ready = curLoaded.hasSource && (!compareOn || Boolean(cmpLoaded?.hasSource));
  const [lastGood, setLastGood] = useState(null);
  if (ready && lastGood?.cur !== curLoaded) {
    setLastGood({ cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded });
  }
  const { cur, cmp, series, team } = ready || !lastGood
    ? { cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded }
    : lastGood;

  const highlights = useMemo(() => (compareOn ? buildHighlights(cur, cmp) : []), [compareOn, cur, cmp]);

  // Textos do regime de comparação (README §7).
  const running = cur.running;
  const dayN = now.getDate();
  const shownName = monthLabel(monthKey, { capitalized: false, withYear: false });
  const cmpName = monthName(cmpKey, monthKey);
  const range = running ? (dayN === 1 ? `1 de ${shownName}` : `1 a ${dayN} de ${shownName}`) : `${shownName} inteiro`;
  const firstDays = dayN === 1 ? 'o primeiro dia' : `os ${dayN} primeiros dias`;
  const subline = compareOn
    ? (running
      ? `${range} comparado com ${firstDays} de ${cmpName}. O mês está em andamento, então a comparação é pró-rata.`
      : `${range} comparado com ${cmpName}. Mês fechado.`)
    : (running ? `${range}. O mês está em andamento: hoje conta à parte.` : `${range}. Mês fechado.`);
  const note = compareOn
    ? (running ? `Comparação pró-rata: ${dayN === 1 ? 'mesmo primeiro dia' : `mesmos ${dayN} primeiros dias`}` : 'Mês fechado contra mês fechado')
    : 'Sem comparativo';

  // Mês cuja busca falhou em todas as tentativas entra vazio: avisa, em vez de
  // deixar o zero passar por número do mês.
  const failedNames = [monthKey, ...(compareOn ? [cmpKey] : [])]
    .filter((k) => sources.failedKeys.includes(k))
    .map((k) => monthName(k, monthKey));

  const spark = (points, fmt) => {
    const last = points[points.length - 1];
    const partial = running && last?.key === monthKey;
    return {
      series: points.length > 1 ? points.map((p) => p.value) : null,
      seriesFrom: points[0] ? shortOf(points[0].key) : '',
      seriesTo: last ? `${shortOf(last.key)}${partial ? ' · parcial' : ''}` : '',
      seriesLabel: `${points.length} ${points.length === 1 ? 'mês' : 'meses'} · ${points.map((p) => `${shortOf(p.key)} ${fmt(p.value)}`).join(' · ')}${partial ? ` (${shortOf(last.key)} parcial)` : ''}`
    };
  };
  const d = (a, b, kind) => (compareOn ? deltaOf(a, b, { kind }) : null);

  const summary = [
    {
      key: 'meta', label: 'Meta diária', goodUp: true,
      help: 'Dias com meta batida ÷ dias de meta do mês. No mês em andamento conta só os dias já fechados; hoje aparece à parte na régua de dias.',
      value: cur.meta?.pct != null ? `${cur.meta.pct}%` : '—',
      sub: cur.meta ? `${fmtNum(cur.meta.done)} de ${fmtNum(cur.meta.total)} ${userId ? 'dias' : 'dias-pessoa'}` : 'carregando',
      delta: d(cur.meta?.pct, cmp?.meta?.pct, 'pp'),
      ...spark(series.meta, pctFmt)
    },
    cur.prosp && !cur.prosp.on
      ? {
        key: 'prosp', label: 'Prospecção', value: 'Desligada', muted: true, sub: 'alvo 0 no cadastro', delta: null, series: null,
        help: 'Alvo diário 0 no cadastro: a pessoa está sem cota de prospecção. Não é 0%.'
      }
      : {
        key: 'prosp', label: 'Prospecção', goodUp: true,
        help: 'Ações de prospecção ÷ alvo do mês (alvo diário da pessoa × dias de meta).',
        value: cur.prosp?.pct != null ? `${cur.prosp.pct}%` : '—',
        sub: cur.prosp ? `${fmtNum(cur.prosp.done)} de ${fmtNum(cur.prosp.target)} ações` : 'carregando',
        delta: d(cur.prosp?.pct, cmp?.prosp?.pct, 'pp'),
        ...spark(series.prosp, pctFmt)
      },
    {
      key: 'active', label: 'Clientes ativos', goodUp: true,
      help: 'Pessoas com contrato vigente no fim do mês. Quem está trancado conta à parte.',
      value: cur.base.active != null ? fmtNum(cur.base.active) : '—',
      sub: userId ? 'base da academia, não da carteira' : running ? 'com contrato vigente hoje' : 'no fim do mês',
      delta: d(cur.base.active, cmp?.base.active, 'count'),
      ...spark(series.active, fmtNum)
    },
    {
      key: 'churn', label: 'Churn', goodUp: false,
      help: 'Cancelamentos mais vencidos que passaram da tolerância ÷ clientes ativos no início do mês.',
      value: cur.base.churn.pct != null ? pctFmt(cur.base.churn.pct) : '—',
      sub: userId ? 'base da academia' : 'saídas definitivas',
      delta: d(cur.base.churn.pct, cmp?.base.churn.pct, 'pp'),
      ...spark(series.churn, pctFmt)
    },
    {
      key: 'renew', label: 'Taxa de renovação', goodUp: true,
      help: 'Renovados ÷ vencendo. No mês em andamento, renovados ÷ contratos que já tiveram desfecho.',
      value: cur.renewal.rate != null ? `${cur.renewal.rate}%` : '—',
      sub: `${fmtNum(cur.renewal.counts.renew)} de ${fmtNum(cur.renewal.decided)} ${running ? 'com desfecho' : 'vencendo'}`,
      delta: d(cur.renewal.rate, cmp?.renewal.rate, 'pp'),
      ...spark(series.renew, pctFmt)
    }
  ];

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );
  const cmpOptions = compareOptions(monthKey).map((k) => ({ key: k, label: monthLabel(k) }));
  const people = users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' }));
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };

  // Alvo 0 não é alvo pequeno: o card de prospecção sai e a Rotina troca de trilhas.
  const prospOff = Boolean(cur.prosp && !cur.prosp.on);
  const movement = cur.base.movement;
  const cancels = cur.base.cancels;
  const wont = cur.renewal.wontReasons;
  const firstName = (personUser?.name || '').trim().split(/\s+/)[0] || 'Sem nome';
  const renewSummary = personUser
    ? `${plural(cur.renewal.cohort, 'contrato', 'contratos')} na carteira de ${firstName}`
    : `${plural(cur.renewal.cohort, 'contrato com fim', 'contratos com fim')} neste mês`;
  // Marcos ainda sem fonte (mês carregando): uma linha por marco, sem número.
  const milestoneItems = cur.milestones || [...new Set((renewalCheckpoints || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    .sort((a, b) => b - a)
    .map((days) => ({ days, done: null, total: null, pct: null }));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="-m-4 md:-m-8 font-sans">
        <header className="bg-card px-4 md:px-8 pb-4 pt-5">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">Operacional</h2>
          <p className="mt-[5px] max-w-[820px] text-[12.5px] leading-normal text-muted-foreground">{subline}</p>
        </header>
        <OperacionalToolbar
          monthKey={monthKey} monthOptions={monthOptions} onMonth={changeMonth}
          canPrev={monthKey > oldestKey} onPrev={() => { if (monthKey > oldestKey) changeMonth(addMonthsToKey(monthKey, -1)); }}
          canNext={monthKey < currentKey} onNext={() => { if (monthKey < currentKey) changeMonth(addMonthsToKey(monthKey, 1)); }}
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={setCompareKey}
          person={person} people={people} onPerson={setPerson}
          note={note}
        />
        {failedNames.length > 0 && (
          <p role="status" className="flex items-center gap-1.5 px-4 md:px-8 pt-3 text-[12px] text-amber-700 dark:text-amber-300">
            <CircleAlert size={13} strokeWidth={2.2} className="flex-none" />
            Não foi possível carregar os dados de {failedNames.join(' e ')}. Recarregue a página para tentar de novo.
          </p>
        )}
        <div className="relative">
          {sources.loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-500/25" aria-hidden="true">
              <span className="block h-full w-2/5 bg-brand-600 motion-safe:animate-pulse" />
            </div>
          )}
          <div className={cn('transition-opacity', sources.loading && 'opacity-35')} aria-busy={sources.loading}>
            {compareOn && highlights.length > 0 && (
              <div className="px-4 md:px-8 pt-[18px]"><DashHighlights items={highlights} /></div>
            )}
            <div className="flex flex-col gap-[22px] px-4 md:px-8 pb-8 pt-5">
              <DashSummaryBand items={summary} />

              <section>
                <SectionTitle title="Rotina" question="o trabalho foi feito?" />
                <div
                  className={cn(
                    'grid grid-cols-1 gap-3.5',
                    prospOff ? 'md:grid-cols-[minmax(0,505px)_minmax(0,1fr)]' : 'md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]'
                  )}
                >
                  {!prospOff && (cur.prosp
                    ? <ProspectionByDay days={cur.prosp.days} values={cur.prosp.perDay} dailyTarget={cur.prosp.dailyTarget} />
                    : <ProspectionPending />)}
                  <MetaDaysCalendar cells={cur.calendar} teamSize={users.length} person={Boolean(userId)} />
                  <TasksCard
                    tasks={cur.tasks}
                    compareTasks={cmp?.tasks}
                    compareName={compareOn ? cmpName : null}
                    className={running && !userId && !prospOff ? 'md:col-span-2' : undefined}
                  />
                  {running && personUser && (
                    <LateCard late={cur.late} user={personUser} className={prospOff ? 'md:col-span-full' : undefined} />
                  )}
                  {!running && (
                    <ClosedMonthCard
                      title="Atrasados agora só existe no mês em andamento"
                      text="É um retrato do momento, não um número do mês fechado."
                    />
                  )}
                </div>
              </section>

              <section>
                <SectionTitle title="Base de clientes" question="a carteira cresceu ou encolheu?" />
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                  <BaseBridge startCount={movement.startCount} endCount={movement.endCount} steps={movement.steps} />
                  <div className="flex flex-col gap-3.5">
                    <BreakdownCard
                      icon={TrendingDown}
                      title="Cancelamentos por motivo"
                      sub={plural(cancels.total, 'cancelamento', 'cancelamentos')}
                      eyebrow="Motivo mais comum"
                      items={cancels.items}
                      total={cancels.total}
                      emptyText="Nenhum cancelamento neste mês."
                    />
                    <UpgradesLocksCard
                      upgrades={cur.upgrades}
                      delta={compareOn ? deltaOf(cur.upgrades, cmp?.upgrades, { kind: 'count' }) : null}
                      movement={movement}
                    />
                  </div>
                </div>
              </section>

              <section>
                <SectionTitle title="Renovação" question="estamos segurando quem vence?" />
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                  <RenewalOutcomeBar counts={cur.renewal.counts} when={cur.renewal.when} running={running} summary={renewSummary} />
                  <MilestoneBars items={milestoneItems} />
                  <BreakdownCard
                    icon={UserX}
                    title="Motivos de quem não vai renovar"
                    sub={plural(wont.total, 'cliente', 'clientes')}
                    eyebrow="Motivo mais comum"
                    items={wont.items}
                    total={wont.total}
                    emptyText="Ninguém declarou que não vai renovar neste mês."
                  />
                  {running ? (
                    <UpcomingCard upcoming={cur.upcoming} />
                  ) : (
                    <ClosedMonthCard
                      title="A vencer só existe no mês em andamento"
                      text="Em mês fechado todos os contratos do período já tiveram desfecho."
                    />
                  )}
                </div>
              </section>

              {team && (
                <section>
                  <SectionTitle title="Equipe no mês" question="clique numa linha para filtrar a tela por essa pessoa" />
                  <TeamMonthTable rows={team.rows} others={team.others} total={cur} running={running} onPick={setPerson} />
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { DashboardOperacionalView };
