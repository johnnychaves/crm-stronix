// @vitest-environment jsdom
// Os checks de hoje da academia (aba Hoje das Rotinas) e o relógio de minuto.
// Mesmo molde do useMyRoutine.test.js: o Firestore trocado por um dublê que
// guarda cada assinatura, para o teste responder por ela na hora que quiser.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { listeners } = vi.hoisted(() => ({ listeners: [] }));

vi.mock('../firebase.js', () => ({ appId: 'app-teste', ROUTINE_MARKS_PATH: 'stronix_rotina_marcas' }));
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

const { useTeamRoutineMarks } = await import('../../hooks/useTeamRoutineMarks.js');
const { useMinuteClock } = await import('../../hooks/useMinuteClock.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const db = {};
let root = null;
let result = null;

function ProbeMarks(props) {
  result = useTeamRoutineMarks(props);
  return null;
}
function ProbeClock() {
  result = useMinuteClock();
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
  vi.useRealTimers();
});

const ultima = () => listeners.at(-1);
const responder = (listener, snap) => act(async () => { listener.next(snap); });
const falhar = (listener) => act(async () => { listener.err(new Error('permission-denied')); });
const docCheck = (id, data) => ({
  id,
  data: (opts) => {
    expect(opts).toEqual({ serverTimestamps: 'estimate' });
    return data;
  },
});
const quando = (hh, mm) => ({ toDate: () => new Date(2026, 9, 6, hh, mm) });
const DIA_1 = '2026-10-06';
const DIA_2 = '2026-10-07';

describe('useTeamRoutineMarks: os checks de hoje da academia', () => {
  it('antes da resposta: carregando, sem checks, e a consulta é só pelo dia', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    expect(result).toEqual({ marks: new Map(), loading: true, error: false });
    expect(ultima().q.ref.path).toEqual(['artifacts', 'app-teste', 'public', 'data', 'stronix_rotina_marcas']);
    expect(ultima().q.wheres.map((w) => [w.field, w.op, w.value])).toEqual([['date', '==', DIA_1]]);
  });

  it('separa os checks por pessoa e por tarefa', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await responder(ultima(), {
      docs: [
        docCheck('ana_2026-10-06_t1', { consultantId: 'ana', taskId: 't1', doneAt: quando(6, 4), note: '' }),
        docCheck('ana_2026-10-06_t3', { consultantId: 'ana', taskId: 't3', doneAt: quando(7, 58), note: 'Lista com 42 leads.' }),
        docCheck('bruno_2026-10-06_t1', { consultantId: 'bruno', taskId: 't1', doneAt: quando(6, 2) }),
      ],
    });
    expect(result.loading).toBe(false);
    expect(result.error).toBe(false);
    expect([...result.marks.keys()]).toEqual(['ana', 'bruno']);
    expect([...result.marks.get('ana').keys()]).toEqual(['t1', 't3']);
    expect(result.marks.get('ana').get('t3')).toEqual({ id: 'ana_2026-10-06_t3', doneAt: new Date(2026, 9, 6, 7, 58), note: 'Lista com 42 leads.' });
    expect(result.marks.get('bruno').get('t1').note).toBe('');
  });

  it('check sem pessoa ou sem tarefa fica de fora, e check sem hora chega sem hora', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await responder(ultima(), {
      docs: [
        docCheck('x1', { taskId: 't1', doneAt: quando(6, 4) }),
        docCheck('x2', { consultantId: 'ana', doneAt: quando(6, 4) }),
        docCheck('x3', { consultantId: 'ana', taskId: 't2', doneAt: null }),
      ],
    });
    expect([...result.marks.keys()]).toEqual(['ana']);
    expect(result.marks.get('ana').get('t2')).toEqual({ id: 'x3', doneAt: null, note: '' });
  });

  it('o dia vira com a assinatura desligada: os checks de ontem não aparecem', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    const deOntem = ultima();
    await responder(deOntem, { docs: [docCheck('c1', { consultantId: 'ana', taskId: 't1', doneAt: quando(6, 4) })] });
    expect(result.marks.size).toBe(1);
    await renderizar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_2, enabled: false });
    expect(deOntem.unsub).toHaveBeenCalled();
    expect(result.marks.size).toBe(0);
    expect(result.loading).toBe(true);
  });

  it('o dia vira com a assinatura ligada: assina o dia novo', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await responder(ultima(), { docs: [] });
    await renderizar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_2 });
    expect(ultima().q.wheres[0].value).toBe(DIA_2);
    expect(result.loading).toBe(true);
    await responder(ultima(), { docs: [] });
    expect(result.loading).toBe(false);
  });

  it('outra academia (Acessar como): sem os checks da anterior até a resposta da nova', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    const daA = ultima();
    await responder(daA, { docs: [docCheck('c1', { consultantId: 'ana', taskId: 't1', doneAt: quando(6, 4) })] });
    await renderizar(ProbeMarks, { db, tenantId: 'academia-b', dayKey: DIA_1 });
    expect(daA.unsub).toHaveBeenCalled();
    expect(result.marks.size).toBe(0);
    expect(result.loading).toBe(true);
  });

  it('a assinatura falha: error true, sem checks e sem carregar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1 });
    await falhar(ultima());
    expect(result).toEqual({ marks: new Map(), loading: false, error: true });
    expect(console.error).toHaveBeenCalled();
  });

  it('desligada desde o começo: não assina nada', async () => {
    await montar(ProbeMarks, { db, tenantId: 'academia-a', dayKey: DIA_1, enabled: false });
    expect(listeners).toHaveLength(0);
    expect(result.loading).toBe(true);
  });
});

describe('useMinuteClock', () => {
  it('anda a cada minuto e para de andar ao sair da tela', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 6, 10, 47, 30) });
    await montar(ProbeClock, {});
    expect(result.getMinutes()).toBe(47);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(result.getMinutes()).toBe(48);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => { root.unmount(); });
    root = null;
    expect(vi.getTimerCount()).toBe(0);
  });
});
