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
  // Estado ativo = azul SÓLIDO com texto branco — mesmo idioma do menu lateral
  // principal do app (e fiel ao mockup aprovado da Direção 2).
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-3 rounded-xl flex items-start gap-3 text-left transition group ${
        active
          ? 'bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(43,89,255,.55)]'
          : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 transition ${
        active
          ? 'bg-white/15 text-white'
          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1]'
      }`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-semibold whitespace-nowrap ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{label}</span>
          {/* Contador e ponto de atenção alinhados à direita (como no mockup) */}
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {badge != null && (
              <span className={`text-[10.5px] font-bold num px-1.5 h-[18px] rounded-md min-w-[18px] grid place-items-center ${
                active ? 'bg-white/20 text-white' : 'text-slate-400 dark:text-slate-500'
              }`}>{badge}</span>
            )}
            {/* Ponto de atenção: algo nesta seção pede ação do gestor (tooltip explica) */}
            {attention && (
              <span title={attention} aria-label={attention} className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </span>
        </div>
        {hint && <div className={`text-[11.5px] leading-snug mt-0.5 ${active ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>{hint}</div>}
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
