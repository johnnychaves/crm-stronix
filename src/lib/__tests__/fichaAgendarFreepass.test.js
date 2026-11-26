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
const T_FUNC = { id: 't3', name: 'Funcional 7 dias', modalidadeId: 'm2', kind: 'dias', quantity: 7, padrao: true, ativo: true };
const FP = {
  id: 'f1', leadId: 'l1', kind: 'aulas', total: 2, aulas: 1, typeName: 'Pilates 2 aulas', modalidadeId: 'm1', modalidadeName: 'Pilates',
  status: 'correndo', startsAt: new Date(2026, 9, 10), endsAt: null, contractAtStart: null,
};
const CONFIG = {
  modalities: [{ id: 'm1', name: 'Pilates' }, { id: 'm2', name: 'Funcional' }], trialClassOptions: [1],
  units: [{ id: 'u1', name: 'Centro', address: 'Rua dos Andradas, 1234' }], metaWeekdays: [1, 2, 3, 4, 5],
  slaOverdueDays: 3, dailyVolumeTarget: 0, planos: [], contratos: [], contractThresholdDays: 30, renewalCheckpoints: [90, 60, 30],
  renewalGraceDays: 15, professores: [{ id: 'p1', nome: 'Leonardo', modalidadeIds: ['m1'] }], dores: [], freepassTypes: [T_AULAS, T_FUNC],
};
const profile = { openProfile: () => {}, leadHref: (leadId) => hrefFor('acad', 'ficha', { leadId }), from: null };

let root = null;
const tela = (lead) => h(MemoryRouter, { initialEntries: ['/acad/ficha/l1'] },
  h(ToastContext.Provider, { value: toast },
    h(LeadProfileContext.Provider, { value: profile },
      h(GeneralConfigContext.Provider, { value: CONFIG },
        h(LeadProfileView, {
          lead, tab: 'timeline', onTab: () => {}, onBack: () => {}, appUser: CONSULTOR,
          statuses: [], tags: [], lossReasons: [], usersList: [CONSULTOR], db: {}, funnels: [],
        })))));
async function montar(lead = LEAD) {
  const c = document.createElement('div');
  document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => { root.render(tela(lead)); });
}
// Os dados do freepass chegam ao vivo: redesenha a ficha com o m de agora.
const redesenhar = async (lead = LEAD) => { await act(async () => { root.render(tela(lead)); }); };
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
  recordNewAppointment.mockReset();
  recordNewAppointment.mockImplementation(async () => 'nova');
  for (const f of Object.values(toast)) f.mockClear();
  vi.useRealTimers();
});

const comeca = (prefixo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(prefixo)) || null;
const clicar = async (el) => { await act(async () => { el.click(); }); };
const fakeBatch = () => {
  const calls = [];
  return { calls, set: (ref, data) => calls.push(['set', ref.path, data]), update: (ref, data) => calls.push(['update', ref.path, data]) };
};
async function abrirAgendar(cartao) {
  await clicar(comeca('Agendar'));
  // O cartão do tipo no assistente (o "A seguir" também tem a aula experimental).
  await clicar([...document.querySelectorAll('button')].find((b) => b.textContent.includes(cartao)));
}
async function abrirAula(modalidade = 'Pilates') {
  await abrirAgendar('Treino de experiência');
  await clicar(comeca(modalidade));
}
async function anotar(texto) {
  const campo = document.querySelector('#wz-note');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(campo, texto);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const aulaRec = (id, at, over = {}) => ({ id, leadId: 'l1', type: 'aula', status: 'agendada', scheduledFor: at, modality: 'Pilates', ...over });
const PEND = { ...LEAD, currentAulaId: 'pend', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 20, 18, 0) };

