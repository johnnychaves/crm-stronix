import { cn } from '../../../lib/utils.js';

// A porcentagem do cadastro num anel. A cor sobe com o preenchimento: âmbar
// abaixo de 60, azul até 99 e verde quando completa. O número fica no centro, e
// o anel inteiro é uma imagem com o texto "Cadastro N% completo".
export function CompletenessRing({ pct }) {
  const r = 29;
  const c = 2 * Math.PI * r;
  const tone = pct >= 100
    ? 'text-emerald-600 dark:text-emerald-400'
    : pct >= 60 ? 'text-brand-600 dark:text-brand-400' : 'text-amber-600 dark:text-amber-400';
  return (
    <div role="img" aria-label={`Cadastro ${pct}% completo`} className={cn('relative size-[72px] flex-none', tone)}>
      <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-white/10" />
        <circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-current transition-[stroke-dashoffset] motion-reduce:transition-none"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={(c * (1 - pct / 100)).toFixed(1)}
        />
      </svg>
      <span aria-hidden="true" className="num absolute inset-0 grid place-items-center font-display text-[17px] font-bold text-foreground">{pct}%</span>
    </div>
  );
}
