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
const T3 = 'carla_2026-10-06_t3';
const T4 = 'carla_2026-10-06_t4';
const CHECK_T3 = 'Marcar como feita: Conferir a limpeza';
const CHECK_T4 = 'Marcar como feita: Postar o story da aula das 12h';
const NOTE_INPUT = 'input[placeholder="Observação (opcional)"]';
const named = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
// O snapshot do Firestore devolve o check na hora, com a hora do servidor ainda
// pendente (doneAt nulo). O cartão só abre a observação quando ele chega.
const snapshot = async (taskId, mark) => {
  const marks = new Map(routine.value.marks);
  if (mark) marks.set(taskId, mark); else marks.delete(taskId);
  routine.value = { ...routine.value, marks };
  await render();
};
const pending = (id) => ({ id, doneAt: null, note: '' });
const key = async (el, k) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
};
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
    await click(button(CHECK_T4));
    expect(markDone).toHaveBeenCalledWith({ db: {}, appUser, model: MODEL, task: MODEL.tasks[2] });
    await snapshot('t4', pending(T4));
    const input = container.querySelector(NOTE_INPUT);
    expect(input).not.toBeNull();
    await type(input, 'Story postado');
    await click(named('Salvar'));
    expect(saveMarkNote).toHaveBeenCalledWith({ db: {}, markId: T4, note: 'Story postado' });
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
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
    await click(button(CHECK_T4));
    expect(toast.error).toHaveBeenCalledWith('Não deu para marcar a tarefa. Tente de novo.');
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
    // A observação aberta de olho no check também fechou: se o check aparecer
    // depois, por outro caminho, ela não reabre sozinha.
    await snapshot('t4', pending(T4));
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
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

  it('Desfazer dentro da observação desfaz aquele check e nunca marca de novo', async () => {
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    expect(container.querySelector(NOTE_INPUT)).not.toBeNull();
    await click(named('Desfazer'));
    expect(undoMark).toHaveBeenCalledTimes(1);
    expect(undoMark).toHaveBeenCalledWith({ db: {}, markId: T4 });
    expect(markDone).toHaveBeenCalledTimes(1);
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
  });

  it('a observação aberta não vaza quando o check some', async () => {
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    expect(container.querySelector(NOTE_INPUT)).not.toBeNull();
    await snapshot('t4', null);
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
  });

  it('observação vazia não grava nada, e o Esc fecha sem salvar', async () => {
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    await click(named('Salvar'));
    expect(saveMarkNote).not.toHaveBeenCalled();
    expect(container.querySelector(NOTE_INPUT)).toBeNull();

    await click(button('Desmarcar: Postar o story da aula das 12h'));
    await snapshot('t4', null);
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    await type(container.querySelector(NOTE_INPUT), 'rascunho');
    await key(container.querySelector(NOTE_INPUT), 'Escape');
    expect(saveMarkNote).not.toHaveBeenCalled();
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
  });

  it('o Enter salva a observação', async () => {
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    await type(container.querySelector(NOTE_INPUT), 'Postado às 11h');
    await key(container.querySelector(NOTE_INPUT), 'Enter');
    expect(saveMarkNote).toHaveBeenCalledWith({ db: {}, markId: T4, note: 'Postado às 11h' });
    expect(container.querySelector(NOTE_INPUT)).toBeNull();
  });

  it('se desfazer falhar, avisa', async () => {
    undoMark.mockRejectedValueOnce(new Error('offline'));
    await render();
    await click(button('Desmarcar: Conferir a agenda do dia na recepção'));
    expect(toast.error).toHaveBeenCalledWith('Não deu para desfazer. Tente de novo.');
  });

  it('se salvar a observação falhar, avisa', async () => {
    saveMarkNote.mockRejectedValueOnce(new Error('offline'));
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    await type(container.querySelector(NOTE_INPUT), 'Story postado');
    await click(named('Salvar'));
    expect(toast.error).toHaveBeenCalledWith('Não deu para salvar a observação. Tente de novo.');
  });

  it('marcar outra tarefa com observação digitada salva a anterior antes', async () => {
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    await type(container.querySelector(NOTE_INPUT), 'Story postado');

    await click(button(CHECK_T3));
    expect(saveMarkNote).toHaveBeenCalledTimes(1);
    expect(saveMarkNote).toHaveBeenCalledWith({ db: {}, markId: T4, note: 'Story postado' });
    expect(markDone).toHaveBeenLastCalledWith({ db: {}, appUser, model: MODEL, task: MODEL.tasks[1] });
    expect(saveMarkNote.mock.invocationCallOrder[0]).toBeLessThan(markDone.mock.invocationCallOrder[1]);

    // A observação nova é da outra tarefa e começa vazia.
    await snapshot('t3', pending(T3));
    const inputs = container.querySelectorAll(NOTE_INPUT);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].getAttribute('aria-label')).toBe('Observação sobre Conferir a limpeza');
    expect(inputs[0].value).toBe('');
  });

  it('marcar outra tarefa sem observação digitada não grava observação', async () => {
    await render();
    await click(button(CHECK_T4));
    await snapshot('t4', pending(T4));
    await click(button(CHECK_T3));
    expect(saveMarkNote).not.toHaveBeenCalled();
  });

  it('um check pendente trava só o próprio círculo', async () => {
    let release;
    markDone.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(T4); }));
    await render();
    await click(button(CHECK_T4));
    expect(button(CHECK_T4).disabled).toBe(true);
    expect(button(CHECK_T3).disabled).toBe(false);
    await click(button(CHECK_T3));
    expect(markDone).toHaveBeenCalledTimes(2);
    await act(async () => { release(); });
    expect(button(CHECK_T4).disabled).toBe(false);
  });

  it('check de outro dia ainda aparece marcado e o toque desfaz', async () => {
    await snapshot('t3', { id: T3, doneAt: new Date(2026, 9, 5, 22, 0), note: '' });
    const circle = button('Desmarcar: Conferir a limpeza');
    expect(circle).not.toBeNull();
    expect(circle.getAttribute('aria-pressed')).toBe('true');
    await click(circle);
    expect(undoMark).toHaveBeenCalledWith({ db: {}, markId: T3 });
    expect(markDone).not.toHaveBeenCalled();
  });

  it('o círculo tem fundo sólido no escuro, o check tem contraste e o ícone sem horário é decorativo', async () => {
    await render();
    const late = button(CHECK_T3);
    expect(late.className).toContain('dark:bg-[#2a1326]');
    expect(button(CHECK_T4).className).toContain('dark:bg-[#0c1126]');
    const done = button('Desmarcar: Conferir a agenda do dia na recepção');
    expect(done.className).toContain('bg-emerald-600');
    expect(done.className).toContain('dark:bg-emerald-500');
    expect(container.querySelector('svg[aria-label]')).toBeNull();
    expect(container.textContent).toContain('Sem horário');
  });
});
