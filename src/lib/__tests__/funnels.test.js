// isSystemStage foi promovida da FunnelsSection para a lib quando nasceu o
// funil de indicações (mais telas passaram a precisar da noção de etapa de
// sistema). Congela o contrato: flag OU nome legado 'Negociação'.

import { describe, it, expect } from 'vitest';
import { isSystemStage, stageNameProblem } from '../funnels.js';

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

// O lead guarda o nome da etapa: nome repetido no mesmo funil junta os leads
// das duas colunas, e Venda e Perda são as colunas finais do Pipeline.
describe('stageNameProblem', () => {
  const stages = [{ id: 's1', name: 'Novo' }, { id: 's2', name: 'Contato ' }, { id: 's3', name: 'Negociação', isSystem: true }];

  it('nome novo e livre passa', () => {
    expect(stageNameProblem(stages, 'Visita')).toBeNull();
  });

  it('barra nome repetido sem olhar caixa e espaço das pontas, ao criar e ao renomear', () => {
    expect(stageNameProblem(stages, ' novo ')).toBe('A etapa "Novo" já existe neste funil.');
    expect(stageNameProblem(stages, 'contato', 's1')).toBe('A etapa "Contato " já existe neste funil.');
    expect(stageNameProblem(stages, 'negociação')).toBe('A etapa "Negociação" já existe neste funil.');
  });

  it('renomear a própria etapa (só a caixa) passa', () => {
    expect(stageNameProblem(stages, 'NOVO', 's1')).toBeNull();
  });

  it('Venda e Perda não viram etapa', () => {
    expect(stageNameProblem(stages, ' venda')).toBe('"venda" é uma coluna fixa do Pipeline e não pode ser nome de etapa.');
    expect(stageNameProblem([], 'Perda')).toBe('"Perda" é uma coluna fixa do Pipeline e não pode ser nome de etapa.');
  });
});
