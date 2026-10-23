// Regras puras da correção do desfecho na Meta Diária: para onde o Compareceu
// leva o lead, quando a correção devolve a etapa, o que desfazer e qual
// desfecho o balão ainda pode trocar.
import { describe, it, expect } from 'vitest';
import {
  planPromotion,
  stageToRevert,
  planAttendedUndo,
  correctableOutcome,
  correctionText,
  revertStageText,
  consumedFields,
  isAppointmentEcho,
} from '../outcomeCorrection.js';
import { DAILY_GOAL_CATEGORIES, contactOwnerId } from '../leads.js';

// O eco sai com o dono do contato que estava por baixo dele (consumedFields).
const SEM_DONO = { nextFollowUpOwnerId: null, nextFollowUpOwnerName: null };

const VISITA = DAILY_GOAL_CATEGORIES.VISITA_HOJE;
const AULA = DAILY_GOAL_CATEGORIES.AULA_HOJE;
const STATUSES = [
  { funnelId: 'f1', name: 'Novo' },
  { funnelId: 'f1', name: 'Negociação' },
  { funnelId: 'f2', name: 'Contato' },
];
const entrou = new Date(2026, 8, 20, 10);
const LEAD = { id: 'l1', funnelId: 'f1', status: 'Novo', statusEnteredAt: entrou };
const NENHUMA = { toStatus: null, promotedFrom: null };

describe('planPromotion', () => {
  it('Compareceu de visita leva para Negociação e guarda de onde saiu', () => {
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES })).toEqual({
      toStatus: 'Negociação',
      promotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
    });
  });

  it('vale também para aula experimental', () => {
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: AULA, statuses: STATUSES }).toStatus)
      .toBe('Negociação');
  });

  it('não promove quem já está em Negociação, Venda ou Perda', () => {
    for (const status of ['Negociação', 'Venda', 'Perda']) {
      expect(planPromotion({ lead: { ...LEAD, status }, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES }))
        .toEqual(NENHUMA);
    }
  });

  it('não promove Não compareceu, Cancelou, outra categoria, promote desligado ou funil sem Negociação', () => {
    expect(planPromotion({ lead: LEAD, outcome: 'no_show', categorySlug: VISITA, statuses: STATUSES })).toEqual(NENHUMA);
    expect(planPromotion({ lead: LEAD, outcome: 'cancelled', categorySlug: VISITA, statuses: STATUSES })).toEqual(NENHUMA);
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: DAILY_GOAL_CATEGORIES.CONTATO_HOJE, statuses: STATUSES }))
      .toEqual(NENHUMA);
    expect(planPromotion({ lead: LEAD, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES, promote: false }))
      .toEqual(NENHUMA);
    expect(planPromotion({ lead: { ...LEAD, funnelId: 'f2' }, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES }))
      .toEqual(NENHUMA);
  });

  it('lead sem data de entrada na etapa guarda null', () => {
    const { promotedFrom } = planPromotion({
      lead: { id: 'l1', funnelId: 'f1', status: 'Novo' }, outcome: 'attended', categorySlug: VISITA, statuses: STATUSES,
    });
    expect(promotedFrom.statusEnteredAt).toBeNull();
  });
});

const PROMOVIDO = {
  ...LEAD,
  status: 'Negociação',
  appointmentPromotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
};

describe('stageToRevert', () => {
  it('devolve de onde saiu quando o lead continua onde o Compareceu o deixou', () => {
    expect(stageToRevert(PROMOVIDO)).toEqual(PROMOVIDO.appointmentPromotedFrom);
  });

  it('não devolve se alguém moveu o lead depois, se o funil mudou, sem o campo ou sem etapa de origem', () => {
    expect(stageToRevert({ ...PROMOVIDO, status: 'Proposta' })).toBeNull();
    expect(stageToRevert({ ...PROMOVIDO, funnelId: 'f2' })).toBeNull();
    expect(stageToRevert({ ...PROMOVIDO, appointmentPromotedFrom: null })).toBeNull();
    expect(stageToRevert({ ...PROMOVIDO, appointmentPromotedFrom: { ...PROMOVIDO.appointmentPromotedFrom, status: '' } }))
      .toBeNull();
    expect(stageToRevert(null)).toBeNull();
  });
});

