import { describe, it, expect } from 'vitest';
import { stageBottleneck, stuckOf, MIN_STAGE_ENTERED } from '../crm/bottleneck.js';

const row = (name, entered, advanced, lost, medianMin = 60) => ({ name, entered, advanced, lost, medianMin });

describe('stageBottleneck', () => {
  const rows = [row('Novo lead', 47, 38, 5), row('Contato feito', 38, 16, 9, 3240), row('Agendado', 16, 13, 2)];

  it('a etapa de menor taxa de avanço, com o que se perdeu e o que ficou parado', () => {
    expect(stageBottleneck(rows)).toEqual({
      name: 'Contato feito', entered: 38, advanced: 16, lost: 9, stuck: 13, advancePct: 42, medianMin: 3240
    });
  });

  it('parado é o que entrou e não avançou nem se perdeu', () => {
    expect(stuckOf(row('x', 38, 16, 9))).toBe(13);
    expect(stuckOf(row('x', 10, 8, 5))).toBe(0); // nunca negativo
  });

  it('etapa com poucas entradas não vira gargalo', () => {
    const few = [row('Novo lead', MIN_STAGE_ENTERED - 1, 0, 4), row('Contato feito', 20, 15, 2)];
    expect(stageBottleneck(few).name).toBe('Contato feito');
    expect(stageBottleneck([row('Novo lead', 3, 0, 3)])).toBeNull();
  });

  it('empate na taxa: fica a etapa com mais perdidos e parados', () => {
    const tie = [row('A', 10, 5, 1), row('B', 20, 10, 6)];
    expect(stageBottleneck(tie).name).toBe('B');
  });

  it('todos os leads avançando ou sem linhas: sem gargalo', () => {
    expect(stageBottleneck([row('A', 10, 10, 0)])).toBeNull();
    expect(stageBottleneck([])).toBeNull();
    expect(stageBottleneck(null)).toBeNull();
  });
});
