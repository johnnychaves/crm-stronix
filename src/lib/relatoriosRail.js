// Lista ao lado dos Relatórios (spec 2026-10-09, "A lista ao lado"): os grupos
// e os submenus, na ordem da tela, com a pergunta de cada um embaixo do nome,
// para o gestor achar o relatório sem abrir um por um. Puro (sem React): o id
// de cada item é a chave dele em RELATORIOS_SUBS (src/lib/routes.js), e o
// relatoriosRail.test.js cobra isso. Quando vierem os relatórios de clientes e
// de vendas, eles entram aqui como grupos novos.

import { SCREENS } from './routes.js';

export const RELATORIOS_RAIL_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Leads',
    items: Object.freeze([
      Object.freeze({ id: 'entrada', label: 'Entrada de leads', hint: 'Quantos chegaram e de onde' }),
      Object.freeze({ id: 'conversao', label: 'Conversão', hint: 'Quantos viraram matrícula' }),
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
