import { describe, it, expect } from 'vitest';
import { upNextOf } from '../upNext.js';
import { computeDailyGoalSlots, isMetaOverdue } from '../dailyGoal.js';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';
import { contactDone } from '../contactGoal.js';
import { consumedFields } from '../outcomeCorrection.js';

const D = (m, d, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi);
const AGORA = D(10, 16, 10, 20);

describe('upNextOf', () => {
  it('lead sem nada marcado não tem a seguir', () => {
    expect(upNextOf({ id: 'l1' }, AGORA)).toEqual([]);
    expect(upNextOf(null, AGORA)).toEqual([]);
  });

  it('visita marcada mostra a unidade e a anotação', () => {
    const lead = {
      appointmentType: 'visita', appointmentScheduledFor: D(10, 21, 19), appointmentUnit: 'Centro',
      nextFollowUp: D(10, 21, 19), nextFollowUpType: 'Visita', nextFollowUpNote: 'Trazer documento'
    };
    const [item] = upNextOf(lead, AGORA);
    expect(item).toMatchObject({ id: 'appointment', type: 'visita', kind: 'visit', title: 'Visita', overdue: false, canOutcome: true });
    expect(item.detail).toBe('Unidade Centro · Trazer documento');
    expect(item.when).toEqual(D(10, 21, 19));
  });

  it('aula experimental mostra modalidade, professor e quantidade', () => {
    const lead = {
      appointmentType: 'aula_experimental', appointmentScheduledFor: D(10, 20, 18),
      appointmentModality: 'Musculação', appointmentProfessorName: 'Marcos Vieira', trialClassesPlanned: 2,
      nextFollowUp: D(10, 20, 18), nextFollowUpType: 'Aula Experimental'
    };
    const [item] = upNextOf(lead, AGORA);
    expect(item).toMatchObject({ kind: 'class', title: 'Aula experimental' });
    expect(item.detail).toBe('Musculação · Marcos Vieira · 2 aulas');
  });

  it('aula sem professor que treina sozinho diz isso, e uma aula só vai no singular', () => {
    const lead = {
      appointmentType: 'aula_experimental', appointmentScheduledFor: D(10, 20, 18),
      appointmentModality: 'Pilates', appointmentSoloTraining: true, trialClassesPlanned: 1
    };
    expect(upNextOf(lead, AGORA)[0].detail).toBe('Pilates · Treina sozinho · 1 aula');
  });

  it('a visita agendada por outro consultor diz de quem é a tarefa', () => {
    const lead = {
      appointmentType: 'visita', appointmentScheduledFor: D(10, 21, 19), appointmentOwnerName: 'Bianca Torres'
    };
    expect(upNextOf(lead, AGORA)[0].detail).toBe('Tarefa de Bianca Torres');
  });

  it('compromisso com desfecho já marcado não é a seguir', () => {
    const lead = { appointmentType: 'visita', appointmentScheduledFor: D(10, 14, 19), appointmentOutcome: 'attended' };
    expect(upNextOf(lead, AGORA)).toEqual([]);
    expect(upNextOf({ ...lead, appointmentOutcome: 'no_show' }, AGORA)).toEqual([]);
  });

  it('tipo de compromisso sem data não é a seguir', () => {
    expect(upNextOf({ appointmentType: 'visita' }, AGORA)).toEqual([]);
  });

  it('compromisso que já passou sem desfecho continua a seguir enquanto é o eco do próximo contato, marcado como atrasado', () => {
    const lead = { appointmentType: 'visita', appointmentScheduledFor: D(10, 15, 19), appointmentUnit: 'Moinhos', nextFollowUp: D(10, 15, 19), nextFollowUpType: 'Visita' };
    expect(upNextOf(lead, AGORA)[0].overdue).toBe(true);
    // Sem o eco (o "Contato feito" o tirou), a Meta não cobra mais, e ele sai.
    expect(upNextOf({ ...lead, nextFollowUp: null, nextFollowUpType: null }, AGORA)).toEqual([]);
  });

  it('ligação marcada é o próximo contato, com o responsável da tarefa', () => {
    const lead = {
      nextFollowUp: D(10, 19, 18, 30), nextFollowUpType: 'Ligação', nextFollowUpNote: 'Fechar o plano',
      nextFollowUpOwnerName: 'Bianca Torres'
    };
    const [item] = upNextOf(lead, AGORA);
    expect(item).toMatchObject({ id: 'contact', type: 'ligacao', kind: 'call', title: 'Ligação', canOutcome: false, overdue: false });
    expect(item.detail).toBe('Tarefa de Bianca Torres · Fechar o plano');
  });

  it('tipo de contato que não é ligação vira mensagem', () => {
    const [item] = upNextOf({ nextFollowUp: D(10, 19, 9), nextFollowUpType: 'Próximo contato' }, AGORA);
    expect(item).toMatchObject({ type: 'mensagem', kind: 'msg', title: 'Mensagem' });
  });

  it('visita e ligação juntas saem em ordem de data, e a anotação da ligação não vai para a visita', () => {
    const lead = {
      appointmentType: 'visita', appointmentScheduledFor: D(10, 24, 19), appointmentUnit: 'Centro',
      nextFollowUp: D(10, 19, 18), nextFollowUpType: 'Ligação', nextFollowUpNote: 'Confirmar a visita'
    };
    const itens = upNextOf(lead, AGORA);
    expect(itens.map((i) => i.id)).toEqual(['contact', 'appointment']);
    expect(itens[1].detail).toBe('Unidade Centro');
    expect(itens[0].detail).toBe('Confirmar a visita');
  });

  it('o próximo contato que é a própria visita não vira um segundo item', () => {
    const lead = {
      appointmentType: 'visita', appointmentScheduledFor: D(10, 21, 19),
      nextFollowUp: D(10, 21, 19), nextFollowUpType: 'Visita'
    };
    expect(upNextOf(lead, AGORA)).toHaveLength(1);
  });

  it('aceita data no formato de Timestamp do Firestore', () => {
    const lead = { nextFollowUp: { toDate: () => D(10, 19, 9) }, nextFollowUpType: 'Mensagem' };
    expect(upNextOf(lead, AGORA)[0].when).toEqual(D(10, 19, 9));
  });

  it('lead antigo, só com o tipo de contato "Visita", ainda mostra a visita (a mesma leitura da Meta)', () => {
    const lead = { nextFollowUp: D(10, 21, 19), nextFollowUpType: 'Visita', nextFollowUpNote: 'Trazer documento' };
    const itens = upNextOf(lead, AGORA);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ id: 'appointment', type: 'visita', title: 'Visita' });
    expect(itens[0].when).toEqual(D(10, 21, 19));
  });

  it('lead perdido não tem a seguir, mesmo com o agendamento gravado', () => {
    const lead = {
      status: 'Perda', appointmentType: 'visita', appointmentScheduledFor: D(10, 15, 19),
      nextFollowUp: D(10, 19, 9), nextFollowUpType: 'Ligação'
    };
    expect(upNextOf(lead, AGORA)).toEqual([]);
  });

  it('cliente não mostra visita vencida, mas mantém o contato de renovação', () => {
    const lead = {
      status: 'Venda', lifecycleStage: 'cliente', appointmentType: 'visita', appointmentScheduledFor: D(10, 15, 19),
      nextFollowUp: D(10, 19, 9), nextFollowUpType: 'Ligação'
    };
    expect(upNextOf(lead, AGORA).map((i) => i.id)).toEqual(['contact']);
  });

  it('cliente mostra a aula marcada de hoje em diante, como a Agenda de hoje', () => {
    const base = { status: 'Venda', lifecycleStage: 'cliente', appointmentType: 'aula_experimental', appointmentModality: 'Pilates' };
    expect(upNextOf({ ...base, appointmentScheduledFor: D(10, 17, 18) }, AGORA).map((i) => i.id)).toEqual(['appointment']);
    // Hoje mais cedo, sem desfecho: ainda é do dia, então aparece como atrasado.
    const [hoje] = upNextOf({ ...base, appointmentScheduledFor: D(10, 16, 7) }, AGORA);
    expect(hoje).toMatchObject({ id: 'appointment', overdue: true });
  });

  it('cliente matriculado por etapa customizada conta como cliente', () => {
    const lead = { status: 'Matriculado', appointmentType: 'visita', appointmentScheduledFor: D(10, 15, 19) };
    expect(upNextOf(lead, AGORA)).toEqual([]);
  });

  it('contato que já passou leva atrasado', () => {
    const [item] = upNextOf({ nextFollowUp: D(10, 15, 18), nextFollowUpType: 'Ligação' }, AGORA);
    expect(item).toMatchObject({ id: 'contact', overdue: true });
  });
});

