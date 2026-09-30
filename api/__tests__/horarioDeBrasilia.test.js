import { describe, it, expect, vi, afterAll } from 'vitest';

// O agendamento pelo Stronizap roda numa função da Vercel, com o processo em
// UTC (lá o TZ é variável reservada). A máquina de desenvolvimento fica em
// Brasília, e nela um erro de fuso não aparece. Por isso o processo vai para
// UTC antes de importar o módulo, como em zapFuso.test.js, e o primeiro teste
// confere que a troca pegou.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  diaDeBrasilia, isoDoDia, diaDaSemanaDoDia, horaInteiraDeBrasilia, dataHoraDeBrasilia, instanteDeBrasilia
} from '../_horarioDeBrasilia.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
    expect(['UTC', 'Etc/UTC']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

describe('instanteDeBrasilia: dia e hora de Brasília viram instante', () => {
  it('18:00 de Brasília é 21:00 em UTC', () => {
    expect(instanteDeBrasilia('2026-10-01', '18:00').toISOString()).toBe('2026-10-01T21:00:00.000Z');
  });

  it('22:30 do último dia do ano já é o ano seguinte em UTC', () => {
    expect(instanteDeBrasilia('2026-12-31', '22:30').toISOString()).toBe('2027-01-01T01:30:00.000Z');
  });

  it('meia-noite e 23:59 ficam no mesmo dia de Brasília', () => {
    expect(instanteDeBrasilia('2026-10-01', '00:00').toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(instanteDeBrasilia('2026-10-01', '23:59').toISOString()).toBe('2026-10-02T02:59:00.000Z');
  });

  it('29 de fevereiro só existe em ano bissexto', () => {
    expect(instanteDeBrasilia('2026-02-29', '09:00')).toBeNull();
    expect(instanteDeBrasilia('2028-02-29', '09:00').toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });

  it.each([
    ['2026-10-01', '24:00'], ['2026-10-01', '18:60'], ['2026-10-01', '8:00'], ['2026-10-01', '18:00:00'],
    ['2026-10-1', '18:00'], ['2026-13-01', '18:00'], ['2026-04-31', '18:00'], ['01/10/2026', '18:00'],
    [20261001, '18:00'], ['2026-10-01', null], [undefined, undefined],
    [['2026-10-01'], '18:00'], ['2026-10-01', ['18:00']],
    ['12026-10-01', '18:00'], ['2026-10-011', '18:00'], [' 2026-10-01', '18:00']
  ])('fora do formato ou inexistente volta null (%s %s)', (dia, hora) => {
    expect(instanteDeBrasilia(dia, hora)).toBeNull();
  });
});

describe('leitura do calendário de Brasília', () => {
  // 23:30 de quinta, 01/10, em Brasília; em UTC já é sexta.
  const quintaTarde = new Date('2026-10-02T02:30:00.000Z');

  it('dataHoraDeBrasilia escreve como o navegador em pt-BR, no horário de Brasília', () => {
    expect(dataHoraDeBrasilia(new Date('2026-10-01T21:00:00.000Z'))).toBe('01/10/2026, 18:00');
    expect(dataHoraDeBrasilia(quintaTarde)).toBe('01/10/2026, 23:30');
    expect(dataHoraDeBrasilia(new Date('2026-10-05T12:05:00.000Z'))).toBe('05/10/2026, 09:05');
    expect(dataHoraDeBrasilia(new Date('x'))).toBeNull();
  });

  it('isoDoDia e diaDaSemanaDoDia usam o dia de Brasília, não o do processo', () => {
    const dia = diaDeBrasilia(quintaTarde);
    expect(isoDoDia(dia)).toBe('2026-10-01');
    expect(diaDaSemanaDoDia(dia)).toBe(4);
    expect(isoDoDia(dia + 1)).toBe('2026-10-02');
    expect(diaDaSemanaDoDia(dia + 3)).toBe(0);
    expect(isoDoDia(diaDeBrasilia(new Date('2027-01-01T01:30:00.000Z')))).toBe('2026-12-31');
  });

  it('horaInteiraDeBrasilia lê a hora de Brasília', () => {
    expect(horaInteiraDeBrasilia(new Date('2026-09-29T21:30:00.000Z'))).toBe(18);
    expect(horaInteiraDeBrasilia(new Date('2026-09-29T20:59:00.000Z'))).toBe(17);
    expect(horaInteiraDeBrasilia(quintaTarde)).toBe(23);
    expect(horaInteiraDeBrasilia(new Date('x'))).toBeNaN();
  });

  it('a meia-noite de Brasília é hora 0, e não 24, na leitura e na conta do instante', () => {
    // 00:00 de quinta, 01/10, em Brasília, que em UTC são 03:00. Se o Intl lesse a
    // meia-noite como hora 24, a leitura e a conta do instanteDeBrasilia errariam.
    const meiaNoite = new Date('2026-10-01T03:00:00.000Z');
    expect(instanteDeBrasilia('2026-10-01', '03:00').toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(dataHoraDeBrasilia(meiaNoite)).toBe('01/10/2026, 00:00');
    expect(horaInteiraDeBrasilia(meiaNoite)).toBe(0);
  });

  it('mês de um dígito sai com zero à esquerda, no ISO e na data escrita', () => {
    expect(isoDoDia(diaDeBrasilia(new Date('2026-03-05T12:00:00.000Z')))).toBe('2026-03-05');
    expect(dataHoraDeBrasilia(new Date('2026-03-05T12:05:00.000Z'))).toBe('05/03/2026, 09:05');
  });
});
