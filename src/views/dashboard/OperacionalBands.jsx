// As faixas do Operacional abaixo do topo (mockup D): tarefas concluídas,
// contatos nos marcos, a base no mês, quem vence no mês e por que saem. Só
// apresentação: cada número chega pronto de metricsOf e de
// src/lib/operacional/view.js.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { TASK_ROWS } from '../../lib/operacional/routine.js';
import { baseBalance, forgottenMilestone, reasonColor, unitColumns, UNITS_MAX } from '../../lib/operacional/view.js';
import { Band } from './Band.jsx';
import { ChartMark } from './ChartMark.jsx';

const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortOf = (key) => SHORT[Number(key.slice(5, 7)) - 1];
const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const KEY = 'mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-foreground/80';
const SWATCH = 'block size-2.5 flex-none rounded-[3px]';
// Hífen opcional nos nomes longos: no celular a coluna é estreita e o nome
// quebra no lugar certo, com o traço. O hyphens-auto depende do dicionário do
// sistema e não quebra em todo navegador.
const BREAK = { contatos: 'Conta\u00ADtos', atrasados: 'Atra\u00ADsados', renovacoes: 'Renova\u00ADções', vencidos: 'Venci\u00ADdos' };

function DeltaChip({ delta, goodUp = true }) {
  if (!delta || delta.none) return null;
  const tone = delta.flat ? 'quiet' : delta.up === goodUp ? 'good' : 'bad';
  return (
    <span
      className={cn(
        'num inline-flex h-[22px] flex-none items-center whitespace-nowrap rounded-[7px] px-2 text-[12px] font-bold',
        tone === 'good' ? 'bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300'
          : tone === 'bad' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-muted text-muted-foreground'
      )}
    >
      {delta.flat ? 'igual' : `${delta.up ? '▲' : '▼'} ${String(delta.text).replace(/^[+−-]\s?/, '')}`}
    </span>
  );
}

