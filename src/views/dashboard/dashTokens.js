// Tokens e helpers puros do dashboard, fora dos arquivos de componente para
// o Fast Refresh funcionar (react-refresh/only-export-components).

// Tons de destaque dos gráficos/badges. `stroke` usa text-* para SVGs com
// stroke="currentColor".
export const DASH_TONES = {
  brand:   { dot: 'bg-brand-600',   strong: 'bg-brand-600',   stroke: 'text-brand-600',   text: 'text-brand-700',   soft: 'bg-brand-50',   darkText: 'dark:text-brand-300',   darkSoft: 'dark:bg-brand-500/10' },
  amber:   { dot: 'bg-amber-500',   strong: 'bg-amber-500',   stroke: 'text-amber-500',   text: 'text-amber-700',   soft: 'bg-amber-50',   darkText: 'dark:text-amber-300',   darkSoft: 'dark:bg-amber-500/10' },
  violet:  { dot: 'bg-violet-500',  strong: 'bg-violet-500',  stroke: 'text-violet-500',  text: 'text-violet-700',  soft: 'bg-violet-50',  darkText: 'dark:text-violet-300',  darkSoft: 'dark:bg-violet-500/10' },
  emerald: { dot: 'bg-emerald-500', strong: 'bg-emerald-500', stroke: 'text-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', darkText: 'dark:text-emerald-300', darkSoft: 'dark:bg-emerald-500/10' },
  rose:    { dot: 'bg-rose-500',    strong: 'bg-rose-500',    stroke: 'text-rose-500',    text: 'text-rose-700',    soft: 'bg-rose-50',    darkText: 'dark:text-rose-300',    darkSoft: 'dark:bg-rose-500/10' },
  teal:    { dot: 'bg-teal-500',    strong: 'bg-teal-500',    stroke: 'text-teal-500',    text: 'text-teal-700',    soft: 'bg-teal-50',    darkText: 'dark:text-teal-300',    darkSoft: 'dark:bg-teal-500/10' },
  slate:   { dot: 'bg-slate-400',   strong: 'bg-slate-400',   stroke: 'text-slate-400',   text: 'text-slate-700',   soft: 'bg-slate-100',  darkText: 'dark:text-slate-300',   darkSoft: 'dark:bg-white/[0.05]' }
};

// Sequência de cores da cápsula segmentada dos cards de quebra (sbrk-):
// laranja → azul → navy → cinza → verde, com equivalentes legíveis no dark.
export const BREAKDOWN_PALETTE = [
  'bg-accent-500',
  'bg-brand-600 dark:bg-brand-500',
  'bg-ink-900 dark:bg-slate-400',
  'bg-slate-400 dark:bg-slate-600',
  'bg-success'
];

// Iniciais para os monogramas quadrados do mockup (te-av / opc-av / cf-mono).
export function dashInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
