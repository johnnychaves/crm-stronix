// @vitest-environment jsdom
// A aba Contratos com as aulas do freepass (entrega 2 do Visitante, Tarefa 4):
// o lançamento por aulas pelo gravador do Agendar, o cartão com as aulas, o
// Remarcar de cada aula e o Agendar da vaga livre (modo 'new'). O Firestore é
// falso: o recordNewAppointment e o logInteractions só anotam a chamada, o
// getDocs devolve os registros da pessoa e o writeBatch guarda o lote.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

const m = vi.hoisted(() => ({ freepasses: [], aulas: [], records: [], n: 0, lotes: [] }));
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
  writeBatch: () => {
    const calls = [];
    m.lotes.push(calls);
    return { update: (ref, data) => calls.push(['update', ref.path, data]), set: (ref, data) => calls.push(['set', ref.path, data]), commit: async () => {} };
  },
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
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const CONSULTOR = { id: 'u2', name: 'Ana Consultora', role: 'consultant', tenantId: 'acad', authUid: 'auth-2', tenantModules: ['faltosos'] };
const GESTOR = { ...CONSULTOR, id: 'u1', name: 'Gil Gestor', role: 'admin', authUid: 'auth-1' };
const PROFESSOR = { ...CONSULTOR, id: 'u3', name: 'Leo Professor', role: 'professor', professorId: 'p1', authUid: 'auth-3' };
const LEAD = {
  id: 'l1', name: 'Rafaela Souza', whatsapp: '11988887777', status: 'Novo', createdAt: new Date(2026, 8, 1),
  tags: [], consultantId: 'u2', consultantName: 'Ana Consultora',
};
const T_AULAS = { id: 't2', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: true, ativo: true };
const T_DIAS = { id: 't3', name: 'Pilates 7 dias', modalidadeId: 'm1', kind: 'dias', quantity: 7, padrao: false, ativo: true };
const FP = {
  id: 'f1', leadId: 'l1', kind: 'aulas', total: 2, aulas: 2, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 9, 10), endsAt: null, contractAtStart: null,
};
const CONFIG = {
  modalities: [{ id: 'm1', name: 'Pilates' }], trialClassOptions: [1],
  units: [{ id: 'u1', name: 'Centro', address: 'Rua dos Andradas, 1234' }], metaWeekdays: [1, 2, 3, 4, 5],
  slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [{ id: 'p1', nome: 'Leonardo', modalidadeIds: ['m1'] }], dores: [], freepassTypes: [T_AULAS, T_DIAS],
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

// A ficha com a aba de verdade: o cartão do freepass troca para a Linha do tempo.
function Ficha({ lead, appUser }) {
  const [tab, setTab] = useState('contratos');
  return h(LeadProfileView, {
    lead, tab, onTab: setTab, onBack: () => {}, appUser,
    statuses: [], tags: [], lossReasons: [], usersList: [appUser], db: {}, funnels: [],
  });
}
let root = null;
const tela = (lead, appUser) => h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
  h(ToastContext.Provider, { value: toast },
    h(LeadProfileContext.Provider, { value: profile },
      h(GeneralConfigContext.Provider, { value: CONFIG }, h(Ficha, { lead, appUser })))));
async function montar(lead = LEAD, appUser = CONSULTOR) {
  const c = document.createElement('div');
  document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => { root.render(tela(lead, appUser)); });
}
beforeEach(() => {
  // Sexta, 16/10/2026, 10h.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
  m.freepasses = []; m.aulas = []; m.records = []; m.n = 0; m.lotes = [];
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  logInteractions.mockClear();
  recordNewAppointment.mockReset();
  recordNewAppointment.mockImplementation(async () => 'nova');
  for (const f of Object.values(toast)) f.mockClear();
  vi.useRealTimers();
});

