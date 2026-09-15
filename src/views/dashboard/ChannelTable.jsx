// Canais de origem (handoff do CRM, linhas 229 a 258; celular, 681 a 697). A
// barra inteira é o volume de leads e o trecho escuro é quem matriculou; a
// conversão fica verde quando passa a da safra toda. No celular, rótulo em
// cima e barra embaixo.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { pct } from '../../lib/crm/stats.js';
import { ChartMark } from './ChartMark.jsx';
import { CrmCard, DashedNote, ReadText, Swatch } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[104px_minmax(0,1fr)_42px_42px_56px] items-center gap-3';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground';
const VOLUME = 'bg-brand-200 dark:bg-brand-500/40';
const widthOf = (v, max) => `${max > 0 ? Math.round((v / max) * 100) : 0}%`;

function Bar({ row, max, tip, className, radius }) {
  return (
    <ChartMark tip={tip} className={cn('relative block bg-muted', radius, className)}>
      <i className={cn('absolute inset-y-0 left-0', radius, VOLUME)} style={{ width: widthOf(row.leads, max) }} />
      <i className={cn('absolute inset-y-0 left-0 bg-brand-600', radius)} style={{ width: widthOf(row.enrolled, max) }} />
    </ChartMark>
  );
}

export function ChannelTable({ rows, cohortConv, read }) {
  const list = (rows || []).map((r) => ({ ...r, conv: pct(r.enrolled, r.leads) }));
  const max = Math.max(1, ...list.map((r) => r.leads));
  const convLabel = (r) => (r.conv == null ? '—' : `${r.conv}%`);
  const tipOf = (r) => `${r.name}: ${fmtNum(r.leads)} ${r.leads === 1 ? 'lead novo' : 'leads novos'}, ${fmtNum(r.enrolled)} ${r.enrolled === 1 ? 'matriculou' : 'matricularam'}${r.conv == null ? '' : ` (${r.conv}%)`}`;
  const above = (r) => r.conv != null && cohortConv != null && r.conv > cohortConv;
  const legend = (
    <div className="hidden flex-none items-center gap-3 sm:flex">
      <Swatch className={cn('w-[18px] rounded', VOLUME)}>leads</Swatch>
      <Swatch className="w-[18px] rounded bg-brand-600">matricularam</Swatch>
    </div>
  );
  return (
    <CrmCard title="Canais de origem" hint="pela origem do cadastro, ordenado por volume" action={legend}>
      {list.length === 0 ? (
        <div className="p-[18px]"><DashedNote title="Nenhum lead cadastrado neste mês." /></div>
      ) : (
        <div className="px-[18px] pb-4 pt-2">
          <div className={cn(GRID, 'hidden h-[26px] md:grid', HEAD)}>
            <span>Canal</span>
            <span />
            <span className="text-right">Leads</span>
            <span className="text-right">Matr.</span>
            <span className="text-right">Conversão</span>
          </div>
          {list.map((r) => (
            <div key={r.name} className={cn(GRID, 'hidden h-9 border-t md:grid', RULE)}>
              <span className="truncate text-[12.5px] font-medium">{r.name}</span>
              <Bar row={r} max={max} tip={tipOf(r)} className="h-3.5" radius="rounded-[7px]" />
              <span className="num text-right text-[12.5px] font-semibold">{fmtNum(r.leads)}</span>
              <span className="num text-right text-[12.5px] text-muted-foreground">{fmtNum(r.enrolled)}</span>
              <span className={cn('num text-right text-[12.5px] font-bold', above(r) && 'text-emerald-700 dark:text-emerald-300')}>{convLabel(r)}</span>
            </div>
          ))}
          <div className="flex flex-col gap-[9px] md:hidden">
            {list.map((r) => (
              <div key={r.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-medium">{r.name}</span>
                  <span className="num flex-none text-[11.5px] text-muted-foreground">{`${fmtNum(r.leads)} ${r.leads === 1 ? 'lead' : 'leads'} · ${convLabel(r)}`}</span>
                </div>
                <Bar row={r} max={max} tip={tipOf(r)} className="mt-1 h-3" radius="rounded-md" />
              </div>
            ))}
          </div>
          <ReadText>{read}</ReadText>
        </div>
      )}
    </CrmCard>
  );
}
