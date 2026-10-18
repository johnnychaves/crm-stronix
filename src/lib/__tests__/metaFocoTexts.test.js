// Os textos da tela nova da Meta (Foco agora): o motivo de cada tarefa, os
// fatos do bloco Agora e a barra "Foco em". O cenário é o do mockup B: sexta,
// 16/10/2026, 14:32.
import { describe, it, expect } from 'vitest';
import { durationText, whyOf, factsOf, focoTabs, focoRules, morningText, FOCO_LABEL } from '../metaFocoTexts.js';
import { taskKey } from '../metaFoco.js';
import { DAILY_GOAL_CATEGORIES as C } from '../leads.js';
import { overdueDaysOf } from '../dailyGoal.js';

const NOW = new Date(2026, 9, 16, 14, 32);
const at = (h, m = 0, dias = 0) => new Date(2026, 9, 16 + dias, h, m);
const entry = (lead, slug) => ({ key: taskKey(lead, slug), slug, lead });

describe('durationText', () => {
  it('minutos, horas e horas com minutos', () => {
    expect(durationText(40 * 60000)).toBe('40 min');
    expect(durationText(-28 * 60000)).toBe('28 min');
    expect(durationText(90 * 60000)).toBe('1h30');
    expect(durationText(120 * 60000)).toBe('2h');
  });
});

describe('whyOf', () => {
  it('visita e aula: passou é vermelho, até 90 minutos é azul e depois é calmo', () => {
    expect(whyOf(entry({ id: 'a', appointmentType: 'aula_experimental', appointmentScheduledFor: at(13, 30) }, C.AULA_HOJE), NOW)).toEqual({ text: 'Passou há 1h02', tone: 'late' });
    expect(whyOf(entry({ id: 'v', appointmentType: 'visita', appointmentScheduledFor: at(15, 0) }, C.VISITA_HOJE), NOW)).toEqual({ text: 'Em 28 min', tone: 'now' });
    expect(whyOf(entry({ id: 'v2', appointmentType: 'visita', appointmentScheduledFor: at(18, 30) }, C.VISITA_HOJE), NOW)).toEqual({ text: 'Em 3h58', tone: 'calm' });
  });

  it('contato diz o canal, e o horário que passou é vermelho', () => {
    expect(whyOf(entry({ id: 'c', nextFollowUp: at(15, 30), nextFollowUpType: 'Ligação' }, C.CONTATO_HOJE), NOW)).toEqual({ text: 'Ligação em 58 min', tone: 'now' });
    expect(whyOf(entry({ id: 'c2', nextFollowUp: at(9, 0), nextFollowUpType: 'Mensagem' }, C.CONTATO_HOJE), NOW)).toEqual({ text: 'Mensagem era às 09:00', tone: 'late' });
  });

  it('lead novo diz quando a janela fecha', () => {
    expect(whyOf(entry({ id: 'n', createdAt: at(15, 20, -1) }, C.NOVO_24H), NOW)).toEqual({ text: 'Fecha em 48 min', tone: 'now' });
    expect(whyOf(entry({ id: 'n2', createdAt: at(21, 10, -1) }, C.NOVO_24H), NOW)).toEqual({ text: 'Fecha às 21:10', tone: 'calm' });
  });

  it('atrasado é âmbar até o prazo da academia, e dali em diante é vermelho e diz crítico', () => {
    expect(whyOf(entry({ id: 'x', nextFollowUp: at(9, 0, -1) }, C.ATRASADO), NOW, { sla: 3 })).toEqual({ text: '1 dia de atraso', tone: 'warn' });
    // O crítico vai escrito, para não depender só da cor.
    expect(whyOf(entry({ id: 'y', nextFollowUp: at(9, 0, -5) }, C.ATRASADO), NOW, { sla: 3 })).toEqual({ text: '5 dias de atraso, crítico', tone: 'late' });
  });

  it('o lead novo que segue sem próximo passo continua dizendo isso depois do primeiro dia', () => {
    const agora = new Date(2026, 9, 24, 10, 0);
    const novo = { id: 'n3', createdAt: new Date(2026, 9, 19, 8, 0) };
    const dias = overdueDaysOf(novo, agora);
    expect(dias).toBeGreaterThan(0);
    expect(whyOf(entry(novo, C.ATRASADO), agora, { sla: 30 })).toEqual({ text: `${dias} dias sem próximo passo`, tone: 'warn' });
    expect(factsOf(entry(novo, C.ATRASADO), agora)).toContainEqual(['Próximo passo', 'Nenhum desde o cadastro']);
  });

  it('o lead novo que acabou de virar Atrasado diz que está sem próximo passo', () => {
    const agora = new Date(2026, 9, 20, 10, 0);
    expect(whyOf(entry({ id: 'z', createdAt: new Date(2026, 9, 19, 8, 0) }, C.ATRASADO), agora)).toEqual({ text: 'Sem próximo passo', tone: 'warn' });
  });

  it('renovação e vencido', () => {
    expect(whyOf(entry({ id: 'r', currentContractEndsAt: at(14, 32, 30) }, C.RENOVACAO), NOW)).toEqual({ text: 'Vence em 30 dias', tone: 'calm' });
    expect(whyOf(entry({ id: 'v', currentContractEndsAt: at(0, 0, -21) }, C.VENCIDO), NOW)).toEqual({ text: 'Venceu há 21 dias', tone: 'calm' });
  });
});

