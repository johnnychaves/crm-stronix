// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado", e o
// handoff de docs/superpowers/specs/handoff-relatorios/): os grupos e os
// submenus, na ordem da tela. Cada item mostra o nome e o número principal do
// relatório, que a tela calcula (railNumberOf). Puro (sem React): o id de cada
// item é a chave dele em RELATORIOS_SUBS (src/lib/routes.js), e o
// relatoriosRail.test.js cobra isso. Quando vierem os relatórios de clientes e
// de vendas, eles entram aqui como grupos novos.

import { SCREENS } from './routes.js';

export const RELATORIOS_RAIL_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Leads',
    items: Object.freeze([
      Object.freeze({ id: 'entrada', label: 'Entrada de leads' }),
      Object.freeze({ id: 'conversao', label: 'Conversão' }),
      Object.freeze({ id: 'visitas-e-aulas', label: 'Visitas e aulas' }),
      Object.freeze({ id: 'perdas', label: 'Perdas' }),
      Object.freeze({ id: 'parados', label: 'Leads parados' }),
    ]),
  }),
]);

export const RELATORIOS_RAIL_IDS = Object.freeze(
  RELATORIOS_RAIL_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
);

// O submenu de quem abre /relatorios sem submenu sai da tabela de endereços,
// para não existirem duas verdades.
export const RELATORIOS_DEFAULT_SECTION = SCREENS.relatorios.subPadrao;

// Submenu que a tela desenha: o do endereço, ou o padrão.
export const relatoriosSection = (sub) => (RELATORIOS_RAIL_IDS.includes(sub) ? sub : RELATORIOS_DEFAULT_SECTION);

// O número principal de cada relatório, lido do resultado da mesma conta que a
// tela do submenu usa: nenhum total é guardado à parte. Sem resultado (os meses
// ainda não chegaram, ou não são os desta tela), null, e o item fica sem
// número. Taxa sem base (ninguém no denominador) vira { none: true }.
const PICK = Object.freeze({
  entrada: (r) => ({ count: r.total }),
  conversao: (r) => ({ rate: r.conversion?.value ?? null }),
  'visitas-e-aulas': (r) => ({ rate: r.attendance?.value ?? null }),
  perdas: (r) => ({ count: r.total }),
  parados: (r) => ({ count: r.total }),
});
export function railNumberOf(id, report) {
  if (!report || !PICK[id]) return null;
  const { count, rate } = PICK[id](report);
  if (count !== undefined) return Number.isFinite(count) ? { text: count.toLocaleString('pt-BR') } : null;
  return rate == null ? { none: true } : { text: `${rate}%` };
}
