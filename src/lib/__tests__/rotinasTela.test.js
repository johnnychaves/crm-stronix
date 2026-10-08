import { describe, expect, it } from 'vitest';
import { ALL_DAYS } from '../rotinas.js';
import {
  DAY_LINE_END, DAY_LINE_START, MODEL_GAP_MINUTES, clockText, dayLineLabels, dayLinePct, findSelection, gapText, hourLabel,
  isDoneState, lateText, modelCardSummary, modelChips, modelDayRows, modelFreeTasks, modelPausedTasks, modelSummary,
  modelSelectDomId, modelTimes, personDay, personTodayText, taskDomId, teamToday, todayHeadline,
} from '../rotinasTela.js';

// 06/10/2026 é terça; 07/10/2026 é quarta; 10/10/2026 é sábado.
const at = (hhmm, day = 6) => { const [h, m] = hhmm.split(':').map(Number); return new Date(2026, 9, day, h, m); };
const task = (id, time, over = {}) => ({ id, title: `Tarefa ${id}`, how: '', days: ALL_DAYS, time, active: true, ...over });
const SEG_A_SEX = [1, 2, 3, 4, 5];
// O "Consultor manhã" do mockup: 8 com horário, das 06:00 às 13:00, e 3 a qualquer hora.
const MANHA = {
  id: 'm1',
  name: 'Consultor manhã',
  tasks: [
    task('a', '06:00'), task('b', '06:30'), task('c', '07:00'), task('d', '07:30'), task('e', '10:00'),
    task('f', '11:00'), task('g', '12:00', { days: [1, 3, 5] }), task('h', '13:00'),
    task('i', null), task('j', null), task('k', null),
  ],
};

describe('a linha do dia do cartão', () => {
  it('vai das 06h às 21h, e o que passa das pontas fica na ponta', () => {
    expect(DAY_LINE_START).toBe(360);
    expect(DAY_LINE_END).toBe(1260);
    expect(dayLinePct(360)).toBe(0);
    expect(dayLinePct(1260)).toBe(100);
    expect(dayLinePct(810)).toBe(50);
    expect(dayLinePct(300)).toBe(0);
    expect(dayLinePct(1380)).toBe(100);
  });

  it('os rótulos das horas', () => {
    expect(hourLabel(360)).toBe('06h');
    expect(hourLabel(780)).toBe('13h');
    expect(hourLabel(810)).toBe('13h30');
  });

  it('os horários do modelo são os das tarefas ativas com horário, em ordem', () => {
    const model = { tasks: [task('a', '10:00'), task('b', '07:30'), task('c', null), task('d', '08:00', { active: false })] };
    expect(modelTimes(model)).toEqual([450, 600]);
    expect(modelTimes(null)).toEqual([]);
  });

  it('rótulos: as pontas sempre, e o primeiro e o último horário quando não encostam em outro rótulo', () => {
    // Manhã: o 06:00 cai em cima do 06h; o 13:00 ganha rótulo.
    expect(dayLineLabels(modelTimes(MANHA)).map((l) => l.text)).toEqual(['06h', '13h', '21h']);
    // Tarde: o 13:00 ganha rótulo; o 21:00 cai em cima do 21h.
    expect(dayLineLabels([780, 840, 960, 1080, 1170, 1260]).map((l) => l.text)).toEqual(['06h', '13h', '21h']);
    expect(dayLineLabels([480, 1020]).map((l) => l.text)).toEqual(['06h', '08h', '17h', '21h']);
    // Um horário só aparece uma vez, e dois horários colados ficam com um rótulo.
    expect(dayLineLabels([720]).map((l) => l.text)).toEqual(['06h', '12h', '21h']);
    expect(dayLineLabels([720, 760]).map((l) => l.text)).toEqual(['06h', '12h', '21h']);
    // Perto das pontas, só as pontas.
    expect(dayLineLabels([400, 1240]).map((l) => l.text)).toEqual(['06h', '21h']);
    expect(dayLineLabels([])).toEqual([
      { pct: 0, text: '06h', align: 'start' },
      { pct: 100, text: '21h', align: 'end' },
    ]);
    expect(dayLineLabels([720]).find((l) => l.text === '12h')).toEqual({ pct: 40, text: '12h', align: 'center' });
  });
});

