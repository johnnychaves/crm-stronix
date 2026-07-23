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

  it('limpa o agendamento formal antigo (visita/aula) e o desfecho anterior', () => {
    const patch = contactReschedule({}, '2026-08-01');
    expect(patch).toMatchObject({
      appointmentScheduledFor: null,
      appointmentType: null,
      appointmentOutcome: null,
      appointmentOutcomeAt: null,
      appointmentOutcomeBy: null
    });
  });

  it('NÃO toca status/funil', () => {
    const patch = contactReschedule({}, '2026-08-01');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('lifecycleStage');
  });
});
