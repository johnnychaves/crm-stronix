// O trilho das Configurações e a tabela de endereços são dois lugares que
// precisam concordar: o id do item do trilho vira o segmento da seção. Se o id
// não estiver em SETTINGS_SECTIONS, o hrefFor tira a seção do endereço calado,
// o endereço vira /<academia>/configuracoes e a tela abre na seção padrão. O
// clique parece funcionar e leva ao lugar errado, sem erro, sem lint e sem
// teste vermelho. Este arquivo é quem cobra.
//
// A mesma dupla existe na ficha (FICHA_TABS e o `value` de cada aba), e lá o
// contrato é cobrado renderizando a ficha, em profileLinks.test.js.
import { describe, it, expect } from 'vitest';
import { SETTINGS_SECTIONS, SCREENS, hrefFor } from '../routes.js';
import {
  SETTINGS_RAIL_GROUPS, SETTINGS_RAIL_IDS, SETTINGS_DEFAULT_SECTION,
  settingsRailGroups, settingsSection,
} from '../settingsRail.js';
import { SETTINGS_GROUP_ICONS, SETTINGS_ITEM_ICONS, EXTERNAL_ICON } from '../../views/settings/settingsRailIcons.js';

const T = 'stronix-crm-app';
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const idsDo = (canImport) => settingsRailGroups(canImport).flatMap((g) => g.items.map((i) => i.id));
const todosOsItens = SETTINGS_RAIL_GROUPS.flatMap((g) => g.items);

describe('trilho das Configurações', () => {
  it('todo destino do trilho é uma seção da tabela de endereços', () => {
    expect(SETTINGS_RAIL_IDS.length).toBeGreaterThan(0);
    for (const id of SETTINGS_RAIL_IDS) expect(own(SETTINGS_SECTIONS, id), id).toBe(true);
  });

  it('todo destino do trilho monta endereço com a seção dentro', () => {
    for (const id of SETTINGS_RAIL_IDS) {
      expect(hrefFor(T, 'settings', { sub: id }), id).toBe(`/${T}/configuracoes/${SETTINGS_SECTIONS[id]}`);
    }
  });

  it('nenhum destino repetido', () => {
    expect(new Set(SETTINGS_RAIL_IDS).size).toBe(SETTINGS_RAIL_IDS.length);
    expect(new Set(todosOsItens.map((i) => i.id)).size).toBe(todosOsItens.length);
  });

  it('sete blocos, na ordem do mockup A, com id próprio', () => {
    expect(SETTINGS_RAIL_GROUPS.map((g) => g.id)).toEqual(['overview', 'academia', 'equipe', 'dia', 'funil', 'conexoes', 'base']);
    expect(SETTINGS_RAIL_GROUPS.map((g) => g.label)).toEqual([null, 'Academia', 'Equipe', 'Dia a dia', 'Funil', 'Conexões', 'Manutenção da base']);
    expect(new Set(SETTINGS_RAIL_GROUPS.map((g) => g.id)).size).toBe(7);
  });

  it('Perfil da academia e Plano & faturas são seções, com endereço próprio', () => {
    expect(SETTINGS_RAIL_IDS).toContain('profile');
    expect(SETTINGS_RAIL_IDS).toContain('billing');
    expect(hrefFor(T, 'settings', { sub: 'profile' })).toBe(`/${T}/configuracoes/perfil-da-academia`);
    expect(hrefFor(T, 'settings', { sub: 'billing' })).toBe(`/${T}/configuracoes/plano-e-faturas`);
  });

  // Rotinas é uma tela do menu, não uma seção: sem esta saída o contrato acima
  // (todo destino é uma seção) reprovaria o item.
  it('Rotinas leva à outra tela e fica fora do contrato de seção', () => {
    const rotinas = todosOsItens.find((i) => i.id === 'rotinas');
    expect(rotinas.screen).toBe('rotinas');
    expect(SCREENS[rotinas.screen]).toBeTruthy();
    expect(SETTINGS_RAIL_IDS).not.toContain('rotinas');
    expect(own(SETTINGS_SECTIONS, 'rotinas')).toBe(false);
    expect(hrefFor(T, rotinas.screen)).toBe(`/${T}/rotinas`);
  });

  it('a seção padrão sai da tabela de endereços e está no trilho', () => {
    expect(SETTINGS_DEFAULT_SECTION).toBe(SCREENS.settings.subPadrao);
    expect(SETTINGS_RAIL_IDS).toContain(SETTINGS_DEFAULT_SECTION);
  });

  it('Importar clientes só aparece na sessão assumida', () => {
    expect(idsDo(true)).toContain('import');
    expect(idsDo(false)).not.toContain('import');
    expect(settingsRailGroups(true)).toBe(SETTINGS_RAIL_GROUPS);
    // O trilho da sessão comum continua com todos os outros destinos.
    expect(idsDo(false)).toEqual(todosOsItens.map((i) => i.id).filter((id) => id !== 'import'));
    // Importar clientes é o único item que some, e o grupo dele continua com os outros dois.
    expect(settingsRailGroups(false).find((g) => g.id === 'base').items.map((i) => i.id)).toEqual(['transfer', 'referral-owners']);
  });

  it('o item de Migrar leads mantém o rótulo que a recusa de carteira do professor cita', () => {
    expect(todosOsItens.find((i) => i.id === 'transfer').label).toBe('Migrar leads');
  });

  // O ícone de cada destino é a TERCEIRA tabela ligada pelo mesmo id (a segunda
  // é o resumo do grupo). Destino novo sem ícone cai em ICONS[id] === undefined:
  // o trilho quebra ao desenhar o item. Lido do módulo, e não do texto da view.
  it('todo destino e todo grupo do trilho têm ícone, e nenhum ícone sobra', () => {
    const itens = todosOsItens.map((i) => i.id);
    for (const id of itens) expect(SETTINGS_ITEM_ICONS[id], id).toBeTruthy();
    for (const id of Object.keys(SETTINGS_ITEM_ICONS)) expect(itens, id).toContain(id);
    const grupos = SETTINGS_RAIL_GROUPS.map((g) => g.id);
    for (const id of grupos) expect(SETTINGS_GROUP_ICONS[id], id).toBeTruthy();
    for (const id of Object.keys(SETTINGS_GROUP_ICONS)) expect(grupos, id).toContain(id);
    expect(EXTERNAL_ICON).toBeTruthy();
  });

  it('sem a sessão assumida, /configuracoes/importacao desenha a seção padrão', () => {
    expect(settingsSection('import', false)).toBe(SETTINGS_DEFAULT_SECTION);
    expect(settingsSection('import', true)).toBe('import');
    expect(settingsSection('catalogs', false)).toBe('catalogs');
    expect(settingsSection('zap', true)).toBe('zap');
  });
});
