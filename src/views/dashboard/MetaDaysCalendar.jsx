// Régua de dias de meta: grade de 5 colunas (Seg a Sex). Handoff linhas 229 a
// 257; lógica de exemplo 1514 a 1564. Teto na grade (470px), card livre
// (README §2) — em telas estreitas a grade rola na horizontal.
import { cn } from '../../lib/utils.js';
import { fmtNum } from '../../lib/format.js';
import { ChartMark } from './ChartMark.jsx';

const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];

// Escala de "quantos bateram" — claro #8FB0FF → #1C3FC4, escuro #2B59FF →
// #C9D8FF (README §3).
const SCALE = [
  'bg-[#8FB0FF] dark:bg-[#2B59FF]',
  'bg-[#5A7FFF] dark:bg-[#5A7FFF]',
  'bg-[#2B59FF] dark:bg-[#8FB0FF]',
  'bg-[#1C3FC4] dark:bg-[#C9D8FF]'
];

const scaleIdx = (hits, teamSize) => Math.min(3, Math.max(0, Math.ceil((hits / Math.max(teamSize, 1)) * 4) - 1));

function cellView(c, { teamSize, person }) {
  if (c.state === 'future') {
    return {
      mark: '', bg: '', border: 'border border-dashed border-border',
      dayFg: 'text-muted-foreground', markFg: '',
      tip: `Dia ${c.day}: ainda não aconteceu`
    };
  }
  if (c.state === 'today') {
    return {
      mark: 'hoje', bg: 'bg-brand-50 dark:bg-brand-500/15', border: 'border border-dashed border-brand-600',
      dayFg: 'text-foreground', markFg: 'text-muted-foreground',
      tip: person
        ? `Dia ${c.day}: hoje, ainda em curso`
        : `Dia ${c.day}: ${fmtNum(c.hits)} de ${fmtNum(teamSize)} bateram até agora (hoje)`
    };
  }
  if (person) {
    const ok = Boolean(c.me);
    return {
      mark: ok ? 'bateu' : 'não',
      bg: ok ? 'bg-brand-600' : 'bg-muted', border: '',
      dayFg: ok ? 'text-white' : 'text-foreground',
      markFg: ok ? 'text-white/75' : 'text-muted-foreground',
      tip: `Dia ${c.day}: ${ok ? 'bateu a meta' : 'não bateu'}`
    };
  }
  const filled = c.hits > 0;
  const strong = teamSize > 0 && c.hits / teamSize >= 0.75;
  return {
    mark: fmtNum(c.hits),
    bg: filled ? SCALE[scaleIdx(c.hits, teamSize)] : 'bg-muted', border: '',
    // Nos passos 3 e 4 da escala o fundo do escuro é claro (#8FB0FF/#C9D8FF):
    // texto branco não passa no contraste, precisa do tom escuro do app.
    dayFg: strong ? 'text-white dark:text-ink-900' : 'text-foreground',
    markFg: strong ? 'text-white/80 dark:text-ink-900/80' : 'text-muted-foreground',
    tip: `Dia ${c.day}: ${fmtNum(c.hits)} de ${fmtNum(teamSize)} bateram`
  };
}

export function MetaDaysCalendar({ cells, teamSize, person }) {
  const list = cells || [];
  const lead = list.length ? list[0].weekday - 1 : 0;
  const slots = [...Array(lead).fill(null), ...list];
  while (slots.length % 5 !== 0) slots.push(null);

  const scaleLabel = person ? 'bateu / não bateu' : 'quantos bateram';
  const scaleSwatches = person
    ? [
      { bg: 'bg-muted', label: 'não', tip: 'Não bateu a meta' },
      { bg: 'bg-brand-600', label: 'bateu', tip: 'Bateu a meta' }
    ]
    : [{ bg: 'bg-muted', label: '0', tip: 'Ninguém bateu' }].concat(
      SCALE.map((bg, i) => {
        const label = fmtNum(Math.ceil((teamSize * (i + 1)) / 4));
        return { bg, label, tip: `${label} de ${fmtNum(teamSize)} bateram` };
      })
    );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card px-[18px] pt-4 pb-3.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold">Dias de meta</span>
      </div>

      <div className="mt-3.5 overflow-x-auto snap-x">
        <div className="grid w-[470px] grid-cols-5 gap-1.5">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="text-center text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{w}</span>
          ))}
          {slots.map((c, i) => {
            if (!c) return <span key={`empty-${i}`} aria-hidden="true" className="h-[52px]" />;
            const v = cellView(c, { teamSize, person });
            return (
              <ChartMark
                key={c.key}
                tip={v.tip}
                as="div"
                className={cn('flex h-[52px] snap-start flex-col items-center justify-center gap-[3px] rounded-[10px]', v.bg, v.border)}
              >
                <span className={cn('num text-[13px] font-semibold leading-none', v.dayFg)}>{c.day}</span>
                <span className={cn('num text-[9.5px] font-bold leading-none', v.markFg)}>{v.mark}</span>
              </ChartMark>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex max-w-[470px] items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-white/[0.06]">
        <span className="whitespace-nowrap text-[10.5px] text-muted-foreground">{scaleLabel}</span>
        <div className="flex-1" />
        {scaleSwatches.map((sw) => (
          <ChartMark key={sw.label} tip={sw.tip} as="span" className="flex items-center gap-1">
            <span className={cn('size-[13px] rounded', sw.bg)} />
            <span className="num text-[10px] text-muted-foreground">{sw.label}</span>
          </ChartMark>
        ))}
      </div>
    </div>
  );
}
