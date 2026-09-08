import { describe, it, expect } from 'vitest';
import { buildZapCard } from '../_zapCard.js';

const HOJE = new Date(2026, 8, 8, 10, 0);

describe('buildZapCard', () => {
  it('monta o cartão de um cliente com contrato ativo', () => {
    const lead = {
      id: 'abc123',
      name: 'Maria Eduarda Ramos',
      lifecycleStage: 'cliente',
      consultantName: 'Ana Beatriz',
      currentPlanName: 'Musculação Anual',
      currentContractStatus: 'ativo',
      currentContractStartsAt: new Date(2025, 10, 12),
      currentContractEndsAt: new Date(2026, 10, 12),
      lastInteractionAt: new Date(2026, 8, 7, 14, 22)
    };
    expect(buildZapCard(lead, HOJE)).toMatchObject({
      found: true,
      leadId: 'abc123',
      kind: 'cliente',
      name: 'Maria Eduarda Ramos',
      consultantName: 'Ana Beatriz',
      planName: 'Musculação Anual',
      contractStatus: 'ativo',
      daysLeft: 65,
      strip: null
    });
  });

  it('monta o cartão de um lead com fase e agendamento', () => {
    const lead = {
      id: 'lead9',
      name: 'Camila Prado',
      lifecycleStage: 'lead',
      status: 'Negociação',
      source: 'Instagram',
      consultantName: 'Diego Martins',
      appointmentType: 'Visita',
      appointmentScheduledFor: new Date(2026, 8, 8, 18, 30)
    };
    const card = buildZapCard(lead, HOJE);
    expect(card).toMatchObject({
      found: true,
      kind: 'lead',
      stage: 'Negociação',
      source: 'Instagram',
      strip: { kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 18:30' }
    });
    expect(card.appointment.type).toBe('Visita');
  });

  it('nunca expõe dado sensível', () => {
    const lead = {
      id: 'x', name: 'Fulano', lifecycleStage: 'cliente',
      cpf: '00000000000', address: 'Rua X, 123',
      currentContractValue: 149900, paymentStatus: 'OVERDUE'
    };
    const card = buildZapCard(lead, HOJE);
    const chaves = Object.keys(card);
    expect(chaves).not.toContain('cpf');
    expect(chaves).not.toContain('address');
    expect(chaves).not.toContain('currentContractValue');
    expect(chaves).not.toContain('paymentStatus');
    expect(JSON.stringify(card)).not.toContain('149900');
    expect(JSON.stringify(card)).not.toContain('00000000000');
  });

  it('devolve não encontrado quando não há lead', () => {
    expect(buildZapCard(null, HOJE)).toEqual({ found: false });
  });
});
