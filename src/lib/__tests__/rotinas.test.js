import { describe, expect, it, vi } from 'vitest';
import {
  ALL_DAYS, MAX_TASKS_PER_MODEL, copyName, daysText, followerChanges, markDoneAt, markIdOf, minutesOf, modelDocs,
  modelNameProblem, modelOfUser, newTaskId, normalizeTask, removeTask, routineDayKey, routineParticipants,
  stateText, taskProblems, taskRunsOn, taskStateAt, tasksForDay, upsertTask,
} from '../rotinas.js';

// 06/10/2026 é terça (getDay 2); 10/10/2026 é sábado.
const at = (hhmm, day = 6) => { const [h, m] = hhmm.split(':').map(Number); return new Date(2026, 9, day, h, m); };
const task = (over = {}) => ({ id: 't1', title: 'Conferir a limpeza', how: '', days: ALL_DAYS, time: '10:30', active: true, ...over });
const SEG_A_SEX = [1, 2, 3, 4, 5];

describe('a tarefa do dia', () => {
  it('"todos os dias de trabalho" segue os dias da Meta da academia', () => {
    expect(taskRunsOn(task(), at('09:00'), SEG_A_SEX)).toBe(true);
    expect(taskRunsOn(task(), at('09:00', 10), SEG_A_SEX)).toBe(false);
    expect(taskRunsOn(task(), at('09:00', 10), [6])).toBe(true);
  });

  it('dias escolhidos valem por si, mesmo fora dos dias da Meta', () => {
    expect(taskRunsOn(task({ days: [1, 2] }), at('09:00'), SEG_A_SEX)).toBe(true);
    expect(taskRunsOn(task({ days: [4] }), at('09:00'), SEG_A_SEX)).toBe(false);
    expect(taskRunsOn(task({ days: [6] }), at('09:00', 10), SEG_A_SEX)).toBe(true);
  });

  it('tarefa pausada não vale', () => {
    expect(taskRunsOn(task({ active: false }), at('09:00'), SEG_A_SEX)).toBe(false);
  });

  it('as tarefas do dia saem em ordem de horário, as sem horário no fim', () => {
    const model = { tasks: [task({ id: 'a', time: null }), task({ id: 'b', time: '11:00' }), task({ id: 'c', time: '08:00' }), task({ id: 'd', days: [4] })] };
    expect(tasksForDay(model, at('09:00'), SEG_A_SEX).map((t) => t.id)).toEqual(['c', 'b', 'a']);
    expect(tasksForDay(null, at('09:00'), SEG_A_SEX)).toEqual([]);
  });
});

describe('o estado da tarefa', () => {
  it('com horário: mais tarde, agora até 30 minutos depois, e atrasada', () => {
    expect(taskStateAt(task(), null, at('10:00'))).toBe('later');
    expect(taskStateAt(task(), null, at('10:30'))).toBe('now');
    expect(taskStateAt(task(), null, at('11:00'))).toBe('now');
    expect(taskStateAt(task(), null, at('11:01'))).toBe('late');
  });

  it('feita até 30 minutos depois do horário é feita; depois disso, feita depois do horário', () => {
    expect(taskStateAt(task(), at('09:00'), at('12:00'))).toBe('done');
    expect(taskStateAt(task(), at('11:00'), at('12:00'))).toBe('done');
    expect(taskStateAt(task(), at('11:01'), at('12:00'))).toBe('doneLate');
  });

  it('sem horário: vale até o fim do dia, e feita é feita', () => {
    expect(taskStateAt(task({ time: null }), null, at('23:50'))).toBe('open');
    expect(taskStateAt(task({ time: null }), at('23:50'), at('23:55'))).toBe('done');
  });

  it('os textos do cartão', () => {
    expect(stateText(task(), 'late', null, at('11:05'))).toBe('Era às 10:30, atrasada há 35 min');
    expect(stateText(task({ time: '18:00' }), 'later', null, at('11:05'))).toBe('Em 6h 55min');
    expect(stateText(task({ time: '12:00' }), 'later', null, at('11:00'))).toBe('Em 1h');
    expect(stateText(task(), 'now', null, at('10:40'))).toBe('É agora');
    expect(stateText(task(), 'done', at('08:06'), at('11:05'))).toBe('Feita às 08:06');
    expect(stateText(task(), 'doneLate', at('10:12'), at('11:05'))).toBe('Feita às 10:12, depois do horário');
    expect(stateText(task({ time: null }), 'open', null, at('11:05'))).toBe('Até o fim do dia');
    expect(stateText(task({ time: null, days: [1, 2] }), 'open', null, at('11:05'))).toBe('Segundas e terças · até o fim do dia');
  });
});

