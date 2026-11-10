// A prova do contato de hoje na Meta Diária (Parte B, PR 3). A ponte grava no
// máximo uma linha zap_signal por tipo, por lead e por dia de Brasília. Só a
// linha de uma PESSOA da equipe, de hoje, prova o contato: a IA, a linha do
// lead, a de ontem e a nota digitada na ficha não provam. A prova só mostra:
// não conclui a tarefa nem acende o "Já interagido".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { zapTeamLineToday, ZAP_SIGNAL_TYPE, DAILY_GOAL_CATEGORIES } from '../leads.js';
import { computeDailyGoalSlots, buildInteractionsByLead } from '../dailyGoal.js';

// Segunda-feira, 09/11/2026, em horário local.
const at = (h, m = 0, dias = 0) => new Date(2026, 10, 9 + dias, h, m);
const HOJE = at(0, 0);
const sinal = (signal, createdAt, extra = {}) => ({
  id: `s-${signal}-${createdAt.getTime()}`, leadId: 'l1', type: ZAP_SIGNAL_TYPE, signal, via: 'stronizap', createdAt, ...extra,
});
const PESSOA = sinal('pessoa_enviou', at(14, 40), {
  answering: true, actorId: 'u1', actorAuthUid: 'auth-u1', consultantName: 'Ana Souza', text: 'Resposta de Ana Souza.',
});

describe('zapTeamLineToday', () => {
  it('a linha de uma pessoa da equipe de hoje é a prova', () => {
    expect(zapTeamLineToday([PESSOA], HOJE)).toBe(PESSOA);
  });

  it('a mensagem enviada pelo celular da academia, sem autor, também prova', () => {
    const semAutor = sinal('pessoa_enviou', at(9, 5), { answering: false, actorId: null, actorAuthUid: null, consultantName: null });
    expect(zapTeamLineToday([semAutor], HOJE)).toBe(semAutor);
  });

  it.each([
    ['a IA', sinal('ia_enviou', at(14, 33), { answering: true, byAi: true })],
    ['o lead', sinal('lead_escreveu', at(14, 32), { answering: false, text: 'Lead escreveu: “oi”' })],
    ['pessoa ontem às 23:59', sinal('pessoa_enviou', at(23, 59, -1), { answering: true, actorId: 'u1' })],
    ['pessoa amanhã à meia-noite', sinal('pessoa_enviou', at(0, 0, 1), { answering: true, actorId: 'u1' })],
    ['linha marcada como IA com signal de pessoa', sinal('pessoa_enviou', at(10), { byAi: true })],
    ['nota de WhatsApp digitada na ficha', { id: 'n1', leadId: 'l1', type: 'note', text: '📲 Mensagem WhatsApp enviada: oi', createdAt: at(10) }],
    ['marca da Meta', { id: 'm1', leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', createdAt: at(10) }],
    ['linha sem data', sinal('pessoa_enviou', at(10), { createdAt: null })],
    ['linha com data inválida', sinal('pessoa_enviou', at(10), { createdAt: new Date('x') })],
  ])('não prova: %s', (_, linha) => {
    expect(zapTeamLineToday([linha], HOJE)).toBeNull();
  });

  it('com duas linhas da equipe no dia local, vale a mais nova, em qualquer ordem', () => {
    const cedo = sinal('pessoa_enviou', at(0, 30), { answering: false, actorId: 'u2', consultantName: 'Bruno' });
    expect(zapTeamLineToday([cedo, PESSOA], HOJE)).toBe(PESSOA);
    expect(zapTeamLineToday([PESSOA, cedo], HOJE)).toBe(PESSOA);
  });

  it('sem lista ou sem o início do dia, null', () => {
    expect(zapTeamLineToday(undefined, HOJE)).toBeNull();
    expect(zapTeamLineToday([PESSOA], null)).toBeNull();
  });
});

describe('computeDailyGoalSlots: zapProofToday', () => {
  const NOW = at(15, 0);
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  // Contato de hoje às 16h, de um lead antigo: só a categoria Contato.
  const CONTATO = {
    id: 'l1', name: 'Carla Souza', status: 'Contato', consultantId: 'u1',
    createdAt: new Date(2026, 9, 1), nextFollowUp: at(16), nextFollowUpType: 'Mensagem',
  };
  const processar = (interactions) =>
    computeDailyGoalSlots([CONTATO], buildInteractionsByLead(interactions), 'u1', [90, 60, 30], 15, NOW)[0];

  it('sem linha do Stronizap, o campo é null e o resto não muda (quem não usa o Stronizap)', () => {
    const l = processar([]);
    expect(l.categorySlugs).toEqual([DAILY_GOAL_CATEGORIES.CONTATO_HOJE]);
    expect(l.zapProofToday).toBeNull();
    expect(l.categoryStatus[DAILY_GOAL_CATEGORIES.CONTATO_HOJE]).toBe(false);
    expect(l.hasOtherActivityToday).toBe(false);
  });

  it('a linha da equipe vira prova, sem concluir a tarefa nem acender "Já interagido"', () => {
    const l = processar([PESSOA]);
    expect(l.zapProofToday).toBe(PESSOA);
    expect(l.categoryStatus[DAILY_GOAL_CATEGORIES.CONTATO_HOJE]).toBe(false);
    expect(l.hasOtherActivityToday).toBe(false);
  });

  it('a linha só da IA, só do lead ou de ontem não é prova', () => {
    expect(processar([sinal('ia_enviou', at(14), { answering: true, byAi: true })]).zapProofToday).toBeNull();
    expect(processar([sinal('lead_escreveu', at(14), { answering: false, text: 'Lead escreveu.' })]).zapProofToday).toBeNull();
    expect(processar([sinal('pessoa_enviou', at(18, 0, -1), { answering: true, actorId: 'u1' })]).zapProofToday).toBeNull();
  });
});
