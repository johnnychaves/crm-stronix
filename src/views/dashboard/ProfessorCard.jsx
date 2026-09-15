// Aulas experimentais por professor (handoff do CRM, linhas 480 a 509). Da
// academia inteira, sempre: uma aula é do professor, não do consultor. Com
// pessoa ou funil escolhido, a etiqueta "academia inteira" diz isso na cara.
// Treina sozinho é a linha de referência, fora do ranking. A barra segue o
// desenho dos canais de origem: a parte clara são as aulas realizadas e a
// escura, as que viraram matrícula, na mesma escala (quem deu mais aulas vai
// até o fim). Assim a barra e a conversão contam a mesma história.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { dashInitials } from './dashTokens.js';
import { CrmCard, DashedNote, ReadText, ScopeTag, Swatch } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const VOLUME = 'bg-brand-200 dark:bg-brand-500/40';
const SOLO_VOLUME = 'bg-slate-200 dark:bg-white/15';
const widthOf = (v, max) => `${max > 0 ? Math.round((v / max) * 100) : 0}%`;

function ProfRow({ p, max }) {
  const mods = (p.mods || []).map((x) => `${x.name} ${fmtNum(x.count)}`).join(' · ');
  const sub = `${plural(p.done, 'realizada', 'realizadas')} · ${plural(p.missed, 'falta', 'faltas')}${mods ? ` · ${mods}` : ''}`;
  const tip = `${p.name}: ${plural(p.done, 'aula realizada', 'aulas realizadas')}, ${plural(p.missed, 'falta', 'faltas')}, ${plural(p.enrolled, 'matrícula', 'matrículas')}${p.conv == null ? '' : ` (${p.conv}%)`}`;
  const good = !p.solo && p.conv != null && p.conv >= 50;
  return (
    <div className={cn('flex items-center gap-[11px] border-t py-[11px]', RULE)}>
      <span
        className={cn(
          'num grid size-[34px] flex-none place-items-center rounded-[10px] font-display text-[12px] font-semibold',
          p.solo ? 'border-[1.5px] border-dashed border-border text-muted-foreground' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
        )}
      >
        {p.solo ? '—' : dashInitials(p.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{p.name}</div>
        <div className="num truncate text-[11px] text-muted-foreground">{sub}</div>
        <ChartMark tip={tip} className="relative mt-[5px] block h-[9px] rounded-[5px] bg-muted">
          <i className={cn('absolute inset-y-0 left-0 rounded-[5px]', p.solo ? SOLO_VOLUME : VOLUME)} style={{ width: widthOf(p.done, max) }} />
          <i className={cn('absolute inset-y-0 left-0 rounded-[5px]', p.solo ? 'bg-slate-400' : 'bg-brand-600')} style={{ width: widthOf(p.enrolled, max) }} />
        </ChartMark>
      </div>
      <div className="w-14 flex-none text-right">
        <div className={cn('num font-display text-[19px] font-bold leading-none', p.solo ? 'text-muted-foreground' : good ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
          {p.conv == null ? '—' : `${p.conv}%`}
        </div>
        <div className="num mt-0.5 text-[10.5px] text-muted-foreground">{`${fmtNum(p.enrolled)}/${fmtNum(p.done)}`}</div>
      </div>
    </div>
  );
}

export function ProfessorCard({ professors, monthName, scoped }) {
  const rows = professors?.rows || [];
  const solo = professors?.solo || null;
  const done = professors?.done || 0;
  const all = solo ? [...rows, solo] : rows;
  const max = Math.max(1, ...all.map((p) => p.done));
  const hint = `${plural(done, 'aula realizada', 'aulas realizadas')} em ${monthName}`;
  const smallBase = done > 0 && done < 30
    ? ` Com ${plural(done, 'aula', 'aulas')} no período, a diferença entre dois professores ainda cabe numa matrícula de sorte.`
    : '';
  const foot = `Conversão do professor: matrículas ÷ aulas realizadas. Treina sozinho é a linha de referência, fora do ranking: é a aula sem professor designado.${smallBase}`;
  return (
    <CrmCard
      title="Aulas experimentais por professor"
      hint={hint}
      action={scoped ? <ScopeTag tone="amber">academia inteira</ScopeTag> : null}
    >
      <div className="px-[18px] pb-4 pt-2">
        {all.length === 0 ? (
          <div className="pt-2.5"><DashedNote title="Nenhuma aula experimental realizada neste mês." /></div>
        ) : (
          <>
            {all.map((p) => <ProfRow key={p.id || 'solo'} p={p} max={max} />)}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Swatch className={cn('w-[18px] rounded', VOLUME)}>aulas realizadas</Swatch>
              <Swatch className="w-[18px] rounded bg-brand-600">matricularam</Swatch>
            </div>
            <ReadText>{foot}</ReadText>
          </>
        )}
      </div>
    </CrmCard>
  );
}
