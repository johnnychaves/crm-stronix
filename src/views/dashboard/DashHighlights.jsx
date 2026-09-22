// Destaques do mês, só com o comparativo ligado (a tela decide; o componente
// só renderiza o que receber). Abaixo de 768px vira carrossel horizontal com o
// pior primeiro.
//
// Dois formatos de item. O do Operacional, { text, delta, up, bad }: a seta
// segue a direção do número e o texto diz "melhorou" ou "piorou". O do CRM,
// { text, delta, tone: 'good' | 'bad' | 'flat', verdict, rank }: a seta diz
// melhor, pior ou igual, o delta já chega com ▲/▼ e o veredito cita o mês
// comparado (handoff do CRM, linhas 158 a 176 e 1181 a 1196). Com `fit`, a
// grade tem uma coluna por item em vez das três fixas.
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const TONES = {
  good: { card: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'bg-success dark:bg-[#0E9F6E]', text: 'text-emerald-700 dark:text-emerald-300' },
  bad: { card: 'bg-rose-50 dark:bg-rose-500/10', icon: 'bg-danger dark:bg-[#E11D48]', text: 'text-rose-700 dark:text-rose-300' },
  flat: { card: 'bg-card', icon: 'bg-slate-400 dark:bg-slate-500', text: 'text-muted-foreground' }
};

function HighlightCard({ h }) {
  const verdictMode = Boolean(h.tone);
  const tone = TONES[verdictMode ? h.tone : (h.bad ? 'bad' : 'good')] || TONES.flat;
  let Icon = h.up ? ArrowUp : ArrowDown;
  if (verdictMode) Icon = h.tone === 'good' ? ArrowUp : h.tone === 'bad' ? ArrowDown : Minus;
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border border-border px-[15px] py-[13px]', tone.card)}>
      <span className={cn('mt-px grid size-[26px] flex-none place-items-center rounded-lg text-white', tone.icon)}>
        <Icon size={14} strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-pretty text-[12.5px] font-semibold leading-[1.45]">{h.text}</div>
        <div className="mt-[5px] flex items-center gap-[7px]">
          <span className={cn('num text-[11.5px] font-bold', tone.text)}>
            {verdictMode ? h.delta : `${h.up ? '▲' : '▼'} ${h.delta}`}
          </span>
          <span className="size-[3px] flex-none rounded-full bg-muted-foreground" />
          <span className={cn('text-[11.5px]', tone.text)}>
            {verdictMode ? h.verdict : (h.bad ? 'piorou' : 'melhorou')}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashHighlights({ items, fit = false }) {
  const list = items || [];
  if (list.length === 0) return null;
  const mobileOrder = [...list].sort((a, b) => (
    a.rank != null && b.rank != null ? a.rank - b.rank : Number(b.bad) - Number(a.bad)
  ));
  return (
    <>
      <div
        className={cn('hidden gap-3 md:grid', !fit && 'grid-cols-3')}
        style={fit ? { gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` } : undefined}
      >
        {list.map((h, i) => <HighlightCard key={i} h={h} />)}
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain md:hidden">
        {mobileOrder.map((h, i) => (
          <div key={i} className="w-[260px] flex-none snap-start">
            <HighlightCard h={h} />
          </div>
        ))}
      </div>
    </>
  );
}
