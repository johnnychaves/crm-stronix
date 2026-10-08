// @vitest-environment jsdom
// As assinaturas das rotinas guardam cada resposta com a pessoa, o dia e a
// academia a que pertence (revisão da Task 4). Uma aba esquecida aberta pela
// noite desliga a assinatura pelo portão de ociosidade, o dia vira, e os checks
// de ontem não podem chegar ao cartão: o cartão desfaria o check de ontem. O
// "Acessar como" troca de pessoa e de academia sem recarregar a página, e a
// resposta da pessoa anterior também não pode aparecer. Os hooks são
// renderizados de verdade em jsdom, com o Firestore trocado por um dublê que
// guarda cada assinatura, para o teste responder por ela na hora que quiser.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { listeners } = vi.hoisted(() => ({ listeners: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'app-teste',
  ROUTINE_MODELS_PATH: 'stronix_routine_models',
  ROUTINE_MARKS_PATH: 'stronix_routine_marks',
}));

vi.mock('firebase/firestore', () => ({
  collection: (db, ...path) => ({ kind: 'collection', path }),
  where: (field, op, value) => ({ kind: 'where', field, op, value }),
  query: (ref, ...wheres) => ({ kind: 'query', ref, wheres }),
  onSnapshot: (q, next, err) => {
    const unsub = vi.fn();
    listeners.push({ q, next, err, unsub });
    return unsub;
  },
}));

const { useMyRoutine } = await import('../../hooks/useMyRoutine.js');
const { useRoutineModels } = await import('../../hooks/useRoutineModels.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const db = {};
let root = null;
let result = null;

function ProbeRoutine(props) {
  result = useMyRoutine(props);
  return null;
}
function ProbeModels(props) {
  result = useRoutineModels(props);
  return null;
}

async function montar(Probe, props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(Probe, props)); });
}
const renderizar = (Probe, props) => act(async () => { root.render(h(Probe, props)); });

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  result = null;
  listeners.length = 0;
  vi.restoreAllMocks();
});

// A assinatura mais recente de cada consulta (o effect assina de novo quando a
// chave muda).
const doModelo = () => listeners.filter((l) => l.q.kind === 'query' && l.q.wheres[0].field === 'followerIds').at(-1);
const dosChecks = () => listeners.filter((l) => l.q.kind === 'query' && l.q.wheres[0].field === 'consultantId').at(-1);
const dosModelos = () => listeners.filter((l) => l.q.kind === 'collection').at(-1);

const responder = (listener, snap) => act(async () => { listener.next(snap); });
const falhar = (listener) => act(async () => { listener.err(new Error('permission-denied')); });

const docModelo = (id, name) => ({ id, data: () => ({ name, followerIds: ['u1'], tasks: [] }) });
const docCheck = (id, taskId, date, note) => ({
  id,
  data: (opts) => {
    expect(opts).toEqual({ serverTimestamps: 'estimate' });
    return { taskId, doneAt: { toDate: () => date }, note };
  },
});

const DIA_1 = '2026-10-06';
const DIA_2 = '2026-10-07';

