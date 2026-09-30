// Opções do balão "Marcar desfecho" em cada estado, e o rótulo do botão.
import { describe, it, expect } from 'vitest';
import { outcomeMenuItems, outcomeTriggerLabel } from '../outcomeMenu.js';

const ids = (items) => items.map((i) => i.id);

describe('outcomeMenuItems', () => {
  it('sem desfecho: Compareceu e Não compareceu', () => {
    expect(outcomeMenuItems({})).toEqual([
      { id: 'attended', label: 'Compareceu', tone: 'success' },
      { id: 'no_show', label: 'Não compareceu', tone: 'danger' },
    ]);
  });

  it('card A fazer: Remarcou e Cancelou embaixo', () => {
    expect(ids(outcomeMenuItems({ withMore: true }))).toEqual(['attended', 'no_show', 'rescheduled', 'cancelled']);
  });

  it('marcado: só a troca, e o desfazer quando a tela permite', () => {
    expect(outcomeMenuItems({ outcome: 'attended' })).toEqual([
      { id: 'no_show', label: 'Trocar para não compareceu', tone: 'danger' },
    ]);
    expect(outcomeMenuItems({ outcome: 'no_show', canUndo: true })).toEqual([
      { id: 'attended', label: 'Trocar para compareceu', tone: 'success' },
      { id: 'undo', label: 'Desfazer marcação', tone: 'neutral' },
    ]);
  });

  it('marcado ignora o withMore', () => {
    expect(ids(outcomeMenuItems({ outcome: 'attended', withMore: true }))).toEqual(['no_show']);
  });
});

describe('outcomeTriggerLabel', () => {
  it('mostra o desfecho, ou o convite quando não há', () => {
    expect(outcomeTriggerLabel(null)).toBe('Marcar desfecho');
    expect(outcomeTriggerLabel('attended')).toBe('Compareceu');
    expect(outcomeTriggerLabel('no_show')).toBe('Não compareceu');
    expect(outcomeTriggerLabel('cancelled')).toBe('Marcar desfecho');
  });
});
