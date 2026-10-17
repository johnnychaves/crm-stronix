import { cn } from '../../lib/utils.js';

// Tinta do ícone no cabeçalho dos painéis (redesign das Configurações).
const PANEL_ICON_TONES = {
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
};

// Painel de seção do redesign: mesma casca do SettingsCard, na densidade do
// mockup (raio 16px, ícone 34px, título 14.5px). Convive com o SettingsCard
// legado — as telas que ainda não passaram pelo redesign seguem naquele.
function SettingsPanel({ icon, iconTone = 'neutral', title, hint, action, children, padded = false, className = '', bodyClassName = '' }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card shadow-card overflow-hidden', className)}>
      {(title || action) && (
        <header className="px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <span className={cn('size-[34px] rounded-[10px] grid place-items-center shrink-0', PANEL_ICON_TONES[iconTone] || PANEL_ICON_TONES.neutral)}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[14.5px] font-semibold leading-tight">{title}</h3>
              {hint && <p className="text-[12px] text-muted-foreground leading-snug mt-1">{hint}</p>}
            </div>
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(padded && 'px-5 pb-5', bodyClassName)}>{children}</div>
    </section>
  );
}

// Cabeçalho da seção ativa: um cartão como o dos painéis (Pipeline, Clientes,
// Relatórios), com título, linha de apoio embaixo e um slot à direita para as
// ações da seção ou uma nota discreta.
function SettingsSectionHeader({ title, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-border bg-card px-6 py-[18px] shadow-card">
      {/* O texto encolhe (e a linha de apoio quebra) antes de as ações descerem para outra linha. */}
      <div className="min-w-[240px] flex-1">
        <h2 className="font-display text-2xl font-bold tracking-tight leading-tight">{title}</h2>
        {hint && <p className="text-[13.5px] text-muted-foreground mt-[3px]">{hint}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

function SettingsCard({ title, hint, icon, action, children, padded = true, className = '' }) {
  return (
    <section className={`rounded-2xl border border-border bg-card shadow-card ${className}`}>
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
export {
  SettingsCard, SettingsTabItem, SettingsRow,
  SettingsPanel, SettingsSectionHeader
};
