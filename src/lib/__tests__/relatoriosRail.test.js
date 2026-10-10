// Lista ao lado dos Relatórios: o contrato com a tabela de endereços, como o
// settingsRail.test.js faz com as Configurações.
import { describe, it, expect } from 'vitest';
import {
  RELATORIOS_RAIL_GROUPS, RELATORIOS_RAIL_IDS, RELATORIOS_DEFAULT_SECTION, relatoriosSection,
} from '../relatoriosRail.js';
import { RELATORIOS_SUBS } from '../routes.js';

describe('lista ao lado dos Relatórios', () => {
  it('cada item é um submenu do endereço, e todo submenu do endereço está na lista', () => {
    expect([...RELATORIOS_RAIL_IDS].sort()).toEqual(Object.keys(RELATORIOS_SUBS).sort());
  });

  it('um grupo, Leads, com Entrada de leads e Conversão, nessa ordem e com a pergunta de cada um', () => {
    expect(RELATORIOS_RAIL_GROUPS.map((g) => g.label)).toEqual(['Leads']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.label)).toEqual(['Entrada de leads', 'Conversão']);
    expect(RELATORIOS_RAIL_GROUPS[0].items.map((i) => i.hint)).toEqual(['Quantos chegaram e de onde', 'Quantos viraram matrícula']);
  });

  it('o padrão é a Entrada, e submenu desconhecido cai nele', () => {
    expect(RELATORIOS_DEFAULT_SECTION).toBe('entrada');
    expect(relatoriosSection('conversao')).toBe('conversao');
    expect(relatoriosSection(null)).toBe('entrada');
    expect(relatoriosSection('perdas')).toBe('entrada');
  });

  it('nada muda em tempo de execução', () => {
    expect(Object.isFrozen(RELATORIOS_RAIL_GROUPS)).toBe(true);
    expect(Object.isFrozen(RELATORIOS_RAIL_GROUPS[0].items)).toBe(true);
  });
});
