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
} from '../outcomeCorrection.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';

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
  const lead = { ...PROMOVIDO, appointmentScheduledFor: agendado, nextFollowUp: null };

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

  it('cliente: nada de etapa nem de próximo contato', () => {
    expect(planAttendedUndo({ lead, fromOutcome: 'attended', isClient: true }))
      .toEqual({ patch: { appointmentPromotedFrom: null }, revertedTo: null });
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