describe('useMyRoutine: cada resposta fica com a pessoa e o dia que a pediram', () => {
  it('antes de qualquer resposta: carregando, sem modelo e sem checks', async () => {
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    expect(result.loading).toBe(true);
    expect(result.error).toBe(false);
    expect(result.model).toBeNull();
    expect(result.marks.size).toBe(0);
    expect(doModelo().q.wheres[0]).toMatchObject({ op: 'array-contains', value: 'u1' });
    expect(dosChecks().q.wheres.map((w) => [w.field, w.value])).toEqual([['consultantId', 'u1'], ['date', DIA_1]]);
  });

  it('com o modelo e depois os checks do dia: deixa de carregar e entrega os checks', async () => {
    const quando = new Date(2026, 9, 6, 9, 30);
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });

    await responder(doModelo(), { docs: [docModelo('m2', 'Zeta'), docModelo('m1', 'Alfa')] });
    expect(result.model).toMatchObject({ id: 'm1', name: 'Alfa' });
    // com modelo, ainda espera os checks do dia
    expect(result.loading).toBe(true);

    await responder(dosChecks(), { docs: [docCheck('c1', 't1', quando, 'feito')] });
    expect(result.loading).toBe(false);
    expect(result.error).toBe(false);
    expect(result.marks.size).toBe(1);
    const mark = result.marks.get('t1');
    expect(mark.id).toBe('c1');
    expect(mark.note).toBe('feito');
    expect(mark.doneAt).toBeInstanceOf(Date);
    expect(mark.doneAt.getTime()).toBe(quando.getTime());
  });

  it('pessoa sem modelo não espera os checks para deixar de carregar', async () => {
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    await responder(doModelo(), { docs: [] });
    expect(result.model).toBeNull();
    expect(result.loading).toBe(false);
  });

  it('o dia vira com a assinatura desligada: os checks de ontem não aparecem', async () => {
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    await responder(doModelo(), { docs: [docModelo('m1', 'Alfa')] });
    await responder(dosChecks(), { docs: [docCheck('c1', 't1', new Date(2026, 9, 6, 9, 30), '')] });
    expect(result.marks.has('t1')).toBe(true);

    const checksDeOntem = dosChecks();
    // portão de ociosidade desligado, e a meia-noite passou
    await renderizar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_2, enabled: false });
    expect(checksDeOntem.unsub).toHaveBeenCalled();
    expect(result.marks.size).toBe(0);
    expect(result.marks.has('t1')).toBe(false);
  });

  it('o dia vira com a assinatura ligada: sem os checks de ontem e carregando até os de hoje', async () => {
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    await responder(doModelo(), { docs: [docModelo('m1', 'Alfa')] });
    await responder(dosChecks(), { docs: [docCheck('c1', 't1', new Date(2026, 9, 6, 9, 30), '')] });

    await renderizar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_2 });
    expect(result.marks.size).toBe(0);
    expect(result.loading).toBe(true);
    expect(dosChecks().q.wheres[1].value).toBe(DIA_2);

    await responder(dosChecks(), { docs: [docCheck('c2', 't2', new Date(2026, 9, 7, 8, 0), '')] });
    expect(result.loading).toBe(false);
    expect([...result.marks.keys()]).toEqual(['t2']);
  });

  it('outra pessoa (Acessar como): sem o modelo nem os checks da anterior, e carregando até a resposta dela', async () => {
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    await responder(doModelo(), { docs: [docModelo('m1', 'Alfa')] });
    await responder(dosChecks(), { docs: [docCheck('c1', 't1', new Date(2026, 9, 6, 9, 30), '')] });
    expect(result.model).not.toBeNull();

    await renderizar(ProbeRoutine, { db, userId: 'u2', dayKey: DIA_1 });
    expect(result.model).toBeNull();
    expect(result.marks.size).toBe(0);
    expect(result.loading).toBe(true);
    expect(doModelo().q.wheres[0].value).toBe('u2');

    await responder(doModelo(), { docs: [docModelo('m9', 'Outro')] });
    expect(result.model).toMatchObject({ id: 'm9' });
    // o modelo de u2 chegou, mas os checks de u2 ainda não
    expect(result.loading).toBe(true);
    expect(result.marks.size).toBe(0);

    await responder(dosChecks(), { docs: [] });
    expect(result.loading).toBe(false);
  });

  it('sem pessoa: não assina nada e não fica carregando', async () => {
    await montar(ProbeRoutine, { db, userId: undefined, dayKey: DIA_1 });
    expect(listeners).toHaveLength(0);
    expect(result.loading).toBe(false);
    expect(result.model).toBeNull();
    expect(result.marks.size).toBe(0);
  });

  it('a assinatura dos checks falha: error true e deixa de carregar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    await responder(doModelo(), { docs: [docModelo('m1', 'Alfa')] });
    expect(result.loading).toBe(true);

    await falhar(dosChecks());
    expect(result.error).toBe(true);
    expect(result.loading).toBe(false);
    expect(result.marks.size).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it('a assinatura do modelo falha: error true, sem modelo e sem carregar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });

    await falhar(doModelo());
    expect(result.error).toBe(true);
    expect(result.loading).toBe(false);
    expect(result.model).toBeNull();
  });

  it('o erro de um dia não vaza para o dia seguinte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_1 });
    await responder(doModelo(), { docs: [docModelo('m1', 'Alfa')] });
    await falhar(dosChecks());
    expect(result.error).toBe(true);

    await renderizar(ProbeRoutine, { db, userId: 'u1', dayKey: DIA_2 });
    expect(result.error).toBe(false);
    expect(result.loading).toBe(true);
  });
});

describe('useRoutineModels: a resposta fica com a academia que a pediu', () => {
  it('antes da resposta: carregando e sem modelos', async () => {
    await montar(ProbeModels, { db, tenantId: 'academia-a' });
    expect(result.loading).toBe(true);
    expect(result.error).toBe(false);
    expect(result.models).toEqual([]);
  });

  it('entrega os modelos em ordem de nome', async () => {
    await montar(ProbeModels, { db, tenantId: 'academia-a' });
    await responder(dosModelos(), { docs: [docModelo('m2', 'Zeta'), docModelo('m1', 'Alfa')] });
    expect(result.loading).toBe(false);
    expect(result.models.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('outra academia (Acessar como): sem os modelos da anterior até a resposta da nova', async () => {
    await montar(ProbeModels, { db, tenantId: 'academia-a' });
    const daA = dosModelos();
    await responder(daA, { docs: [docModelo('m1', 'Alfa')] });
    expect(result.models).toHaveLength(1);

    await renderizar(ProbeModels, { db, tenantId: 'academia-b' });
    expect(daA.unsub).toHaveBeenCalled();
    expect(result.models).toEqual([]);
    expect(result.loading).toBe(true);

    await responder(dosModelos(), { docs: [docModelo('m7', 'Beta')] });
    expect(result.loading).toBe(false);
    expect(result.models.map((m) => m.id)).toEqual(['m7']);
  });

  it('a assinatura falha: error true, lista vazia e deixa de carregar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar(ProbeModels, { db, tenantId: 'academia-a' });
    await falhar(dosModelos());
    expect(result.error).toBe(true);
    expect(result.loading).toBe(false);
    expect(result.models).toEqual([]);
  });

  it('sem tenantId e sem resposta ainda: não quebra e fica carregando', async () => {
    await montar(ProbeModels, { db });
    expect(result.loading).toBe(true);
    expect(result.models).toEqual([]);
  });
});
