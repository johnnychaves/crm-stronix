// Passagem entre etapas (handoff do CRM, linhas 324 a 369). Para cada etapa do
// funil escolhido: quantos entraram no mês, quantos avançaram, quantos se
// perderam a partir dela e o tempo mediano na etapa. Só existe com um funil
// escolhido e a partir de setembro de 2026; nos outros casos, o cartão
// tracejado explica. No celular vira lista por etapa, com as três
// porcentagens em linha (README §5).
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { fmtDuration, plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { CrmCard, DashedNote, ScopeTag, Swatch } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[118px_minmax(0,1fr)_42px_42px_68px] items-center gap-2.5';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground';
const LOST = 'bg-danger dark:bg-[#E11D48]';
const STAY = 'bg-slate-400/25';
const pctLabel = (v) => (v == null ? '—' : `${v}%`);

function Row({ r, maxEntered }) {
  // Desde a Decisão 16 do plano, "perderam" conta só as entradas do mês que
  // se perderam a partir da etapa (quem entrou antes não soma aqui), então
  // lost já cabe dentro de entered; os Math.min abaixo são só uma proteção.
  const adv = r.entered ? Math.min(r.advanced, r.entered) : 0;
  const lost = r.entered ? Math.min(r.lost, r.entered - adv) : 0;
  const stay = Math.max(0, r.entered - adv - lost);
  const share = (v) => `${r.entered ? Math.round((v / r.entered) * 100) : 0}%`;
  const advPct = pct(r.advanced, r.entered);
  const lostPct = pct(r.lost, r.entered);
  const staying = Math.max(0, r.entered - r.advanced - r.lost);
  const lostHigh = r.entered > 0 && r.lost / r.entered >= 0.2;
  const tipBase = `${r.name}: ${plural(r.entered, 'entrou', 'entraram')}, ${plural(r.advanced, 'avançou', 'avançaram')}, ${plural(r.lost, 'se perdeu', 'se perderam')}, ${plural(staying, 'segue', 'seguem')} na etapa.`;
  const tip = r.medianMin == null ? tipBase : `${tipBase} Mediana de ${fmtDuration(r.medianMin)} na etapa.`;
  return (
    <>
      <div className={cn(GRID, 'hidden h-10 border-t md:grid', RULE)}>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">{r.name}</div>
          <div className="num text-[10.5px] text-muted-foreground">{plural(r.entered, 'entrou', 'entraram')}</div>
        </div>
        <ChartMark
          tip={tip}
          className="flex h-4 min-w-3 overflow-hidden rounded-[5px] bg-muted"
          style={{ width: `${Math.round((r.entered / maxEntered) * 100)}%` }}
        >
          <i className="block h-full bg-brand-600" style={{ width: share(adv) }} />
          <i className={cn('block h-full', LOST)} style={{ width: share(lost) }} />
          <i className={cn('block h-full', STAY)} style={{ width: share(stay) }} />
        </ChartMark>
        <span className="num text-right text-[12.5px] font-semibold">{pctLabel(advPct)}</span>
        <span className={cn('num text-right text-[12.5px]', lostHigh ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>{pctLabel(lostPct)}</span>
        <span className="num text-right text-[12px] text-muted-foreground">{fmtDuration(r.medianMin)}</span>
      </div>
      <div className={cn('border-t py-2.5 md:hidden', RULE)}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12.5px] font-semibold">{r.name}</span>
          <span className="num flex-none text-[11px] text-muted-foreground">{plural(r.entered, 'entrou', 'entraram')}</span>
        </div>
        <div className="num mt-0.5 text-[11.5px] text-muted-foreground">
          {`avançaram ${pctLabel(advPct)} · perderam ${pctLabel(lostPct)} · mediana ${fmtDuration(r.medianMin)}`}
        </div>
      </div>
    </>
  );
}

export function StagePassageTable({ passage, needFunnel, hasBase, funnelName, monthName, academyMedian = false, since = null }) {
  // since: no primeiro mês da gravação, o dia em que ela começou (a base do mês é parcial).
  const hint = needFunnel ? 'escolha um funil' : `funil ${funnelName} · movimentos gravados ${since ? `desde ${since}` : `em ${monthName}`}`;
  const rows = passage?.rows || [];
  const maxEntered = Math.max(1, ...rows.map((r) => r.entered));
  let empty = null;
  if (needFunnel) {
    empty = (
      <DashedNote
        title="Escolha um funil para ver a passagem entre etapas"
        text="Cada funil tem as suas etapas, e etapa de funis diferentes não soma. Selecione um funil na barra de cima."
      />
    );
  } else if (!hasBase) {
    empty = (
      <DashedNote
        title="A passagem entre etapas começa em setembro de 2026"
        text="A troca de etapa passou a ser gravada em setembro de 2026. Antes disso não existe base para dizer quantos avançaram ou se perderam em cada etapa, e inventar o número seria pior que não mostrar."
      />
    );
  } else if (!passage || rows.every((r) => r.entered === 0)) {
    // Mês real sem nenhuma troca de etapa gravada mostra a nota vazia, não
    // uma tabela de linhas zeradas (que hoje só aparecia quando passage vinha
    // null, por falha).
    empty = <DashedNote title="Nenhuma troca de etapa gravada neste mês." />;
  }
  return (
    <CrmCard title="Passagem entre etapas" hint={hint} action={!empty && academyMedian ? <ScopeTag>mediana da academia</ScopeTag> : null}>
      {empty ? (
        <div className="p-[18px]">{empty}</div>
      ) : (
        <div className="px-[18px] pb-4 pt-2.5">
          <div className={cn(GRID, 'hidden h-[26px] md:grid', HEAD)}>
            <span>Etapa</span>
            <span>Entraram, avançaram, perderam</span>
            <span className="text-right">Avan.</span>
            <span className="text-right">Perda</span>
            <span className="text-right">Mediana</span>
          </div>
          {rows.map((r) => <Row key={r.name} r={r} maxEntered={maxEntered} />)}
          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            {/* A legenda de cor só faz sentido onde a barra existe (md e acima). */}
            <div className="hidden flex-wrap items-center gap-x-3.5 gap-y-1.5 md:flex">
              <Swatch className="bg-brand-600">avançou</Swatch>
              <Swatch className={LOST}>perdeu</Swatch>
              <Swatch className={STAY}>segue na etapa</Swatch>
            </div>
            {passage.worst && (
              <span className="num text-[11px] text-muted-foreground">
                {`Maior vazamento: ${passage.worst.name}, ${fmtNum(passage.worst.lost)} ${passage.worst.lost === 1 ? 'perdido' : 'perdidos'} de ${fmtNum(passage.worst.entered)}.`}
              </span>
            )}
          </div>
        </div>
      )}
    </CrmCard>
  );
}