describe('planAttendedUndo', () => {
  const agendado = new Date(2026, 8, 29, 18);
  // O Compareceu tirou o eco: o nextFollowUp está vazio, e o tipo do
  // compromisso ficou.
  const lead = { ...PROMOVIDO, appointmentScheduledFor: agendado, nextFollowUp: null, nextFollowUpType: 'Visita' };

  it('Compareceu desfeito: volta a etapa com a data antiga e o próximo contato vira o horário do agendamento', () => {
    expect(planAttendedUndo({ lead, fromOutcome: 'attended' })).toEqual({
      patch: { appointmentPromotedFrom: null, status: 'Novo', statusEnteredAt: entrou, nextFollowUp: agendado },
      revertedTo: 'Novo',
    });
  });

  it('próximo contato já agendado depois do Compareceu fica como está', () => {
    const depois = new Date(2026, 9, 1, 9);
    expect(planAttendedUndo({ lead: { ...lead, nextFollowUp: depois }, fromOutcome: 'attended' }).patch)
      .toEqual({ appointmentPromotedFrom: null, status: 'Novo', statusEnteredAt: entrou });
  });

  it('lead movido depois do Compareceu: a etapa fica, o próximo contato volta', () => {
    expect(planAttendedUndo({ lead: { ...lead, status: 'Proposta' }, fromOutcome: 'attended' })).toEqual({
      patch: { appointmentPromotedFrom: null, nextFollowUp: agendado },
      revertedTo: null,
    });
  });

  // O Compareceu tira o eco do cliente como o de qualquer lead
  // (consumedFields), então o desfazer o devolve. A etapa não volta.
  it('cliente: a etapa fica, e o eco que o Compareceu tirou volta', () => {
    expect(planAttendedUndo({ lead, fromOutcome: 'attended', isClient: true }))
      .toEqual({ patch: { appointmentPromotedFrom: null, nextFollowUp: agendado }, revertedTo: null });
  });

  // O contato do cliente tinha sido concluído de manhã ("Contato feito" apaga
  // o próximo contato e o tipo), e o Compareceu da tarde não tirou nada.
  // Devolver o horário do agendamento criaria um contato que ninguém marcou,
  // e a Meta o cobraria em Contato Hoje.
  it('sem o tipo do compromisso não há eco a devolver', () => {
    const semEco = { ...lead, nextFollowUpType: null };
    expect(planAttendedUndo({ lead: semEco, fromOutcome: 'attended', isClient: true }))
      .toEqual({ patch: { appointmentPromotedFrom: null }, revertedTo: null });
    expect(planAttendedUndo({ lead: semEco, fromOutcome: 'attended' }).patch).not.toHaveProperty('nextFollowUp');
  });

  it('Não compareceu desfeito não mexe no próximo contato', () => {
    expect(planAttendedUndo({ lead: { ...lead, appointmentPromotedFrom: null, status: 'Novo' }, fromOutcome: 'no_show' }))
      .toEqual({ patch: { appointmentPromotedFrom: null }, revertedTo: null });
  });

  it('origem sem data de entrada: volta só a etapa', () => {
    const semData = { ...lead, appointmentPromotedFrom: { ...lead.appointmentPromotedFrom, statusEnteredAt: null } };
    expect(planAttendedUndo({ lead: semData, fromOutcome: 'attended' }).patch)
      .toEqual({ appointmentPromotedFrom: null, status: 'Novo', nextFollowUp: agendado });
  });
});

describe('correctableOutcome', () => {
  const now = new Date(2026, 8, 29, 15);
  const hoje = (h) => new Date(2026, 8, 29, h);
  const base = { appointmentOutcome: 'attended', appointmentOutcomeAt: hoje(14), appointmentScheduledFor: hoje(13) };

  it('Compareceu ou Não compareceu de hoje, com o agendamento de hoje', () => {
    expect(correctableOutcome(base, now)).toBe('attended');
    expect(correctableOutcome({ ...base, appointmentOutcome: 'no_show' }, now)).toBe('no_show');
  });

  it('nada a corrigir: cancelado, sem desfecho, desfecho de ontem ou agendamento em outro dia', () => {
    expect(correctableOutcome({ ...base, appointmentOutcome: 'cancelled' }, now)).toBeNull();
    expect(correctableOutcome({ ...base, appointmentOutcome: null }, now)).toBeNull();
    expect(correctableOutcome({ ...base, appointmentOutcomeAt: new Date(2026, 8, 28, 14) }, now)).toBeNull();
    expect(correctableOutcome({ ...base, appointmentScheduledFor: new Date(2026, 8, 30, 9) }, now)).toBeNull();
    expect(correctableOutcome(null, now)).toBeNull();
  });
});

