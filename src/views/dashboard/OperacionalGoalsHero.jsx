// O topo do Operacional (mockup D, "Duas metas"): a Meta diária e a Meta de
// prospecção lado a lado, com o mesmo peso. Embaixo de cada número, uma linha
// por pessoa nos mesmos dias de meta do mês: na meta, um ponto por dia (bateu
// ou não); na prospecção, uma barrinha com as ações do dia contra o alvo
// diário daquela pessoa. A linha de alguém fica na mesma altura nas duas
// metas, e o nome dela filtra a tela.
//
// Os pontos e as barras levam só o `title` do navegador e ficam fora do
// leitor de tela: o botão do nome diz o resultado da linha por extenso. Pôr
// um foco em cada dia somaria dezenas de paradas no Tab.
//
// Props:
//   meta     { pct, done, total, hidden, delta, person } ou null (carregando)
//   prosp    { on, pct, done, target, delta } ou null
//   rows     goalRows (src/lib/operacional/view.js)
//   axis     goalAxis
//   running  mês em andamento (a prospecção conta "até hoje")
//   cmpName  nome do mês comparado
//   picked   id da pessoa filtrada, ou null
//   onPick   (id) => void
import { Fragment } from 'react';
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { DashHelpTip } from './DashPrimitives.jsx';

export const META_HELP = 'Dias com meta batida ÷ dias de meta do mês. O dia conta como batido quando a pessoa zera as tarefas da Meta Diária. No mês em andamento só entram os dias já fechados; hoje aparece com um anel.';
export const PROSP_HELP = 'Ações de prospecção ÷ alvo do mês (o alvo diário de cada pessoa vezes os dias de meta até hoje). Contam os leads cadastrados e os agendamentos. A prospecção não trava o dia de meta.';

const HIT = 'bg-[#8FB0FF]';
const BAR_HIT = 'bg-[#FF8A5B]';
const BAR_LOW = 'bg-[#8FB0FF]/50';
const BAR_TODAY = 'bg-[#FF8A5B]/40';

function Pill({ delta, cmpName }) {
  if (!delta) return null;
  const tone = delta.none || delta.flat ? 'quiet' : delta.up ? 'good' : 'bad';
  const text = delta.none ? delta.text
    : delta.flat ? `igual a ${cmpName}`
      : `${delta.up ? '▲' : '▼'} ${String(delta.text).replace(/^[+−-]\s?/, '')} sobre ${cmpName}`;
  return (
    <span
      className={cn(
        'num inline-flex h-[26px] w-max items-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-bold',
        tone === 'good' ? 'bg-emerald-400/15 text-emerald-300' : tone === 'bad' ? 'bg-rose-400/15 text-rose-300' : 'bg-white/10 text-white/70'
      )}
    >
      {text}
    </span>
  );
}

function Head({ label, help, value, muted, delta, cmpName, sub }) {
  return (
    <>
      <div className="flex items-center gap-2 text-[15px] text-white/70">
        {label}
        <DashHelpTip text={help} label={`O que é "${label}"?`} />
      </div>
      <div className="mb-6 mt-2.5 flex flex-wrap items-end gap-x-[18px] gap-y-3">
        {/* A altura de linha vem depois do tamanho: o cn tira o leading que vier antes do text-[...]. */}
        <div className={cn('font-display font-bold tracking-[-0.045em]', muted ? 'text-[40px] text-white/60' : 'text-[clamp(52px,6.4vw,84px)]', 'leading-[0.9]')}>{value}</div>
        <div className="flex flex-col gap-2 pb-1.5">
          <Pill delta={delta} cmpName={cmpName} />
          {sub && <span className="num text-[13.5px] text-white/80">{sub}</span>}
        </div>
      </div>
    </>
  );
}

// Grade das linhas: nome, um espaço por dia de meta e o resultado.
const gridOf = (n) => ({ gridTemplateColumns: `var(--goal-name) repeat(${Math.max(n, 1)}, minmax(0, 1fr)) var(--goal-res)` });
const GRID = 'grid items-center gap-x-[2px] gap-y-2 [--goal-name:52px] [--goal-res:38px] [grid-auto-rows:30px] sm:gap-x-1 sm:[--goal-name:64px] sm:[--goal-res:44px]';

