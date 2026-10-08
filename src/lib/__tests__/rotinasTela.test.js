import { describe, expect, it } from 'vitest';
import { ALL_DAYS } from '../rotinas.js';
import {
  DAY_LINE_END, DAY_LINE_START, MODEL_GAP_MINUTES, dayLineLabels, dayLinePct, gapText, hourLabel, modelCardSummary,
  modelChips, modelDayRows, modelFreeTasks, modelPausedTasks, modelSummary, modelTimes, personTodayText,
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