// ---------- Tarefas concluídas: colunas lado a lado, mês contra o comparado ----------
export function TasksBand({ tasks, compareTasks, cmpName }) {
  const showCmp = Boolean(cmpName && compareTasks);
  const rows = TASK_ROWS.map((r) => ({ ...r, v: tasks ? tasks[r.id] : null, c: showCmp ? compareTasks[r.id] : null }));
  const total = tasks ? tasks.total : null;
  const max = Math.max(1, ...rows.flatMap((r) => [r.v || 0, r.c || 0]));
  const h = (v) => `${Math.max(2, Math.round((v / max) * 100))}%`;
  return (
    <Band
      title="Tarefas concluídas"
      help="Tarefas da Meta Diária marcadas como feitas no mês, por tipo. Cada tarefa conta uma vez por lead e por dia."
      question={total == null ? 'As tarefas da Meta feitas no mês, por tipo.'
        : `${plural(total, 'tarefa', 'tarefas')} da Meta ${total === 1 ? 'feita' : 'feitas'} no mês, por tipo${showCmp ? `, contra os mesmos dias de ${cmpName}` : ''}.`}
    >
      <div className="flex h-[176px] items-end gap-1 border-b border-border pt-6 sm:gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
            {showCmp && r.c != null && (
              <ChartMark
                tip={`${r.label}, ${cmpName}: ${fmtNum(r.c)}`}
                className="block w-full max-w-[20px] rounded-t-[4px] bg-slate-300 dark:bg-slate-600"
                style={{ height: h(r.c) }}
              />
            )}
            <div className="relative flex h-full w-full max-w-[20px] items-end">
              {r.v != null && (
                <>
                  <span className="num absolute inset-x-[-14px] text-center font-display text-[13px] font-bold" style={{ bottom: `calc(${h(r.v)} + 4px)` }}>{fmtNum(r.v)}</span>
                  <ChartMark tip={`${r.label}: ${fmtNum(r.v)}`} className="block w-full rounded-t-[4px] bg-brand-600" style={{ height: h(r.v) }} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-2">
        {rows.map((r) => {
          const d = r.v != null && r.c != null ? r.v - r.c : null;
          return (
            <div key={r.id} className="min-w-0 flex-1 text-center">
              <div className="text-balance text-[10.5px] leading-tight text-foreground/80 sm:text-[11.5px]">{BREAK[r.id] || r.label}</div>
              {showCmp && (
                <div className={cn('num mt-1 text-[11.5px] font-bold', d == null || d === 0 ? 'text-muted-foreground' : d > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                  {d == null ? '—' : d === 0 ? '=' : `${d > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(d))}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showCmp && (
        <div className={KEY}>
          <span className="inline-flex items-center gap-1.5"><i className={cn(SWATCH, 'bg-brand-600')} />este mês</span>
          <span className="inline-flex items-center gap-1.5"><i className={cn(SWATCH, 'bg-slate-300 dark:bg-slate-600')} />{`${cmpName}, mesmos dias`}</span>
        </div>
      )}
    </Band>
  );
}

// ---------- Anel de progresso ----------
function Ring({ pct, size = 104, stroke = 11, tone }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, pct || 0) / 100);
  const color = tone === 'warn' ? 'stroke-amber-500' : tone === 'none' ? 'stroke-transparent' : 'stroke-brand-600 dark:stroke-brand-400';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="mx-auto block size-[84px] sm:size-[104px]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-white/10" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} className={color}
      />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" className="fill-foreground font-display text-[21px] font-bold">{pct != null ? `${pct}%` : '—'}</text>
    </svg>
  );
}

// ---------- Contatos nos marcos ----------
export function MilestonesBand({ items }) {
  const list = items || [];
  const worst = forgottenMilestone(list);
  return (
    <Band
      title="Contatos nos marcos"
      help="Tarefas de renovação feitas ÷ clientes que chegaram a cada marco. A academia pode mudar os marcos em Configurações."
      question="Dos clientes que chegaram a cada marco, quantos receberam o contato de renovação."
    >
      <div className="grid gap-3 text-center" style={{ gridTemplateColumns: `repeat(${Math.max(list.length, 1)}, minmax(0, 1fr))` }}>
        {list.map((m) => (
          <div
            key={m.days}
            role="img"
            aria-label={m.pct != null ? `Marco de ${m.days} dias: ${m.pct}%, ${fmtNum(m.done)} de ${fmtNum(m.total)} clientes` : `Marco de ${m.days} dias: sem número`}
          >
            <Ring pct={m.pct} tone={m.pct == null ? 'none' : m.pct >= 70 ? 'ok' : 'warn'} />
            <div className="num mt-2 font-semibold">{`${m.days} dias antes`}</div>
            <div className="num text-[12px] text-muted-foreground">{m.total != null ? `${fmtNum(m.done)} de ${plural(m.total, 'cliente', 'clientes')}` : '—'}</div>
          </div>
        ))}
      </div>
      {worst && (
        <p className="mt-5 rounded-xl bg-amber-500/[0.12] px-3.5 py-3 text-[13px] text-foreground/80">
          <b className="text-amber-700 dark:text-amber-300">{`O marco de ${worst.days} dias é o mais esquecido.`}</b>
          {` ${plural(worst.missed, 'cliente chegou', 'clientes chegaram')} nele sem receber o contato de renovação.`}
        </p>
      )}
    </Band>
  );
}

// ---------- A base no mês: evolução de 6 meses e o balanço do mês ----------
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

function TrendChart({ points, running }) {
  const W = 620; const L = 44; const R = 572; const T = 30; const B = 196;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const step = NICE.find((s) => (max - min) / s <= 4) || 10000;
  const lo = Math.floor(min / step) * step - (min % step === 0 ? step : 0);
  const hi = Math.ceil(max / step) * step + (max % step === 0 ? step : 0);
  const y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
  const x = (i) => L + (i * (R - L)) / Math.max(points.length - 1, 1);
  const grid = [];
  for (let g = lo; g <= hi; g += step) grid.push(g);
  const pts = points.map((p, i) => [x(i), y(p.value)]);
  const path = (list) => list.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const solid = running ? pts.slice(0, -1) : pts;
  const last = pts[pts.length - 1];
  const lastP = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${B + 26}`} width="100%" role="img" aria-label={`Clientes ativos: ${points.map((p) => `${shortOf(p.key)} ${fmtNum(p.value)}`).join(', ')}`}>
      <defs>
        <linearGradient id="op-base-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2B59FF" stopOpacity=".16" />
          <stop offset="1" stopColor="#2B59FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} x2={R} y1={y(g)} y2={y(g)} className="stroke-slate-100 dark:stroke-white/[0.07]" />
          <text x={L - 8} y={y(g) + 4} textAnchor="end" className="fill-slate-400 text-[10.5px] dark:fill-slate-500">{fmtNum(g)}</text>
        </g>
      ))}
      <path d={`${path(pts)} L${last[0].toFixed(1)} ${B} L${pts[0][0].toFixed(1)} ${B} Z`} fill="url(#op-base-area)" />
      {solid.length > 1 && <path d={path(solid)} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="stroke-brand-600 dark:stroke-brand-400" />}
      {running && pts.length > 1 && (
        <path d={path(pts.slice(-2))} fill="none" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" className="stroke-brand-600 dark:stroke-brand-400" />
      )}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <g key={p.key}>
            <circle
              cx={pts[i][0]} cy={pts[i][1]} r={isLast ? 6 : 4} strokeWidth="2.5"
              className={isLast ? 'fill-brand-600 stroke-card dark:fill-brand-400' : 'fill-card stroke-brand-600 dark:stroke-brand-400'}
            >
              <title>{`${shortOf(p.key)}: ${fmtNum(p.value)} clientes ativos${isLast && running ? ' hoje' : ' no fim do mês'}`}</title>
            </circle>
            <text
              x={isLast ? pts[i][0] + 10 : pts[i][0]} y={B + 18} textAnchor={isLast ? 'end' : 'middle'}
              className={cn('text-[11.5px]', isLast ? 'fill-foreground font-bold' : 'fill-slate-400 dark:fill-slate-500')}
            >
              {isLast && running ? `${shortOf(p.key)} (hoje)` : shortOf(p.key)}
            </text>
          </g>
        );
      })}
      <text x={pts[0][0] + 6} y={pts[0][1] - 12} className="fill-muted-foreground text-[12px]">{fmtNum(points[0].value)}</text>
      <text x={last[0] - 4} y={last[1] - 14} textAnchor="end" className="fill-foreground font-display text-[17px] font-bold">{fmtNum(lastP.value)}</text>
    </svg>
  );
}

const ENTRY_COLOR = { entraram: 'bg-brand-600', voltaram: 'bg-[#8FB0FF]', importados: 'bg-[#C9D8FF] dark:bg-[#5A7FFF]', destrancaram: 'bg-yellow-500' };
const EXIT_COLOR = { cancelaram: 'bg-rose-500', venceram: 'bg-rose-300 dark:bg-rose-400/70', trancaram: 'bg-yellow-500' };

function FlowBar({ items, colors, max }) {
  return (
    <div className="flex h-[22px] gap-0.5">
      {items.map((it, i) => (
        <ChartMark
          key={it.key}
          tip={`${it.label}: ${fmtNum(it.n)}`}
          className={cn('block h-full', colors[it.key], i === 0 && 'rounded-l-[5px]', i === items.length - 1 && 'rounded-r-[5px]')}
          style={{ width: `${(it.n / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function Balance({ balance, locks, monthName }) {
  const { net, entries, exits, entered, left } = balance;
  if (!entered && !left) {
    return <p className="text-[13.5px] text-muted-foreground">{`Ninguém entrou nem saiu da base em ${monthName}.`}</p>;
  }
  const max = Math.max(entered, left, 1);
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <b className={cn('num font-display text-[46px] font-bold leading-none tracking-[-0.04em]', net > 0 ? 'text-emerald-700 dark:text-emerald-300' : net < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-foreground')}>
          {net > 0 ? `+${fmtNum(net)}` : net < 0 ? `−${fmtNum(-net)}` : '0'}
        </b>
        <span className="text-muted-foreground">{`${net === 1 || net === -1 ? 'cliente' : 'clientes'} no saldo de ${monthName}`}</span>
      </div>
      <div className="mt-[18px] grid grid-cols-[72px_minmax(0,1fr)_34px] items-center gap-x-3 gap-y-3.5">
        <span className="font-semibold text-foreground/80">Entraram</span>
        <FlowBar items={entries} colors={ENTRY_COLOR} max={max} />
        <span className="num text-right font-display text-[17px] font-bold">{fmtNum(entered)}</span>
        <span className="font-semibold text-foreground/80">Saíram</span>
        <FlowBar items={exits} colors={EXIT_COLOR} max={max} />
        <span className="num text-right font-display text-[17px] font-bold">{fmtNum(left)}</span>
      </div>
      <div className="mt-[18px] grid grid-cols-1 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
        {[...entries.map((e) => ({ ...e, color: ENTRY_COLOR[e.key] })), ...exits.map((e) => ({ ...e, color: EXIT_COLOR[e.key] }))].map((e) => (
          <div key={e.key} className="flex items-center gap-2">
            <i className={cn(SWATCH, e.color)} />
            <span className="flex-1 text-foreground/80">{e.label}</span>
            <b className="num">{fmtNum(e.n)}</b>
          </div>
        ))}
      </div>
      {(locks.trancaram > 0 || locks.destrancaram > 0) && (
        <p className="mt-3.5 text-[12.5px] text-muted-foreground">
          {`Trancamentos no mês: ${plural(locks.trancaram, 'contrato trancado', 'contratos trancados')} e ${plural(locks.destrancaram, 'destrancado', 'destrancados')}.`}
        </p>
      )}
    </div>
  );
}

export function BaseBand({ movement, known, series, running, monthName, person }) {
  const points = series || [];
  const balance = baseBalance(movement);
  return (
    <Band
      title="A base no mês"
      help="Clientes ativos são pessoas com contrato vigente; quem está trancado conta à parte. Trancaram e Destrancaram são o saldo de quem trancou e destrancou no mês."
      question={`Quantos clientes ativos a academia tem e como chegou até aqui. Ao lado, quem entrou e quem saiu em ${monthName}.${person ? ' A base é da academia inteira, mesmo com uma pessoa escolhida.' : ''}`}
    >
      {!known ? (
        <p className="text-[13.5px] text-muted-foreground">Ainda não havia contratos no sistema neste mês.</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div>
            {points.length > 1
              ? <TrendChart points={points} running={running} />
              : <p className="text-[13.5px] text-muted-foreground">A evolução aparece quando houver mais de um mês com contratos.</p>}
          </div>
          <Balance balance={balance} locks={{ trancaram: movement?.trancaram || 0, destrancaram: movement?.destrancaram || 0 }} monthName={monthName} />
        </div>
      )}
    </Band>
  );
}

// ---------- Quem vence no mês: um quadrado por contrato ----------
const OUTCOMES = [
  { key: 'renew', label: 'renovaram', one: 'renovou', cls: 'bg-emerald-500' },
  { key: 'wont', label: 'não vão renovar', one: 'não vai renovar', cls: 'bg-amber-500' },
  { key: 'lapsed', label: 'venceram sem renovar', one: 'venceu sem renovar', cls: 'bg-rose-500' },
  { key: 'pending', label: 'ainda vão vencer', one: 'ainda vai vencer', cls: 'bg-slate-200 dark:bg-white/10' }
];
const WHEN = [
  { key: 'antes', label: 'Antes de vencer', cls: 'bg-brand-700 dark:bg-brand-500' },
  { key: 'no', label: 'No dia', cls: 'bg-[#5A7FFF]' },
  { key: 'depois', label: 'Na tolerância', cls: 'bg-brand-200 dark:bg-brand-300' }
];

export function RenewalBand({ renewal, running, monthName, delta, personFirst }) {
  const counts = renewal?.counts || {};
  const kinds = OUTCOMES.filter((o) => running || o.key !== 'pending').map((o) => ({ ...o, n: counts[o.key] || 0 }));
  const total = kinds.reduce((a, o) => a + o.n, 0);
  const when = renewal?.when || {};
  const renewed = counts.renew || 0;
  const whenTotal = WHEN.reduce((a, w) => a + (when[w.key] || 0), 0);
  const whose = personFirst ? ` da carteira de ${personFirst}` : '';
  return (
    <Band
      title={`Quem vence em ${monthName}`}
      help="Contratos com fim no mês e o desfecho de cada um. A taxa de renovação é renovados ÷ contratos que já tiveram desfecho."
      question={total > 0
        ? `${plural(total, 'contrato', 'contratos')}${whose} ${total === 1 ? 'termina' : 'terminam'} no mês. Um quadrado para cada, pintado pelo desfecho${running ? ' até agora' : ''}.`
        : `Nenhum contrato${whose} termina neste mês.`}
      aside={<DeltaChip delta={delta} />}
    >
      {total > 0 && (
        <>
          {total <= UNITS_MAX ? (
            <div
              role="img"
              aria-label={kinds.map((o) => `${fmtNum(o.n)} ${o.n === 1 ? o.one : o.label}`).join(', ')}
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${unitColumns(total)}, minmax(0, 1fr))` }}
            >
              {kinds.flatMap((o) => Array.from({ length: o.n }, (_, i) => (
                <i key={`${o.key}-${i}`} aria-hidden="true" title={o.one} className={cn('block aspect-square rounded-[4px]', o.cls)} />
              )))}
            </div>
          ) : (
            <div className="flex h-6 gap-0.5 overflow-hidden rounded-md">
              {kinds.filter((o) => o.n > 0).map((o) => (
                <ChartMark key={o.key} tip={`${fmtNum(o.n)} ${o.label}`} className={cn('block h-full', o.cls)} style={{ width: `${(o.n / total) * 100}%` }} />
              ))}
            </div>
          )}
          <div className={KEY}>
            {kinds.map((o) => (
              <span key={o.key} className="inline-flex items-center gap-1.5">
                <i className={cn(SWATCH, o.cls)} />
                <b className="num">{fmtNum(o.n)}</b>
                {o.label}
              </span>
            ))}
          </div>
          {renewed > 0 && whenTotal > 0 && (
            <div className="mt-[22px] border-t border-slate-100 pt-4 dark:border-white/[0.06]">
              <div className="font-semibold">{`Quando ${renewed === 1 ? 'o contrato renovou' : `os ${fmtNum(renewed)} renovaram`}`}</div>
              <div className="mt-2.5 flex h-3.5 gap-0.5 overflow-hidden rounded">
                {WHEN.filter((w) => (when[w.key] || 0) > 0).map((w) => (
                  <ChartMark key={w.key} tip={`${w.label}: ${fmtNum(when[w.key])}`} className={cn('block h-full', w.cls)} style={{ width: `${(when[w.key] / whenTotal) * 100}%` }} />
                ))}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                {WHEN.map((w) => (
                  <div key={w.key} className="text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><i className={cn('block size-2 rounded-[3px]', w.cls)} />{w.label}</span>
                    <b className="num block font-display text-[20px] text-foreground">{fmtNum(when[w.key] || 0)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Band>
  );
}

// ---------- Por que saem: duas roscas com a mesma cor por motivo ----------
// Quem saiu sem motivo gravado vira a fatia "Sem motivo", para o anel fechar
// com o número do centro.
function Donut({ items: given, total, word, emptyText }) {
  if (!total) return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  const known = given.reduce((a, it) => a + it.count, 0);
  const items = known < total ? [...given, { name: 'Sem motivo', count: total - known }] : given;
  const size = 132; const stroke = 20; const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const gap = 3;
  // Onde cada fatia começa no anel, somando as anteriores.
  const segs = items.reduce((list, it) => {
    const start = list.length ? list[list.length - 1].start + list[list.length - 1].len : 0;
    return [...list, { it, start, len: (it.count / total) * c }];
  }, []);
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${fmtNum(total)} ${word}: ${items.map((it) => `${it.name} ${fmtNum(it.count)}`).join(', ')}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-white/10" />
        {segs.map(({ it, start, len }) => (
          <circle
            key={it.name}
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={reasonColor(it.name)} strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, len - (items.length > 1 ? gap : 0))} ${c}`} strokeDashoffset={-start}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{`${it.name}: ${fmtNum(it.count)}`}</title>
          </circle>
        ))}
        <text x="50%" y="47%" textAnchor="middle" className="fill-foreground font-display text-[28px] font-bold">{fmtNum(total)}</text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-muted-foreground text-[11.5px]">{word}</text>
      </svg>
      <div className="flex w-full flex-col gap-1.5 text-[12.5px]">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-2">
            <i className={SWATCH} style={{ background: reasonColor(it.name) }} />
            <span className="flex-1 text-foreground/80">{it.name}</span>
            <b className="num">{fmtNum(it.count)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExitReasonsBand({ cancels, wont }) {
  return (
    <Band title="Por que saem" question="Os motivos de quem cancelou no mês e de quem avisou que não vai renovar.">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-3 font-semibold">Cancelaram</div>
          <Donut items={cancels?.items || []} total={cancels?.total || 0} word={cancels?.total === 1 ? 'cancelou' : 'cancelaram'} emptyText="Nenhum cancelamento neste mês." />
        </div>
        <div>
          <div className="mb-3 font-semibold">Não vão renovar</div>
          <Donut items={wont?.items || []} total={wont?.total || 0} word={wont?.total === 1 ? 'avisou' : 'avisaram'} emptyText="Ninguém avisou que não vai renovar neste mês." />
        </div>
      </div>
    </Band>
  );
}
