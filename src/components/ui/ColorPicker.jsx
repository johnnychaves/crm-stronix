/* eslint-disable react-refresh/only-export-components */
import { Check } from 'lucide-react';

// Tailwind 4 color name → utility classnames for the pipeline/tag badges.
// Maps to the colors used historically by the app (statusGradientMap keys) so
// existing data still renders sensibly under new visual treatment.
function settingsColorTone(color) {
  const palette = {
    blue:    { dot: 'bg-blue-500',    soft: 'bg-blue-50',    text: 'text-blue-700',    darkSoft: 'dark:bg-blue-500/10',    darkText: 'dark:text-blue-300',    strong: 'bg-blue-500',    ring: 'ring-blue-500/50' },
    indigo:  { dot: 'bg-indigo-500',  soft: 'bg-indigo-50',  text: 'text-indigo-700',  darkSoft: 'dark:bg-indigo-500/10',  darkText: 'dark:text-indigo-300',  strong: 'bg-indigo-500',  ring: 'ring-indigo-500/50' },
    violet:  { dot: 'bg-violet-500',  soft: 'bg-violet-50',  text: 'text-violet-700',  darkSoft: 'dark:bg-violet-500/10',  darkText: 'dark:text-violet-300',  strong: 'bg-violet-500',  ring: 'ring-violet-500/50' },
    purple:  { dot: 'bg-purple-500',  soft: 'bg-purple-50',  text: 'text-purple-700',  darkSoft: 'dark:bg-purple-500/10',  darkText: 'dark:text-purple-300',  strong: 'bg-purple-500',  ring: 'ring-purple-500/50' },
    pink:    { dot: 'bg-pink-500',    soft: 'bg-pink-50',    text: 'text-pink-700',    darkSoft: 'dark:bg-pink-500/10',    darkText: 'dark:text-pink-300',    strong: 'bg-pink-500',    ring: 'ring-pink-500/50' },
    rose:    { dot: 'bg-rose-500',    soft: 'bg-rose-50',    text: 'text-rose-700',    darkSoft: 'dark:bg-rose-500/10',    darkText: 'dark:text-rose-300',    strong: 'bg-rose-500',    ring: 'ring-rose-500/50' },
    red:     { dot: 'bg-red-500',     soft: 'bg-red-50',     text: 'text-red-700',     darkSoft: 'dark:bg-red-500/10',     darkText: 'dark:text-red-300',     strong: 'bg-red-500',     ring: 'ring-red-500/50' },
    orange:  { dot: 'bg-orange-500',  soft: 'bg-orange-50',  text: 'text-orange-700',  darkSoft: 'dark:bg-orange-500/10',  darkText: 'dark:text-orange-300',  strong: 'bg-orange-500',  ring: 'ring-orange-500/50' },
    amber:   { dot: 'bg-amber-500',   soft: 'bg-amber-50',   text: 'text-amber-700',   darkSoft: 'dark:bg-amber-500/10',   darkText: 'dark:text-amber-300',   strong: 'bg-amber-500',   ring: 'ring-amber-500/50' },
    yellow:  { dot: 'bg-yellow-500',  soft: 'bg-yellow-50',  text: 'text-yellow-700',  darkSoft: 'dark:bg-yellow-500/10',  darkText: 'dark:text-yellow-300',  strong: 'bg-yellow-500',  ring: 'ring-yellow-500/50' },
    lime:    { dot: 'bg-lime-500',    soft: 'bg-lime-50',    text: 'text-lime-700',    darkSoft: 'dark:bg-lime-500/10',    darkText: 'dark:text-lime-300',    strong: 'bg-lime-500',    ring: 'ring-lime-500/50' },
    green:   { dot: 'bg-green-500',   soft: 'bg-green-50',   text: 'text-green-700',   darkSoft: 'dark:bg-green-500/10',   darkText: 'dark:text-green-300',   strong: 'bg-green-500',   ring: 'ring-green-500/50' },
    emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', darkSoft: 'dark:bg-emerald-500/10', darkText: 'dark:text-emerald-300', strong: 'bg-emerald-500', ring: 'ring-emerald-500/50' },
    teal:    { dot: 'bg-teal-500',    soft: 'bg-teal-50',    text: 'text-teal-700',    darkSoft: 'dark:bg-teal-500/10',    darkText: 'dark:text-teal-300',    strong: 'bg-teal-500',    ring: 'ring-teal-500/50' },
    cyan:    { dot: 'bg-cyan-500',    soft: 'bg-cyan-50',    text: 'text-cyan-700',    darkSoft: 'dark:bg-cyan-500/10',    darkText: 'dark:text-cyan-300',    strong: 'bg-cyan-500',    ring: 'ring-cyan-500/50' },
    sky:     { dot: 'bg-sky-500',     soft: 'bg-sky-50',     text: 'text-sky-700',     darkSoft: 'dark:bg-sky-500/10',     darkText: 'dark:text-sky-300',     strong: 'bg-sky-500',     ring: 'ring-sky-500/50' },
    brand:   { dot: 'bg-brand-600',   soft: 'bg-brand-50',   text: 'text-brand-700',   darkSoft: 'dark:bg-brand-500/10',   darkText: 'dark:text-brand-300',   strong: 'bg-brand-600',   ring: 'ring-brand-500/50' },
    slate:   { dot: 'bg-slate-400',   soft: 'bg-slate-100',  text: 'text-slate-700',   darkSoft: 'dark:bg-white/[0.05]',   darkText: 'dark:text-slate-300',   strong: 'bg-slate-400',   ring: 'ring-slate-400/50' }
  };
  return palette[color] || palette.slate;
}

function ColorBadge({ color, name, size = 'md' }) {
  const t = settingsColorTone(color);
  const sizing = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-md whitespace-nowrap ${sizing} ${t.soft} ${t.text} ${t.darkSoft} ${t.darkText}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`}></span>
      {name}
    </span>
  );
}

// Palette shown in the color pickers for Pipeline (Funil) and Tags (Etiquetas).
// Legacy values like 'green', 'yellow', 'red', 'orange', 'purple', 'gray'
// still render correctly via settingsColorTone(); they just won't be highlighted
// in the picker — editing the item lets the user pick from this canonical set.
const SETTINGS_COLOR_OPTIONS = ['blue', 'amber', 'violet', 'teal', 'rose', 'emerald', 'pink', 'indigo', 'lime', 'slate'];

function ColorDot({ color, active, onClick, size = 22 }) {
  const t = settingsColorTone(color);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`rounded-full grid place-items-center transition ${t.strong} ${active ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-neutral-900 scale-110' : 'ring-1 ring-black/[0.06] hover:scale-105'}`}
      title={color}
    >
      {active && <Check size={12} className="text-white" />}
    </button>
  );
}
export { settingsColorTone, ColorBadge, SETTINGS_COLOR_OPTIONS, ColorDot };
