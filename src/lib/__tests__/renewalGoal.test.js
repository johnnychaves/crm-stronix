// Testes da regra pura de renovação por marcos (renewalGoal.js). Datas
// sempre em horário LOCAL, como o app faz.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RENEWAL_CHECKPOINTS,
  daysToExpiryOf,
  activeRenewalCheckpoint,
  shouldPromptRenewal,
  renewalDecline,
  renewalReschedule
} from '../renewalGoal.js';

const NOW = new Date(2026, 6, 15, 10, 0, 0); // quarta-feira, 15/07/2026 10:00

const cliente = (over = {}) => ({
  id: 'c1',
  lifecycleStage: 'cliente',
  status: 'Venda',
  currentContractStatus: 'ativo',
  currentContractEndsAt: null,
  renewalHandledCheckpoints: [],
  renewalDeclined: false,
  ...over
});

const endsInDays = (n) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe('daysToExpiryOf', () => {
  it('arredonda para cima os dias restantes', () => {
    expect(daysToExpiryOf(endsInDays(15), NOW)).toBe(15);
    expect(daysToExpiryOf(new Date(2026, 6, 30), NOW)).toBe(15); // meia-noite do dia 30, NOW é 10:00 do dia 15
  });

  it('retorna negativo para contrato já vencido', () => {
    expect(daysToExpiryOf(endsInDays(-5), NOW)).toBeLessThan(0);
  });

  it('null quando não há vigência gravada', () => {
    expect(daysToExpiryOf(null, NOW)).toBeNull();
    expect(daysToExpiryOf(undefined, NOW)).toBeNull();
  });
});

describe('activeRenewalCheckpoint', () => {
  it('marco ativo = menor marco >= dias restantes', () => {
    expect(activeRenewalCheckpoint(15, [90, 60, 30])).toBe(30);
    expect(activeRenewalCheckpoint(45, [90, 60, 30])).toBe(60);
    expect(activeRenewalCheckpoint(75, [90, 60, 30])).toBe(90);
  });

  it('exatamente no valor do marco entra nele (borda inclusiva)', () => {
    expect(activeRenewalCheckpoint(30, [90, 60, 30])).toBe(30);
    expect(activeRenewalCheckpoint(60, [90, 60, 30])).toBe(60);
  });

  it('além do MAIOR marco → null (ainda não entrou em nenhuma janela)', () => {
    expect(activeRenewalCheckpoint(91, [90, 60, 30])).toBeNull();
  });

  it('contrato já vencido (dias negativos) cai no menor marco', () => {
    expect(activeRenewalCheckpoint(-10, [90, 60, 30])).toBe(30);
  });

  it('checkpoints vazios/ausentes → sempre null', () => {
    expect(activeRenewalCheckpoint(15, [])).toBeNull();
    expect(activeRenewalCheckpoint(15, null)).toBeNull();
    expect(activeRenewalCheckpoint(15, undefined)).toBeNull();
  });

  it('ignora valores inválidos/negativos/zero na lista de marcos', () => {
    expect(activeRenewalCheckpoint(15, [30, 0, -5, NaN, 'x'])).toBe(30);
  });

  it('daysToExpiry não finito → null', () => {
    expect(activeRenewalCheckpoint(null, [90, 60, 30])).toBeNull();
    expect(activeRenewalCheckpoint(NaN, [90, 60, 30])).toBeNull();
  });
});