describe('factsOf', () => {
  it('a aula leva a modalidade, o professor e o horário, com a origem e o interesse', () => {
    const aula = { id: 'a', appointmentType: 'aula_experimental', appointmentScheduledFor: at(16, 30), appointmentModality: 'Funcional', appointmentProfessorName: 'Carol', trialClassesPlanned: 2, source: 'Google', dor: 'Condicionamento' };
    expect(factsOf(entry(aula, C.AULA_HOJE), NOW)).toEqual([
      ['Aula', 'Funcional com Carol, 2 aulas'],
      ['Horário', 'hoje às 16:30'],
      ['Origem', 'Google'],
      ['Interesse', 'Condicionamento'],
    ]);
  });

  it('a renovação mostra o plano e o marco, e cliente não leva a origem', () => {
    const cliente = { id: 'r', currentPlanName: 'Anual Musculação', currentContractEndsAt: at(14, 32, 88), source: 'Instagram' };
    expect(factsOf(entry(cliente, C.RENOVACAO), NOW, { renewalCheckpoints: [90, 60, 30] })).toEqual([
      ['Plano', 'Anual Musculação'],
      ['Vence', 'em 88 dias, marco de 90'],
    ]);
  });

  it('a renovação que vence hoje diz hoje nos fatos, como no motivo', () => {
    const cliente = { id: 'r2', currentPlanName: 'Mensal', currentContractEndsAt: at(14, 0) };
    expect(whyOf(entry(cliente, C.RENOVACAO), NOW).text).toBe('Vence hoje');
    expect(factsOf(entry(cliente, C.RENOVACAO), NOW, { renewalCheckpoints: [90, 60, 30] })).toContainEqual(['Vence', 'hoje, marco de 30']);
  });

  it('nunca passa de quatro', () => {
    const visita = { id: 'v', appointmentType: 'visita', appointmentScheduledFor: at(15, 0), appointmentUnit: 'Moinhos', source: 'Site', dor: 'Ganho de massa' };
    expect(factsOf(entry(visita, C.VISITA_HOJE), NOW)).toHaveLength(4);
  });
});

describe('focoTabs', () => {
  it('conta as pendentes de cada foco e acende o ponto da primeira da fila', () => {
    const pendentes = [
      entry({ id: 'a', appointmentType: 'aula_experimental', appointmentScheduledFor: at(13, 30) }, C.AULA_HOJE),
      entry({ id: 'c', nextFollowUp: at(17, 30), nextFollowUpType: 'Mensagem' }, C.CONTATO_HOJE),
      entry({ id: 'x', nextFollowUp: at(9, 0, -2) }, C.ATRASADO),
    ];
    const tabs = focoTabs(pendentes, NOW, { sla: 3 });
    expect(tabs.map((t) => t.label)).toEqual(['Todos', 'Visitas e aulas', 'Contatos', 'Novos leads', 'Atrasados', 'Renovações', 'Vencidos']);
    expect(tabs.map((t) => t.pending)).toEqual([3, 1, 1, 0, 1, 0, 0]);
    expect(tabs[1]).toMatchObject({ dot: 'late', why: 'Passou há 1h02' });
    expect(tabs[2]).toMatchObject({ dot: null, why: 'Mensagem em 2h58' });
    expect(tabs[0].dot).toBeNull();
  });

  it('a linha da manhã conta as tarefas e as que têm horário', () => {
    const pendentes = [
      entry({ id: 'a', appointmentType: 'aula_experimental', appointmentScheduledFor: at(16, 30) }, C.AULA_HOJE),
      entry({ id: 'c', nextFollowUp: at(17, 30) }, C.CONTATO_HOJE),
      entry({ id: 'x', nextFollowUp: at(9, 0, -2) }, C.ATRASADO),
    ];
    expect(morningText(pendentes)).toBe('Você começa o dia com 3 tarefas, 2 com horário.');
    expect(morningText(pendentes.slice(2))).toBe('Você começa o dia com 1 tarefa.');
    expect(morningText([])).toBe('');
  });

  it('as regras dizem o prazo da academia', () => {
    expect(focoRules(5)[2]).toBe('Atrasados críticos, a partir de 5 dias');
    expect(FOCO_LABEL.all).toBe('Todos');
  });
});
