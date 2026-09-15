// Aulas experimentais por professor (handoff do CRM, linhas 480 a 509), no
// mesmo formato da conversão por pessoa: realizadas, faltas e a matrícula em
// %, com a barra da conversão. Matrícula e conversão em verde, como na tabela
// de pessoas. Da academia inteira, sempre: uma aula é do professor, não do
// consultor. Com pessoa ou funil escolhido, a etiqueta "academia inteira" diz
// isso na cara. Treina sozinho é a linha de referência, fora do ranking, em
// cinza. No celular vira lista.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { dashInitials } from './dashTokens.js';
import { CrmCard, DashedNote, ReadText, ScopeTag } from './CrmParts.jsx';

const RULE = 'border-slate-100 dark:border-white/[0.06]';
const GRID = 'grid grid-cols-[minmax(0,1fr)_68px_40px_112px] items-center gap-2.5';
const HEAD = 'text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground';
const GREEN_TEXT = 'text-emerald-700 dark:text-emerald-300';
const GREEN_FILL = 'bg-success dark:bg-[#0E9F6E]';

const pctText = (v) => (v == null ? '—' : `${v}%`);
const withCounts = (p) => (p.mods || []).map((x) => `${x.name} ${fmtNum(x.count)}`).join(' · ');
// Sob o nome: com uma modalidade só, o nome dela (a contagem já está em
// Realizadas); com várias, a contagem de cada.
function modsText(p) {
  const mods = p.mods || [];
  if (p.solo) return 'sem professor designado';
  if (mods.length === 0) return 'sem aula realizada';
  return mods.length === 1 ? mods[0].name : withCounts(p);
}
const mobileLine = (p) => {
  const mods = withCounts(p);
  return `${plural(p.done, 'realizada', 'realizadas')} · ${plural(p.missed, 'falta', 'faltas')}${mods ? ` · ${mods}` : ''}`;
};
const tipOf = (p) => `${p.name}: ${plural(p.enrolled, 'matrícula', 'matrículas')} em ${plural(p.done, 'aula realizada', 'aulas realizadas')}${p.conv == null ? '' : ` (${p.conv}%)`}`;
const convColor = (p) => (p.solo || p.conv == null ? 'text-muted-foreground' : GREEN_TEXT);

function Avatar({ p }) {
  return (
    <span
      className={cn(
        'num grid size-8 flex-none place-items-center rounded-[9px] font-display text-[12px] font-semibold',
        p.solo ? 'border-[1.5px] border-dashed border-border text-muted-foreground' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
      )}
    >
      {p.solo ? '—' : dashInitials(p.name)}
    </span>
  );
}

function ConvBar({ p }) {
  return (
    <div className="flex items-center gap-[9px]">
      <ChartMark tip={tipOf(p)} className="relative block h-2.5 flex-1 overflow-hidden rounded-[5px] bg-muted">
        <i className={cn('absolute inset-y-0 left-0 rounded-[5px]', p.solo ? 'bg-slate-400' : GREEN_FILL)} style={{ width: `${Math.min(100, p.conv || 0)}%` }} />
      </ChartMark>
      <span className={cn('num w-[38px] text-right text-[13px] font-bold', convColor(p))}>{pctText(p.conv)}</span>
    </div>
  );
}

export function ProfessorCard({ professors, monthName, scoped }) {
  const rows = professors?.rows || [];
  const solo = professors?.solo || null;
  const done = professors?.done || 0;
  const all = solo ? [...rows, solo] : rows;
  const hint = `${plural(done, 'aula realizada', 'aulas realizadas')} em ${monthName}`;
  const smallBase = done > 0 && done < 30
    ? ` Com ${plural(done, 'aula', 'aulas')} no período, a diferença entre dois professores ainda cabe numa matrícula de sorte.`
    : '';
  const foot = `Matrícula: matrículas ÷ aulas realizadas. A matrícula vai para o professor da última aula a que o lead compareceu. Treina sozinho é a linha de referência, fora do ranking: é a aula sem professor designado.${smallBase}`;
  return (
    <CrmCard
      title="Aulas experimentais por professor"
      hint={hint}
      action={scoped ? <ScopeTag tone="amber">academia inteira</ScopeTag> : null}
    >
      <div className="px-[18px] pb-4 pt-2.5">
        {all.length === 0 ? (
          <div className="pt-2.5"><DashedNote title="Nenhuma aula experimental realizada neste mês." /></div>
        ) : (
          <>
            <div className="hidden md:block">
              <div className={cn(GRID, 'h-[26px]', HEAD)}>
                <span>Professor</span>
                <span className="text-right">Realizadas</span>
                <span className="text-right">Faltas</span>
                <span>Matrícula</span>
              </div>
              {all.map((p) => (
                <div key={p.id || 'solo'} className={cn(GRID, 'h-[52px] border-t', RULE)}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar p={p} />
                    <div className="min-w-0">
                      <div className={cn('truncate text-[13px] font-semibold', p.solo && 'text-muted-foreground')}>{p.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{modsText(p)}</div>
                    </div>
                  </div>
                  <span className="num text-right text-[13px]">{fmtNum(p.done)}</span>
                  <span className="num text-right text-[13px] text-muted-foreground">{fmtNum(p.missed)}</span>
                  <ConvBar p={p} />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-[9px] md:hidden">
              {all.map((p) => (
                <div key={p.id || 'solo'} className="flex items-center gap-2.5">
                  <Avatar p={p} />
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-[12.5px] font-semibold', p.solo && 'text-muted-foreground')}>{p.name}</div>
                    <div className="num truncate text-[10.5px] text-muted-foreground">{mobileLine(p)}</div>
                  </div>
                  <span className={cn('num flex-none text-[15px] font-bold', convColor(p))}>{pctText(p.conv)}</span>
                </div>
              ))}
            </div>
            <ReadText>{foot}</ReadText>
          </>
        )}
      </div>
    </CrmCard>
  );
}