function NameButton({ row, said, picked, onPick }) {
  const on = picked === row.id;
  return (
    <button
      type="button"
      onClick={() => onPick?.(row.id)}
      aria-label={`${row.short}. ${said}. ${on ? 'Voltar à equipe toda' : 'Ver a tela só dessa pessoa'}`}
      title={on ? `${row.name}: voltar à equipe toda` : `${row.name}: ver a tela só dela`}
      className={cn(
        'min-w-0 truncate rounded text-left text-[12px] font-semibold outline-none hover:text-white hover:underline hover:underline-offset-[3px] focus-visible:ring-2 focus-visible:ring-white/50 sm:text-[13px]',
        on ? 'text-white underline underline-offset-[3px]' : 'text-white/85'
      )}
    >
      {row.short}
    </button>
  );
}

function Axis({ axis }) {
  return (
    <>
      <span />
      {axis.map((d, i) => {
        // No celular só ficam hoje e o início de cada semana; o início de
        // semana colado em hoje some, senão os dois números se encostam.
        const nextToToday = axis[i - 1]?.state === 'today' || axis[i + 1]?.state === 'today';
        return (
          <span
            key={d.key}
            className={cn(
              'num self-start justify-self-center text-[10.5px]',
              d.state === 'today' ? 'font-bold text-white underline underline-offset-[3px]'
                : d.weekStart ? cn('font-semibold text-white/80', nextToToday && 'max-sm:invisible') : 'text-white/40 max-sm:invisible'
            )}
          >
            {d.day}
          </span>
        );
      })}
      <span />
    </>
  );
}

function MetaDot({ cell, name }) {
  if (cell.state === 'future') return <span aria-hidden="true" className="size-1 justify-self-center rounded-full bg-white/20" />;
  const today = cell.state === 'today';
  const title = today
    ? `${name}, hoje: ${cell.hit ? 'já bateu' : 'ainda não bateu'}`
    : `${name}, dia ${cell.day}: ${cell.hit ? 'bateu' : 'não bateu'}`;
  return (
    <span
      aria-hidden="true"
      title={title}
      className={cn(
        'aspect-square w-full max-w-[15px] justify-self-center rounded-full',
        cell.hit ? HIT : 'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.28)]',
        today && !cell.hit && 'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75)]',
        today && cell.hit && 'shadow-[0_0_0_2px_#0E1A40,0_0_0_3.5px_rgba(255,255,255,0.75)]'
      )}
    />
  );
}

function MetaRows({ rows, axis, picked, onPick }) {
  return (
    <div className={GRID} style={gridOf(axis.length)}>
      {rows.map((r) => {
        const m = r.meta;
        const said = m && m.pct != null ? `${r.name}: bateu a meta em ${fmtNum(m.done)} de ${fmtNum(m.total)} dias, ${m.pct}%` : `${r.name}: meta sem número`;
        return (
          <Fragment key={r.id}>
            <NameButton row={r} said={said} picked={picked} onPick={onPick} />
            {m
              ? m.cells.map((c) => <MetaDot key={c.key} cell={c} name={r.short} />)
              : axis.map((d) => <span key={d.key} aria-hidden="true" className="size-1 justify-self-center rounded-full bg-white/15" />)}
            <span className="num justify-self-end font-display text-[14px] font-bold">{m && m.pct != null ? `${m.pct}%` : '—'}</span>
          </Fragment>
        );
      })}
      <Axis axis={axis} />
    </div>
  );
}

function ProspCell({ cell, target, vMax, name }) {
  if (cell.state === 'future') return <span aria-hidden="true" className="size-1 self-end justify-self-center rounded-full bg-white/20" />;
  const today = cell.state === 'today';
  const v = cell.value || 0;
  const h = Math.max(2, Math.round((Math.min(v, vMax) / vMax) * 30));
  const line = Math.round((target / vMax) * 30);
  return (
    <span aria-hidden="true" title={`${name}, dia ${cell.day}: ${fmtNum(v)} ${v === 1 ? 'ação' : 'ações'}${today ? ' até agora' : ''} (alvo ${fmtNum(target)})`} className="relative flex h-full items-end justify-center">
      <span className="absolute -inset-x-0.5 border-t border-dashed border-white/30" style={{ bottom: line }} />
      <span className={cn('block w-full max-w-[10px] rounded-t-[3px]', today ? BAR_TODAY : v >= target ? BAR_HIT : BAR_LOW)} style={{ height: h }} />
    </span>
  );
}