describe('textos do modelo', () => {
  it('os dias da semana', () => {
    expect(daysText(ALL_DAYS)).toBe('Todos os dias de trabalho');
    expect(daysText([5, 1, 2, 3, 4])).toBe('Segunda a sexta');
    expect(daysText([2, 4])).toBe('Terças e quintas');
    expect(daysText([6, 0])).toBe('Sábados e domingos');
    expect(daysText([1, 3, 5])).toBe('Segundas, quartas e sextas');
  });

  it('nome de cópia sem repetir', () => {
    expect(copyName('Consultor da manhã', [])).toBe('Cópia de Consultor da manhã');
    expect(copyName('Consultor da manhã', [{ name: 'Cópia de Consultor da manhã' }])).toBe('Cópia de Consultor da manhã (2)');
    // 'Cópia de Um nome bem comprido que passa do limite' cortado em 40 termina em espaço: o espaço sai.
    const longName = 'Um nome bem comprido que passa do limite';
    expect(`Cópia de ${longName}`.slice(0, 40)).toBe('Cópia de Um nome bem comprido que passa ');
    expect(copyName(longName, [])).toBe('Cópia de Um nome bem comprido que passa');
    // O nome cortado já existe: sai a variante (2), que também cabe em 40 e não deixa espaço antes dela.
    const second = copyName(longName, [{ name: 'Cópia de Um nome bem comprido que passa' }]);
    expect(second).toBe('Cópia de Um nome bem comprido que pa (2)');
    expect(second.length).toBeLessThanOrEqual(40);
  });

  it('nome de cópia cortado em espaço não deixa espaço antes do (2)', () => {
    // Aqui o corte em 36 (40 menos o " (2)") cai logo depois de um espaço.
    const name = 'Um nome bem comprido quase xx yy zz';
    expect(`Cópia de ${name}`.slice(0, 36)).toBe('Cópia de Um nome bem comprido quase ');
    const first = copyName(name, []);
    expect(first).toBe('Cópia de Um nome bem comprido quase xx y');
    expect(copyName(name, [{ name: first }])).toBe('Cópia de Um nome bem comprido quase (2)');
  });
});

