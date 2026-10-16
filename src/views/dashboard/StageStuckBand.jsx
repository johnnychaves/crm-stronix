// "Onde os leads travam" (mockup A do CRM): para cada etapa do funil escolhido,
// dos leads que entraram nela neste mês, quantos avançaram, quantos se
// perderam e quantos ainda estão parados. O gargalo, a etapa em que menos
// leads avançam, fica destacado e escrito numa frase no topo.
//
// Só existe com um funil escolhido (etapa de funis diferentes não soma) e a
// partir de setembro de 2026, quando a troca de etapa passou a ser gravada. Nos
// outros casos o cartão tracejado explica. A tabela é larga: ela só aparece a
// partir de 1024 px, e abaixo disso cada etapa vira um bloco empilhado.
//
// Props:
//   passage    { rows: [{ name, entered, advanced, lost, medianMin }], worst }
//   nowRows    [{ name, count }] — a carteira de agora por etapa, ou null
//   needFunnel, hasBase, funnelName, monthName, since, academyMedian
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { fmtDuration, plural } from '../../lib/crm/format.js';
import { stageBottleneck, stuckOf } from '../../lib/crm/bottleneck.js';
import { Band } from './Band.jsx';
import { ChartMark } from './ChartMark.jsx';
import { DashedNote } from './CrmParts.jsx';

export const STUCK_HELP = 'Para cada etapa, os leads que entraram nela neste mês: os que avançaram para a próxima, os que foram perdidos e os que ainda estão lá, parados. O gargalo é a etapa em que menos leads avançam. "Agora" é quantos leads estão nela neste momento, de qualquer mês.';

const HEAD = 'text-[12px] text-muted-foreground';
const GRID = 'grid grid-cols-[minmax(110px,128px)_minmax(120px,1fr)_70px_64px_64px_78px_60px] items-center gap-3';
const STUCK_FILL = 'bg-[repeating-linear-gradient(135deg,#FBBF24_0_5px,#FDE68A_5px_10px)] dark:bg-[repeating-linear-gradient(135deg,#B45309_0_5px,#78350F_5px_10px)]';
// O que o gargalo diz depois do nome da etapa, numa string só.
function bottleneckSentence(bn, nowIn) {
  const parts = [`Só ${bn.advancePct}% dos leads avançam daqui, ${plural(bn.lost, 'foi perdido', 'foram perdidos')} e ${plural(bn.stuck, 'segue parado', 'seguem parados')}.`];
  if (bn.medianMin != null && nowIn != null) parts.push(`Os leads ficam em média ${fmtDuration(bn.medianMin)} nessa etapa e hoje há ${fmtNum(nowIn)} deles lá dentro.`);
  else if (bn.medianMin != null) parts.push(`Os leads ficam em média ${fmtDuration(bn.medianMin)} nessa etapa.`);
  else if (nowIn != null) parts.push(`Hoje há ${fmtNum(nowIn)} deles lá dentro.`);
  return parts.join(' ');
}

const pctOf = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

function Cell({ big, small, tone }) {
  return (
    <span className="text-right">
      <b className={cn('num block font-display text-[16px] font-bold leading-tight', tone)}>{big}</b>
      <small className="block text-[11.5px] text-muted-foreground">{small}</small>
    </span>
  );
}

function StageRow({ r, maxEntered, isBottleneck, now }) {
  const stuck = stuckOf(r);
  const advPct = pctOf(r.advanced, r.entered);
  const tip = `${r.name}: ${plural(r.entered, 'entrou', 'entraram')}, ${plural(r.advanced, 'avançou', 'avançaram')}, ${plural(r.lost, 'se perdeu', 'se perderam')}, ${plural(stuck, 'segue parado', 'seguem parados')} na etapa.`;
  const seg = (
    <ChartMark
      tip={tip}
      className="flex h-[22px] min-w-3 overflow-hidden rounded-[7px] bg-muted"
      style={{ width: `${Math.max(Math.round((r.entered / maxEntered) * 100), 6)}%` }}
    >
      <i className="block h-full bg-success dark:bg-[#0E9F6E]" style={{ width: `${pctOf(r.advanced, r.entered)}%` }} />
      <i className="block h-full border-l-2 border-card bg-danger dark:bg-[#E11D48]" style={{ width: `${pctOf(r.lost, r.entered)}%` }} />
      <i className={cn('block h-full border-l-2 border-card', STUCK_FILL)} style={{ width: `${pctOf(stuck, r.entered)}%` }} />
    </ChartMark>
  );
  const badge = isBottleneck && (
    <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10.5px] font-bold text-white">gargalo</span>
  );
  return (
    <>
      <div className={cn(GRID, 'hidden rounded-xl border-t border-slate-100 px-3 py-3.5 first:border-t-0 lg:grid dark:border-white/[0.06]', isBottleneck && 'my-0.5 border-t-transparent bg-amber-500/10 ring-1 ring-amber-500/40')}>
        <span className="flex flex-wrap items-center gap-2 font-semibold">{r.name}{badge}</span>
        <div className="min-w-0">{seg}</div>
        <Cell big={`${advPct}%`} small={`${fmtNum(r.advanced)} de ${fmtNum(r.entered)}`} tone="text-emerald-700 dark:text-emerald-300" />
        <Cell big={fmtNum(r.lost)} small={r.lost === 1 ? 'perdido' : 'perdidos'} tone="text-rose-700 dark:text-rose-300" />
        <Cell big={fmtNum(stuck)} small={stuck === 1 ? 'parado' : 'parados'} tone="text-amber-700 dark:text-amber-300" />
        <Cell big={fmtDuration(r.medianMin)} small="na etapa" />
        <Cell big={now == null ? '—' : fmtNum(now)} small="agora" />
      </div>
      <div className={cn('border-t border-slate-100 py-3 first:border-t-0 lg:hidden dark:border-white/[0.06]', isBottleneck && 'rounded-xl bg-amber-500/10 px-3')}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2 font-semibold">{r.name}{badge}</div>
        {seg}
        <div className="num mt-1.5 text-[11.5px] text-muted-foreground">
          {`${advPct}% avançaram · ${plural(r.lost, 'perdido', 'perdidos')} · ${plural(stuck, 'parado', 'parados')} · ${fmtDuration(r.medianMin)} na etapa`}
        </div>
      </div>
    </>
  );
}