describe('os textos do modelo', () => {
  it('o resumo do cartão', () => {
    expect(modelSummary(MANHA)).toEqual({ timed: 8, free: 3, first: '06:00', last: '13:00' });
    expect(modelCardSummary(MANHA)).toBe('8 tarefas · das 06:00 às 13:00 · 3 a qualquer hora');
    expect(modelCardSummary({ tasks: [task('a', '13:00'), task('b', '21:00')] })).toBe('2 tarefas · das 13:00 às 21:00');
    expect(modelCardSummary({ tasks: [task('a', '08:00'), task('b', null)] })).toBe('1 tarefa · às 08:00 · 1 a qualquer hora');
    expect(modelCardSummary({ tasks: [task('a', null), task('b', null)] })).toBe('2 tarefas a qualquer hora');
    expect(modelCardSummary({ tasks: [task('a', '08:00', { active: false })] })).toBe('Nenhuma tarefa ativa');
    expect(modelCardSummary({ tasks: [] })).toBe('Nenhuma tarefa ainda');
  });

  it('as etiquetas do modelo aberto', () => {
    expect(modelChips(MANHA)).toEqual(['8 tarefas no horário, das 06:00 às 13:00', '3 a qualquer hora']);
    expect(modelChips({ tasks: [task('a', '08:00')] })).toEqual(['1 tarefa no horário, às 08:00']);
    expect(modelChips({ tasks: [task('a', null)] })).toEqual(['1 a qualquer hora']);
    expect(modelChips({ tasks: [] })).toEqual([]);
  });

  it('o dia do modelo: as tarefas com horário em ordem, com o vão de 90 minutos ou mais', () => {
    const rows = modelDayRows(MANHA);
    expect(rows.map((r) => (r.kind === 'gap' ? gapText(r.minutes) : r.task.time))).toEqual([
      '06:00', '06:30', '07:00', '07:30', '2h30 sem tarefa', '10:00', '11:00', '12:00', '13:00',
    ]);
    expect(rows.find((r) => r.kind === 'gap')).toEqual({ kind: 'gap', key: 'vao-d', minutes: 150 });
  });

  it('o vão começa em 90 minutos, e as pausadas e as sem horário ficam fora da linha', () => {
    expect(MODEL_GAP_MINUTES).toBe(90);
    const model = { tasks: [task('a', '08:00'), task('b', '09:29'), task('c', '10:59'), task('p', '09:00', { active: false }), task('s', null)] };
    expect(modelDayRows(model).map((r) => r.key)).toEqual(['a', 'b', 'vao-b', 'c']);
    expect(gapText(90)).toBe('1h30 sem tarefa');
    expect(gapText(180)).toBe('3h sem tarefa');
    expect(gapText(125)).toBe('2h05 sem tarefa');
  });

  it('os grupos de baixo: as sem horário ativas, na ordem do modelo, e as pausadas, em ordem de horário', () => {
    const model = { tasks: [task('a', null), task('b', '08:00', { active: false }), task('c', null, { active: false }), task('d', '07:00', { active: false }), task('e', '09:00'), task('f', null)] };
    expect(modelFreeTasks(model).map((t) => t.id)).toEqual(['a', 'f']);
    expect(modelPausedTasks(model).map((t) => t.id)).toEqual(['d', 'b', 'c']);
  });

  it('a linha de cada consultor diz o dia de hoje dele', () => {
    // Terça: a tarefa de segunda, quarta e sexta não vale.
    expect(personTodayText(MANHA, at('09:00'), SEG_A_SEX)).toBe('10 tarefas hoje · das 06:00 às 13:00');
    expect(personTodayText(MANHA, at('09:00', 7), SEG_A_SEX)).toBe('11 tarefas hoje · das 06:00 às 13:00');
    expect(personTodayText(MANHA, at('09:00', 10), SEG_A_SEX)).toBe('Nenhuma tarefa hoje');
    expect(personTodayText({ tasks: [task('a', '08:00')] }, at('09:00'), SEG_A_SEX)).toBe('1 tarefa hoje · às 08:00');
    expect(personTodayText({ tasks: [task('a', null)] }, at('09:00'), SEG_A_SEX)).toBe('1 tarefa hoje');
  });
});

// ---------- A aba Hoje (mockup 2026-10-08-rotinas-aba-hoje.html) ----------

const mark = (hhmm, note = '', day = 6) => ({ id: `c-${hhmm}`, doneAt: at(hhmm, day), note });
const marksOf = (obj) => new Map(Object.entries(obj));
// Os dados do mockup, às 10:47 de uma terça.
const NOW = at('10:47');
const MANHA_HOJE = {
  id: 'manha',
  name: 'Consultor manhã',
  followerIds: ['ana', 'bruno'],
  tasks: [
    task('t1', '06:00'), task('t2', '06:30'), task('t3', '07:00'), task('t4', '07:30'), task('t5', '10:00'),
    task('t6', '10:30'), task('t7', '11:00'), task('t8', '12:00'), task('t9', '13:00'), task('t10', null), task('t11', null),
  ],
};
const TARDE = {
  id: 'tarde',
  name: 'Consultor tarde',
  followerIds: ['carla'],
  tasks: [task('u1', '13:00'), task('u2', '14:00'), task('u3', '16:00'), task('u4', '18:00'), task('u5', '20:30'), task('u6', null)],
};
const ANA_MARKS = marksOf({ t1: mark('06:04'), t2: mark('06:41'), t3: mark('07:58', 'Lista com 42 leads.'), t4: mark('08:20'), t10: mark('09:15', 'Pedi para 3 alunos.') });
const BRUNO_MARKS = marksOf({ t1: mark('06:02'), t2: mark('06:33'), t3: mark('07:05'), t4: mark('07:40'), t5: mark('10:12'), t11: mark('09:30') });

