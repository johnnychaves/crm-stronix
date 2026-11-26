// @vitest-environment jsdom
// O Agendar da ficha com o freepass (entrega 2 do Visitante): o que a gravação
// manda para o registro da aula, para o lead e para o lote. O Firestore é falso:
// o recordNewAppointment e o logInteractions só anotam a chamada, e o getDocs
// devolve os registros da pessoa depois da aula gravada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const m = vi.hoisted(() => ({ freepasses: [], aulas: [], records: [], n: 0 }));
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', CONTRACTS_PATH: 'contratos',
  AULAS_PATH: 'stronix_aulas', FREEPASS_PATH: 'stronix_freepass', db: {}, auth: {}, storage: {},
}));
vi.mock('firebase/firestore', async (original) => ({
  ...(await original()),
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (col, id) => {
    if (id) return { path: `${col.path}/${id}`, id };
    m.n += 1;
    return { path: `${col.path}/auto${m.n}`, id: `auto${m.n}` };
  },
  query: (col, ...filtros) => ({ col, filtros }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  getDocs: async () => ({ docs: m.records.map((r) => ({ id: r.id, data: () => r })) }),
  serverTimestamp: () => 'TS',
}));
vi.mock('../../hooks/useLeadFreepasses.js', () => ({ useLeadFreepasses: () => m.freepasses }));
vi.mock('../../hooks/useLeadAulas.js', () => ({ useLeadAulas: () => m.aulas }));
vi.mock('../../hooks/useLeadTimeline.js', () => ({ useLeadTimeline: () => [] }));
const logInteractions = vi.fn(async () => []);
vi.mock('../interactions.js', () => ({ logInteraction: vi.fn(async () => {}), logInteractions: (...a) => logInteractions(...a) }));
const recordNewAppointment = vi.fn(async () => 'nova');
vi.mock('../aulasWrites.js', () => ({ recordNewAppointment: (...a) => recordNewAppointment(...a), markConvertingAula: vi.fn() }));

const { LeadProfileView } = await import('../../views/LeadProfileView.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2', tenantModules: ['faltosos'] };
const LEAD = {
  id: 'l1', name: 'Rafaela Souza', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1),
  tags: [], consultantId: 'u2', consultantName: 'Ana Consultora',
};
const T_AULAS = { id: 't2', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };
const FP = {
  id: 'f1', leadId: 'l1', kind: 'aulas', total: 2, aulas: 1, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 9, 10), endsAt: null, contractAtStart: null,
};
const CONFIG = {
  modalities: [{ id: 'm1', name: 'Pilates' }], trialClassOptions: [1], units: [], metaWeekdays: [1, 2, 3, 4, 5],
  slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [{ id: 'p1', nome: 'Leonardo', modalidadeIds: ['m1'] }], dores: [], freepassTypes: [T_AULAS],
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

let root = null;
async function montar(lead = LEAD) {
  const c = document.createElement('div');
  document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
      h(ToastContext.Provider, { value: toast },
        h(LeadProfileContext.Provider, { value: profile },
          h(GeneralConfigContext.Provider, { value: CONFIG },
            h(LeadProfileView, {
              lead, tab: 'timeline', onTab: () => {}, onBack: () => {}, appUser: CONSULTOR,
              statuses: [], tags: [], lossReasons: [], usersList: [CONSULTOR], db: {}, funnels: [],
            }))))));
  });
}
beforeEach(() => {
  // Sexta, 16/10/2026, 10h.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
  m.freepasses = []; m.aulas = []; m.records = []; m.n = 0;
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  logInteractions.mockClear();
  recordNewAppointment.mockClear();
  vi.useRealTimers();
});

