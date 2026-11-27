// @vitest-environment jsdom
// As leituras da Meta do professor: os estados de falta dele e os leads. Mesmo
// molde do useTeamRoutineMarks.test.js, com o Firestore trocado por um dublê.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const { listeners, getDocsMock } = vi.hoisted(() => ({ listeners: [], getDocsMock: vi.fn() }));

vi.mock('../firebase.js', () => ({
  appId: 'app-teste', FALTOSOS_PATH: 'stronix_faltosos', LEADS_PATH: 'stronix_leads', AULAS_PATH: 'stronix_aulas',
}));
vi.mock('firebase/firestore', () => ({
  collection: (db, ...path) => ({ kind: 'collection', path }),
  where: (field, op, value) => ({ kind: 'where', field, op, value }),
  documentId: () => '__id__',
  query: (ref, ...wheres) => ({ kind: 'query', ref, wheres }),
  getDocs: (q) => getDocsMock(q),
  onSnapshot: (q, next, err) => {
    const unsub = vi.fn();
    listeners.push({ q, next, err, unsub });
    return unsub;
  },
}));

const { useFaltososDoProfessor } = await import('../../hooks/useFaltososDoProfessor.js');
const { useAulasDeHojeDoProfessor } = await import('../../hooks/useAulasDeHojeDoProfessor.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const db = {};
let root = null;
let result = null;

function ProbeFaltosos(props) {
  result = useFaltososDoProfessor(props);
  return null;
}
function ProbeAulas(props) {
  result = useAulasDeHojeDoProfessor(props);
  return null;
}
async function montar(Probe, props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(Probe, props)); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  result = null;
  listeners.length = 0;
  getDocsMock.mockReset();
});

const ultima = () => listeners.at(-1);
const responder = (listener, snap) => act(async () => { listener.next(snap); });
// O dublê confere que o hook pede a hora estimada: sem isso, a tarefa recém
// gravada (feitaEm ainda pendente no servidor) chegaria nula.
const docEstado = (id, data) => ({
  id,
  data: (opts) => {
    expect(opts).toEqual({ serverTimestamps: 'estimate' });
    return data;
  },
});

describe('useFaltososDoProfessor', () => {
  it('lê os estados do professor e os leads deles', async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: 'l1', data: () => ({ name: 'Ana' }) }] });
    await montar(ProbeFaltosos, { db, professorId: 'p1', listenersActive: true });
    expect(result.carregando).toBe(true);
    expect(ultima().q.wheres.map((w) => [w.field, w.op, w.value])).toEqual([['professorId', '==', 'p1']]);
    await responder(ultima(), { docs: [docEstado('l1', { status: 'faltando', professorId: 'p1' })] });
    await act(async () => {});
    expect(result.carregando).toBe(false);
    expect(result.estados).toEqual([{ id: 'l1', leadId: 'l1', status: 'faltando', professorId: 'p1' }]);
    expect(result.leadsById.get('l1').name).toBe('Ana');
  });

  it('sem professor ou com o portão fechado, não assina nada', async () => {
    await montar(ProbeFaltosos, { db, professorId: null, listenersActive: true });
    expect(listeners).toHaveLength(0);
    await act(async () => { root.render(h(ProbeFaltosos, { db, professorId: 'p1', listenersActive: false })); });
    expect(listeners).toHaveLength(0);
  });
});

describe('useAulasDeHojeDoProfessor', () => {
  it('pede só o dia e filtra aula, professor e cancelada no navegador', async () => {
    await montar(ProbeAulas, { db, professorId: 'p1', now: new Date(2026, 10, 27, 10), listenersActive: true });
    const q = ultima().q;
    expect(q.wheres.map((w) => [w.field, w.op])).toEqual([['scheduledFor', '>='], ['scheduledFor', '<=']]);
    expect(q.wheres[0].value).toBeInstanceOf(Date);
    await responder(ultima(), {
      docs: [
        { id: 'a1', data: () => ({ type: 'aula', professorId: 'p1', status: 'agendada' }) },
        { id: 'a2', data: () => ({ type: 'aula', professorId: 'p2', status: 'agendada' }) },
        { id: 'a3', data: () => ({ type: 'aula', professorId: 'p1', status: 'cancelled' }) },
        { id: 'a4', data: () => ({ type: 'visita', professorId: 'p1', status: 'agendada' }) },
      ],
    });
    expect(result.map((a) => a.id)).toEqual(['a1']);
  });
});
