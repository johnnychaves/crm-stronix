function SettingsCard({ title, hint, icon, action, children, padded = true, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] shadow-card ${className}`}>
      {(title || action) && (
        <header className="px-6 py-5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="w-9 h-9 rounded-lg grid place-items-center bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 shrink-0">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold whitespace-nowrap">{title}</h3>
              {hint && <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{hint}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-6' : ''}>{children}</div>
    </section>
  );
}

function SettingsTabItem({ icon, label, hint, badge, attention, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-3 rounded-xl flex items-start gap-3 text-left transition group ${
        active
          ? 'bg-brand-50 dark:bg-brand-500/10 ring-1 ring-brand-200 dark:ring-brand-500/20'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]'
      }`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-semibold whitespace-nowrap ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-white'}`}>{label}</span>
          {badge != null && (
            <span className={`text-[10.5px] font-bold num px-1.5 h-[18px] rounded-md min-w-[18px] grid place-items-center ${
              active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300'
            }`}>{badge}</span>
          )}
          {/* Ponto de atenção: algo nesta seção pede ação do gestor (tooltip explica) */}
          {attention && (
            <span title={attention} aria-label={attention} className="ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          )}
        </div>
        {hint && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{hint}</div>}
      </div>
    </button>
  );
}

function SettingsRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
export { SettingsCard, SettingsTabItem, SettingsRow };
