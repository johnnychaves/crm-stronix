import { describe, it, expect } from 'vitest';
import { isPassActive, getTrialPassNote } from '../freePass.js';

// now fixo: 15/07/2026 12:00 (meio do dia — a conta trunca pra meia-noite via
// startOfDay, então a hora aqui não deveria afetar o resultado).
const NOW = new Date(2026, 6, 15, 12, 0, 0);

describe('isPassActive', () => {
  it('passe ativo (ainda restam dias)', () => {
    // Aula marcada há 2 dias, passe de 7 dias -> termina em 21/07, ainda ativo.
    const lead = { appointmentScheduledFor: new Date(2026, 6, 13), trialClassesPlanned: 7 };
    expect(isPassActive(lead, NOW)).toBe(true);
  });

  it('passe termina HOJE ainda conta como ativo (daysLeft === 0)', () => {
    // Aula marcada em 09/07, passe de 7 dias -> último dia válido 15/07 (hoje).
    const lead = { appointmentScheduledFor: new Date(2026, 6, 9), trialClassesPlanned: 7 };
    expect(isPassActive(lead, NOW)).toBe(true);
  });

  it('passe expirado (daysLeft < 0)', () => {
    // Aula marcada em 01/07, passe de 3 dias -> expirou em 03/07.
    const lead = { appointmentScheduledFor: new Date(2026, 6, 1), trialClassesPlanned: 3 };
    expect(isPassActive(lead, NOW)).toBe(false);
  });

  it('sem quantidade registrada (trialClassesPlanned ausente) -> não ativo', () => {
    const lead = { appointmentScheduledFor: new Date(2026, 6, 13) };
    expect(isPassActive(lead, NOW)).toBe(false);
  });

  it('trialClassesPlanned inválido (0 ou negativo) -> não ativo', () => {
    expect(isPassActive({ appointmentScheduledFor: new Date(2026, 6, 13), trialClassesPlanned: 0 }, NOW)).toBe(false);
    expect(isPassActive({ appointmentScheduledFor: new Date(2026, 6, 13), trialClassesPlanned: -2 }, NOW)).toBe(false);
  });

  it('sem data de agendamento -> não ativo mesmo com quantidade', () => {
    expect(isPassActive({ trialClassesPlanned: 7 }, NOW)).toBe(false);
  });

  it('now default (sem 2º argumento) não quebra', () => {
    const lead = { appointmentScheduledFor: new Date(), trialClassesPlanned: 5 };
    expect(isPassActive(lead)).toBe(true);
  });
});

describe('getTrialPassNote', () => {
  it('sem quantidade -> null (sem nota exibida)', () => {
    expect(getTrialPassNote({ appointmentScheduledFor: new Date(2026, 6, 13) }, NOW)).toBeNull();
  });

  it('sem data marcada -> null', () => {
    expect(getTrialPassNote({ trialClassesPlanned: 5 }, NOW)).toBeNull();
  });

  it('passe expirado: texto com a data de término', () => {
    const lead = { appointmentScheduledFor: new Date(2026, 6, 1), trialClassesPlanned: 3 };
    const note = getTrialPassNote(lead, NOW);
    expect(note.text).toBe('passe expirou 03/07');
    expect(note.cls).toContain('rose');
  });

  it('passe termina hoje: texto fixo', () => {
    const lead = { appointmentScheduledFor: new Date(2026, 6, 9), trialClassesPlanned: 7 };
    const note = getTrialPassNote(lead, NOW);
    expect(note.text).toBe('passe termina hoje');
    expect(note.cls).toContain('amber');
  });

  it('passe ativo com dias restantes: contador no singular', () => {
    // Termina 16/07 (amanhã) -> falta 1 dia.
    const lead = { appointmentScheduledFor: new Date(2026, 6, 10), trialClassesPlanned: 7 };
    const note = getTrialPassNote(lead, NOW);
    expect(note.text).toBe('até 16/07 · falta 1 dia');
  });

  it('passe ativo com dias restantes: contador no plural', () => {
    // Termina 21/07 -> faltam 6 dias.
    const lead = { appointmentScheduledFor: new Date(2026, 6, 13), trialClassesPlanned: 9 };
    const note = getTrialPassNote(lead, NOW);
    expect(note.text).toBe('até 21/07 · faltam 6 dias');
    expect(note.cls).toContain('slate');
  });
});