describe('validação', () => {
  const models = [{ id: 'm1', name: 'Consultor da manhã' }];

  it('nome do modelo', () => {
    expect(modelNameProblem('  ', models)).toBe('Escreva o nome do modelo.');
    expect(modelNameProblem('x'.repeat(41), models)).toBe('O nome pode ter até 40 caracteres.');
    expect(modelNameProblem(' consultor DA manhã ', models)).toBe('Já existe um modelo com esse nome.');
    expect(modelNameProblem('Consultor da manhã', models, 'm1')).toBe(null);
    expect(modelNameProblem('Consultor da tarde', models)).toBe(null);
  });

  it('tarefa', () => {
    expect(taskProblems({ title: '', how: '', days: ALL_DAYS, time: '09:00' })).toEqual({ title: 'Escreva o nome da tarefa.' });
    expect(taskProblems({ title: 'Ok', how: '', days: [], time: null })).toEqual({ days: 'Escolha pelo menos um dia.' });
    expect(taskProblems({ title: 'Ok', how: '', days: ALL_DAYS, time: '25:00' })).toEqual({ time: 'Escolha o horário.' });
    expect(taskProblems({ title: 'Ok', how: 'x'.repeat(241), days: ALL_DAYS, time: null })).toEqual({ how: 'Até 240 caracteres.' });
    expect(taskProblems({ title: 'Ok', how: '', days: [2], time: '09:00' })).toEqual({});
  });

  it('dia que não existe não vale como dia escolhido', () => {
    expect(taskProblems({ title: 'Ok', how: '', days: [7], time: null })).toEqual({ days: 'Escolha pelo menos um dia.' });
    expect(taskProblems({ title: 'Ok', how: '', days: [1, 9], time: null })).toEqual({ days: 'Escolha pelo menos um dia.' });
    expect(taskProblems({ title: 'Ok', how: '', days: 'segunda', time: null })).toEqual({ days: 'Escolha pelo menos um dia.' });
    expect(taskProblems({ title: 'Ok', how: '', days: [0, 6], time: null })).toEqual({});
  });

  it('a tarefa gravada sem horário ou sem dias não quebra', () => {
    expect(normalizeTask({ title: 'Ok', how: '', days: ALL_DAYS, time: undefined }, 't').time).toBe(null);
    expect(normalizeTask({ title: 'Ok', how: '', days: ALL_DAYS, time: '25:00' }, 't').time).toBe(null);
    expect(normalizeTask({ title: 'Ok', how: '', days: undefined, time: null }, 't').days).toEqual([]);
    expect(normalizeTask({ title: 'Ok', how: '', days: 'segunda', time: null }, 't').days).toEqual([]);
  });

  it('o id da tarefa tem 12 letras ou números e não se repete', () => {
    const a = newTaskId();
    const b = newTaskId();
    expect(a).toMatch(/^[a-z0-9]{12}$/i);
    expect(b).toMatch(/^[a-z0-9]{12}$/i);
    expect(a).not.toBe(b);
  });

  it('o id da tarefa sai também onde o navegador não tem randomUUID', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', undefined);
    try {
      const a = newTaskId();
      const b = newTaskId();
      expect(a).toMatch(/^[a-z0-9]{12}$/i);
      expect(b).toMatch(/^[a-z0-9]{12}$/i);
      expect(a).not.toBe(b);
    } finally {
      vi.stubGlobal('crypto', real);
    }
  });

  it('a tarefa gravada sai limpa, com os dias em ordem', () => {
    expect(normalizeTask({ title: ' Postar o story ', how: ' ', days: [5, 1], time: '11:00' }, 't9'))
      .toEqual({ id: 't9', title: 'Postar o story', how: '', days: [1, 5], time: '11:00', active: true });
    expect(normalizeTask({ title: 'Ok', how: '', days: ALL_DAYS, time: null, active: false }, 't1').active).toBe(false);
  });

  it('o limite de tarefas é 30', () => {
    expect(MAX_TASKS_PER_MODEL).toBe(30);
  });

  it('minutos do horário', () => {
    expect(minutesOf('07:30')).toBe(450);
    expect(minutesOf('24:00')).toBe(null);
    expect(minutesOf(null)).toBe(null);
  });
});

