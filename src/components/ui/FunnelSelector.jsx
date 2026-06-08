import { Kanban } from 'lucide-react';
import { ALL_FUNNELS_ID } from '../../lib/funnels.js';

function FunnelSelector({ funnels, value, onChange, compact = false, variant = 'standalone', allowAll = false, className = '' }) {
  const list = Array.isArray(funnels) ? funnels : [];
  if (list.length === 0) {
    return (
      <div className={`text-xs font-medium text-gray-400 dark:text-neutral-500 italic px-4 py-3 ${className}`}>
        Sem funis cadastrados
      </div>
    );
  }
  const padY = compact ? 'py-2.5' : 'py-3';
  const padX = compact ? 'pl-10 pr-10' : 'pl-12 pr-11';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const bg = variant === 'soft'
    ? 'bg-paper-50 dark:bg-neutral-950'
    : 'bg-white dark:bg-neutral-900';
  const iconPos = compact ? 'left-3.5' : 'left-4';
  const chevronPos = compact ? 'right-3' : 'right-4';
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`relative group ${className}`}>
      <Kanban className={`absolute ${iconPos} top-1/2 -translate-y-1/2 ${iconSize} text-gray-400 dark:text-neutral-500 group-focus-within:text-brand-600 transition-colors pointer-events-none`} />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${bg} border border-gray-200 dark:border-neutral-800 rounded-2xl ${padX} ${padY} ${textSize} font-semibold text-gray-900 dark:text-white outline-none focus:border-brand-600 transition-all shadow-sm cursor-pointer appearance-none`}
      >
        {allowAll && (
          <option value={ALL_FUNNELS_ID}>★ Todos os funis</option>
        )}
        {list.map((f) => (
          <option key={f.id} value={f.id}>{f.name}{f.isDefault ? ' • Padrão' : ''}</option>
        ))}
      </select>
      <svg className={`absolute ${chevronPos} top-1/2 -translate-y-1/2 ${iconSize} text-gray-400 dark:text-neutral-500 pointer-events-none`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </div>
  );
}
export { FunnelSelector };
