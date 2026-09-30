import { describe, it, expect } from 'vitest';
import { buildZapCard, buildZapWard, buildGuardianCard, appointmentOutcomeOf, cardAppointment, isAppointmentCancelled } from '../_zapCard.js';

// Instante escrito no horário de Brasília, pelo mesmo motivo de
// zapStrip.test.js: o cartão conta dias de Brasília em qualquer máquina.
const brt = (s) => new Date(`${s}:00-03:00`);

const HOJE = brt('2026-09-08T10:00');

describe('buildZapCard', () => {
  it('monta o cartão de um cliente com contrato ativo', () => {
    const lead = {
      id: 'abc123',
      name: 'Maria Eduarda Ramos',
      lifecycleStage: 'cliente',
      consultantName: 'Ana Beatriz',
      currentPlanName: 'Musculação Anual',
      currentContractStatus: 'ativo',
      currentContractStartsAt: brt('2025-11-12T00:00'),
      // Longe de qualquer marco padrão (90/60/30) de propósito: este teste
      // valida os campos do cartão de um cliente comum, não a faixa — a faixa
      // tem cobertura própria em 'marcos de renovação repassados pra faixa',
      // abaixo.
      currentContractEndsAt: brt('2027-09-08T00:00'),
      lastInteractionAt: brt('2026-09-07T14:22')
    };
    expect(buildZapCard(lead, HOJE)).toMatchObject({
      found: true,
      leadId: 'abc123',
      kind: 'cliente',
      name: 'Maria Eduarda Ramos',
      consultantName: 'Ana Beatriz',
      planName: 'Musculação Anual',
      contractStatus: 'ativo',
      daysLeft: 365,
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
      appointmentScheduledFor: brt('2026-09-08T18:30')
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

  describe('marcos de renovação repassados pra faixa', () => {
    const clienteAVencer = (extra = {}) => ({
      id: 'c1',
      name: 'Cliente Teste',
      lifecycleStage: 'cliente',
      currentContractStatus: 'ativo',
      currentContractStartsAt: brt('2025-09-08T00:00'),
      currentContractEndsAt: brt('2026-10-23T00:00'), // 45 dias após HOJE
      ...extra
    });

    it('repassa marcos customizados pra buildZapStrip', () => {
      const card = buildZapCard(clienteAVencer(), HOJE, [45, 20]);
      expect(card.strip).toEqual({
        kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 45 dias'
      });
    });

    it('cai no padrão 90/60/30 quando nenhum marco é passado (config ausente)', () => {
      const lead = clienteAVencer({ currentContractEndsAt: brt('2026-10-08T00:00') }); // 30 dias
      const card = buildZapCard(lead, HOJE);
      expect(card.strip).toEqual({
        kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
      });
    });

    it('cai no padrão 90/60/30 quando o valor da config é lixo', () => {
      const lead = clienteAVencer({ currentContractEndsAt: brt('2026-10-08T00:00') }); // 30 dias
      const card = buildZapCard(lead, HOJE, [-1, 0, 'x']);
      expect(card.strip).toEqual({
        kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
      });
    });

    it('não acrescenta campo novo ao cartão — continua a mesma lista fechada', () => {
      const card = buildZapCard(clienteAVencer(), HOJE, [45, 20]);
      expect(Object.keys(card).sort()).toEqual([
        'appointment', 'consultantName', 'contractEndsAt', 'contractStatus',
        'daysLeft', 'found', 'kind', 'lastInteractionAt', 'leadId', 'name',
        'planName', 'strip'
      ]);
    });
  });
});

describe('cartão do responsável', () => {
  const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
  const pedro = {
    id: 'k1', name: 'Pedro Souza', lifecycleStage: 'lead', status: 'Novo', source: 'Instagram',
    consultantName: 'Bruno', isMinor: true, guardian: MAE, cpf: '12345678900',
    createdAt: brt('2026-08-01T00:00'),
  };
  const ana = { ...pedro, id: 'k2', name: 'Ana Souza', guardian: { ...MAE, name: 'Maria S.' }, createdAt: brt('2026-09-01T00:00') };

  it('menor em wards: cartão de lead sem found, com parentesco, e sem campo fora da lista', () => {
    const w = buildZapWard(pedro, HOJE);
    expect(w).toMatchObject({ leadId: 'k1', kind: 'lead', name: 'Pedro Souza', stage: 'Novo', relationship: 'Mãe' });
    expect('found' in w).toBe(false);
    expect(Object.keys(w).sort()).toEqual([
      'appointment', 'consultantName', 'kind', 'lastInteractionAt', 'leadId', 'name', 'relationship', 'source', 'stage', 'strip',
    ]);
  });

  it('só menores: tipo responsável, nome do menor cadastrado por último, menores em ordem de nome', () => {
    const card = buildGuardianCard([pedro, ana], HOJE);
    expect(card.found).toBe(true);
    expect(card.kind).toBe('responsavel');
    expect(card.name).toBe('Maria S.');
    expect(card.wards.map((w) => w.name)).toEqual(['Ana Souza', 'Pedro Souza']);
    expect(Object.keys(card).sort()).toEqual(['found', 'kind', 'name', 'wards']);
  });
});

describe('desfecho do agendamento no cartão', () => {
  // Visita de 01/10 às 18:00 de Brasília, como a ficha e a Meta Diária mostram.
  const visita = (extra = {}) => ({
    id: 'lead9', name: 'Camila Prado', lifecycleStage: 'lead', status: 'Negociação',
    appointmentType: 'visita', appointmentScheduledFor: brt('2026-10-01T18:00'), nextFollowUpType: 'Visita', ...extra
  });

  it('sem desfecho: a linha vem com outcome null', () => {
    expect(buildZapCard(visita(), HOJE).appointment).toEqual({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: null });
  });

  it.each(['attended', 'no_show'])('%s registrado na Meta Diária aparece na linha', (outcome) => {
    expect(buildZapCard(visita({ appointmentOutcome: outcome }), HOJE).appointment.outcome).toBe(outcome);
  });

  it('remarcado não é desfecho: o lead já está com a data nova', () => {
    expect(buildZapCard(visita({ appointmentOutcome: 'rescheduled' }), HOJE).appointment.outcome).toBeNull();
  });

  it('cancelado pela Meta Diária: a data já foi apagada e a linha some', () => {
    const cancelado = visita({ appointmentOutcome: 'cancelled', appointmentScheduledFor: null, appointmentType: null, nextFollowUp: null });
    expect(buildZapCard(cancelado, HOJE).appointment).toBeNull();
  });

  it('cancelado sem a data apagada também some', () => {
    expect(buildZapCard(visita({ appointmentOutcome: 'cancelled' }), HOJE).appointment).toBeNull();
  });

  it('o menor em wards leva o desfecho do agendamento dele', () => {
    const menor = visita({ isMinor: true, guardian: { name: 'Maria', phone: '(11) 9 1234-5678', relationship: 'Mãe' }, appointmentOutcome: 'no_show' });
    expect(buildZapWard(menor, HOJE).appointment).toEqual({ type: 'visita', at: '2026-10-01T21:00:00.000Z', outcome: 'no_show' });
  });

  it('o cliente também mostra o desfecho', () => {
    const cliente = visita({ lifecycleStage: 'cliente', appointmentOutcome: 'attended' });
    expect(buildZapCard(cliente, HOJE)).toMatchObject({ kind: 'cliente', appointment: { outcome: 'attended' } });
  });

  it('a linha do agendamento só leva tipo, data e desfecho, mesmo com o lead cheio', () => {
    const cheio = visita({
      appointmentOutcome: 'attended',
      appointmentUnit: 'Centro',
      appointmentModality: 'Pilates',
      appointmentProfessorName: 'Carla Dias',
      appointmentOutcomeBy: 'u1',
      appointmentOutcomeAt: brt('2026-10-01T19:00'),
      nextFollowUpNote: 'Vem depois do trabalho.',
      cpf: '12345678900'
    });
    expect(Object.keys(buildZapCard(cheio, HOJE).appointment).sort()).toEqual(['at', 'outcome', 'type']);
  });

  it('appointmentOutcomeOf e cardAppointment são a regra que o cartão usa', () => {
    expect(appointmentOutcomeOf({ appointmentOutcome: 'attended' })).toBe('attended');
    expect(appointmentOutcomeOf({ appointmentOutcome: 'qualquer' })).toBeNull();
    expect(appointmentOutcomeOf(null)).toBeNull();
    expect(cardAppointment({})).toBeNull();
  });

  it('isAppointmentCancelled é verdadeiro só para o desfecho cancelled', () => {
    expect(isAppointmentCancelled({ appointmentOutcome: 'cancelled' })).toBe(true);
    expect(isAppointmentCancelled({ appointmentOutcome: 'attended' })).toBe(false);
    expect(isAppointmentCancelled({})).toBe(false);
    expect(isAppointmentCancelled(null)).toBe(false);
  });
});
