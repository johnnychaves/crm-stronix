import { describe, it, expect } from 'vitest';
import { buildZapStrip } from '../_zapStrip.js';

// Instante escrito no horário de Brasília. A faixa lê o dia e a hora de
// Brasília seja qual for o fuso da máquina, então o teste diz o instante com o
// fuso junto: new Date(2026, 8, 8, 18, 30) seria 18:30 de Brasília na máquina
// de dev e 15:30 de Brasília no CI, que roda em UTC.
const brt = (s) => new Date(`${s}:00-03:00`);

const HOJE = brt('2026-09-08T10:00'); // 08/09/2026 10:00

const cliente = (extra = {}) => ({
  lifecycleStage: 'cliente',
  currentContractStatus: 'ativo',
  currentContractStartsAt: brt('2025-09-08T00:00'),
  currentContractEndsAt: brt('2027-09-08T00:00'),
  ...extra
});

describe('buildZapStrip', () => {
  it('não devolve faixa quando não há prazo curto', () => {
    expect(buildZapStrip(cliente(), HOJE)).toBeNull();
  });

  it('devolve visita quando há visita marcada para hoje', () => {
    const lead = { appointmentType: 'Visita', appointmentScheduledFor: brt('2026-09-08T18:30') };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'visita_hoje', tone: 'agendado', text: 'Visita hoje às 18:30'
    });
  });

  it('devolve aula experimental quando há aula marcada para hoje', () => {
    const lead = { appointmentType: 'Aula', appointmentScheduledFor: brt('2026-09-08T07:00') };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'aula_hoje', tone: 'agendado', text: 'Aula experimental hoje às 07:00'
    });
  });

  it('ignora compromisso que não é hoje', () => {
    const lead = { appointmentType: 'Visita', appointmentScheduledFor: brt('2026-09-10T18:30') };
    expect(buildZapStrip(lead, HOJE)).toBeNull();
  });

  it('devolve contrato vencido com a contagem de dias', () => {
    const lead = cliente({ currentContractEndsAt: brt('2026-08-31T00:00') });
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'vencido', tone: 'vencido', text: 'Contrato vencido há 8 dias'
    });
  });

  it('devolve marco de renovação quando o contrato entra em 30 dias', () => {
    const lead = cliente({ currentContractEndsAt: brt('2026-10-08T00:00') }); // 08/10/2026
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
    });
  });

  // O status "a vencer" do SISTEMA (badge/ficha) usa um threshold FIXO de 30
  // dias, separado dos marcos de renovação (ver src/lib/renewalGoal.js). O
  // marco de 90 dias tem que acusar antes desse threshold — senão nenhum
  // marco > 30 aparece nunca, nem o padrão 90/60/30 usado aqui.
  it('devolve marco de 90 dias mesmo o contrato ainda não estando "a vencer" pelo threshold fixo do sistema', () => {
    const lead = cliente({ currentContractEndsAt: brt('2026-11-12T00:00') }); // 65 dias
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 90 dias'
    });
  });

  // Renovação emendada (começa no dia seguinte ao fim do contrato renovado) que
  // ainda não começou não é agendada: o resumo do lead dá "ativo" e a faixa
  // mostra o marco, igual à Meta Diária. Sem a marca, o mesmo contrato é
  // agendado e a faixa fica em silêncio. Só a marca muda entre os dois casos.
  it('renovação emendada que ainda não começou mostra o marco; sem a marca, é agendada e não mostra', () => {
    const renovacao = {
      currentContractStartsAt: new Date(2026, 8, 20), // 20/09/2026, ainda no futuro
      currentContractEndsAt: new Date(2026, 9, 20) // 20/10/2026: 42 dias, marco de 60
    };
    expect(buildZapStrip(cliente({ ...renovacao, currentContractSeamless: true }), HOJE)).toEqual({
      kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 60 dias'
    });
    expect(buildZapStrip(cliente(renovacao), HOJE)).toBeNull();
  });

  it('devolve freepass ativo com a contagem', () => {
    // aula em 07/09 com 3 dias de validade: último dia é 09/09, hoje é 08/09.
    const lead = {
      appointmentType: 'Aula',
      appointmentScheduledFor: brt('2026-09-07T07:00'),
      trialClassesPlanned: 3
    };
    expect(buildZapStrip(lead, HOJE)).toEqual({
      kind: 'freepass', tone: 'avencer', text: 'Freepass até 09/09 · falta 1 dia'
    });
  });

  it('compromisso de hoje ganha do marco de renovação', () => {
    const lead = cliente({
      currentContractEndsAt: brt('2026-10-08T00:00'),
      appointmentType: 'Visita',
      appointmentScheduledFor: brt('2026-09-08T09:00')
    });
    expect(buildZapStrip(lead, HOJE).kind).toBe('visita_hoje');
  });

  describe('marcos de renovação configuráveis', () => {
    it('usa marcos customizados da academia em vez do padrão 90/60/30', () => {
      // Vence em 120 dias (06/01/2027): mais longe que o maior marco padrão
      // (90), então o padrão não acusa nada. Um marco customizado de 120 já
      // cobre esse prazo.
      const lead = cliente({ currentContractEndsAt: brt('2027-01-06T00:00') });
      expect(buildZapStrip(lead, HOJE)).toBeNull();
      expect(buildZapStrip(lead, HOJE, [120, 60])).toEqual({
        kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 120 dias'
      });
    });

    it('cai no padrão 90/60/30 quando os marcos não são passados', () => {
      const lead = cliente({ currentContractEndsAt: brt('2026-10-08T00:00') }); // 30 dias
      expect(buildZapStrip(lead, HOJE, undefined)).toEqual({
        kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
      });
    });

    it.each([
      ['array vazio', []],
      ['valores negativos', [-30, -10]],
      ['string em vez de array', '30'],
      ['array com lixo misturado', [0, -5, NaN, 'x']]
    ])('cai no padrão 90/60/30 quando os marcos são inválidos (%s)', (_label, marcosRuins) => {
      const lead = cliente({ currentContractEndsAt: brt('2026-10-08T00:00') }); // 30 dias
      expect(buildZapStrip(lead, HOJE, marcosRuins)).toEqual({
        kind: 'renovacao', tone: 'avencer', text: 'Marco de renovação · 30 dias'
      });
    });
  });
});
