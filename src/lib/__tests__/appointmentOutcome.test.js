// Gravação do desfecho e da correção, sem Firebase de verdade: o SDK, o
// firebase.js, o logInteraction e o histórico de aulas são falsos e anotam o
// que receberam.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ updates: [], adds: [], logs: [], aula: [] }));

vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter' }));
vi.mock('firebase/firestore', () => ({
  doc: (...p) => ({ path: p.slice(1).join('/') }),
  collection: (...p) => ({ path: p.slice(1).join('/') }),
  updateDoc: async (ref, data) => { m.updates.push({ path: ref.path, data }); },
  addDoc: async (ref, data) => { m.adds.push({ path: ref.path, data }); return { id: 'novo' }; },
  serverTimestamp: () => 'TS',
}));
vi.mock('../interactions.js', () => ({
  logInteraction: async (_db, lead, _user, payload, patch = null) => {
    m.logs.push({ leadId: lead.id, payload, patch });
    return 'i1';
  },
}));
vi.mock('../aulasWrites.js', () => ({
  applyOutcomeToAula: async ({ outcome }) => { m.aula.push(['apply', outcome]); },
  clearAulaOutcome: async () => { m.aula.push(['clear']); },
}));

const { writeAppointmentOutcome, correctAppointmentOutcome } = await import('../appointmentOutcome.js');
const { DAILY_GOAL_CATEGORIES } = await import('../leads.js');

const VISITA = DAILY_GOAL_CATEGORIES.VISITA_HOJE;
const AULA = DAILY_GOAL_CATEGORIES.AULA_HOJE;
const USER = { id: 'u1', authUid: 'auth1', name: 'Lucas' };
const STATUSES = [{ funnelId: 'f1', name: 'Novo' }, { funnelId: 'f1', name: 'Negociação' }];
const entrou = new Date(2026, 8, 20, 10);
const agendado = new Date(2026, 8, 29, 18);
const NOVO = {
  id: 'l1', name: 'Ana', funnelId: 'f1', status: 'Novo', statusEnteredAt: entrou,
  consultantId: 'c1', consultantAuthUid: 'a1', appointmentScheduledFor: agendado, nextFollowUp: agendado,
};
const PROMOVIDO = {
  ...NOVO,
  status: 'Negociação',
  nextFollowUp: null,
  appointmentOutcome: 'attended',
  appointmentPromotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
};

beforeEach(() => { m.updates.length = 0; m.adds.length = 0; m.logs.length = 0; m.aula.length = 0; });

describe('writeAppointmentOutcome', () => {
  it('Compareceu promove e guarda de onde o lead saiu', async () => {
    await writeAppointmentOutcome({ db: {}, lead: NOVO, outcome: 'attended', categorySlug: VISITA, appUser: USER, statuses: STATUSES });
    expect(m.updates[0].data).toMatchObject({
      appointmentOutcome: 'attended',
      status: 'Negociação',
      appointmentPromotedFrom: { status: 'Novo', statusEnteredAt: entrou, funnelId: 'f1', toStatus: 'Negociação' },
      nextFollowUp: null,
    });
    const tipos = m.adds.map((a) => a.data.type);
    expect(tipos).toEqual(['daily_goal_done', 'status_change']);
    expect(m.adds[0].data.outcomeCorrection).toBeUndefined();
  });

  it('desfecho sem promoção grava appointmentPromotedFrom null', async () => {
    await writeAppointmentOutcome({ db: {}, lead: NOVO, outcome: 'no_show', categorySlug: VISITA, appUser: USER, statuses: STATUSES });
    expect(m.updates[0].data.appointmentPromotedFrom).toBeNull();
    expect(m.updates[0].data.status).toBeUndefined();
  });

  it('com correction a marca do dia leva o texto e a marca de correção', async () => {
    await writeAppointmentOutcome({
      db: {}, lead: NOVO, outcome: 'attended', categorySlug: VISITA, appUser: USER, statuses: STATUSES,
      sourceLabel: 'Meta Diária', correction: true,
    });
    expect(m.adds[0].data).toMatchObject({
      type: 'daily_goal_done', appointmentOutcome: 'attended', outcomeCorrection: true,
    });
    expect(m.adds[0].data.text).toMatch(/^↩️ Desfecho corrigido: ✅ Compareceu · Meta Diária/);
  });
});

describe('writeAppointmentOutcome com extraPatch', () => {
  it('extraPatch entra no updateDoc sem sobrescrever o desfecho', async () => {
    await writeAppointmentOutcome({
      db: {}, lead: NOVO, outcome: 'no_show', categorySlug: VISITA, appUser: USER, statuses: STATUSES,
      extraPatch: { appointmentOutcome: 'x', foo: 1 },
    });
    expect(m.updates[0].data.foo).toBe(1);
    expect(m.updates[0].data.appointmentOutcome).toBe('no_show');
  });
});

