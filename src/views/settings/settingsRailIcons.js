import {
  ArrowRightLeft, ArrowUpRight, Building2, CalendarClock, CreditCard, FileSpreadsheet, Gauge,
  Handshake, Kanban, Library, ListChecks, PlugZap, Target, Users, Wrench,
} from 'lucide-react';

// O ícone de cada destino do trilho das Configurações, pelo id do item, e o de
// cada grupo, pelo id do grupo. A ordem, os rótulos e os ids moram em
// src/lib/settingsRail.js (puro, com teste de contrato); aqui fica só o
// desenho, em JS sem JSX para o teste importar o mapa em vez de ler o texto da
// view. Destino ou grupo novo entra nos dois lugares.
export const SETTINGS_ITEM_ICONS = Object.freeze({
  overview: Gauge,
  profile: Building2,
  billing: CreditCard,
  team: Users,
  pace: Target,
  sched: CalendarClock,
  rotinas: ListChecks,
  funnels: Kanban,
  catalogs: Library,
  zap: PlugZap,
  transfer: ArrowRightLeft,
  'referral-owners': Handshake,
  import: FileSpreadsheet,
});

export const SETTINGS_GROUP_ICONS = Object.freeze({
  overview: Gauge,
  academia: Building2,
  equipe: Users,
  dia: Target,
  funil: Kanban,
  conexoes: PlugZap,
  base: Wrench,
});

// A marca de "este item abre outra tela" (Rotinas).
export const EXTERNAL_ICON = ArrowUpRight;