// O "A seguir" concorda com a Meta Diária: o que a Meta cobra aparece, e o que
// ela deixou de cobrar sai (revisão do PR 3, 18/10/2026).
describe('upNextOf contra a Meta', () => {
  const base = { id: 'l1', status: 'Novo', consultantId: 'u1', createdAt: D(10, 1), lifecycleStage: 'lead' };
  const meta = (lead) => computeDailyGoalSlots([lead], new Map(), 'u1', undefined, undefined, AGORA).flatMap((s) => s.categorySlugs);

  it('visita perdida concluída pelo "Contato feito" sai da Meta e do a seguir', () => {
    const lead = {
      ...base, appointmentType: 'visita', appointmentScheduledFor: D(10, 10, 19),
      nextFollowUp: D(10, 10, 19), nextFollowUpType: 'Visita', ...contactDone(D(10, 11, 9)),
    };
    expect(meta(lead)).toEqual([]);
    expect(isMetaOverdue(lead, AGORA)).toBe(false);
    expect(upNextOf(lead, AGORA)).toEqual([]);
  });

  it('visita perdida que ainda é o eco do próximo contato aparece atrasada, como na Meta', () => {
    const lead = {
      ...base, appointmentType: 'visita', appointmentScheduledFor: D(10, 10, 19),
      nextFollowUp: D(10, 10, 19), nextFollowUpType: 'Visita',
    };
    expect(meta(lead)).toEqual([DAILY_GOAL_CATEGORIES.ATRASADO]);
    expect(upNextOf(lead, AGORA)).toMatchObject([{ id: 'appointment', overdue: true }]);
  });

  it('visita passada depois de um contato reagendado sai; o contato fica', () => {
    const lead = {
      ...base, appointmentType: 'visita', appointmentScheduledFor: D(10, 10, 19),
      nextFollowUp: D(10, 17, 9), nextFollowUpType: 'Mensagem',
    };
    expect(upNextOf(lead, AGORA).map((i) => i.id)).toEqual(['contact']);
  });

  it('"Não veio" sem remarcar: a Meta cobra o contato atrasado, e o a seguir também', () => {
    const lead = {
      ...base, appointmentType: 'visita', appointmentScheduledFor: D(10, 15, 19),
      nextFollowUp: D(10, 15, 19), nextFollowUpType: 'Visita', appointmentOutcome: 'no_show', ...consumedFields('no_show', {}),
    };
    expect(meta(lead)).toEqual([DAILY_GOAL_CATEGORIES.ATRASADO]);
    expect(isMetaOverdue(lead, AGORA)).toBe(true);
    const itens = upNextOf(lead, AGORA);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ id: 'contact', overdue: true, canOutcome: false, detail: 'Não veio à visita' });
    expect(itens[0].when).toEqual(D(10, 15, 19));
  });

  it('"Não veio" hoje ainda não é atraso, nem na Meta nem no a seguir', () => {
    const lead = {
      ...base, appointmentType: 'aula_experimental', appointmentScheduledFor: D(10, 16, 7),
      nextFollowUp: D(10, 16, 7), nextFollowUpType: 'Aula Experimental', appointmentOutcome: 'no_show',
    };
    expect(isMetaOverdue(lead, AGORA)).toBe(false);
    expect(upNextOf(lead, AGORA)).toEqual([]);
  });

  it('cliente com o eco de uma aula passada fica fora, como na Meta', () => {
    const lead = {
      ...base, status: 'Venda', lifecycleStage: 'cliente', appointmentType: 'aula_experimental',
      appointmentScheduledFor: D(10, 14, 18), nextFollowUp: D(10, 14, 18), nextFollowUpType: 'Aula Experimental', appointmentOutcome: 'no_show',
    };
    expect(isMetaOverdue(lead, AGORA)).toBe(false);
    expect(upNextOf(lead, AGORA)).toEqual([]);
  });
});