describe('textos', () => {
  it('a marca de correção diz o desfecho novo, de onde veio e a categoria', () => {
    expect(correctionText({ outcome: 'no_show', sourceLabel: 'Agenda do dia', categoryLabel: 'Visita hoje' }))
      .toBe('↩️ Desfecho corrigido: ❌ Não veio · Agenda do dia (Visita hoje)');
    expect(correctionText({ outcome: 'attended', sourceLabel: 'Meta Diária', categoryLabel: 'Aula hoje' }))
      .toBe('↩️ Desfecho corrigido: ✅ Compareceu · Meta Diária (Aula hoje)');
  });

  it('a volta de etapa diz para onde', () => {
    expect(revertStageText('Novo')).toBe('Fase voltou para [Novo] após correção do desfecho.');
  });
});

// O que o desfecho tira do lead, regra única do card da Meta e da Agenda de
// hoje: o eco do agendamento no próximo contato e, no Cancelou, o agendamento.
// Até 17/10/2026 o cliente era uma exceção que não perdia nada: a aula
// cancelada ficava na agenda e o eco deixava o lead em Atrasados no dia
// seguinte.
describe('consumedFields: o desfecho tira o eco do agendamento', () => {
  const agendado = new Date(2026, 9, 17, 18, 0);
  const comEco = { appointmentType: 'visita', appointmentScheduledFor: agendado, nextFollowUp: agendado, nextFollowUpType: 'Visita' };
  const comContato = { ...comEco, nextFollowUp: new Date(2026, 9, 20, 9, 0), nextFollowUpType: 'Mensagem' };
  const cliente = { ...comEco, lifecycleStage: 'cliente', status: 'Matriculado' };
  const at = new Date(2026, 9, 17, 10, 0);

  it('Compareceu tira o eco e preserva o agendamento', () => {
    expect(consumedFields('attended', comEco)).toEqual({ nextFollowUp: null, ...SEM_DONO });
  });

  // O Cancelou grava também que o lead foi tratado (newLeadHandledAt), porque
  // o agendamento que sai era o sinal disso para a regra do lead novo.
  it('Cancelou tira o eco e o agendamento, e marca o lead como tratado', () => {
    expect(consumedFields('cancelled', comEco, at)).toEqual({ nextFollowUp: null, ...SEM_DONO, appointmentScheduledFor: null, appointmentType: null, newLeadHandledAt: at });
  });

  it('um contato de verdade marcado à parte fica', () => {
    expect(consumedFields('attended', comContato)).toEqual({});
    expect(consumedFields('cancelled', comContato, at)).toEqual({ appointmentScheduledFor: null, appointmentType: null, newLeadHandledAt: at });
  });

  it('cliente segue a mesma regra: a aula cancelada sai e o eco não vira Atrasado', () => {
    expect(consumedFields('cancelled', cliente, at)).toEqual({ nextFollowUp: null, ...SEM_DONO, appointmentScheduledFor: null, appointmentType: null, newLeadHandledAt: at });
    expect(consumedFields('attended', cliente)).toEqual({ nextFollowUp: null, ...SEM_DONO });
  });

  it('Não compareceu e Remarcou não tiram nada', () => {
    expect(consumedFields('no_show', comEco)).toEqual({});
    expect(consumedFields('rescheduled', comEco)).toEqual({});
  });

  // O eco tomou o lugar do contato delegado: o dono daquele contato não vale
  // mais. Sem tirá-lo junto, o "Próximo contato?" depois do desfecho, que
  // grava só a data e o tipo, mandava o contato novo para quem tinha recebido o
  // antigo. É o lead de antes de 18/10/2026, quando agendar a visita ainda não
  // limpava o dono (buildSchedulePatch).
  describe('o eco sai com o dono do contato antigo', () => {
    const daAnaComBruno = { consultantId: 'u-ana', nextFollowUpOwnerId: 'u-bruno', nextFollowUpOwnerName: 'Bruno' };

    it('Compareceu e Cancelou num eco com o dono do Bruno: o próximo contato volta para a Ana', () => {
      const lead = { ...comEco, ...daAnaComBruno };
      for (const outcome of ['attended', 'cancelled']) {
        const depois = { ...lead, ...consumedFields(outcome, lead, at) };
        expect(depois.nextFollowUpOwnerId).toBeNull();
        expect(depois.nextFollowUpOwnerName).toBeNull();
        expect(contactOwnerId(depois)).toBe('u-ana');
      }
    });

    // Limite que já existia antes de 18/10/2026: o isAppointmentEcho trata como
    // eco a mensagem marcada no mesmo minuto da visita, e o desfecho a apaga.
    // O dono dela fica, porque com o tipo Mensagem ela não é eco para a Meta.
    it('mensagem com dono no mesmo minuto da visita: o desfecho a apaga, mas não tira o dono', () => {
      const lead = { ...comEco, nextFollowUp: new Date(agendado), nextFollowUpType: 'Mensagem', ...daAnaComBruno };
      for (const outcome of ['attended', 'cancelled']) {
        const patch = consumedFields(outcome, lead, at);
        expect(patch.nextFollowUp).toBeNull();
        expect(patch).not.toHaveProperty('nextFollowUpOwnerId');
        expect(patch).not.toHaveProperty('nextFollowUpOwnerName');
      }
    });

    it('o contato delegado de verdade, marcado à parte, continua com o Bruno', () => {
      const lead = { ...comContato, ...daAnaComBruno };
      for (const outcome of ['attended', 'cancelled']) {
        const patch = consumedFields(outcome, lead, at);
        expect(patch).not.toHaveProperty('nextFollowUpOwnerId');
        expect(patch).not.toHaveProperty('nextFollowUpOwnerName');
        expect(contactOwnerId({ ...lead, ...patch })).toBe('u-bruno');
      }
    });
  });
});

