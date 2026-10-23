import { describe, it, expect } from 'vitest';
import { contractTimelineOf, legendKeysOf } from '../contractsTab.js';

// Só a forma que a função lê: lanes com segmentos {kind, widthPct, pauses} e a
// lista de marcos.
const seg = (kind, pauses = [], widthPct = 10) => ({ id: `${kind}-${pauses.length}`, kind, widthPct, pauses });
const D = (y, m, d, h = 0) => new Date(y, m - 1, d, h);

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

  it('pausa de largura zero não acende o trancado', () => {
    const t = { lanes: [[seg('em_uso', [{ leftPct: 80, widthPct: 0 }])]], marks: [] };
    expect(legendKeysOf(t)).toEqual(['em_uso']);
  });

  it('segmento de largura zero não entra na legenda', () => {
    const t = { lanes: [[seg('em_uso'), seg('cancelado', [], 0), seg('encerrado', [], 0), seg('proximo', [], 0)]], marks: [] };
    expect(legendKeysOf(t)).toEqual(['em_uso']);
  });

  it('contrato trancado hoje, num eixo de mais de um ano: sem amarelo no eixo, sem trancado na legenda', () => {
    // Trancado às 10h e visto às 15h: a pausa vai até o início de hoje, então
    // tem largura zero no eixo.
    const now = D(2026, 10, 18, 15);
    const antigo = { id: 'old', planName: 'Anual', durationMonths: 12, value: 1200, status: 'vencido', startsAt: D(2025, 6, 1), endsAt: D(2026, 6, 1), createdAt: D(2025, 6, 1) };
    const trancado = { id: 'tr1', planName: 'Trimestral', durationMonths: 3, value: 600, status: 'trancado', pausedAt: D(2026, 10, 18, 10), startsAt: D(2026, 9, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 9, 1) };
    const t = contractTimelineOf({ contracts: [antigo, trancado], heroId: 'tr1', now, checkpoints: [90, 60, 30], handled: [] });
    expect(t.lanes.flat().flatMap((s) => s.pauses).every((p) => p.widthPct === 0)).toBe(true);
    expect(legendKeysOf(t)).not.toContain('trancado');
    // Dois dias depois, a pausa já aparece no eixo e na legenda.
    const depois = contractTimelineOf({ contracts: [antigo, { ...trancado, pausedAt: D(2026, 10, 16, 10) }], heroId: 'tr1', now, checkpoints: [90, 60, 30], handled: [] });
    expect(legendKeysOf(depois)).toContain('trancado');
  });

  it('marcos de renovação só aparecem quando existem', () => {
    const t = { lanes: [[seg('em_uso')]], marks: [{ days: 30, pct: 80 }] };
    expect(legendKeysOf(t)).toEqual(['em_uso', 'marcos']);
  });
});