describe('shouldPromptRenewal', () => {
  it('entra quando existe marco ativo ainda não tratado', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(15) });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(true);
  });

  it('não entra quando o marco ativo já está em renewalHandledCheckpoints', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(15), renewalHandledCheckpoints: [30] });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('marco diferente ainda não tratado entra mesmo com outro marco já handled', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(45), renewalHandledCheckpoints: [90] });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(true); // marco ativo aqui é 60
  });

  it('não entra quando ainda não alcançou o maior marco', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(120) });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('renewalDeclined=true nunca entra, mesmo com marco ativo não tratado', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(15), renewalDeclined: true });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('contrato cancelado nunca entra', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(15), currentContractStatus: 'cancelado' });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('reagendar (marco atual em handled) tira do marco atual mas VOLTA no próximo marco', () => {
    // Ciclo do reagendamento: reagendou no marco 90 → handled=[90]. Enquanto o
    // prazo restante estiver na faixa do 90 (>60), NÃO reaparece em Renovações.
    const noMarco90 = cliente({ currentContractEndsAt: endsInDays(75), renewalHandledCheckpoints: [90] });
    expect(shouldPromptRenewal(noMarco90, NOW, [90, 60, 30])).toBe(false);
    // Quando o prazo cai pra faixa do 60 (marco ativo = 60, ainda não tratado),
    // volta a pedir renovação.
    const noMarco60 = cliente({ currentContractEndsAt: endsInDays(45), renewalHandledCheckpoints: [90] });
    expect(shouldPromptRenewal(noMarco60, NOW, [90, 60, 30])).toBe(true);
  });

  it('sem currentContractEndsAt não entra', () => {
    const l = cliente({ currentContractEndsAt: null });
    expect(shouldPromptRenewal(l, NOW, [90, 60, 30])).toBe(false);
  });

  it('checkpoints vazios nunca entra', () => {
    const l = cliente({ currentContractEndsAt: endsInDays(15) });
    expect(shouldPromptRenewal(l, NOW, [])).toBe(false);
  });

  it('lead nulo/indefinido não entra', () => {
    expect(shouldPromptRenewal(null, NOW, DEFAULT_RENEWAL_CHECKPOINTS)).toBe(false);
  });
});

describe('renewalDecline', () => {
  it('marca declinado e adiciona o marco ativo aos handled', () => {
    const l = cliente({ renewalHandledCheckpoints: [] });
    const patch = renewalDecline(l, 30);
    expect(patch).toEqual({ renewalDeclined: true, renewalHandledCheckpoints: [30] });
  });

  it('não duplica um marco já presente em handled', () => {
    const l = cliente({ renewalHandledCheckpoints: [90] });
    const patch = renewalDecline(l, 90);
    expect(patch.renewalHandledCheckpoints).toEqual([90]);
  });

  it('acumula com marcos já tratados anteriormente', () => {
    const l = cliente({ renewalHandledCheckpoints: [90] });
    const patch = renewalDecline(l, 60);
    expect(patch.renewalHandledCheckpoints).toEqual([90, 60]);
  });

  it('activeCheckpoint null não adiciona nada, mas ainda declina', () => {
    const l = cliente({ renewalHandledCheckpoints: [90] });
    const patch = renewalDecline(l, null);
    expect(patch).toEqual({ renewalDeclined: true, renewalHandledCheckpoints: [90] });
  });

  it('lead sem renewalHandledCheckpoints (legado) não quebra', () => {
    const patch = renewalDecline({}, 30);
    expect(patch).toEqual({ renewalDeclined: true, renewalHandledCheckpoints: [30] });
  });
});

describe('renewalReschedule', () => {
  it('grava nextFollowUp (Date) + tipo genérico de contato + marca o marco como tratado', () => {
    const l = cliente({ renewalHandledCheckpoints: [] });
    const d = endsInDays(3);
    const patch = renewalReschedule(l, d, 90);
    expect(patch).toEqual({
      nextFollowUp: d,
      nextFollowUpType: 'Mensagem',
      renewalHandledCheckpoints: [90]
    });
  });

  it('aceita string yyyy-mm-dd (formato de <input type="date">) como meia-noite LOCAL', () => {
    const patch = renewalReschedule(cliente(), '2026-08-01', 60);
    expect(patch.nextFollowUp).toEqual(new Date(2026, 7, 1));
  });

  it('NÃO seta renewalRescheduleAt (campo removido) nem toca status/declined', () => {
    const patch = renewalReschedule(cliente(), '2026-08-01', 30);
    expect(patch).not.toHaveProperty('renewalRescheduleAt');
    expect(patch).not.toHaveProperty('renewalDeclined');
    expect(patch).not.toHaveProperty('status');
  });

  it('acumula o marco atual sem duplicar marcos já tratados', () => {
    const l = cliente({ renewalHandledCheckpoints: [90] });
    expect(renewalReschedule(l, endsInDays(3), 60).renewalHandledCheckpoints).toEqual([90, 60]);
    expect(renewalReschedule(l, endsInDays(3), 90).renewalHandledCheckpoints).toEqual([90]);
  });

  it('permite sobrescrever o tipo de follow-up (ex.: Ligação)', () => {
    const patch = renewalReschedule(cliente(), endsInDays(3), 30, 'Ligação');
    expect(patch.nextFollowUpType).toBe('Ligação');
  });
});