export function StageStuckBand({ passage, nowRows, needFunnel, hasBase, funnelName, monthName, since = null, academyMedian = false }) {
  const rows = passage?.rows || [];
  const question = needFunnel
    ? 'Escolha um funil para ver em qual etapa os leads travam.'
    : `Funil ${funnelName}. Dos leads que entraram em cada etapa ${since ? `desde ${since}` : `em ${monthName}`}, quantos avançaram, quantos se perderam e quantos ainda estão parados nela.`;
  let empty = null;
  if (needFunnel) {
    empty = (
      <DashedNote
        title="Escolha um funil para ver onde os leads travam"
        text="Cada funil tem as suas etapas, e etapa de funis diferentes não soma. Selecione um funil na barra de cima."
      />
    );
  } else if (!hasBase) {
    empty = (
      <DashedNote
        title="Esta análise começa em setembro de 2026"
        text="A troca de etapa passou a ser gravada em setembro de 2026. Antes disso não existe base para dizer quantos avançaram ou se perderam em cada etapa."
      />
    );
  } else if (!passage || rows.every((r) => r.entered === 0)) {
    empty = <DashedNote title="Nenhuma troca de etapa gravada neste mês." />;
  }

  const bn = empty ? null : stageBottleneck(rows);
  const nowBy = new Map((nowRows || []).map((r) => [r.name, r.count]));
  const maxEntered = Math.max(1, ...rows.map((r) => r.entered));
  const nowIn = bn ? nowBy.get(bn.name) : null;

  return (
    <Band title="Onde os leads travam" help={STUCK_HELP} question={question}>
      {empty ? empty : (
        <>
          {bn ? (
            <div className="mb-[18px] flex items-start gap-3.5 rounded-[14px] border border-amber-500/35 bg-amber-500/10 px-[18px] py-3.5">
              <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-amber-500 font-display text-[16px] font-bold text-white">!</span>
              <p className="m-0 text-pretty">
                <b className="text-amber-700 dark:text-amber-300">{`O gargalo é ${bn.name}.`}</b>
                {` ${bottleneckSentence(bn, nowIn)}`}
              </p>
            </div>
          ) : (
            <p className="mb-[18px] rounded-[14px] bg-muted px-[18px] py-3.5 text-muted-foreground">
              Nenhuma etapa se destaca como gargalo: a amostra é pequena ou todos os leads estão avançando.
            </p>
          )}
          <div className="overflow-x-auto overscroll-x-contain">
            <div className={cn(GRID, 'hidden px-3 pb-2 lg:grid', HEAD)}>
              <span>Etapa</span>
              <span>Para onde foram os leads que entraram</span>
              <span className="text-right">Avançaram</span>
              <span className="text-right">Perderam</span>
              <span className="text-right">Parados</span>
              <span className="text-right">Tempo na etapa</span>
              <span className="text-right">Agora</span>
            </div>
            {rows.map((r) => (
              <StageRow key={r.name} r={r} maxEntered={maxEntered} isBottleneck={bn?.name === r.name} now={nowBy.has(r.name) ? nowBy.get(r.name) : null} />
            ))}
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[12.5px] text-foreground/80">
            <span className="inline-flex items-center gap-1.5"><i className="size-[11px] rounded-[3px] bg-success dark:bg-[#0E9F6E]" />avançaram para a próxima etapa</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-[11px] rounded-[3px] bg-danger dark:bg-[#E11D48]" />foram perdidos</span>
            <span className="inline-flex items-center gap-1.5"><i className={cn('size-[11px] rounded-[3px]', STUCK_FILL)} />entraram e ainda não saíram</span>
            {academyMedian && <span className="text-muted-foreground">O tempo na etapa é a mediana da academia.</span>}
          </div>
        </>
      )}
    </Band>
  );
}
