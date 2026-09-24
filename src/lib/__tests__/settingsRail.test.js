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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SETTINGS_SECTIONS, SCREENS, hrefFor } from '../routes.js';
import {
  SETTINGS_RAIL_GROUPS, SETTINGS_RAIL_IDS, SETTINGS_DEFAULT_SECTION,
  settingsRailGroups, settingsSection,
} from '../settingsRail.js';

const T = 'stronix-crm-app';
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const idsDo = (canImport) => settingsRailGroups(canImport).flatMap((g) => g.items.map((i) => i.id));

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
    expect(idsDo(false)).toEqual(SETTINGS_RAIL_IDS.filter((id) => id !== 'import'));
  });

  // O ícone de cada destino é a TERCEIRA tabela ligada pelo mesmo id, e é a
  // única que mora na view (JSX não entra em módulo puro). Destino novo sem
  // ícone cai em RAIL_ICONS[id] === undefined: o trilho desenha o item sem
  // figura, alinhado torto, e nada reclama. Lido do texto do arquivo porque
  // importar a view arrastaria o Firebase e o React para um teste de node.
  it('todo destino do trilho tem ícone na view', () => {
    const view = readFileSync(
      fileURLToPath(new URL('../../views/settings/SettingsView.jsx', import.meta.url)),
      'utf8',
    );
    const bloco = view.match(/const RAIL_ICONS = \{([\s\S]*?)\n\};/)?.[1];
    expect(bloco, 'RAIL_ICONS não achado em SettingsView.jsx').toBeTruthy();
    // Chave com e sem aspas: `overview:` e `'referral-owners':`.
    const comIcone = [...bloco.matchAll(/^\s*'?([\w-]+)'?:/gm)].map((m) => m[1]);
    for (const id of SETTINGS_RAIL_IDS) expect(comIcone, id).toContain(id);
    // E o contrário: ícone de destino que não existe mais é código morto.
    for (const id of comIcone) expect(SETTINGS_RAIL_IDS, id).toContain(id);
  });

  it('sem a sessão assumida, /configuracoes/importacao desenha a seção padrão', () => {
    expect(settingsSection('import', false)).toBe(SETTINGS_DEFAULT_SECTION);
    expect(settingsSection('import', true)).toBe('import');
    expect(settingsSection('catalogs', false)).toBe('catalogs');
    expect(settingsSection('zap', true)).toBe('zap');
  });
});
