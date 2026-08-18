import { describe, it, expect } from 'vitest';
import { buildSchedulePatch } from '../schedulePatch.js';

// O patch é aplicado com set(merge:true): o que ele NÃO menciona sobrevive,
// e null MENCIONADO sobrescreve. Os testes checam as duas coisas.
const aplicar = (lead, patch) => ({ ...lead, ...patch });

const AULA = new Date(2026, 7, 20, 18, 0);
const MSG = new Date(2026, 7, 19, 9, 0);

const leadComAula = {
  appointmentType: 'aula_experimental',
  appointmentScheduledFor: AULA,
  appointmentModality: 'Musculação',
  appointmentProfessorId: 'p1',
  currentAulaId: 'aula123',
};

describe('buildSchedulePatch — o bug relatado em 18/08/2026', () => {
  it('MENSAGEM não apaga a aula marcada', () => {
    const patch = buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG });
    const depois = aplicar(leadComAula, patch);

    expect(depois.appointmentType).toBe('aula_experimental');
    expect(depois.appointmentScheduledFor).toBe(AULA);
    expect(depois.appointmentModality).toBe('Musculação');
    expect(depois.currentAulaId).toBe('aula123');
    // e o contato foi agendado
    expect(depois.nextFollowUp).toBe(MSG);
    expect(depois.nextFollowUpType).toBe('Mensagem');
  });

  it('LIGAÇÃO não apaga a aula marcada', () => {
    const depois = aplicar(leadComAula, buildSchedulePatch({ typeLabel: 'Ligação', date: MSG }));
    expect(depois.appointmentType).toBe('aula_experimental');
    expect(depois.appointmentScheduledFor).toBe(AULA);
  });

  it('MENSAGEM não apaga a visita marcada', () => {
    const visita = new Date(2026, 7, 21, 10, 0);
    const lead = { appointmentType: 'visita', appointmentScheduledFor: visita, appointmentUnit: 'Centro' };
    const depois = aplicar(lead, buildSchedulePatch({ typeLabel: 'Mensagem', date: MSG }));
    expect(depois.appointmentType).toBe('visita');
    expect(depois.appointmentScheduledFor).toBe(visita);
    expect(depois.appointmentUnit).toBe('Centro');
  });

  it('mensagem/ligação NÃO mencionam nenhum campo de compromisso', () => {
    for (const typeLabel of ['Mensagem', 'Ligação']) {
      const patch = buildSchedulePatch({ typeLabel, date: MSG });
      const tocados = Object.keys(patch).filter((k) => k.startsWith('appointment') || k === 'currentAulaId' || k === 'trialClassesPlanned');
      expect(tocados).toEqual([]);
    }
  });
});

describe('buildSchedulePatch — compromisso formal', () => {
  it('AULA grava o compromisso e os extras do tipo', () => {
    const patch = buildSchedulePatch({
      typeLabel: 'Aula Experimental', date: AULA,
      modalidade: 'Jiu-Jitsu', professorId: 'p9', professorName: 'Ana', quantidade: 3,
      currentAulaId: 'nova',
    });
    expect(patch).toMatchObject({
      appointmentType: 'aula_experimental',
      appointmentScheduledFor: AULA,
      appointmentModality: 'Jiu-Jitsu',
      appointmentProfessorId: 'p9',
      appointmentProfessorName: 'Ana',
      trialClassesPlanned: 3,
      appointmentUnit: null,
      currentAulaId: 'nova',
    });
  });

  it('VISITA grava a unidade e limpa os extras de aula', () => {
    const patch = buildSchedulePatch({ typeLabel: 'Visita', date: AULA, unidade: 'Centro' });
    expect(patch).toMatchObject({
      appointmentType: 'visita',
      appointmentUnit: 'Centro',
      appointmentModality: null,
      appointmentProfessorId: null,
      appointmentSoloTraining: false,
      trialClassesPlanned: null,
    });
  });

  it('compromisso novo nasce sem desfecho colado do anterior', () => {
    const lead = { appointmentOutcome: 'no_show', appointmentOutcomeAt: new Date(2026, 6, 1) };
    const depois = aplicar(lead, buildSchedulePatch({ typeLabel: 'Visita', date: AULA }));
    expect(depois.appointmentOutcome).toBeNull();
    expect(depois.appointmentOutcomeAt).toBeNull();
  });

  it('trocar aula por visita não deixa professor para trás', () => {
    const depois = aplicar(leadComAula, buildSchedulePatch({ typeLabel: 'Visita', date: AULA, unidade: 'Centro' }));
    expect(depois.appointmentProfessorId).toBeNull();
    expect(depois.appointmentModality).toBeNull();
  });
});
