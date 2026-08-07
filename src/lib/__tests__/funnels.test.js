// isSystemStage foi promovida da FunnelsSection para a lib quando nasceu o
// funil de indicações (mais telas passaram a precisar da noção de etapa de
// sistema). Congela o contrato: flag OU nome legado 'Negociação'.

import { describe, it, expect } from 'vitest';
import { isSystemStage } from '../funnels.js';

describe('isSystemStage', () => {
  it('true pela flag isSystem', () => {
    expect(isSystemStage({ name: 'Aguardando ação', isSystem: true })).toBe(true);
  });

  it("true pelo nome legado 'Negociação' (case-insensitive, com espaços)", () => {
    expect(isSystemStage({ name: ' negociação ' })).toBe(true);
    expect(isSystemStage({ name: 'NEGOCIAÇÃO' })).toBe(true);
  });

  it('false para etapa comum ou nulo', () => {
    expect(isSystemStage({ name: 'Primeiro contato' })).toBe(false);
    expect(isSystemStage(null)).toBe(false);
  });
});
