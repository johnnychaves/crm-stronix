// A régua do expediente da urgência da espera: só contam os minutos dentro da
// faixa das 8h às 21h de Brasília. Instantes sempre em ISO com Z, porque o CI
// roda em UTC e a regra é de Brasília (UTC-3, sem horário de verão).
import { describe, it, expect } from 'vitest';
import { EXPEDIENTE, msDeExpediente } from '../expediente.js';

const MIN = 60 * 1000;
const de = (a, b) => msDeExpediente(new Date(a), new Date(b)) / MIN;

describe('msDeExpediente', () => {
  it('a faixa é das 8h às 21h', () => {
    expect(EXPEDIENTE).toEqual({ inicio: '08:00', fim: '21:00' });
  });

  it('dentro da faixa conta o tempo corrido', () => {
    // 08:00 às 08:30 de Brasília, segunda 09/11/2026.
    expect(de('2026-11-09T11:00:00Z', '2026-11-09T11:30:00Z')).toBe(30);
  });

  it('08:00 entra e o que vem antes não conta', () => {
    // 07:00 às 08:30 de Brasília: só a meia hora depois das 8h.
    expect(de('2026-11-09T10:00:00Z', '2026-11-09T11:30:00Z')).toBe(30);
    // 07:59 às 08:29: 29 minutos.
    expect(de('2026-11-09T10:59:00Z', '2026-11-09T11:29:00Z')).toBe(29);
  });

  it('21:00 não entra', () => {
    // 20:50 às 21:30 de Brasília: 10 minutos.
    expect(de('2026-11-09T23:50:00Z', '2026-11-10T00:30:00Z')).toBe(10);
  });

  it('a noite não conta: 20:50 até 08:20 do dia seguinte são 30 minutos', () => {
    expect(de('2026-11-09T23:50:00Z', '2026-11-10T11:20:00Z')).toBe(30);
  });

  it('fora da faixa inteira não conta nada', () => {
    // 21:10 às 23:00 de Brasília.
    expect(de('2026-11-10T00:10:00Z', '2026-11-10T02:00:00Z')).toBe(0);
  });

  it('o fim de semana conta igual', () => {
    // Sábado, 14/11/2026, 08:00 às 08:30 de Brasília.
    expect(de('2026-11-14T11:00:00Z', '2026-11-14T11:30:00Z')).toBe(30);
  });

  it('intervalo invertido ou data inválida dá zero', () => {
    expect(de('2026-11-09T12:00:00Z', '2026-11-09T11:00:00Z')).toBe(0);
    expect(msDeExpediente(null, new Date('2026-11-09T12:00:00Z'))).toBe(0);
    expect(msDeExpediente(new Date('lixo'), new Date('2026-11-09T12:00:00Z'))).toBe(0);
  });
});
