// @vitest-environment jsdom
// O Remarcar da Meta com o módulo Stronix 2.0 (decisão do Johnny, 27/11/2026):
// o lead mostra sempre o compromisso pendente mais cedo. O caso: freepass de 2
// aulas, terça A e quinta B; falta na terça e a próxima tentativa, na terça
// seguinte, vira avulsa (o freepass está cheio). O lead passa a apontar para a
// quinta (B), e não para a avulsa, senão B sumiria da Agenda de hoje na quinta.
// A tela é a de verdade (DailyGoalView), e o Firestore é falso: as gravações
// do registro e da interação só anotam a chamada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const m = vi.hoisted(() => ({ aulas: [], freepasses: [] }));
vi.mock('../firebase.js', async (original) => ({
  ...(await original()),
  appId: 'acad', db: {}, auth: {}, storage: {},
}));
vi.mock('firebase/firestore', async (original) => ({
  ...(await original()),
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (col, id) => ({ path: `${col.path}/${id}`, id }),
  query: (col) => ({ col }),
  where: () => ({}),
  onSnapshot: () => () => {},
  getDocs: async (q) => {
    const list = q.col.path.endsWith('stronix_freepass') ? m.freepasses : m.aulas;
    return { docs: list.map((r) => ({ id: r.id, data: () => r })) };
  },
  serverTimestamp: () => 'TS',
}));
const logInteractions = vi.fn(async () => []);
const logInteraction = vi.fn(async () => {});
vi.mock('../interactions.js', () => ({ logInteraction: (...a) => logInteraction(...a), logInteractions: (...a) => logInteractions(...a) }));
const upsertScheduledAula = vi.fn(async () => 'C');
vi.mock('../aulasWrites.js', () => ({
  applyOutcomeToAula: vi.fn(async () => {}), closeOpenAppointment: vi.fn(async () => null),
  upsertScheduledAppointment: vi.fn(async () => null), upsertScheduledAula: (...a) => upsertScheduledAula(...a),
}));
vi.mock('../dailyGoalHistory.js', () => ({ recordGoalHit: vi.fn(async () => true) }));
vi.mock('canvas-confetti', () => ({ default: () => {} }));

const { DailyGoalView } = await import('../../views/DailyGoalView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2', tenantModules: ['faltosos'] };
// Terça, 13/10/2026, 10h. A aula A foi hoje às 9h; a B é na quinta, 15/10, às 18h.
const NOW = new Date(2026, 9, 13, 10, 0);
const A_AT = new Date(2026, 9, 13, 9, 0);
const B_AT = new Date(2026, 9, 15, 18, 0);
const T_AULAS = { id: 't2', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };
const FP = {
  id: 'f1', leadId: 'l1', kind: 'aulas', total: 2, aulas: 2, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 9, 13), endsAt: new Date(2026, 9, 15), contractAtStart: null,
};
const aulaRec = (id, at, over = {}) => ({ id, leadId: 'l1', type: 'aula', status: 'agendada', scheduledFor: at, modality: 'Pilates', freepassId: 'f1', professorId: 'p1', professorName: 'Leonardo', ...over });
const LEAD = {
  id: 'l1', name: 'Rafaela Souza', whatsapp: '11988887777', status: 'Agendado', createdAt: new Date(2026, 8, 1),
  consultantId: 'u2', consultantName: 'Ana Consultora', consultantAuthUid: 'auth-2',
  appointmentType: 'aula_experimental', appointmentScheduledFor: A_AT, nextFollowUp: A_AT, nextFollowUpType: 'Aula Experimental',
  appointmentModality: 'Pilates', appointmentProfessorId: 'p1', appointmentProfessorName: 'Leonardo', currentAulaId: 'A',
  freepassId: 'f1', freepassKind: 'aulas', freepassTotal: 2, freepassAulas: 2, freepassStatus: 'correndo', freepassContractAtStart: null,
};
const CONFIG = {
  modalities: [{ id: 'm1', name: 'Pilates' }], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5],
  slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [{ id: 'p1', nome: 'Leonardo', modalidadeIds: ['m1'] }], dores: [], freepassTypes: [T_AULAS],
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: 'dailyGoal' };

let root = null;
async function montar() {
  const c = document.createElement('div');
  document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/meta-diaria'] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG },
            h(DailyGoalView, {
              leads: [LEAD], agendaLeads: [LEAD], interactions: [], appUser: CONSULTOR, statuses: [], db: {},
              usersList: [CONSULTOR], listenersActive: true,
            }))))));
  });
}
const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(texto)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  // Depois do Não compareceu: A fechou como falta; B segue pendente; C é a avulsa que o Remarcar grava.
  m.aulas = [aulaRec('A', A_AT, { status: 'no_show' }), aulaRec('B', B_AT)];
  m.freepasses = [FP];
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  logInteractions.mockClear();
  logInteraction.mockClear();
  upsertScheduledAula.mockClear();
  vi.useRealTimers();
});

describe('o Remarcar da Meta aponta o lead para o compromisso pendente mais cedo', () => {
  it('falta na aula A e próxima tentativa avulsa na terça seguinte: o lead aponta para a aula B do freepass', async () => {
    await montar();
    const agora = document.querySelector('article[aria-label^="Agora"]');
    await clicar([...agora.querySelectorAll('button')].find((b) => b.textContent.includes('Não compareceu')));
    // O "Agendar próxima tentativa" abre com o freepass cheio: a aula fica avulsa.
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).toContain('Aula avulsa: o freepass já tem as 2 aulas');
    await clicar(botao('Em 7 dias'));
    await clicar(botao('Agendar tentativa'));

    // O registro da tentativa nasce avulso (fora do freepass).
    expect(upsertScheduledAula.mock.calls[0][0].fields).toMatchObject({ freepassId: null, scheduledFor: new Date(2026, 9, 20, 9, 0) });
    const [, , , payloads, leadUpdate] = logInteractions.mock.calls[0];
    // A interação fala da tentativa marcada; o lead aponta para a B.
    expect(payloads[0].text).toContain('20/10/2026');
    expect(leadUpdate).toMatchObject({
      currentAulaId: 'B', appointmentType: 'aula_experimental', appointmentScheduledFor: B_AT, nextFollowUp: B_AT,
      appointmentOutcome: null, appointmentProfessorId: 'p1', nextFollowUpNote: null,
    });
    // O dono da tarefa não muda no Remarcar.
    expect(leadUpdate).not.toHaveProperty('appointmentOwnerId');
  });

  it('sem o módulo, o lead aponta para a tentativa marcada, como antes', async () => {
    CONSULTOR.tenantModules = [];
    try {
      await montar();
      const agora = document.querySelector('article[aria-label^="Agora"]');
      await clicar([...agora.querySelectorAll('button')].find((b) => b.textContent.includes('Não compareceu')));
      await clicar(botao('Em 7 dias'));
      await clicar(botao('Agendar tentativa'));
      const leadUpdate = logInteractions.mock.calls[0][4];
      expect(leadUpdate).toMatchObject({ currentAulaId: 'C', appointmentScheduledFor: new Date(2026, 9, 20, 9, 0) });
    } finally {
      CONSULTOR.tenantModules = ['faltosos'];
    }
  });
});
