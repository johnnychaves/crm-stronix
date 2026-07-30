// Testes da AGENDA DO DIA (dayAgenda.js). Todas as funções recebem `now` por
// parâmetro, então não há relógio falso aqui. Datas sempre em horário LOCAL,
// como o app faz.

import { describe, it, expect } from 'vitest';
import { computeDayAgenda } from '../dayAgenda.js';

const NOW = new Date(2026, 6, 30, 18, 52); // qui 30/07/2026 18:52 local
const at = (h, m = 0) => new Date(2026, 6, 30, h, m);

const users = new Map([
  ['u1', { name: 'Rafael' }],
  ['u2', { name: 'Carla' }],
  ['auth-u2', { name: 'Carla' }],
]);

const lead = (over = {}) => ({
  id: 'l1',
  name: 'Bruno Salgado',
  consultantId: 'u1',
  status: 'Novo',
  appointmentType: 'aula_experimental',
  appointmentScheduledFor: at(19),
  ...over,
});

describe('computeDayAgenda — união das fontes e recorte do dia', () => {
  it('une as duas fontes e desduplica por id, a fonte viva vencendo', () => {
    const vivo = lead({ id: 'l1', name: 'Bruno (vivo)' });
    const consulta = lead({ id: 'l1', name: 'Bruno (consulta)' });
    const soConsulta = lead({ id: 'l2', name: 'Thiago', consultantId: 'u2' });

    const { rows } = computeDayAgenda({
      liveLeads: [vivo],
      agendaLeads: [consulta, soConsulta],
      usersById: users,
      viewerId: 'u2',
      now: NOW,
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === 'l1').name).toBe('Bruno (vivo)');
  });

  it('mantém só visita e aula experimental', () => {
    const msg = lead({ id: 'l3', appointmentType: null, nextFollowUpType: 'Mensagem', nextFollowUp: at(19) });
    const visita = lead({ id: 'l4', appointmentType: 'visita' });

    const { rows } = computeDayAgenda({
      liveLeads: [msg, visita], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual(['l4']);
  });

  it('registro antigo só com nextFollowUp entra pelo fallback', () => {
    const legado = lead({ id: 'l5', appointmentType: null, appointmentScheduledFor: null, nextFollowUpType: 'Aula experimental', nextFollowUp: at(15) });

    const { rows } = computeDayAgenda({
      liveLeads: [legado], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].categorySlug).toBe('aula_hoje');
  });

  it('ontem e amanhã ficam de fora', () => {
    const ontem = lead({ id: 'l6', appointmentScheduledFor: new Date(2026, 6, 29, 19, 0) });
    const amanha = lead({ id: 'l7', appointmentScheduledFor: new Date(2026, 6, 31, 19, 0) });

    const { rows } = computeDayAgenda({
      liveLeads: [ontem, amanha], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows).toHaveLength(0);
  });

  it('ordena por horário crescente', () => {
    const tarde = lead({ id: 'l8', appointmentScheduledFor: at(20) });
    const cedo = lead({ id: 'l9', appointmentScheduledFor: at(14, 30) });

    const { rows } = computeDayAgenda({
      liveLeads: [tarde, cedo], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual(['l9', 'l8']);
  });
});

describe('computeDayAgenda — cliente, perda e desfecho', () => {
  it('cliente matriculado entra e vem marcado', () => {
    const cliente = lead({ id: 'c1', name: 'Thiago Melo', status: 'Venda', lifecycleStage: 'cliente' });

    const { rows } = computeDayAgenda({
      liveLeads: [], agendaLeads: [cliente], usersById: users, viewerId: 'u2', now: NOW,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].isClient).toBe(true);
  });

  it('lead perdido fica de fora', () => {
    const perdido = lead({ id: 'p1', status: 'Perda' });

    const { rows } = computeDayAgenda({
      liveLeads: [perdido], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows).toHaveLength(0);
  });

  it('desfecho de HOJE marca a linha como resolvida e nomeia quem registrou', () => {
    const veio = lead({
      id: 'd1',
      appointmentOutcome: 'attended',
      appointmentOutcomeAt: at(19, 12),
      appointmentOutcomeBy: 'auth-u2',
    });

    const { rows, pending } = computeDayAgenda({
      liveLeads: [veio], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows[0].outcome).toBe('attended');
    expect(rows[0].outcomeByName).toBe('Carla');
    expect(pending).toBe(0);
  });

  it('desfecho de OUTRO dia não resolve a linha de hoje (caso da remarcação)', () => {
    // Veio numa aula da semana passada; o agendamento foi remarcado para hoje e o
    // wizard não limpa appointmentOutcome. A linha de hoje tem que estar PENDENTE.
    const remarcado = lead({
      id: 'd2',
      appointmentOutcome: 'attended',
      appointmentOutcomeAt: new Date(2026, 6, 23, 19, 10),
    });

    const { rows, pending } = computeDayAgenda({
      liveLeads: [remarcado], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows[0].outcome).toBeNull();
    expect(rows[0].outcomeByName).toBeNull();
    expect(pending).toBe(1);
  });

  it('isMine marca só as linhas do viewer, e o dono é nomeado pelo índice', () => {
    const meu = lead({ id: 'm1', consultantId: 'u2' });
    const dele = lead({ id: 'm2', consultantId: 'u1' });

    const { rows } = computeDayAgenda({
      liveLeads: [meu, dele], agendaLeads: [], usersById: users, viewerId: 'u2', now: NOW,
    });

    expect(rows.find((r) => r.id === 'm1').isMine).toBe(true);
    expect(rows.find((r) => r.id === 'm2').isMine).toBe(false);
    expect(rows.find((r) => r.id === 'm2').ownerName).toBe('Rafael');
  });

  it('lead sem consultor não quebra e recebe rótulo neutro', () => {
    const orfao = lead({ id: 'o1', consultantId: null });

    const { rows } = computeDayAgenda({
      liveLeads: [orfao], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });

    expect(rows[0].ownerName).toBe('sem consultor');
    expect(rows[0].isMine).toBe(false);
  });

  it('nextIndex aponta a primeira linha a partir de agora, e -1 se o dia acabou', () => {
    const passou = lead({ id: 'n1', appointmentScheduledFor: at(14, 30) });
    const vem = lead({ id: 'n2', appointmentScheduledFor: at(19) });

    const agora = computeDayAgenda({
      liveLeads: [passou, vem], agendaLeads: [], usersById: users, viewerId: 'u1', now: NOW,
    });
    expect(agora.rows[agora.nextIndex].id).toBe('n2');

    const fimDoDia = computeDayAgenda({
      liveLeads: [passou, vem], agendaLeads: [], usersById: users, viewerId: 'u1', now: at(22),
    });
    expect(fimDoDia.nextIndex).toBe(-1);
  });
});
