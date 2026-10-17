// Trilho das Configurações: os destinos da tela, na ordem em que aparecem, e a
// escolha da seção que a tela desenha. Puro de propósito (sem React, sem JSX):
// o id de cada item é também o que vira segmento do endereço, então ele precisa
// existir em SETTINGS_SECTIONS (src/lib/routes.js). Id fora da tabela some do
// endereço calado no hrefFor, o clique leva para a seção padrão e nada reclama.
// Quem cobra esse contrato é o settingsRail.test.js.
//
// O ícone de cada item e de cada grupo mora em
// src/views/settings/settingsRailIcons.js, porque aqui não entra JSX. O que liga
// os dois é o id.

import { SCREENS } from './routes.js';

// Grupos do trilho, na ordem da tela, no desenho do mockup A (17/10/2026). O
// `id` do grupo é a chave do resumo (railSummaries) e do ícone. `soAssumida`
// marca o item que só existe na sessão assumida do super console. `screen`
// marca o item que leva a OUTRA tela do app (Rotinas): ele fica fora de
// SETTINGS_RAIL_IDS, porque o contrato "todo destino é uma seção da tabela de
// endereços" não vale para ele.
export const SETTINGS_RAIL_GROUPS = Object.freeze([
  { id: 'overview', label: null, items: [{ id: 'overview', label: 'Visão geral' }] },
  {
    id: 'academia',
    label: 'Academia',
    items: [
      { id: 'profile', label: 'Perfil da academia' },
      { id: 'billing', label: 'Plano & faturas' },
    ],
  },
  { id: 'equipe', label: 'Equipe', items: [{ id: 'team', label: 'Equipe & acessos' }] },
  {
    id: 'dia',
    label: 'Dia a dia',
    items: [
      { id: 'pace', label: 'Metas & ritmo' },
      { id: 'sched', label: 'Agendamento' },
      { id: 'rotinas', label: 'Rotinas', screen: 'rotinas' },
    ],
  },
  {
    id: 'funil',
    label: 'Funil',
    items: [
      { id: 'funnels', label: 'Funis & etapas' },
      { id: 'catalogs', label: 'Catálogos' },
    ],
  },
  { id: 'conexoes', label: 'Conexões', items: [{ id: 'zap', label: 'Stronizap' }] },
  {
    id: 'base',
    label: 'Manutenção da base',
    items: [
      { id: 'transfer', label: 'Migrar leads' },
      { id: 'referral-owners', label: 'Indicações sem dono' },
      { id: 'import', label: 'Importar clientes', soAssumida: true },
    ],
  },
]);

// Os destinos que são seção desta tela, achatados, para o teste de contrato com
// a tabela de endereços. Item de outra tela (`screen`) fica de fora.
export const SETTINGS_RAIL_IDS = Object.freeze(
  SETTINGS_RAIL_GROUPS.flatMap((g) => g.items.filter((i) => !i.screen).map((i) => i.id)),
);

// A seção de quem abre /configuracoes sem seção. Sai da tabela de endereços
// para não existirem duas verdades: mudar o subPadrao lá muda o destino daqui
// junto.
export const SETTINGS_DEFAULT_SECTION = SCREENS.settings.subPadrao;

// Trilho desta sessão. Importar clientes só existe na sessão assumida do super
// console (spec 2026-09-03), então sem ela o item some do trilho.
export function settingsRailGroups(canImport) {
  if (canImport) return SETTINGS_RAIL_GROUPS;
  return SETTINGS_RAIL_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.soAssumida) }))
    .filter((g) => g.items.length > 0);
}

// Seção que a tela realmente desenha. O endereço pede uma seção, mas Importar
// clientes só existe na sessão assumida: sem ela, /configuracoes/importacao
// deixaria o lado direito em branco. Cai na seção padrão, do mesmo jeito calado
// que uma sub-tela desconhecida cai na tela-mãe. O endereço não é reescrito:
// ele se acerta no primeiro clique do trilho.
export function settingsSection(section, canImport) {
  return section === 'import' && !canImport ? SETTINGS_DEFAULT_SECTION : section;
}