const comeca = (prefixo, raiz = document) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(prefixo)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const dialogo = () => document.querySelector('[role="dialog"]');
async function escolherProfessor(fieldset, id) {
  await act(async () => {
    const s = fieldset.querySelector('select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, id);
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const aulaRec = (id, at, over = {}) => ({ id, leadId: 'l1', type: 'aula', status: 'agendada', scheduledFor: at, modality: 'Pilates', freepassId: 'f1', professorId: 'p1', professorName: 'Leonardo', ...over });
const fakeBatch = () => {
  const calls = [];
  return { calls, set: (ref, data) => calls.push(['set', ref.path, data]), update: (ref, data) => calls.push(['update', ref.path, data]) };
};

describe('aba Contratos com as aulas do freepass', () => {
  // Lançar freepass por aulas: Hoje (sex 16/10, 18h) e a semana seguinte, com o Leonardo.
  async function lancarPorAulas({ marcar = true, botao = 'Lançar freepass' } = {}) {
    await clicar(comeca('Lançar freepass'));
    await clicar(dialogo().querySelector('[role="radio"][aria-label^="Pilates 2 aulas"]'));
    const aula1 = dialogo().querySelector('fieldset');
    if (marcar) {
      await clicar([...aula1.querySelectorAll('button')].find((b) => b.textContent === 'Hoje'));
      await escolherProfessor(aula1, 'p1');
    }
    await clicar(comeca(botao, dialogo().querySelector('[data-slot="dialog-footer"]')));
  }
  const visitaEm = (at) => ({ ...LEAD, appointmentType: 'visita', appointmentScheduledFor: at, nextFollowUp: at, nextFollowUpType: 'Visita' });

  it('lança por aulas sem pendente: as duas aulas nascem no lote, com a interação e a aula da vez', async () => {
    await montar();
    await lancarPorAulas();

    // Nada a remarcar: as aulas vão no lote, e nenhuma pendente se mexe.
    expect(recordNewAppointment).not.toHaveBeenCalled();
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'freepass']);
    expect(payloads[0]).toMatchObject({ volumeKind: 'aula_experimental' });
    expect(payloads[1]).toMatchObject({ text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas marcadas.' });
    expect(patch).toMatchObject({ currentAulaId: 'auto2', appointmentScheduledFor: new Date(2026, 9, 16, 18, 0), freepassId: 'auto1', freepassAulas: 2 });
    const b = fakeBatch();
    extra(b);
    expect(b.calls.map(([op, path]) => [op, path])).toEqual([
      ['set', 'artifacts/acad/public/data/stronix_freepass/auto1'],
      ['set', 'artifacts/acad/public/data/stronix_aulas/auto2'],
      ['set', 'artifacts/acad/public/data/stronix_aulas/auto3'],
    ]);
    expect(b.calls[0][2]).toMatchObject({ via: 'contratos', typeId: 't2', startsAt: new Date(2026, 9, 16) });
    expect(b.calls[1][2]).toMatchObject({ scheduledFor: new Date(2026, 9, 16, 18, 0), freepassId: 'auto1', professorId: 'p1' });
    expect(b.calls[2][2]).toMatchObject({ scheduledFor: new Date(2026, 9, 23, 18, 0), freepassId: 'auto1' });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Freepass lançado\. Primeira aula em 16\/10\/2026/));
    expect(dialogo()).toBeNull();
  });

  it('aula pendente da mesma modalidade, fora de freepass: nasce na linha 1 e vira a aula 1', async () => {
    m.aulas = [aulaRec('pend', new Date(2026, 9, 19, 18, 0), { freepassId: null })];
    m.records = [aulaRec('pend', new Date(2026, 9, 19, 18, 0), { freepassId: 'auto1' })];
    recordNewAppointment.mockImplementation(async () => 'pend');
    await montar({ ...LEAD, currentAulaId: 'pend', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await lancarPorAulas({ marcar: false });
    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: 'auto1', scheduledFor: new Date(2026, 9, 19, 18, 0), professorId: 'p1' });
    const [, , , , patch, extra] = logInteractions.mock.calls[0];
    expect(patch).toMatchObject({ currentAulaId: 'pend', freepassId: 'auto1' });
    const b = fakeBatch();
    extra(b);
    expect(b.calls[1]).toEqual(['set', 'artifacts/acad/public/data/stronix_aulas/auto2', expect.objectContaining({ scheduledFor: new Date(2026, 9, 26, 18, 0) })]);
  });

  it('visita pendente mais tarde que a aula 1: recusa antes de gravar', async () => {
    await montar(visitaEm(new Date(2026, 11, 3, 9, 0)));
    await lancarPorAulas();
    expect(toast.warning).toHaveBeenCalledWith('Rafaela tem uma visita marcada para 03/12. Remarque a visita ou marque esta aula depois dela.');
    expect(logInteractions).not.toHaveBeenCalled();
    expect(recordNewAppointment).not.toHaveBeenCalled();
    expect(dialogo()).not.toBeNull();
  });

  it('visita pendente mais cedo: o freepass nasce e o lead fica com a visita', async () => {
    await montar(visitaEm(new Date(2026, 9, 16, 12, 0)));
    await lancarPorAulas();
    expect(recordNewAppointment).not.toHaveBeenCalled();
    const patch = logInteractions.mock.calls[0][4];
    expect(Object.keys(patch).every((k) => k.startsWith('freepass'))).toBe(true);
    expect(patch).toMatchObject({ freepassId: 'auto1', freepassAulas: 2 });
  });

  it('aula pendente de outra modalidade: não é movida, e o lead fica com ela quando é mais cedo', async () => {
    m.aulas = [aulaRec('pend', new Date(2026, 9, 16, 12, 0), { freepassId: null, modality: 'Funcional' })];
    await montar({ ...LEAD, currentAulaId: 'pend', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 16, 12, 0) });
    await lancarPorAulas();
    expect(recordNewAppointment).not.toHaveBeenCalled();
    const patch = logInteractions.mock.calls[0][4];
    expect(Object.keys(patch).every((k) => k.startsWith('freepass'))).toBe(true);
  });

  it('o gestor lança de novo um freepass por aulas da mesma modalidade', async () => {
    m.freepasses = [{ ...FP, status: 'encerrado' }];
    await montar(LEAD, GESTOR);
    await lancarPorAulas({ botao: 'Lançar mesmo assim' });
    const [, , , payloads, patch] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'freepass']);
    expect(patch).toMatchObject({ freepassId: 'auto1', currentAulaId: 'auto2' });
  });

  // Antes, o launchCheck sem freepass repetido devolvia null e o lançamento
  // quebrava no check.block, sem gravar nem avisar.
  it('por dias continua pelo writeFreepassLaunch, sem aula', async () => {
    await montar();
    await clicar(comeca('Lançar freepass'));
    await clicar(dialogo().querySelector('[role="radio"][aria-label^="Pilates 7 dias"]'));
    await clicar(comeca('Lançar freepass', dialogo()));
    expect(recordNewAppointment).not.toHaveBeenCalled();
    const [, , , payloads, patch] = logInteractions.mock.calls[0];
    expect(payloads).toEqual([expect.objectContaining({ type: 'freepass', text: 'Freepass lançado: Pilates 7 dias (Pilates), de 16/10 a 22/10.' })]);
    expect(patch).toMatchObject({ freepassKind: 'dias', freepassEndsAt: new Date(2026, 9, 22) });
    expect(toast.success).toHaveBeenCalledWith('Freepass lançado.');
  });

  it('o cartão lista as aulas com a situação, a cancelada sem número, e a vaga sem dia', async () => {
    m.freepasses = [{ ...FP, total: 4, aulas: 3 }];
    m.aulas = [
      aulaRec('a1', new Date(2026, 9, 12, 18, 0), { status: 'attended' }),
      aulaRec('a2', new Date(2026, 9, 13, 18, 0), { status: 'no_show', professorId: null, professorName: null, soloTraining: true }),
      aulaRec('a3', new Date(2026, 9, 14, 18, 0), { status: 'cancelled' }),
      aulaRec('a4', new Date(2026, 9, 20, 18, 0)),
      aulaRec('outra', new Date(2026, 9, 21, 18, 0), { freepassId: 'f9' }),
    ];
    await montar({ ...LEAD, currentAulaId: 'a4', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 20, 18, 0) });
    expect(document.body.textContent).toContain('1 aula a agendar');
    expect(document.body.textContent).toContain('3 de 4 agendadas');
    const lista = document.querySelector('ul[aria-label="Aulas do freepass Pilates 2 aulas"]');
    // O número do círculo vem na frente; a cancelada tem um traço.
    const linhas = [...lista.querySelectorAll('li')].map((li) => li.textContent);
    expect(linhas).toEqual([
      '1Aula 1 · seg 12/10 às 18:00 · Prof. LeonardoCompareceu',
      '2Aula 2 · ter 13/10 às 18:00 · Treina sozinhoNão veio',
      '–qua 14/10 às 18:00 · Prof. LeonardoCancelada',
      '3Aula 3 · ter 20/10 às 18:00 · Prof. LeonardoAgendadaRemarcar',
      '4Aula 4 · ainda sem diaA agendarAgendar a aula 4',
    ]);
    expect(lista.querySelectorAll('button[aria-label^="Remarcar"]')).toHaveLength(1);
    expect(lista.querySelector('.line-through').textContent).toBe('qua 14/10 às 18:00 · Prof. Leonardo');
  });

  it('o professor vê as aulas, sem Remarcar e sem Agendar', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0))];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) }, PROFESSOR);
    const lista = document.querySelector('ul[aria-label^="Aulas do freepass"]');
    expect(lista.textContent).toContain('Aula 2 · ainda sem dia');
    expect(lista.querySelectorAll('button')).toHaveLength(0);
  });

  it('remarcar uma aula futura que não é a da vez: muda o registro, reconta o fim e o lead passa a ela quando fica mais cedo', async () => {
    m.freepasses = [FP];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0)), aulaRec('a2', new Date(2026, 9, 23, 18, 0))];
    m.records = m.aulas;
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await clicar(document.querySelector('button[aria-label="Remarcar a aula 2"]'));
    expect(dialogo().textContent).toContain('Remarcar a aula 2');
    const linha = dialogo().querySelector('fieldset');
    // O mesmo dia da aula 1 é recusado.
    await clicar([...linha.querySelectorAll('button')].find((b) => b.textContent === 'seg 19/10'));
    expect(dialogo().textContent).toContain('A aula 2 está no mesmo dia de outra aula do freepass. Escolha outro dia.');
    expect(comeca('Remarcar', dialogo().querySelector('[data-slot="dialog-footer"]')).disabled).toBe(true);
    await clicar([...linha.querySelectorAll('button')].find((b) => b.textContent === 'Hoje'));
    expect(dialogo().textContent).toContain('A aula 2 passa para sex 16/10 às 18:00.');
    await clicar(comeca('Remarcar', dialogo().querySelector('[data-slot="dialog-footer"]')));

    expect(logInteractions).not.toHaveBeenCalled();
    const [lote] = m.lotes;
    expect(lote.map(([op, path]) => [op, path])).toEqual([
      ['update', 'artifacts/acad/public/data/stronix_aulas/a2'],
      ['update', 'artifacts/acad/public/data/stronix_freepass/f1'],
      ['update', 'artifacts/acad/public/data/leads/l1'],
    ]);
    expect(lote[0][2]).toEqual({ scheduledFor: new Date(2026, 9, 16, 18, 0), professorId: 'p1', professorName: 'Leonardo', soloTraining: false });
    expect(lote[1][2]).toEqual({ aulas: 2, endsAt: new Date(2026, 9, 19) });
    expect(lote[2][2]).toMatchObject({
      currentAulaId: 'a2', appointmentScheduledFor: new Date(2026, 9, 16, 18, 0), appointmentType: 'aula_experimental',
      freepassAulas: 2, freepassEndsAt: new Date(2026, 9, 19),
    });
    expect(toast.success).toHaveBeenCalledWith('Aula 2 remarcada.');
    expect(dialogo()).toBeNull();
  });

  it('remarcar para depois da aula da vez: o lead fica com o agendamento dele', async () => {
    m.freepasses = [FP];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0)), aulaRec('a2', new Date(2026, 9, 23, 18, 0))];
    m.records = m.aulas;
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await clicar(document.querySelector('button[aria-label="Remarcar a aula 2"]'));
    const linha = dialogo().querySelector('fieldset');
    await clicar([...linha.querySelectorAll('button')].find((b) => b.textContent === 'qui 22/10'));
    await clicar(comeca('Remarcar', dialogo().querySelector('[data-slot="dialog-footer"]')));
    const leadPatch = m.lotes[0][2][2];
    expect(Object.keys(leadPatch).every((k) => k.startsWith('freepass'))).toBe(true);
    expect(leadPatch).toMatchObject({ freepassEndsAt: new Date(2026, 9, 22) });
  });

  it('remarcar para antes de uma visita pendente: recusa, sem gravar', async () => {
    m.freepasses = [FP];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 23, 18, 0)), aulaRec('a2', new Date(2026, 9, 27, 18, 0))];
    m.records = m.aulas;
    await montar(visitaEm(new Date(2026, 9, 20, 9, 0)));
    await clicar(document.querySelector('button[aria-label="Remarcar a aula 2"]'));
    await clicar([...dialogo().querySelector('fieldset').querySelectorAll('button')].find((b) => b.textContent === 'Hoje'));
    await clicar(comeca('Remarcar', dialogo().querySelector('[data-slot="dialog-footer"]')));
    expect(toast.warning).toHaveBeenCalledWith('Rafaela tem uma visita marcada para 20/10. Remarque a visita ou marque esta aula depois dela.');
    expect(m.lotes).toEqual([]);
    expect(dialogo()).not.toBeNull();
  });

  it('remarcar uma aula que mudou em outra aba: recusa, sem gravar', async () => {
    m.freepasses = [FP];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0)), aulaRec('a2', new Date(2026, 9, 23, 18, 0))];
    m.records = [m.aulas[0], { ...m.aulas[1], status: 'cancelled' }];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await clicar(document.querySelector('button[aria-label="Remarcar a aula 2"]'));
    await clicar([...dialogo().querySelector('fieldset').querySelectorAll('button')].find((b) => b.textContent === 'qui 22/10'));
    await clicar(comeca('Remarcar', dialogo().querySelector('[data-slot="dialog-footer"]')));
    expect(toast.warning).toHaveBeenCalledWith('Essa aula mudou enquanto você remarcava. Confira o cartão do freepass.');
    expect(m.lotes).toEqual([]);
  });

  it('remarcar a aula da vez abre o Agendar da ficha, já na aula e na modalidade, remarcando a pendente', async () => {
    m.freepasses = [FP];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0)), aulaRec('a2', new Date(2026, 9, 23, 18, 0))];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await clicar(document.querySelector('button[aria-label="Remarcar a aula 1"]'));
    expect(dialogo()).toBeNull();
    expect(document.body.textContent).toContain('A aula continua no freepass de Rafaela');
  });

  // O "Agendar" da vaga: Usar o freepass, Leonardo e o dia escolhido.
  async function agendarVaga(dia = 'Hoje') {
    await clicar(comeca('Agendar', document.querySelector('ul[aria-label^="Aulas do freepass"]')));
    await clicar(comeca('Usar o freepass'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca(dia));
    await clicar(comeca('Confirmar agendamento'));
  }

  it('Agendar da vaga livre: preso ao freepass, sem aula avulsa e com a modalidade travada', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0))];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await clicar(comeca('Agendar', document.querySelector('ul[aria-label^="Aulas do freepass"]')));
    // Sem remarcar a pendente: o freepass recebe uma aula a mais.
    expect(document.body.textContent).toContain('A aula entra no freepass de Rafaela');
    expect(comeca('Aula avulsa')).toBeNull();
    expect(document.querySelector('button[title="Editar modalidade"]')).toBeNull();
    expect(document.querySelector('button[title="Editar tipo"]')).toBeNull();
  });

  it('Agendar da vaga livre: a aula nova vai no lote e o lead passa a ela por ser a mais cedo', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0))];
    m.records = [...m.aulas];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 19, 18, 0) });
    await agendarVaga();

    expect(recordNewAppointment).not.toHaveBeenCalled();
    const [, , , , patch, extra] = logInteractions.mock.calls[0];
    expect(patch).toMatchObject({ currentAulaId: 'auto1', appointmentScheduledFor: new Date(2026, 9, 16, 18, 0), freepassAulas: 2 });
    const b = fakeBatch();
    extra(b);
    expect(b.calls).toEqual([
      ['set', 'artifacts/acad/public/data/stronix_aulas/auto1', expect.objectContaining({ freepassId: 'f1', scheduledFor: new Date(2026, 9, 16, 18, 0), status: 'agendada' })],
      ['update', 'artifacts/acad/public/data/stronix_freepass/f1', { aulas: 2, endsAt: new Date(2026, 9, 19) }],
    ]);
  });

  it('Agendar da vaga livre depois da aula da vez: o lead fica com a pendente', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 16, 12, 0))];
    m.records = [...m.aulas];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 16, 12, 0) });
    await agendarVaga('Segunda-feira');
    const patch = logInteractions.mock.calls[0][4];
    expect(Object.keys(patch).every((k) => k.startsWith('freepass'))).toBe(true);
    expect(patch).toMatchObject({ freepassAulas: 2, freepassEndsAt: new Date(2026, 9, 19) });
  });

  it('Agendar da vaga livre com o desfecho de antes de hoje: o lead passa para a aula nova', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 14, 18, 0), { status: 'attended' })];
    m.records = [...m.aulas];
    await montar({ ...LEAD, currentAulaId: 'a1', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 14, 18, 0), appointmentOutcome: 'attended' });
    await agendarVaga();
    expect(logInteractions.mock.calls[0][4]).toMatchObject({ currentAulaId: 'auto1', appointmentOutcome: null });
  });

  it('Agendar da vaga livre com uma visita pendente mais tarde: recusa antes de gravar', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 12, 18, 0), { status: 'attended' })];
    await montar(visitaEm(new Date(2026, 9, 20, 9, 0)));
    await agendarVaga();
    expect(toast.warning).toHaveBeenCalledWith('Rafaela tem uma visita marcada para 20/10. Remarque a visita ou marque esta aula depois dela.');
    expect(logInteractions).not.toHaveBeenCalled();
    expect(comeca('Confirmar agendamento')).not.toBeNull();
  });

  it('sem o módulo Stronix 2.0, nada do freepass aparece na aba', async () => {
    m.freepasses = [{ ...FP, aulas: 1 }];
    m.aulas = [aulaRec('a1', new Date(2026, 9, 19, 18, 0))];
    await montar(LEAD, { ...CONSULTOR, tenantModules: [] });
    expect(document.querySelector('ul[aria-label^="Aulas do freepass"]')).toBeNull();
    expect(comeca('Lançar freepass')).toBeNull();
    expect(document.querySelector('button[aria-label^="Remarcar a aula"]')).toBeNull();
    expect(document.body.textContent).not.toContain('a agendar');
  });
});