describe('lista de tarefas', () => {
  it('troca a tarefa pelo id ou acrescenta no fim, e tira pelo id', () => {
    const list = [task({ id: 'a' }), task({ id: 'b' })];
    expect(upsertTask(list, task({ id: 'b', title: 'Nova' })).map((t) => t.title)).toEqual(['Conferir a limpeza', 'Nova']);
    expect(upsertTask(list, task({ id: 'c' })).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(removeTask(list, 'a').map((t) => t.id)).toEqual(['b']);
  });
});

describe('quem segue', () => {
  const models = [
    { id: 'm1', name: 'Manhã', followerIds: ['carla', 'diego'] },
    { id: 'm2', name: 'Tarde', followerIds: ['ana'] },
  ];

  it('cada pessoa segue um modelo só', () => {
    expect(modelOfUser(models, 'ana').id).toBe('m2');
    expect(modelOfUser(models, 'bruno')).toBe(null);
  });

  it('pôr alguém num modelo tira a pessoa do modelo anterior', () => {
    const changes = followerChanges(models, 'm1', ['ana']);
    expect(Object.fromEntries(changes)).toEqual({ m2: [], m1: ['carla', 'diego', 'ana'] });
  });

  it('pôr de novo quem já está não muda a lista, e tirar funciona', () => {
    expect(Object.fromEntries(followerChanges(models, 'm1', ['carla']))).toEqual({ m1: ['carla', 'diego'] });
    expect(Object.fromEntries(followerChanges(models, 'm1', [], ['diego']))).toEqual({ m1: ['carla'] });
  });

  it('modelo de destino que sumiu não muda ninguém', () => {
    expect(Object.fromEntries(followerChanges(models, 'mx', ['ana']))).toEqual({});
    expect(followerChanges(models, 'mx', ['ana'], ['carla']).size).toBe(0);
  });

  it('pôr duas pessoas de modelos diferentes de uma vez tira cada uma do modelo antigo', () => {
    const three = [...models, { id: 'm3', name: 'Noite', followerIds: [] }];
    expect(Object.fromEntries(followerChanges(three, 'm3', ['ana', 'carla']))).toEqual({
      m2: [], m1: ['diego'], m3: ['ana', 'carla'],
    });
  });

  it('só consultor ativo, com nome, segue modelo', () => {
    const users = [
      { id: 'carla', name: 'Carla', role: 'consultant' },
      { id: 'g', name: 'Gestora', role: 'admin' },
      { id: 'p', name: 'Prof', role: 'professor', professorId: 'x' },
      { id: 'saiu', name: 'Saiu', role: 'consultant', active: false },
      { id: 'semnome', role: 'consultant' },
    ];
    expect(routineParticipants(users).map((u) => u.id)).toEqual(['carla']);
  });
});

describe('o check só conta no próprio dia', () => {
  it('a hora do check precisa cair no dia do check', () => {
    expect(markDoneAt({ doneAt: at('08:06') }, '2026-10-06')).toEqual(at('08:06'));
    expect(markDoneAt({ doneAt: at('23:50', 5) }, '2026-10-06')).toBe(null);
    expect(markDoneAt({ doneAt: null }, '2026-10-06')).toBe(null);
    expect(markDoneAt(null, '2026-10-06')).toBe(null);
  });

  it('aceita a hora como o Timestamp do Firestore', () => {
    expect(markDoneAt({ doneAt: { toDate: () => at('08:06') } }, '2026-10-06')).toEqual(at('08:06'));
    expect(markDoneAt({ doneAt: { toDate: () => at('23:50', 5) } }, '2026-10-06')).toBe(null);
    expect(markDoneAt({ doneAt: { toDate: () => 'não é data' } }, '2026-10-06')).toBe(null);
    expect(markDoneAt({ doneAt: { seconds: 1 } }, '2026-10-06')).toBe(null);
  });
});

describe('o que é gravado', () => {
  it('o id do check', () => {
    expect(markIdOf('carla', '2026-10-06', 't4')).toBe('carla_2026-10-06_t4');
    expect(routineDayKey(at('23:59'))).toBe('2026-10-06');
  });

  it('o modelo e a versão do dia', () => {
    const tasks = [task()];
    expect(modelDocs({ modelId: 'm1', name: ' Manhã ', tasks, followerIds: ['carla'], userId: 'g', dateKey: '2026-10-06' })).toEqual({
      model: { name: 'Manhã', tasks, followerIds: ['carla'] },
      version: { id: 'm1_2026-10-06', data: { modelId: 'm1', date: '2026-10-06', name: 'Manhã', tasks, followerIds: ['carla'], deleted: false, savedBy: 'g' } },
    });
  });

  it('o modelo excluído deixa a versão sem ninguém', () => {
    const { version } = modelDocs({ modelId: 'm1', name: 'Manhã', tasks: [], followerIds: ['carla'], deleted: true, userId: 'g', dateKey: '2026-10-06' });
    expect(version.data).toMatchObject({ deleted: true, followerIds: [] });
  });
});
