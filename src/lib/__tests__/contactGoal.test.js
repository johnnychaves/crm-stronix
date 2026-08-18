// Testes da regra pura de desfecho de CONTATO (contactGoal.js). Datas em
// horário LOCAL, como o app faz.

import { describe, it, expect } from 'vitest';
import { followUpChannelOf, contactDone, contactReschedule } from '../contactGoal.js';

describe('followUpChannelOf', () => {
  it('Ligação quando o nextFollowUpType do lead contém "liga"', () => {
    expect(followUpChannelOf({ nextFollowUpType: 'Ligação' })).toEqual({ type: 'Ligação', volumeKind: 'ligacao' });
    expect(followUpChannelOf({ nextFollowUpType: 'ligacao' })).toEqual({ type: 'Ligação', volumeKind: 'ligacao' });
  });

  it('Mensagem como default (qualquer outro tipo / ausente)', () => {
    expect(followUpChannelOf({ nextFollowUpType: 'Mensagem' })).toEqual({ type: 'Mensagem', volumeKind: 'mensagem' });
    expect(followUpChannelOf({ nextFollowUpType: 'WhatsApp' })).toEqual({ type: 'Mensagem', volumeKind: 'mensagem' });
    expect(followUpChannelOf({})).toEqual({ type: 'Mensagem', volumeKind: 'mensagem' });
    expect(followUpChannelOf(null)).toEqual({ type: 'Mensagem', volumeKind: 'mensagem' });
  });
});

describe('contactDone', () => {
  it('limpa nextFollowUp e nextFollowUpType (conclui sem próximo contato)', () => {
    expect(contactDone()).toEqual({ nextFollowUp: null, nextFollowUpType: null });
  });

  it('NÃO toca status/funil', () => {
    const patch = contactDone();
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('lifecycleStage');
  });
});

describe('contactReschedule', () => {
  it('aceita um Date direto + preserva o canal do lead (Ligação)', () => {
    const d = new Date(2026, 7, 1);
    const patch = contactReschedule({ nextFollowUpType: 'Ligação' }, d);
    expect(patch.nextFollowUp).toBe(d);
    expect(patch.nextFollowUpType).toBe('Ligação');
  });

  it('aceita string yyyy-mm-dd como meia-noite LOCAL + default Mensagem', () => {
    const patch = contactReschedule({}, '2026-08-01');
    expect(patch.nextFollowUp).toEqual(new Date(2026, 7, 1));
    expect(patch.nextFollowUpType).toBe('Mensagem');
  });

  // ANTES de 18/08/2026 este patch LIMPAVA o agendamento formal, e o teste
  // exigia isso. Era o bug: reagendar um contato pela Meta apagava a visita ou
  // aula que o lead tinha marcada. Contato e compromisso são coisas separadas —
  // o contato mexe só no nextFollowUp.
  it('NÃO encosta no compromisso formal nem no desfecho dele', () => {
    const patch = contactReschedule({}, '2026-08-01');
    expect(patch).not.toHaveProperty('appointmentScheduledFor');
    expect(patch).not.toHaveProperty('appointmentType');
    expect(patch).not.toHaveProperty('appointmentOutcome');
    expect(patch).not.toHaveProperty('appointmentOutcomeAt');
    expect(patch).not.toHaveProperty('appointmentOutcomeBy');
  });

  it('reagendar contato preserva a aula marcada do lead', () => {
    const aula = new Date(2026, 7, 20, 18, 0);
    const lead = { appointmentType: 'aula_experimental', appointmentScheduledFor: aula };
    const patch = contactReschedule(lead, '2026-08-15');
    // O patch é aplicado por cima do lead: o que ele não menciona, sobrevive.
    const depois = { ...lead, ...patch };
    expect(depois.appointmentType).toBe('aula_experimental');
    expect(depois.appointmentScheduledFor).toBe(aula);
  });

  it('NÃO toca status/funil', () => {
    const patch = contactReschedule({}, '2026-08-01');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('lifecycleStage');
  });
});