describe('correctAppointmentOutcome', () => {
  it('Compareceu para Não compareceu: volta a etapa, repõe o próximo contato e registra a correção', async () => {
    const r = await correctAppointmentOutcome({
      db: {}, lead: PROMOVIDO, from: 'attended', to: 'no_show', categorySlug: VISITA, appUser: USER,
      statuses: STATUSES, sourceLabel: 'Agenda do dia',
    });
    expect(r.revertedTo).toBe('Novo');
    expect(m.updates[0].data).toMatchObject({
      appointmentOutcome: 'no_show', appointmentOutcomeAt: 'TS', appointmentOutcomeBy: 'auth1',
      appointmentPromotedFrom: null, status: 'Novo', statusEnteredAt: entrou, nextFollowUp: agendado,
    });
    expect(m.updates[0].data.lifecycleBucket).toBe('ativo');
    // A marca da correção sai como a primeira marcação da agenda: sem actorId/actorAuthUid,
    // então o Operacional credita a tarefa ao dono do lead e não a quem clicou.
    expect(m.adds).toHaveLength(1);
    expect(m.adds[0].data).toMatchObject({
      type: 'daily_goal_done', dailyGoalCategory: VISITA, appointmentOutcome: 'no_show', outcomeCorrection: true,
    });
    expect(m.adds[0].data.text).toMatch(/^↩️ Desfecho corrigido: ❌ Não veio · Agenda do dia/);
    expect(m.adds[0].data.actorAuthUid).toBeUndefined();
    expect(m.logs).toHaveLength(1);
    expect(m.logs[0].payload).toMatchObject({
      type: 'status_change', fromStatus: 'Negociação', toStatus: 'Novo', funnelId: 'f1',
      text: 'Fase voltou para [Novo] após correção do desfecho.',
    });
    expect(m.aula).toEqual([]);
  });

  it('na aula experimental, o registro da aula vira falta', async () => {
    await correctAppointmentOutcome({ db: {}, lead: PROMOVIDO, from: 'attended', to: 'no_show', categorySlug: AULA, appUser: USER });
    expect(m.aula).toEqual([['apply', 'no_show']]);
  });

  it('cliente: troca o desfecho sem mexer em etapa nem em próximo contato', async () => {
    const r = await correctAppointmentOutcome({
      db: {}, lead: { ...PROMOVIDO, status: 'Venda' }, from: 'attended', to: 'no_show', categorySlug: VISITA,
      appUser: USER, isClient: true,
    });
    expect(r.revertedTo).toBeNull();
    expect(m.logs).toEqual([]);
    expect(m.updates[0].data.status).toBeUndefined();
    expect(m.updates[0].data.nextFollowUp).toBeUndefined();
    expect(m.adds[0].data.outcomeCorrection).toBe(true);
  });

  it('cliente: corrigir para Compareceu não promove nem consome o próximo contato', async () => {
    const faltou = { ...NOVO, status: 'Venda', appointmentOutcome: 'no_show' };
    await correctAppointmentOutcome({
      db: {}, lead: faltou, from: 'no_show', to: 'attended', categorySlug: VISITA, appUser: USER,
      statuses: STATUSES, isClient: true,
    });
    expect(m.updates[0].data.status).toBeUndefined();
    expect(m.updates[0].data.nextFollowUp).toBeUndefined();
    expect(m.updates[0].data.appointmentPromotedFrom).toBeNull();
    expect(m.adds).toHaveLength(1);
    expect(m.adds[0].data.outcomeCorrection).toBe(true);
  });

  it('Não compareceu para Compareceu: é um Compareceu com a marca de correção', async () => {
    const faltou = { ...NOVO, appointmentOutcome: 'no_show', appointmentPromotedFrom: null };
    const r = await correctAppointmentOutcome({
      db: {}, lead: faltou, from: 'no_show', to: 'attended', categorySlug: VISITA, appUser: USER, statuses: STATUSES,
    });
    expect(r).toEqual({ revertedTo: null, promotedTo: 'Negociação' });
    expect(m.updates[0].data).toMatchObject({ appointmentOutcome: 'attended', status: 'Negociação' });
    expect(m.adds[0].data).toMatchObject({ type: 'daily_goal_done', outcomeCorrection: true });
  });

  it('Desfazer um Compareceu: limpa o desfecho, volta a etapa e registra a volta', async () => {
    const r = await correctAppointmentOutcome({
      db: {}, lead: PROMOVIDO, from: 'attended', to: null, categorySlug: AULA, appUser: USER,
    });
    expect(r.revertedTo).toBe('Novo');
    expect(m.updates[0].data).toMatchObject({
      appointmentOutcome: null, appointmentOutcomeAt: null, appointmentOutcomeBy: null,
      appointmentPromotedFrom: null, status: 'Novo', nextFollowUp: agendado,
    });
    expect(m.aula).toEqual([['clear']]);
    expect(m.logs.map((l) => l.payload.type)).toEqual(['status_change']);
  });

  it('Desfazer um Não compareceu não grava marca na linha do tempo', async () => {
    const faltou = { ...NOVO, appointmentOutcome: 'no_show', appointmentPromotedFrom: null };
    await correctAppointmentOutcome({ db: {}, lead: faltou, from: 'no_show', to: null, categorySlug: VISITA, appUser: USER });
    expect(m.updates[0].data).toEqual({
      appointmentPromotedFrom: null, appointmentOutcome: null, appointmentOutcomeAt: null, appointmentOutcomeBy: null,
    });
    expect(m.logs).toEqual([]);
  });

  it('trocar para o mesmo desfecho não grava nada', async () => {
    await correctAppointmentOutcome({ db: {}, lead: PROMOVIDO, from: 'attended', to: 'attended', categorySlug: VISITA, appUser: USER });
    expect(m.updates).toEqual([]);
    expect(m.adds).toEqual([]);
    expect(m.logs).toEqual([]);
  });
});
