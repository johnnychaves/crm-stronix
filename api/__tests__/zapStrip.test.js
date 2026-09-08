import { describe, it, expect } from 'vitest';
import { buildZapStrip } from '../_zapStrip.js';

const HOJE = new Date(2026, 8, 8, 10, 0); // 08/09/2026 10:00

const cliente = (extra = {}) => ({
  lifecycleStage: 'cliente',
  currentContractStatus: 'ativo',
  currentContractStartsAt: new Date(2025, 8, 8),
  currentContractEndsAt: new Date(2027, 8, 8),
  ...extra
});

describe('buildZapStrip', () => {
  it('não devolve faixa quando não há prazo curto', () => {
    expect(buildZapStrip(cliente(), HOJE)).toBeNull();
  });

  it('devolve visita quando há visita marcada para hoje', () => {
    const lead = { appointmentType: 'Visita', appointmentScheduledFor: new Date(2026, 8, 8, 18, 30) };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 18:30'
    });
  });

  it('devolve aula experimental quando há aula marcada para hoje', () => {
    const lead = { appointmentType: 'Aula', appointmentScheduledFor: new Date(2026, 8, 8, 7, 0) };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'aula_hoje', tone: 'agendado', text: 'Aula experimental hoje às 07:00'
    });
  });

  it('ignora compromisso que não é hoje', () => {
    const lead = { appointmentType: 'Visita', appointmentScheduledFor: new Date(2026, 8, 10, 18, 30) };
    expect(buildZapStrip(lead, HOJE)).toBeNull();
  });

  it('devolve contrato vencido com a contagem de dias', () => {
    const lead = cliente({ currentContractEndsAt: new Date(2026, 7, 31) });
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'vencido', tone: 'vencido', text: 'Contrato vencido há 8 dias'
    });
  });

  it('devolve marco de renovação quando o contrato entra em 30 dias', () => {
    const lead = cliente({ currentContractEndsAt: new Date(2026, 9, 8) }); // 08/10/2026
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
    });
  });

  it('devolve freepass ativo com a contagem', () => {
    // aula em 07/09 com 3 dias de validade: último dia é 09/09, hoje é 08/09.
    const lead = {
      appointmentType: 'Aula',
      appointmentScheduledFor: new Date(2026, 8, 7, 7, 0),
      trialClassesPlanned: 3
    };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'freepass', tone: 'avencer', text: 'Freepass até 09/09 · falta 1 dia'
    });
  });

  it('compromisso de hoje ganha do marco de renovação', () => {
    const lead = cliente({
      currentContractEndsAt: new Date(2026, 9, 8),
      appointmentType: 'Visita',
      appointmentScheduledFor: new Date(2026, 8, 8, 9, 0)
    });
    expect(buildZapStrip(lead, HOJE).kind).toBe('visita_hoje');
  });
});
