function StatPill({ label, value, accent = 'slate' }) {
  const tones = {
    brand:   'bg-brand-50 text-brand-700 border-brand-200/60 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/20',
    amber:   'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    rose:    'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    slate:   'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/[0.04] dark:text-slate-200 dark:border-white/[0.08]'
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 h-9 rounded-lg border ${tones[accent] || tones.slate}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70 whitespace-nowrap">{label}</span>
      <span className="num text-[14px] font-bold">{value}</span>
    </div>
  );
}
export { StatPill };
