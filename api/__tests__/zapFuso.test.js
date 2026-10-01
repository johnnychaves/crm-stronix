import { describe, it, expect, vi, afterAll } from 'vitest';

// O cartão do Zap roda numa função da Vercel, com o processo em UTC (lá o TZ é
// variável reservada, não dá para trocar). A máquina de desenvolvimento fica
// em Brasília, e nela getHours() e getDate() já devolvem o horário de
// Brasília: o defeito de fuso não aparece, e um teste no fuso da máquina
// passaria mesmo com ele de volta. Por isso este arquivo põe o processo em UTC
// antes de importar o cartão, e o primeiro teste confere que a troca pegou.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import { buildZapStrip } from '../_zapStrip.js';
import { buildZapCard } from '../_zapCard.js';
import { buildContractCancel } from '../../src/lib/contracts.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Instante escrito no horário de Brasília: brt('2026-09-08T18:00').
const brt = (s) => new Date(`${s}:00-03:00`);

const visita = (quando) => ({ appointmentType: 'Visita', appointmentScheduledFor: brt(quando) });
const aula = (quando, extra = {}) => ({ appointmentType: 'Aula', appointmentScheduledFor: brt(quando), ...extra });
const cliente = (extra = {}) => ({
  lifecycleStage: 'cliente',
  currentContractStatus: 'ativo',
  currentContractStartsAt: brt('2025-09-01T00:00'),
  currentContractEndsAt: brt('2026-12-01T00:00'),
  ...extra
});

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 8, 8, 18, 0).toISOString()).toBe('2026-09-08T18:00:00.000Z');
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
    expect(['UTC', 'Etc/UTC']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

describe('faixa do cartão no horário de Brasília', () => {
  it('visita às 18:00 de Brasília sai como 18:00, e não 21:00', () => {
    expect(buildZapStrip(visita('2026-09-08T18:00'), brt('2026-09-08T10:00'))).toEqual({
      kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 18:00'
    });
  });

  it('aula experimental às 07:00 de Brasília sai como 07:00', () => {
    expect(buildZapStrip(aula('2026-09-08T07:00'), brt('2026-09-08T06:00'))).toEqual({
      kind: 'aula_hoje', tone: 'agendado', text: 'Aula experimental hoje às 07:00'
    });
  });

  it('às 22:00 de Brasília, a visita de hoje às 22:30 continua sendo de hoje, às 22:30', () => {
    expect(buildZapStrip(visita('2026-09-08T22:30'), brt('2026-09-08T22:00'))).toEqual({
      kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 22:30'
    });
  });

  it('às 22:00 de Brasília, a visita de hoje de manhã continua na faixa', () => {
    expect(buildZapStrip(visita('2026-09-08T09:00'), brt('2026-09-08T22:00'))).toEqual({
      kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 09:00'
    });
  });

  it('às 22:00 de Brasília, a visita de amanhã ainda não aparece como de hoje', () => {
    expect(buildZapStrip(visita('2026-09-09T10:00'), brt('2026-09-08T22:00'))).toBeNull();
  });

  it('às 23:59 ainda é hoje, e à meia-noite de Brasília já é o dia seguinte', () => {
    const lead = visita('2026-09-09T10:00');
    expect(buildZapStrip(lead, brt('2026-09-08T23:59'))).toBeNull();
    expect(buildZapStrip(lead, brt('2026-09-09T00:00'))?.text).toBe('Visita hoje às 10:00');
  });

  it('visita à meia-noite e meia sai como 00:30', () => {
    expect(buildZapStrip(visita('2026-09-09T00:30'), brt('2026-09-09T00:10'))?.text)
      .toBe('Visita hoje às 00:30');
  });

  it('na virada do ano, a visita das 23:30 do dia 31 é de hoje', () => {
    expect(buildZapStrip(visita('2026-12-31T23:30'), brt('2026-12-31T20:00'))?.text)
      .toBe('Visita hoje às 23:30');
  });

  it('aula de ontem às 21:30 não vira aula de hoje às 00:30', () => {
    // 07/09 às 21:30 em Brasília é 08/09 às 00:30 em UTC.
    const lead = aula('2026-09-07T21:30', { trialClassesPlanned: 3 });
    expect(buildZapStrip(lead, brt('2026-09-08T10:00'))).toEqual({
      kind: 'freepass', tone: 'avencer', text: 'Freepass até 09/09 · falta 1 dia'
    });
  });

  it('às 22:00 de Brasília, o freepass que termina amanhã ainda tem 1 dia', () => {
    const lead = aula('2026-09-07T07:00', { trialClassesPlanned: 3 });
    expect(buildZapStrip(lead, brt('2026-09-08T22:00'))).toEqual({
      kind: 'freepass', tone: 'avencer', text: 'Freepass até 09/09 · falta 1 dia'
    });
  });

  it('às 22:00 de Brasília, o freepass que termina hoje continua na faixa', () => {
    const lead = aula('2026-09-06T07:00', { trialClassesPlanned: 3 });
    expect(buildZapStrip(lead, brt('2026-09-08T22:00'))).toEqual({
      kind: 'freepass', tone: 'avencer', text: 'Freepass termina hoje'
    });
  });

  it('às 22:00 de Brasília, contrato vencido em 31/08 conta 8 dias, e não 9', () => {
    const lead = cliente({ currentContractEndsAt: brt('2026-08-31T00:00') });
    expect(buildZapStrip(lead, brt('2026-09-08T22:00'))).toEqual({
      kind: 'vencido', tone: 'vencido', text: 'Contrato vencido há 8 dias'
    });
  });

  // O marco conta blocos de 24 horas entre dois instantes (daysToExpiryOf, em
  // src/lib/renewalGoal.js), sem ler o calendário. Não dependia do fuso antes
  // e não pode passar a depender.
  it('o marco de renovação não muda com o fuso', () => {
    const lead = cliente({ currentContractEndsAt: brt('2026-10-08T00:00') });
    expect(buildZapStrip(lead, brt('2026-09-08T22:00'))).toEqual({
      kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
    });
  });
});

describe('dias restantes do contrato no dia de Brasília', () => {
  it('às 22:00 de Brasília, contrato que vence amanhã tem daysLeft 1, e não 0', () => {
    const card = buildZapCard(cliente({ currentContractEndsAt: brt('2026-09-09T00:00') }), brt('2026-09-08T22:00'));
    expect(card.daysLeft).toBe(1);
  });

  it('às 20:59 de Brasília o mesmo contrato também tem daysLeft 1', () => {
    const card = buildZapCard(cliente({ currentContractEndsAt: brt('2026-09-09T00:00') }), brt('2026-09-08T20:59'));
    expect(card.daysLeft).toBe(1);
  });

  it('às 22:00 de Brasília, contrato vencido em 31/08 tem daysLeft -8', () => {
    const card = buildZapCard(cliente({ currentContractEndsAt: brt('2026-08-31T00:00') }), brt('2026-09-08T22:00'));
    expect(card.daysLeft).toBe(-8);
  });

  it('as datas em ISO continuam sendo o instante gravado', () => {
    const lead = cliente({
      currentContractEndsAt: brt('2026-09-09T00:00'),
      appointmentType: 'Visita',
      appointmentScheduledFor: brt('2026-09-08T18:00'),
      lastInteractionAt: brt('2026-09-08T21:15')
    });
    const card = buildZapCard(lead, brt('2026-09-08T22:00'));
    expect(card.contractEndsAt).toBe('2026-09-09T03:00:00.000Z');
    expect(card.appointment).toEqual({ type: 'Visita', at: '2026-09-08T21:00:00.000Z', outcome: null });
    expect(card.lastInteractionAt).toBe('2026-09-09T00:15:00.000Z');
  });
});

// O bloco "em uso" do resumo do lead (contracts.js): enquanto a renovação
// marcada não começa, o cartão diz o estado do contrato que o cliente usa.
// A comparação é por instante, então o processo em UTC não muda o resultado.
// Decisão do Johnny (01/10/2026): com dois contratos ativos, cancelar um deixa
// o cliente ativo pelo outro. O cancelamento com `replacement` passa o resumo
// do lead para o contrato que continua, e o cartão do Zap o lê como qualquer
// resumo, por instante, no processo em UTC.
describe('cartão depois de cancelar o último contrato com outro em uso', () => {
  const outro = { id: 'k1', planName: 'Start', value: 1200, status: 'ativo', startsAt: brt('2025-12-01T00:00'), endsAt: brt('2026-12-01T00:00') };

  it('com o resumo passado para o contrato que continua, o cartão diz ativo', () => {
    const patch = buildContractCancel({ planName: 'Flow', cancelledAt: brt('2026-10-20T00:00'), reason: 'Financeiro', replacement: outro }).leadPatch;
    const card = buildZapCard({ lifecycleStage: 'cliente', ...patch }, brt('2026-10-20T22:00'));
    expect(card.contractStatus).toBe('ativo');
  });

  it('sem outro contrato em uso, o cartão diz cancelado, como sempre', () => {
    const patch = buildContractCancel({ planName: 'Flow', cancelledAt: brt('2026-10-20T00:00'), reason: 'Financeiro' }).leadPatch;
    expect(buildZapCard(cliente(patch), brt('2026-10-20T22:00')).contractStatus).toBe('cancelado');
  });
});

describe('cartão com o bloco "em uso" do lead, no processo em UTC', () => {
  // A renovação começa em 12/10/2026 e o contrato em uso vai até a meia-noite
  // de 11/10, em Brasília.
  const renovado = (extra = {}) => cliente({
    currentContractStartsAt: brt('2026-10-12T00:00'), currentContractEndsAt: brt('2027-10-12T00:00'),
    inUseContractId: 'k1', inUseContractStatus: 'ativo', inUseContractEndsAt: brt('2026-10-11T00:00'),
    ...extra
  });

  it('contrato em uso valendo: ativo, sem faixa de marco', () => {
    const card = buildZapCard(renovado(), brt('2026-09-30T22:00'));
    expect(card.contractStatus).toBe('ativo');
    expect(card.strip).toBeNull();
  });

  it('às 22:00 de Brasília do dia seguinte ao fim, sem a marca de emendada, já é o intervalo: agendado', () => {
    expect(buildZapCard(renovado(), brt('2026-10-11T22:00')).contractStatus).toBe('agendado');
    // Com a marca, o dia 11 continua do cliente.
    expect(buildZapCard(renovado({ currentContractSeamless: true }), brt('2026-10-11T22:00')).contractStatus).toBe('ativo');
  });

  it('em uso trancado: trancado, e a faixa fica em silêncio', () => {
    const card = buildZapCard(renovado({ inUseContractStatus: 'trancado' }), brt('2026-09-30T22:00'));
    expect(card.contractStatus).toBe('trancado');
    expect(card.strip).toBeNull();
  });

  it('em uso cancelado: agendado', () => {
    expect(buildZapCard(renovado({ inUseContractStatus: 'cancelado' }), brt('2026-09-30T22:00')).contractStatus).toBe('agendado');
  });
});