describe('isAppointmentEcho', () => {
  const agendado = new Date(2026, 9, 17, 18, 0);
  it('o tipo de compromisso no próximo contato é eco', () => {
    expect(isAppointmentEcho({ nextFollowUp: agendado, nextFollowUpType: 'Aula Experimental' })).toBe(true);
  });
  it('sem o tipo, o eco se reconhece pelo mesmo horário do agendamento', () => {
    expect(isAppointmentEcho({ appointmentScheduledFor: agendado, nextFollowUp: new Date(agendado) })).toBe(true);
  });
  it('mensagem ou ligação em outro horário não é eco', () => {
    expect(isAppointmentEcho({ appointmentScheduledFor: agendado, nextFollowUp: new Date(2026, 9, 20, 9, 0), nextFollowUpType: 'Ligação' })).toBe(false);
    expect(isAppointmentEcho({})).toBe(false);
  });
});

// O eco antigo, reconhecido só pelo horário (sem o tipo no próximo contato),
// ganha o tipo do compromisso no Compareceu. É esse tipo que o desfazer lê
// para devolver o eco: sem ele, o eco saía e não voltava.
describe('o eco sem tipo sai no Compareceu e volta no desfazer', () => {
  const agendado = new Date(2026, 9, 17, 18, 0);
  const antigo = { appointmentType: 'visita', appointmentScheduledFor: agendado, nextFollowUp: new Date(agendado), nextFollowUpType: null };

  it('o Compareceu tira o eco e grava o tipo da visita', () => {
    expect(consumedFields('attended', antigo)).toEqual({ nextFollowUp: null, ...SEM_DONO, nextFollowUpType: 'Visita' });
    expect(consumedFields('attended', { ...antigo, appointmentType: 'aula_experimental' }))
      .toEqual({ nextFollowUp: null, ...SEM_DONO, nextFollowUpType: 'Aula Experimental' });
  });

  it('o desfazer devolve o eco', () => {
    const depois = { ...antigo, ...consumedFields('attended', antigo) };
    expect(planAttendedUndo({ lead: depois, fromOutcome: 'attended', isClient: true }).patch).toEqual({
      appointmentPromotedFrom: null, nextFollowUp: agendado,
    });
  });

  it('o eco que já tinha o tipo não muda o tipo', () => {
    expect(consumedFields('attended', { ...antigo, nextFollowUpType: 'Aula Experimental' })).toEqual({ nextFollowUp: null, ...SEM_DONO });
  });
});
