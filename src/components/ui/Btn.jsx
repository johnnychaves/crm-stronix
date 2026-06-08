function Btn({ kind = 'secondary', icon, children, onClick, type = 'button', disabled, size = 'sm', className = '' }) {
  const styles = {
    primary:   'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm',
    brand:     'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 dark:bg-white/[0.04] dark:text-slate-200 dark:border-white/10 dark:hover:bg-white/[0.08]',
    success:   'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
    soft:      'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.12]',
    danger:    'bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 dark:bg-white/[0.04] dark:border-white/10 dark:hover:bg-rose-500/10',
    ghost:     'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
  };
  const sizing = size === 'md' ? 'h-9 px-3.5 text-[12.5px]' : 'h-8 px-3 text-[12px]';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 ${sizing} rounded-lg font-semibold whitespace-nowrap transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed ${styles[kind] || styles.secondary} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

function IconBtn({ icon, title, onClick, kind = 'default', className = '' }) {
  const styles = {
    default: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06]',
    edit:    'text-slate-400 hover:text-brand-700 hover:bg-brand-50 dark:hover:text-brand-300 dark:hover:bg-brand-500/10',
    danger:  'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-500/10'
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 grid place-items-center rounded-lg transition ${styles[kind] || styles.default} ${className}`}
    >
      {icon}
    </button>
  );
}
export { Btn, IconBtn };
