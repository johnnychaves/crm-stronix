// Testes dos helpers do catálogo de planos. O plano guarda modalityIds (array
// de ids). Planos antigos têm o campo único modalityId — a leitura cai nele
// como fallback, sem migração.

import { describe, it, expect } from 'vitest';
import { planModalityIds, planModalityNames } from '../planos.js';

const mods = [
  { id: 'm1', name: 'Musculação' },
  { id: 'm2', name: 'Pilates' },
];

describe('planModalityIds', () => {
  it('usa modalityIds quando existe', () => {
    expect(planModalityIds({ modalityIds: ['m1', 'm2'] })).toEqual(['m1', 'm2']);
  });
  it('cai no modalityId legado quando não há modalityIds', () => {
    expect(planModalityIds({ modalityId: 'm1' })).toEqual(['m1']);
  });
  it('plano sem modalidade vira lista vazia', () => {
    expect(planModalityIds({})).toEqual([]);
    expect(planModalityIds({ modalityId: null })).toEqual([]);
  });
  it('modalityIds vazio é respeitado (não cai no legado)', () => {
    expect(planModalityIds({ modalityIds: [], modalityId: 'm1' })).toEqual([]);
  });
});

describe('planModalityNames', () => {
  it('resolve ids para nomes', () => {
    expect(planModalityNames({ modalityIds: ['m1', 'm2'] }, mods)).toEqual(['Musculação', 'Pilates']);
  });
  it('resolve o campo legado', () => {
    expect(planModalityNames({ modalityId: 'm2' }, mods)).toEqual(['Pilates']);
  });
  it('ignora id órfão (modalidade excluída)', () => {
    expect(planModalityNames({ modalityIds: ['m1', 'zzz'] }, mods)).toEqual(['Musculação']);
  });
  it('sem modalidade vira lista vazia', () => {
    expect(planModalityNames({}, mods)).toEqual([]);
  });
});
