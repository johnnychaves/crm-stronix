import { CalendarCheck, CirclePause, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';

// O ícone de cada relatório, pelo id do submenu (src/lib/relatoriosRail.js).
// A lista ao lado e a apresentação do balão "Novo" usam os mesmos.
export const RELATORIOS_ICONS = Object.freeze({
  entrada: UserPlus,
  conversao: TrendingUp,
  'visitas-e-aulas': CalendarCheck,
  perdas: TrendingDown,
  parados: CirclePause,
});

// A cor do que cada relatório mede, no fundo do ícone (desenho C do mockup
// 2026-10-15-relatorios-menu-lateral.html): o par 700 no claro e 300 no
// escuro, como o GREEN_TEXT.
const GREEN = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
export const RELATORIOS_TONES = Object.freeze({
  entrada: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  conversao: GREEN,
  'visitas-e-aulas': GREEN,
  perdas: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  parados: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
});
