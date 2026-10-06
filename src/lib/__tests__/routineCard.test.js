// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const routine = vi.hoisted(() => ({ value: null }));
vi.mock('../../hooks/useMyRoutine.js', () => ({ useMyRoutine: () => routine.value }));
vi.mock('../rotinasWrites.js', () => ({
  markDone: vi.fn(async () => 'carla_2026-10-06_t4'),
  saveMarkNote: vi.fn(async () => {}),
  undoMark: vi.fn(async () => {}),
}));

const { markDone, saveMarkNote, undoMark } = await import('../rotinasWrites.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { RoutineCard } = await import('../../components/dailygoal/RoutineCard.jsx');

const MODEL = {
  id: 'm1', name: 'Consultor da manhã', followerIds: ['carla'],
  tasks: [
    { id: 't1', title: 'Conferir a agenda do dia na recepção', how: '', days: 'all', time: '08:00', active: true },
    { id: 't3', title: 'Conferir a limpeza', how: '', days: 'all', time: '10:30', active: true },
    { id: 't4', title: 'Postar o story da aula das 12h', how: '', days: 'all', time: '11:00', active: true },
    { id: 't6', title: 'Revisar as perdas da semana', how: '', days: [1, 2], time: null, active: true },
    { id: 't7', title: 'Organizar o mural', how: '', days: [5], time: '17:00', active: true },
  ],
};
const NOW = new Date(2026, 9, 6, 11, 5); // terça
const appUser = { id: 'carla', authUid: 'carla', name: 'Carla Souza', role: 'consultant' };
const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  routine.value = {
    model: MODEL,
    marks: new Map([['t1', { id: 'carla_2026-10-06_t1', doneAt: new Date(2026, 9, 6, 8, 6), note: '' }]]),
    loading: false,
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async () => {
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(RoutineCard, { db: {}, appUser, enabled: true, now: NOW, metaWeekdays: [1, 2, 3, 4, 5] })));
  });
};
const button = (label) => container.querySelector(`button[aria-label="${label}"]`);
const click = async (el) => { await act(async () => { el.click(); }); };
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('cartão Rotina de hoje', () => {
  it('mostra as tarefas do dia com a contagem e o estado de cada uma', async () => {
    await render();
    const text = container.textContent;
    expect(text).toContain('Rotina de hoje');
    expect(text).toContain('Montada pelo gestor. Não conta na sua meta.');
    expect(text).toContain('1 de 4');
    expect(text).toContain('Feita às 08:06');
    expect(text).toContain('Era às 10:30, atrasada há 35 min');
    expect(text).toContain('É agora');
    expect(text).toContain('Segundas e terças · até o fim do dia');
    expect(text).not.toContain('Organizar o mural');
  });

  it('o toque marca a tarefa e abre a observação, que salva só o texto', async () => {
    await render();
    await click(button('Marcar como feita: Postar o story da aula das 12h'));
    expect(markDone).toHaveBeenCalledWith({ db: {}, appUser, model: MODEL, task: MODEL.tasks[2] });
    const input = container.querySelector('input[placeholder="Observação (opcional)"]');
    expect(input).not.toBeNull();
    await type(input, 'Story postado');
    await click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Salvar'));
    expect(saveMarkNote).toHaveBeenCalledWith({ db: {}, markId: 'carla_2026-10-06_t4', note: 'Story postado' });
    expect(container.querySelector('input[placeholder="Observação (opcional)"]')).toBeNull();
  });

  it('o toque numa tarefa feita desfaz o check', async () => {
    await render();
    await click(button('Desmarcar: Conferir a agenda do dia na recepção'));
    expect(undoMark).toHaveBeenCalledWith({ db: {}, markId: 'carla_2026-10-06_t1' });
  });

  it('a observação salva aparece embaixo da tarefa', async () => {
    routine.value.marks.set('t3', { id: 'carla_2026-10-06_t3', doneAt: new Date(2026, 9, 6, 10, 44), note: 'Faltava papel, já reposto' });
    await render();
    expect(container.textContent).toContain('Faltava papel, já reposto');
  });

  it('se marcar falhar, avisa e não abre a observação', async () => {
    markDone.mockRejectedValueOnce(new Error('permission-denied'));
    await render();
    await click(button('Marcar como feita: Postar o story da aula das 12h'));
    expect(toast.error).toHaveBeenCalledWith('Não deu para marcar a tarefa. Tente de novo.');
    expect(container.querySelector('input[placeholder="Observação (opcional)"]')).toBeNull();
  });

  it('enquanto carrega, ou se a leitura falhou, o cartão não aparece', async () => {
    routine.value = { model: MODEL, marks: new Map(), loading: true, error: false };
    await render();
    expect(container.innerHTML).toBe('');
    routine.value = { model: MODEL, marks: new Map(), loading: false, error: true };
    await render();
    expect(container.innerHTML).toBe('');
  });

  it('sem modelo, ou sem tarefa no dia, o cartão não aparece', async () => {
    routine.value = { model: null, marks: new Map(), loading: false };
    await render();
    expect(container.innerHTML).toBe('');
    routine.value = { model: { ...MODEL, tasks: [MODEL.tasks[4]] }, marks: new Map(), loading: false };
    await render();
    expect(container.innerHTML).toBe('');
  });
});
