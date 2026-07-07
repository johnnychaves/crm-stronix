import { ChevronDown } from 'lucide-react';

// Elementos "só expandido" da sidebar: no desktop o trilho recolhido os
// esconde; hover (ou foco de teclado via :has(:focus-visible)) revela.
// No mobile (drawer) ficam sempre visíveis. Compartilhado com o App.jsx
// (wordmark, títulos de seção, rodapé).
const SIDEBAR_EXPANDED_ONLY =
  'transition-opacity duration-200 md:opacity-0 md:group-hover/sidebar:opacity-100 md:group-has-[:focus-visible]/sidebar:opacity-100';

function SidebarItem({ icon, label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full h-11 pl-3.5 pr-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all ${active
        ? 'bg-brand-600 text-white shadow-[0_6px_16px_-6px_rgba(43,89,255,.65)]'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-500" />}
      <span className={active ? 'text-white' : 'text-gray-400 group-hover:text-brand-600 dark:text-neutral-500 dark:group-hover:text-white transition-colors'}>{icon}</span>
      <span className={`flex-1 text-left whitespace-nowrap tracking-tight ${SIDEBAR_EXPANDED_ONLY}`}>{label}</span>
      {badge != null && (
        <span className={`text-[10.5px] font-bold px-1.5 h-[18px] rounded-md min-w-[18px] grid place-items-center tabular-nums shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-accent-500/12 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400'} ${SIDEBAR_EXPANDED_ONLY}`}>{badge}</span>
      )}
      {/* Ponto de notificação do trilho recolhido — o badge acima some junto
          com os rótulos; o ponto faz o caminho inverso no hover. */}
      {badge != null && (
        <span
          aria-hidden="true"
          className="hidden md:block absolute top-2 left-[26px] size-2 rounded-full bg-accent-500 pointer-events-none transition-opacity duration-200 md:group-hover/sidebar:opacity-0 md:group-has-[:focus-visible]/sidebar:opacity-0"
        />
      )}
    </button>
  );
}

// Item-pai recolhível: abre um "slide para baixo" com os sub-itens.
// No trilho recolhido o slide fica fechado mesmo com open=true e
// reabre animado quando a sidebar expande no hover.
function SidebarGroup({ icon, label, active, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`group w-full h-11 pl-3.5 pr-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all ${active
          ? 'bg-brand-50 text-brand-700 dark:bg-white/[0.06] dark:text-brand-300'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
      >
        <span className={active ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400 group-hover:text-brand-600 dark:text-neutral-500 dark:group-hover:text-white transition-colors'}>{icon}</span>
        <span className={`flex-1 text-left whitespace-nowrap tracking-tight ${SIDEBAR_EXPANDED_ONLY}`}>{label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${active ? 'text-brand-500 dark:text-brand-300' : 'text-gray-400 dark:text-neutral-500'} ${SIDEBAR_EXPANDED_ONLY}`} />
      </button>
      <div className={`grid transition-all duration-200 ease-in-out ${open
        ? 'grid-rows-[1fr] opacity-100 mt-1 md:grid-rows-[0fr] md:opacity-0 md:group-hover/sidebar:grid-rows-[1fr] md:group-hover/sidebar:opacity-100 md:group-has-[:focus-visible]/sidebar:grid-rows-[1fr] md:group-has-[:focus-visible]/sidebar:opacity-100'
        : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="ml-[26px] pl-3 border-l border-slate-200 dark:border-white/[0.08] space-y-0.5 py-0.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarSubItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2.5 pl-3 pr-2.5 h-9 rounded-lg text-[13px] font-medium transition-all ${active ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : 'bg-gray-300 group-hover:bg-brand-500 dark:bg-neutral-600'}`} />
      <span className="tracking-tight truncate">{label}</span>
    </button>
  );
}
export { SidebarItem, SidebarGroup, SidebarSubItem, SIDEBAR_EXPANDED_ONLY };