describe('Agendar da ficha com o freepass', () => {
  it('aula no freepass que corre: o lead aponta para a aula mais cedo, com o professor dela e sem a anotação', async () => {
    m.freepasses = [FP];
    // Depois da gravação: a aula que já estava no freepass (hoje, 12h, treina sozinho) e a nova (hoje, 18h).
    m.records = [
      aulaRec('antes', new Date(2026, 9, 16, 12, 0), { freepassId: 'f1', professorId: null, soloTraining: true }),
      aulaRec('nova', new Date(2026, 9, 16, 18, 0), { freepassId: 'f1', professorId: 'p1' }),
    ];
    await montar();
    await abrirAula();
    await clicar(comeca('Usar o freepass'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    await anotar('Traz tênis');
    await clicar(comeca('Confirmar agendamento'));

    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: 'f1', modality: 'Pilates', professorId: 'p1' });
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads).toHaveLength(1);
    // A anotação continua no texto da interação, que fala da aula marcada agora.
    expect(payloads[0].text).toMatch(/^🔔 Aula Experimental agendada \(Pilates\) · Leonardo p\/ 16\/10\/2026.*Obs: Traz tênis$/);
    expect(patch).toMatchObject({
      currentAulaId: 'antes', appointmentScheduledFor: new Date(2026, 9, 16, 12, 0), nextFollowUp: new Date(2026, 9, 16, 12, 0),
      appointmentProfessorId: null, appointmentProfessorName: null, appointmentSoloTraining: true, nextFollowUpNote: null,
      trialClassesPlanned: null, freepassId: 'f1', freepassAulas: 2, freepassEndsAt: new Date(2026, 9, 16),
    });
    const b = fakeBatch();
    extra(b);
    expect(b.calls).toEqual([['update', 'artifacts/acad/public/data/stronix_freepass/f1', { aulas: 2, endsAt: new Date(2026, 9, 16) }]]);
  });

  it('a aula da vez com professor leva o professor para o lead', async () => {
    m.freepasses = [FP];
    m.records = [
      aulaRec('antes', new Date(2026, 9, 16, 12, 0), { freepassId: 'f1', professorId: 'p1' }),
      aulaRec('nova', new Date(2026, 9, 16, 18, 0), { freepassId: 'f1', soloTraining: true }),
    ];
    await montar();
    await abrirAula();
    await clicar(comeca('Usar o freepass'));
    await clicar(comeca('Treina sozinho'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));
    const patch = logInteractions.mock.calls[0][4];
    expect(patch).toMatchObject({ currentAulaId: 'antes', appointmentProfessorId: 'p1', appointmentProfessorName: 'Leonardo', appointmentSoloTraining: false });
  });

  it('o lead já aponta para a aula da vez: o agendamento dele fica como está', async () => {
    m.freepasses = [FP];
    m.records = [
      aulaRec('antes', new Date(2026, 9, 16, 12, 0), { freepassId: 'f1', professorId: 'p1' }),
      aulaRec('nova', new Date(2026, 9, 16, 18, 0), { freepassId: 'f1', professorId: 'p1' }),
    ];
    await montar({ ...LEAD, currentAulaId: 'antes', appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 9, 16, 12, 0) });
    await abrirAula();
    await clicar(comeca('Usar o freepass'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));
    const patch = logInteractions.mock.calls[0][4];
    expect(Object.keys(patch).sort()).toEqual(Object.keys(patch).filter((k) => k.startsWith('freepass')).sort());
    expect(patch).toMatchObject({ freepassAulas: 2 });
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
    m.records = [aulaRec('nova', new Date(2026, 9, 16, 18, 0), { freepassId: 'auto1' })];
    await clicar(comeca('Agendar 2 aulas'));

    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: 'auto1', scheduledFor: new Date(2026, 9, 16, 18, 0) });
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'freepass']);
    expect(payloads[1]).toMatchObject({ freepassId: 'auto1', text: 'Freepass lançado: Pilates 2 aulas (Pilates), 2 aulas marcadas.' });
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

  // O recordNewAppointment engole a falha e devolve o id antigo.
  it('a aula 1 não foi gravada: nada vai para o lote e a ficha avisa o erro', async () => {
    recordNewAppointment.mockImplementation(async () => null);
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
    m.records = [];
    await clicar(comeca('Agendar 2 aulas'));
    expect(logInteractions).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar o agendamento.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('troca de modalidade: a aula pendente do Pilates nasce num freepass de Funcional e o do Pilates devolve a vaga', async () => {
    m.freepasses = [FP];
    m.aulas = [{ id: 'pend', leadId: 'l1', status: 'agendada', freepassId: 'f1' }];
    recordNewAppointment.mockImplementation(async () => 'pend');
    m.records = [aulaRec('pend', new Date(2026, 9, 16, 18, 0), { freepassId: 'auto1', modality: 'Funcional', soloTraining: true })];
    await montar(PEND);
    await abrirAula('Funcional');
    expect(document.body.textContent).toContain('Qual freepass de Funcional?');
    await clicar(comeca('Funcional 7 dias'));
    await clicar(comeca('Treina sozinho'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));

    expect(recordNewAppointment.mock.calls[0][0].fields).toMatchObject({ freepassId: 'auto1', modality: 'Funcional' });
    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads.map((p) => p.type)).toEqual(['note', 'freepass']);
    // O de Funcional termina antes (o de Pilates por aulas não tem fim marcado): é o do resumo.
    expect(patch).toMatchObject({ currentAulaId: 'pend', freepassId: 'auto1', freepassKind: 'dias', freepassAulas: 1 });
    const b = fakeBatch();
    extra(b);
    expect(b.calls.map(([op, path, data]) => [op, path, data.aulas])).toEqual([
      ['set', 'artifacts/acad/public/data/stronix_freepass/auto1', 1],
      ['update', 'artifacts/acad/public/data/stronix_freepass/f1', 0],
    ]);
  });

  it('remarcar a aula do freepass como avulsa: a aula sai do freepass e ele volta a ter vaga', async () => {
    m.freepasses = [FP];
    m.aulas = [{ id: 'pend', leadId: 'l1', status: 'agendada', freepassId: 'f1' }];
    m.records = [aulaRec('pend', new Date(2026, 9, 16, 18, 0), { freepassId: null })];
    await montar(PEND);
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

  it('visita no lugar da aula pendente do freepass: a aula é cancelada e o freepass devolve a vaga', async () => {
    m.freepasses = [FP];
    m.aulas = [{ id: 'pend', leadId: 'l1', status: 'agendada', freepassId: 'f1' }];
    recordNewAppointment.mockImplementation(async () => 'pend');
    m.records = [aulaRec('pend', new Date(2026, 9, 20, 18, 0), { freepassId: 'f1', status: 'cancelled' })];
    await montar(PEND);
    await abrirAgendar('Conhecer a unidade');
    await clicar(comeca('Centro'));
    await clicar(comeca('Hoje'));
    await clicar(comeca('Confirmar agendamento'));

    const [, , , payloads, patch, extra] = logInteractions.mock.calls[0];
    expect(payloads).toHaveLength(1);
    expect(patch).toMatchObject({ appointmentType: 'visita', freepassId: 'f1', freepassAulas: 0 });
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

  it('o freepass mudou enquanto a pessoa agendava: recusa e o assistente fica como está', async () => {
    m.freepasses = [FP];
    await montar();
    await abrirAula();
    await clicar(comeca('Usar o freepass'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    // Outra aba encheu o freepass.
    m.freepasses = [{ ...FP, aulas: 2 }];
    await redesenhar();
    await clicar(comeca('Confirmar agendamento'));
    expect(toast.warning).toHaveBeenCalledWith('O freepass mudou enquanto você agendava. Confira o passo Freepass.');
    expect(recordNewAppointment).not.toHaveBeenCalled();
    expect(logInteractions).not.toHaveBeenCalled();
    expect(comeca('Confirmar agendamento')).not.toBeNull();
  });

  it('lançado em outra aba: o lançamento escolhido é recusado', async () => {
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
    m.freepasses = [{ ...FP, aulas: 0 }];
    await redesenhar();
    await clicar(comeca('Agendar 2 aulas'));
    expect(toast.warning).toHaveBeenCalledWith('O freepass mudou enquanto você agendava. Confira o passo Freepass.');
    expect(recordNewAppointment).not.toHaveBeenCalled();
  });

  it('os dados do freepass ainda não chegaram: não grava', async () => {
    m.freepasses = [FP];
    await montar();
    await abrirAula();
    await clicar(comeca('Usar o freepass'));
    await clicar(comeca('Leonardo'));
    await clicar(comeca('Hoje'));
    m.aulas = null;
    await redesenhar();
    await clicar(comeca('Confirmar agendamento'));
    expect(toast.warning).toHaveBeenCalledWith('Ainda carregando os dados do freepass. Tente de novo em instantes.');
    expect(recordNewAppointment).not.toHaveBeenCalled();
  });
});
