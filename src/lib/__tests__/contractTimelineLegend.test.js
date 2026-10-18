import { describe, it, expect } from 'vitest';
import { legendKeysOf } from '../contractsTab.js';

// Só a forma que a função lê: lanes com segmentos {kind, pauses} e a lista de marcos.
const seg = (kind, pauses = []) => ({ id: `${kind}-${pauses.length}`, kind, pauses });

describe('legendKeysOf', () => {
  it('sem linha do tempo, não há legenda', () => {
    expect(legendKeysOf(null)).toEqual([]);
    expect(legendKeysOf(undefined)).toEqual([]);
  });

  it('um contrato em uso sem marcos: só "em uso"', () => {
    const t = { lanes: [[seg('em_uso')]], marks: [] };
    expect(legendKeysOf(t)).toEqual(['em_uso']);
  });

  it('segue a ordem fixa e junta as faixas de todas as trilhas', () => {
    const t = {
      lanes: [[seg('encerrado'), seg('em_uso')], [seg('cancelado'), seg('proximo')]],
      marks: []
    };
    expect(legendKeysOf(t)).toEqual(['em_uso', 'proximo', 'encerrado', 'cancelado']);
  });

  it('trancado só aparece quando algum segmento tem pausa', () => {
    const sem = { lanes: [[seg('em_uso')]], marks: [] };
    const com = { lanes: [[seg('em_uso', [{ leftPct: 10, widthPct: 5 }])]], marks: [] };
    expect(legendKeysOf(sem)).not.toContain('trancado');
    expect(legendKeysOf(com)).toEqual(['em_uso', 'trancado']);
  });

  it('marcos de renovação só aparecem quando existem', () => {
    const t = { lanes: [[seg('em_uso')]], marks: [{ days: 30, pct: 80 }] };
    expect(legendKeysOf(t)).toEqual(['em_uso', 'marcos']);
  });
});