const comeca = (prefixo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(prefixo)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const fakeBatch = () => {
  const calls = [];
  return { calls, set: (ref, data) => calls.push(['set', ref.path, data]), update: (ref, data) => calls.push(['update', ref.path, data]) };
};
async function abrirAula() {
  await clicar(comeca('Agendar'));
  // O cartão do tipo no assistente (o "A seguir" também tem a aula experimental).
  await clicar([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Treino de experiência')));
  await clicar(comeca('Pilates'));
}

describe('Agendar da ficha com o freepass', () => {
  it('aula no freepass que corre: o registro leva o freepass, e o lead aponta para a aula mais cedo', async () => {
    m.freepasses = [FP];
    // Depois da gravação: a aula que já estava no freepass (hoje, 12h) e a nova (hoje, 18h).
    m.records = [
      { id: 'antes', leadId: 'l1', type: 'aula', freepassId: 'f1', status: 'agendada', scheduledFor: new Date(2026, 9, 16, 12, 0), modality: 'Pilates', professorId: 'p1' },
      { id: 'nova', leadId: 'l1', type: 'aula', freepassId: 'f1', status: 'agendada', scheduledFor: new Date(2026, 9, 16, 18, 0), modality: 'Pilates', professorId: 'p1' },
    ];
    await montar();
    await abrirAula();
    await clicar(comeca('Entra no freepass'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));

    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: 'f1', modality: 'Pilates', professorId: 'p1' });
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads).toHaveLength(1);
    expect(payloads[0].text).toMatch(/^🔔 Aula Experimental agendada \(Pilates\) · Leonardo p\/ 16\/10\/2026/);
    expect(patch).toMatchObject({
      currentAulaId: 'antes', appointmentScheduledFor: new Date(2026, 9, 16, 12, 0), trialClassesPlanned: null,
      freepassId: 'f1', freepassAulas: 2, freepassEndsAt: new Date(2026, 9, 16),
    });
    const b = fakeBatch();
    extra(b);
    expect(b.calls).toEqual([['update', 'artifacts/acad/public/data/stronix_freepass/f1', { aulas: 2, endsAt: new Date(2026, 9, 16) }]]);
  });

  it('primeira vez, por aulas: nasce o freepass com as duas aulas, a segunda no mesmo lote', async () => {
    await montar();
    await abrirAula();
    await clicar(comeca('Pilates 2 aulas'));
    const aula1 = document.querySelector('fieldset');
    await clicar([...aula1.querySelectorAll('button')].find((b) => b.textContent === 'Hoje'));
    await act(async () => {
      const s = aula1.querySelector('select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'p1');
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // A aula 1 é gravada pelo recordNewAppointment, já no freepass reservado.
    m.records = [{ id: 'nova', leadId: 'l1', type: 'aula', freepassId: 'auto1', status: 'agendada', scheduledFor: new Date(2026, 9, 16, 18, 0) }];
    await clicar(comeca('Agendar 2 aulas'));

    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: 'auto1', scheduledFor: new Date(2026, 9, 16, 18, 0) });
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'freepass']);
    expect(payloads[1]).toMatchObject({ freepassId: 'auto1', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas para agendar.' });
    expect(patch).toMatchObject({ currentAulaId: 'nova', freepassId: 'auto1', freepassAulas: 2, freepassEndsAt: new Date(2026, 9, 23) });
    const b = fakeBatch();
    extra(b);
    expect(b.calls.map(([op, path]) => [op, path])).toEqual([
      ['set', 'artifacts/acad/public/data/stronix_freepass/auto1'],
      ['set', 'artifacts/acad/public/data/stronix_aulas/auto2'],
    ]);
    expect(b.calls[0][2]).toMatchObject({ via: 'agendar', aulas: 2, typeId: 't2', startsAt: new Date(2026, 9, 16), endsAt: new Date(2026, 9, 23) });
    expect(b.calls[1][2]).toMatchObject({ freepassId: 'auto1', scheduledFor: new Date(2026, 9, 23, 18, 0), professorId: 'p1', professorName: 'Leonardo', modality: 'Pilates' });
  });

  it('remarcar a aula do freepass como avulsa: a aula sai do freepass e ele volta a ter vaga', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [{ id: 'pend', leadId: 'l1', status: 'agendada', freepassId: 'f1' }];
    m.records = [{ id: 'pend', leadId: 'l1', type: 'aula', freepassId: null, status: 'agendada', scheduledFor: new Date(2026, 9, 16, 18, 0) }];
    await montar({ ...LEAD, currentAulaId: 'pend', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 20, 18, 0) });
    await abrirAula();
    expect(document.body.textContent).toContain('A aula continua no freepass de Rafaela');
    await clicar(comeca('Aula avulsa'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));

    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: null });
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads).toHaveLength(1);
    expect(patch).toMatchObject({ currentAulaId: 'nova', freepassId: 'f1', freepassAulas: 0 });
    const b = fakeBatch();
    extra(b);
    expect(b.calls).toEqual([['update', 'artifacts/acad/public/data/stronix_freepass/f1', { aulas: 0, endsAt: null }]]);
  });

  it('aula avulsa sem freepass envolvido: nada de freepass no lote nem no lead', async () => {
    m.freepasses = [{ ...FP, status: 'encerrado' }];
    await montar();
    await abrirAula();
    expect(document.body.textContent).toContain('Essa aula fica avulsa');
    await clicar(comeca('Aula avulsa'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));
    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: null });
    const [, , , , patch, extra] = logInteractions.mock.calls[0];
    expect(extra).toBeNull();
    expect(Object.keys(patch).some((k) => k.startsWith('freepass'))).toBe(false);
  });
});