describe('o dia de uma pessoa', () => {
  it('conta o que foi feito e o que está atrasado, com o estado de cada tarefa', () => {
    const day = personDay(MANHA_HOJE, ANA_MARKS, NOW, SEG_A_SEX);
    expect(day).toMatchObject({ total: 11, done: 5, late: 1 });
    expect(day.rows.map((r) => r.state)).toEqual(['done', 'done', 'doneLate', 'doneLate', 'late', 'now', 'later', 'later', 'later', 'done', 'open']);
    expect(day.timed.map((r) => r.task.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']);
    expect(day.free.map((r) => r.task.id)).toEqual(['t10', 't11']);
    expect(day.rows.find((r) => r.task.id === 't3')).toMatchObject({ note: 'Lista com 42 leads.', doneAt: at('07:58') });
  });

  it('a linha do agora entra antes da primeira tarefa com horário que ainda não chegou', () => {
    expect(personDay(MANHA_HOJE, ANA_MARKS, NOW, SEG_A_SEX).nowIndex).toBe(6);
    // Às 11:00 o t7 já chegou: a linha vai para antes do t8.
    expect(personDay(MANHA_HOJE, ANA_MARKS, at('11:00'), SEG_A_SEX).nowIndex).toBe(7);
    // Depois da última, a linha fica no fim.
    expect(personDay(MANHA_HOJE, ANA_MARKS, at('15:00'), SEG_A_SEX).nowIndex).toBe(9);
    // Sem tarefa com horário, não tem linha.
    expect(personDay({ tasks: [task('s', null)] }, null, NOW, SEG_A_SEX).nowIndex).toBeNull();
  });

  it('antes da primeira tarefa e sem nada feito, diz quando a rotina começa', () => {
    expect(personDay(TARDE, null, NOW, SEG_A_SEX).startsAt).toBe('13:00');
    expect(personDay(TARDE, marksOf({ u6: mark('10:00') }), NOW, SEG_A_SEX).startsAt).toBeNull();
    expect(personDay(TARDE, null, at('13:00'), SEG_A_SEX).startsAt).toBeNull();
    expect(personDay(TARDE, null, at('13:10'), SEG_A_SEX).startsAt).toBeNull();
  });

  it('o check de outro dia não conta, e a observação dele vai junto', () => {
    const day = personDay(MANHA_HOJE, marksOf({ t1: mark('06:04', 'de ontem', 5), t2: mark('06:31') }), NOW, SEG_A_SEX);
    expect(day.done).toBe(1);
    expect(day.rows[0]).toMatchObject({ state: 'late', doneAt: null, note: '' });
  });

  it('sem tarefa hoje, a conta é zero', () => {
    expect(personDay(MANHA_HOJE, ANA_MARKS, at('10:47', 10), SEG_A_SEX)).toMatchObject({ total: 0, done: 0, late: 0, nowIndex: null, startsAt: null });
  });

  it('feita e feita depois do horário são feitas', () => {
    expect(['done', 'doneLate'].map(isDoneState)).toEqual([true, true]);
    expect(['now', 'late', 'later', 'open'].map(isDoneState)).toEqual([false, false, false, false]);
  });

  it('os textos de hora da lateral', () => {
    expect(lateText(task('x', '10:00'), NOW)).toBe('Era às 10:00, há 47 min');
    expect(lateText(task('x', '06:00'), at('11:45'))).toBe('Era às 06:00, há 5h 45min');
    expect(clockText(at('07:58'))).toBe('07:58');
  });
});

describe('a equipe hoje', () => {
  // Na ordem da equipe, com o Diego (sem modelo) primeiro.
  const people = [
    { id: 'diego', name: 'Diego Rocha' },
    { id: 'ana', name: 'Ana Souza' },
    { id: 'bruno', name: 'Bruno Lima' },
    { id: 'carla', name: 'Carla Dias' },
  ];
  const team = (now = NOW, marksByPerson = new Map([['ana', ANA_MARKS], ['bruno', BRUNO_MARKS]])) =>
    teamToday({ people, models: [MANHA_HOJE, TARDE], marksByPerson, now, metaWeekdays: SEG_A_SEX });

  it('um cartão por pessoa, na ordem da equipe, e quem está sem modelo no fim', () => {
    const t = team();
    expect(t.cards.map((c) => c.person.id)).toEqual(['ana', 'bruno', 'carla', 'diego']);
    expect(t.cards.map((c) => c.model?.id ?? null)).toEqual(['manha', 'manha', 'tarde', null]);
    expect(t.cards.map((c) => c.done ?? null)).toEqual([5, 6, 0, null]);
    expect(t).toMatchObject({ done: 11, total: 28, late: 1, following: 3, withoutModel: 1 });
  });

  it('as atrasadas em ordem de horário, e de nome no empate', () => {
    expect(team().lateRows.map((r) => [r.person.id, r.task.id, r.text])).toEqual([['ana', 't5', 'Era às 10:00, há 47 min']]);
    const late = team(at('11:45'), new Map()).lateRows;
    expect(late).toHaveLength(14);
    expect(late.slice(0, 3).map((r) => [r.person.id, r.task.id])).toEqual([['ana', 't1'], ['bruno', 't1'], ['ana', 't2']]);
  });

  it('as observações, a mais recente primeiro', () => {
    expect(team().notes.map((n) => [n.person.id, n.task.id, n.note])).toEqual([
      ['ana', 't10', 'Pedi para 3 alunos.'],
      ['ana', 't3', 'Lista com 42 leads.'],
    ]);
  });

  it('acha a tarefa escolhida, e devolve null quando ela sumiu', () => {
    const { cards } = team();
    expect(findSelection(cards, { personId: 'ana', taskId: 't3' })).toMatchObject({
      person: { id: 'ana' }, task: { id: 't3' }, state: 'doneLate', note: 'Lista com 42 leads.',
    });
    expect(findSelection(cards, { personId: 'ana', taskId: 'u1' })).toBeNull();
    expect(findSelection(cards, { personId: 'diego', taskId: 't1' })).toBeNull();
    expect(findSelection(cards, null)).toBeNull();
  });
});

describe('o título da aba Hoje', () => {
  const texto = (args) => todayHeadline(args).map((p) => p.text).join('');

  it('com atrasadas, com uma só e sem nenhuma', () => {
    expect(texto({ peopleCount: 4, following: 3, done: 11, total: 28, late: 4 })).toBe('A equipe fez 11 de 28 tarefas da rotina até agora, e 4 estão atrasadas.');
    expect(texto({ peopleCount: 4, following: 3, done: 11, total: 28, late: 1 })).toBe('A equipe fez 11 de 28 tarefas da rotina até agora, e 1 está atrasada.');
    expect(texto({ peopleCount: 4, following: 3, done: 28, total: 28, late: 0 })).toBe('A equipe fez 28 de 28 tarefas da rotina até agora. Nenhuma está atrasada.');
    expect(texto({ peopleCount: 1, following: 1, done: 0, total: 1, late: 0 })).toBe('A equipe fez 0 de 1 tarefa da rotina até agora. Nenhuma está atrasada.');
  });

  it('o que leva destaque', () => {
    expect(todayHeadline({ peopleCount: 4, following: 3, done: 7, total: 26, late: 4 }).filter((p) => p.em)).toEqual([
      { text: '7 de 26', em: 'brand' },
      { text: '4 estão atrasadas', em: 'late' },
    ]);
  });

  it('os casos sem conta', () => {
    expect(texto({ peopleCount: 0, following: 0, done: 0, total: 0, late: 0 })).toBe('Nenhum consultor na equipe ainda.');
    expect(texto({ peopleCount: 3, following: 0, done: 0, total: 0, late: 0 })).toBe('Ninguém segue um modelo ainda.');
    expect(texto({ peopleCount: 3, following: 2, done: 0, total: 0, late: 0 })).toBe('Hoje não tem tarefa da rotina para a equipe.');
  });
});

describe('os ids do DOM da tela Rotinas', () => {
  it('cada tarefa de cada pessoa tem um id estável, sem caractere que atrapalhe o id', () => {
    expect(taskDomId('ana', 't3')).toBe('rot-ana-t3');
    expect(taskDomId('ana', 't3')).toBe(taskDomId('ana', 't3'));
    expect(taskDomId('ana', 't3')).not.toBe(taskDomId('bruno', 't3'));
    expect(taskDomId('a b', 't/1.x')).toBe('rot-a_b-t_1_x');
  });

  it('o seletor de modelo de cada pessoa tem o seu', () => {
    expect(modelSelectDomId('ana')).toBe('rot-modelo-ana');
    expect(modelSelectDomId('a.b')).toBe('rot-modelo-a_b');
  });
});