function ProspRows({ rows, axis, picked, onPick }) {
  // Uma escala só para todas as linhas: a barra de um compara com a do outro.
  const vMax = Math.max(1, ...rows.flatMap((r) => (r.prosp?.on ? [r.prosp.dailyTarget * 1.6, ...r.prosp.cells.map((c) => c.value || 0)] : [])));
  return (
    <div className={GRID} style={gridOf(axis.length)}>
      {rows.map((r) => {
        const p = r.prosp;
        const said = !p ? `${r.name}: prospecção sem número`
          : !p.on ? `${r.name}: prospecção desligada`
            : `${r.name}: ${p.pct ?? 0}% do alvo de prospecção`;
        return (
          <Fragment key={r.id}>
            <NameButton row={r} said={said} picked={picked} onPick={onPick} />
            {p && p.on
              ? p.cells.map((c) => <ProspCell key={c.key} cell={c} target={p.dailyTarget} vMax={vMax} name={r.short} />)
              : <span className="text-[12px] text-white/45" style={{ gridColumn: `span ${axis.length}` }}>{p ? 'desligada: alvo 0 no cadastro' : ''}</span>}
            <span className="num justify-self-end font-display text-[14px] font-bold">{p && p.on && p.pct != null ? `${p.pct}%` : '—'}</span>
          </Fragment>
        );
      })}
      <Axis axis={axis} />
    </div>
  );
}

function Key({ items }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-white/70">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.mark}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function OperacionalGoalsHero({ meta, prosp, rows, axis, running, cmpName, picked, onPick }) {
  const list = rows || [];
  const days = axis || [];
  const metaValue = meta?.pct != null ? `${meta.pct}%` : '—';
  const metaSub = meta?.hidden ? 'indisponível'
    : meta?.pct != null ? `${fmtNum(meta.done)} de ${fmtNum(meta.total)} ${meta.person ? 'dias batidos' : 'dias-pessoa batidos'}` : null;
  const prospOff = Boolean(prosp && !prosp.on);
  const prospValue = prospOff ? 'Desligada' : prosp?.pct != null ? `${prosp.pct}%` : '—';
  const prospSub = prospOff ? 'alvo 0 no cadastro'
    : prosp ? `${fmtNum(prosp.done)} de ${fmtNum(prosp.target)} ações até ${running ? 'hoje' : 'o fim do mês'}` : null;
  const showRows = list.length > 0 && days.length > 0;

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-[22px] bg-ink-900 bg-[radial-gradient(800px_320px_at_20%_-40%,#22357a_0,transparent_60%),radial-gradient(800px_320px_at_95%_-40%,#3a2a5e_0,transparent_55%)] text-white lg:grid-cols-2">
      <div className="min-w-0 px-[22px] pb-6 pt-7 md:px-[34px]">
        <Head label="Meta diária" help={META_HELP} value={metaValue} delta={meta?.delta} cmpName={cmpName} sub={metaSub} />
        {showRows && (
          <>
            <MetaRows rows={list} axis={days} picked={picked} onPick={onPick} />
            <Key items={[
              { label: 'bateu', mark: <i className={cn('block size-2.5 rounded-full', HIT)} /> },
              { label: 'não bateu', mark: <i className="block size-2.5 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.4)]" /> },
              { label: 'hoje', mark: <i className="block size-2.5 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75)]" /> }
            ]} />
          </>
        )}
      </div>
      <div className="min-w-0 border-t border-white/10 px-[22px] pb-6 pt-7 md:px-[34px] lg:border-l lg:border-t-0">
        <Head label="Meta de prospecção" help={PROSP_HELP} value={prospValue} muted={prospOff} delta={prospOff ? null : prosp?.delta} cmpName={cmpName} sub={prospSub} />
        {showRows && !prospOff && (
          <>
            <ProspRows rows={list} axis={days} picked={picked} onPick={onPick} />
            <Key items={[
              { label: 'bateu o alvo do dia', mark: <i className={cn('block size-2.5 rounded-[3px]', BAR_HIT)} /> },
              { label: 'abaixo do alvo', mark: <i className={cn('block size-2.5 rounded-[3px]', BAR_LOW)} /> },
              { label: 'alvo', mark: <i className="block w-3.5 border-t border-dashed border-white/50" /> }
            ]} />
          </>
        )}
      </div>
      <p className="border-t border-white/10 px-[22px] py-3.5 text-pretty text-[13px] text-white/60 md:px-[34px] lg:col-span-2">
        As duas metas medem coisas diferentes. O dia de meta fecha quando a pessoa zera as tarefas da Meta, e a prospecção conta ações novas contra o alvo, sem travar o dia.
        {list.length > 0 && (picked ? ' Clique no nome de novo para voltar à equipe toda.' : ' Clique num nome para ver a tela só daquela pessoa.')}
      </p>
    </section>
  );
}
