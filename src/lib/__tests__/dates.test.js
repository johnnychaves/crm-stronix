import { describe, it, expect } from 'vitest';
import { calendarDaysBetween, fromDateTimeInputValue, startOfLocalDay, toDateTimeInputValue } from '../dates.js';

// Os dois helpers do <input type="datetime-local">. Tudo em hora LOCAL: passar
// pelo toISOString jogaria a data 3h para trás no Brasil e um contato marcado
// para 27/08 às 00:30 viraria 26/08 às 21:30.
describe('toDateTimeInputValue', () => {
  it('formata como yyyy-mm-ddTHH:MM em hora local', () => {
    expect(toDateTimeInputValue(new Date(2026, 7, 27, 9, 5))).toBe('2026-08-27T09:05');
  });

  it('preenche zero à esquerda em mês, dia, hora e minuto', () => {
    expect(toDateTimeInputValue(new Date(2026, 0, 3, 7, 0))).toBe('2026-01-03T07:00');
  });

  it('meia-noite não escorrega para o dia anterior', () => {
    expect(toDateTimeInputValue(new Date(2026, 7, 27, 0, 0))).toBe('2026-08-27T00:00');
  });

  it('data inválida ou ausente devolve string vazia', () => {
    expect(toDateTimeInputValue(null)).toBe('');
    expect(toDateTimeInputValue(new Date('nada'))).toBe('');
  });
});

describe('fromDateTimeInputValue', () => {
  it('lê yyyy-mm-ddTHH:MM como hora local', () => {
    const d = fromDateTimeInputValue('2026-08-27T14:30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(27);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it('aceita o valor com segundos que alguns navegadores mandam', () => {
    const d = fromDateTimeInputValue('2026-08-27T14:30:45');
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it('valor só com o dia vale meia-noite local, sem voltar um dia', () => {
    const d = fromDateTimeInputValue('2026-08-27');
    expect(d.getDate()).toBe(27);
    expect(d.getHours()).toBe(0);
  });

  it('string vazia ou inválida devolve null', () => {
    expect(fromDateTimeInputValue('')).toBe(null);
    expect(fromDateTimeInputValue(null)).toBe(null);
    expect(fromDateTimeInputValue('27/08/2026 14:30')).toBe(null);
  });

  it('vai e volta sem perder a hora', () => {
    const original = new Date(2026, 7, 27, 18, 45);
    expect(fromDateTimeInputValue(toDateTimeInputValue(original)).getTime()).toBe(original.getTime());
  });
});

// Dias do calendário no horário local. A emenda da renovação é "o dia
// seguinte ao fim", não "24 horas depois do fim".
describe('calendarDaysBetween', () => {
  it('conta dias do calendário, não períodos de 24 horas', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 11, 23, 0), new Date(2026, 9, 12, 1, 0))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 9, 11, 1, 0), new Date(2026, 9, 11, 23, 0))).toBe(0);
  });
  it('vira o mês e o ano', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 31), new Date(2026, 10, 1))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 11, 31), new Date(2027, 0, 1))).toBe(1);
  });
  it('negativo quando a segunda data vem antes', () => {
    expect(calendarDaysBetween(new Date(2026, 7, 21), new Date(2026, 6, 27))).toBe(-25);
  });
  it('null com data ausente', () => {
    expect(calendarDaysBetween(null, new Date())).toBeNull();
  });
});

describe('startOfLocalDay', () => {
  it('é a meia-noite local do mesmo dia', () => {
    expect(startOfLocalDay(new Date(2026, 8, 28, 15, 32))).toEqual(new Date(2026, 8, 28));
  });
  it('null com data inválida', () => {
    expect(startOfLocalDay(null)).toBeNull();
  });
});
