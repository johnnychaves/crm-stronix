// Testes do estado de ciclo de vida da pessoa (src/lib/leadState.js).
// O ponto fixo: cliente vem antes de Perda — quem virou cliente não volta a
// ser lead, e com contrato vencido ele é INATIVO, não perdido.

import { describe, it, expect } from 'vitest';
import { deriveLeadState } from '../leadState.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 9, 8);

const vigente = { startsAt: D(2026, 3, 1), endsAt: D(2027, 3, 1) };
const vencido = { startsAt: D(2025, 3, 1), endsAt: D(2026, 3, 1) };

const cliente = (extra = {}) => ({
  id: 'c1', name: 'Carla Dias', status: 'Venda', isConverted: true, lifecycleStage: 'cliente',
  currentContractId: 'k1', currentContractStatus: 'ativo',
  currentContractStartsAt: vigente.startsAt, currentContractEndsAt: vigente.endsAt,
  ...extra
});

describe('deriveLeadState', () => {
  it('lead em prospecção', () => {
    expect(deriveLeadState({ status: 'Em contato' }, NOW).key).toBe('lead');
  });

  it('lead perdido (sem marcas de cliente)', () => {
    expect(deriveLeadState({ status: 'Perda', lossReason: 'Preço' }, NOW).key).toBe('perdido');
  });

  it('cliente com contrato vigente', () => {
    expect(deriveLeadState(cliente(), NOW).key).toBe('cliente_ativo');
  });

  it('contrato vencido vira CLIENTE INATIVO, não lead', () => {
    const state = deriveLeadState(cliente({ currentContractStartsAt: vencido.startsAt, currentContractEndsAt: vencido.endsAt }), NOW);
    expect(state.key).toBe('inativo');
    expect(state.label).toBe('INATIVO');
  });

  it('cliente com status Perda gravado (doc antigo) continua cliente, não LEAD PERDIDO', () => {
    expect(deriveLeadState(cliente({ status: 'Perda', isConverted: false }), NOW).key).toBe('cliente_ativo');
  });

  it('Venda sem contrato (antiga) em Perda também continua cliente', () => {
    expect(deriveLeadState({ status: 'Perda', lifecycleStage: 'cliente' }, NOW).key).toBe('cliente_ativo');
  });
});
