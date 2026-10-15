// Lista ao lado dos Relatórios: o contrato com a tabela de endereços, como o
// settingsRail.test.js faz com as Configurações, e o número de cada item.
import { describe, it, expect } from 'vitest';
import {
  RELATORIOS_RAIL_GROUPS, RELATORIOS_RAIL_IDS, RELATORIOS_DEFAULT_SECTION, relatoriosSection, railNumberOf,
} from '../relatoriosRail.js';
import { RELATORIOS_SUBS } from '../routes.js';

describe('lista ao lado dos Relatórios', () => {
  it('cada item é um submenu do endereço, e todo submenu do endereço está na lista', () => {
    expect([...RELATORIOS_RAIL_IDS].sort()).toEqual(Object.keys(RELATORIOS_SUBS).sort());
  });

  it('um grupo, Leads, com os cinco submenus na ordem da spec e os nomes do handoff', () => {
    expect(RELATORIOS_RAIL_GROUPS.map((g) => g.label)).toEqual(['Leads']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.label)).toEqual([
      'Entrada de leads', 'Conversão', 'Visitas e aulas', 'Perdas', 'Leads parados',
    ]);
  });

  it('o padrão é a Entrada, e submenu desconhecido cai nele', () => {
    expect(RELATORIOS_DEFAULT_SECTION).toBe('entrada');
    expect(relatoriosSection('conversao')).toBe('conversao');
    expect(relatoriosSection(null)).toBe('entrada');
    expect(relatoriosSection('perdas')).toBe('perdas');
    expect(relatoriosSection('clientes')).toBe('entrada');
  });

  it('nada muda em tempo de execução', () => {
    expect(Object.isFrozen(RELATORIOS_RAIL_GROUPS)).toBe(true);
    expect(Object.isFrozen(RELATORIOS_RAIL_GROUPS[0].items)).toBe(true);
  });
});

describe('número de cada item', () => {
  it('lê o total ou a taxa do resultado da conta do submenu', () => {
    expect(railNumberOf('entrada', { total: 1234 })).toEqual({ text: '1.234' });
    expect(railNumberOf('perdas', { total: 0 })).toEqual({ text: '0' });
    expect(railNumberOf('parados', { total: 7 })).toEqual({ text: '7' });
    expect(railNumberOf('conversao', { conversion: { value: 23 } })).toEqual({ text: '23%' });
    expect(railNumberOf('visitas-e-aulas', { attendance: { value: 0 } })).toEqual({ text: '0%' });
  });

  it('taxa sem base é sem base, e sem resultado não há número', () => {
    expect(railNumberOf('conversao', { conversion: { value: null } })).toEqual({ none: true });
    expect(railNumberOf('visitas-e-aulas', { attendance: { value: null } })).toEqual({ none: true });
    expect(railNumberOf('entrada', null)).toBeNull();
    expect(railNumberOf('clientes', { total: 3 })).toBeNull();
  });
});
