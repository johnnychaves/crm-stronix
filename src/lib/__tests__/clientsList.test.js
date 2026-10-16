import { describe, it, expect } from 'vitest';
import { vigenciaOf } from '../clientsList.js';
import { CONTRACT_STATUS as S } from '../contracts.js';

// Meio-dia de 16/10/2026: o fim gravado à meia-noite não muda o dia do calendário.
const NOW = new Date(2026, 9, 16, 12);
const day = (m, d, y = 2026) => new Date(y, m - 1, d);
const lead = (start, end) => ({ currentContractStartsAt: start, currentContractEndsAt: end });

describe('vigenciaOf', () => {
  it('sem data de fim não há vigência', () => {
    expect(vigenciaOf(lead(null, null), S.ATIVO, NOW)).toBeNull();
    expect(vigenciaOf({}, S.ATIVO, NOW)).toBeNull();
  });

  it('ativo e a vencer dizem quantos dias faltam, e só o a vencer acende o aviso', () => {
    expect(vigenciaOf(lead(day(4, 20), day(10, 20)), S.A_VENCER, NOW)).toMatchObject({ text: 'vence em 4 dias', dateText: '20/10/2026', warn: true });
    expect(vigenciaOf(lead(day(4, 20), day(10, 17)), S.A_VENCER, NOW).text).toBe('vence amanhã');
    expect(vigenciaOf(lead(day(4, 20), day(10, 16)), S.A_VENCER, NOW).text).toBe('vence hoje');
    expect(vigenciaOf(lead(day(2, 10), day(2, 10, 2027)), S.ATIVO, NOW)).toMatchObject({ text: 'vence em 117 dias', warn: false });
  });

  it('vencido diz há quantos dias, e no último dia inteiro diz "venceu hoje"', () => {
    expect(vigenciaOf(lead(day(3, 1), day(10, 10)), S.VENCIDO, NOW).text).toBe('venceu há 6 dias');
    expect(vigenciaOf(lead(day(3, 1), day(10, 15)), S.VENCIDO, NOW).text).toBe('venceu ontem');
    expect(vigenciaOf(lead(day(3, 1), day(10, 16)), S.VENCIDO, NOW).text).toBe('venceu hoje');
  });

  it('trancado e cancelado dizem o estado, e agendado diz quando começa', () => {
    expect(vigenciaOf(lead(day(3, 15), day(3, 15, 2027)), S.TRANCADO, NOW).text).toBe('contrato trancado');
    expect(vigenciaOf(lead(day(7, 10), day(10, 10)), S.CANCELADO, NOW).text).toBe('contrato cancelado');
    expect(vigenciaOf(lead(day(10, 25), day(4, 25, 2027)), S.AGENDADO, NOW).text).toBe('começa em 9 dias');
    expect(vigenciaOf(lead(day(10, 17), day(4, 17, 2027)), S.AGENDADO, NOW).text).toBe('começa amanhã');
    expect(vigenciaOf(lead(null, day(4, 25, 2027)), S.AGENDADO, NOW).text).toBe('contrato agendado');
  });

  it('a régua vai de 0 a 1 e fica vazia quando o contrato ainda não começou', () => {
    expect(vigenciaOf(lead(day(10, 6), day(10, 26)), S.ATIVO, NOW).pct).toBeCloseTo(0.525, 2);
    expect(vigenciaOf(lead(day(10, 25), day(4, 25, 2027)), S.AGENDADO, NOW).pct).toBe(0);
    expect(vigenciaOf(lead(day(3, 1), day(10, 10)), S.VENCIDO, NOW).pct).toBe(1);
    expect(vigenciaOf(lead(null, day(10, 20)), S.ATIVO, NOW).pct).toBeNull();
  });

  it('trancado e cancelado não têm régua, porque o tempo deles não corre', () => {
    expect(vigenciaOf(lead(day(3, 15), day(3, 15, 2027)), S.TRANCADO, NOW).pct).toBeNull();
    expect(vigenciaOf(lead(day(7, 10), day(12, 10)), S.CANCELADO, NOW).pct).toBeNull();
  });

  it('com renovação marcada, a vigência é a do contrato em uso e a régua some', () => {
    const renovado = { ...lead(day(11, 6), day(5, 6, 2027)), inUseContractId: 'c1', inUseContractEndsAt: day(10, 26) };
    expect(vigenciaOf(renovado, S.ATIVO, NOW)).toMatchObject({ text: 'vence em 10 dias', dateText: '26/10/2026', pct: null });
    // Contrato em uso que já acabou: vale a renovação, como a situação.
    const acabou = { ...renovado, inUseContractEndsAt: day(10, 10) };
    expect(vigenciaOf(acabou, S.ATIVO, NOW).dateText).toBe('06/05/2027');
    // Agendado fala da renovação, que é o que ele espera.
    expect(vigenciaOf(renovado, S.AGENDADO, NOW).text).toBe('começa em 21 dias');
  });
});
