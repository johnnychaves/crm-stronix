// Testes do status derivado do contrato. O foco é a ordem das regras: um
// contrato pode satisfazer mais de uma condição ao mesmo tempo (cancelado E
// vencido, agendado E dentro da janela de aviso) e só uma resposta é certa.

import { describe, it, expect } from 'vitest';
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABEL,
  buildContractCancel,
  buildContractEdit,
  buildContractPause,
  buildContractResume,
  buildMatriculaWrites,
  deriveContractStatus,
  deriveLeadContractStatus
} from '../contracts.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 7, 28);

describe('deriveContractStatus', () => {
  it('ativo quando está em vigência e longe do fim', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 1, 10), endsAt: D(2027, 1, 10) }, NOW))
      .toBe(CONTRACT_STATUS.ATIVO);
  });

  it('a_vencer dentro da janela de aviso', () => {
    expect(deriveContractStatus({ startsAt: D(2025, 8, 20), endsAt: D(2026, 8, 20) }, NOW))
      .toBe(CONTRACT_STATUS.A_VENCER);
  });

  it('vencido depois do término', () => {
    expect(deriveContractStatus({ startsAt: D(2025, 1, 10), endsAt: D(2026, 1, 10) }, NOW))
      .toBe(CONTRACT_STATUS.VENCIDO);
  });

  it('agendado quando o início ainda não chegou', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1) }, NOW))
      .toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('começar hoje já conta como ativo, não agendado', () => {
    expect(deriveContractStatus({ startsAt: NOW, endsAt: D(2027, 7, 28) }, NOW))
      .toBe(CONTRACT_STATUS.ATIVO);
  });

  it('agendado vence a janela de aviso — contrato curto que começa e acaba dentro dela', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 8, 1), endsAt: D(2026, 8, 20) }, NOW))
      .toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('cancelado ganha de tudo, inclusive de um início futuro', () => {
    expect(deriveContractStatus(
      { status: CONTRACT_STATUS.CANCELADO, startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1) },
      NOW
    )).toBe(CONTRACT_STATUS.CANCELADO);
  });

  it('sem startsAt continua respondendo pelo fim da vigência', () => {
    expect(deriveContractStatus({ endsAt: D(2027, 1, 10) }, NOW)).toBe(CONTRACT_STATUS.ATIVO);
  });

  it('null sem vigência registrada', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 9, 1) }, NOW)).toBeNull();
    expect(deriveContractStatus(null, NOW)).toBeNull();
  });

  it('respeita a janela configurada pela academia', () => {
    const contrato = { startsAt: D(2025, 10, 1), endsAt: D(2026, 9, 15) };
    expect(deriveContractStatus(contrato, NOW, 30)).toBe(CONTRACT_STATUS.ATIVO);
    expect(deriveContractStatus(contrato, NOW, 60)).toBe(CONTRACT_STATUS.A_VENCER);
  });

  it('todo status tem rótulo', () => {
    Object.values(CONTRACT_STATUS).forEach(s => {
      expect(CONTRACT_STATUS_LABEL[s]).toBeTruthy();
    });
  });
});

describe('buildContractCancel', () => {
  it('grava o motivo — que antes ia sempre null', () => {
    const r = buildContractCancel({ planName: 'Anual', cancelledAt: D(2026, 5, 14), reason: 'Mudou de cidade', note: 'volta em 2027' });
    expect(r.contractPatch.status).toBe(CONTRACT_STATUS.CANCELADO);
    expect(r.contractPatch.cancelReason).toBe('Mudou de cidade');
    expect(r.contractPatch.cancelNote).toBe('volta em 2027');
    expect(r.leadPatch.currentContractStatus).toBe(CONTRACT_STATUS.CANCELADO);
    expect(r.interactionText).toContain('Mudou de cidade');
    expect(r.interactionText).toContain('14/05/2026');
  });

  it('sem motivo não inventa texto', () => {
    const r = buildContractCancel({ cancelledAt: D(2026, 5, 14) });
    expect(r.contractPatch.cancelReason).toBeNull();
    expect(r.interactionText).not.toContain('—');
  });
});

describe('buildContractPause', () => {
  it('congela o contrato na data escolhida', () => {
    const r = buildContractPause({ planName: 'Anual', pausedAt: D(2026, 7, 10), reason: 'Viagem' });
    expect(r.contractPatch.status).toBe(CONTRACT_STATUS.TRANCADO);
    expect(r.contractPatch.pausedAt).toEqual(D(2026, 7, 10));
    expect(r.contractPatch.pauseReason).toBe('Viagem');
    expect(r.leadPatch.currentContractStatus).toBe(CONTRACT_STATUS.TRANCADO);
  });

  it('trancado é status derivado também', () => {
    expect(deriveContractStatus(
      { status: CONTRACT_STATUS.TRANCADO, startsAt: D(2026, 1, 1), endsAt: D(2026, 8, 10) },
      NOW
    )).toBe(CONTRACT_STATUS.TRANCADO);
  });

  it('trancado ganha de vencido — parado, o contrato não corre', () => {
    expect(deriveContractStatus(
      { status: CONTRACT_STATUS.TRANCADO, startsAt: D(2025, 1, 1), endsAt: D(2026, 1, 1) },
      NOW
    )).toBe(CONTRACT_STATUS.TRANCADO);
  });
});

describe('buildContractResume', () => {
  const contrato = { pausedAt: D(2026, 7, 8), endsAt: D(2027, 1, 10), pausedDaysTotal: 0 };

  it('empurra o término pelos dias parados', () => {
    const r = buildContractResume({ contract: contrato, resumedAt: D(2026, 7, 28) });
    expect(r.pausedDays).toBe(20);
    expect(r.newEndsAt).toEqual(D(2027, 1, 30));
    expect(r.contractPatch.endsAt).toEqual(D(2027, 1, 30));
    expect(r.leadPatch.currentContractEndsAt).toEqual(D(2027, 1, 30));
    expect(r.contractPatch.status).toBe(CONTRACT_STATUS.ATIVO);
    expect(r.contractPatch.pausedAt).toBeNull();
    expect(r.interactionText).toContain('20 dias');
  });

  it('acumula quando o contrato é trancado mais de uma vez', () => {
    const r = buildContractResume({
      contract: { ...contrato, pausedDaysTotal: 15 },
      resumedAt: D(2026, 7, 28)
    });
    expect(r.contractPatch.pausedDaysTotal).toBe(35);
  });

  it('reativar no mesmo dia não muda a vigência', () => {
    const r = buildContractResume({ contract: contrato, resumedAt: D(2026, 7, 8) });
    expect(r.pausedDays).toBe(0);
    expect(r.contractPatch.endsAt).toEqual(D(2027, 1, 10));
  });
});

describe('buildContractEdit', () => {
  const contrato = { planId: 'p1', planName: 'Mensal', value: 149, durationMonths: 1, startsAt: D(2026, 7, 1), endsAt: D(2026, 8, 1) };
  const plano = { id: 'p2', name: 'Anual', value: 1390, durationMonths: 12 };

  it('recalcula a vigência a partir do plano corrigido', () => {
    const r = buildContractEdit({ contract: contrato, plan: plano, value: 1390, startsAt: D(2026, 7, 1) });
    expect(r.contractPatch.planName).toBe('Anual');
    expect(r.contractPatch.durationMonths).toBe(12);
    expect(r.contractPatch.endsAt).toEqual(D(2027, 7, 1));
    expect(r.leadPatch.currentContractEndsAt).toEqual(D(2027, 7, 1));
  });

  it('preserva os dias já trancados ao recalcular', () => {
    const r = buildContractEdit({
      contract: { ...contrato, pausedDaysTotal: 20 },
      plan: plano,
      value: 1390,
      startsAt: D(2026, 7, 1)
    });
    expect(r.contractPatch.endsAt).toEqual(D(2027, 7, 21));
  });

  it('não mexe em marcos de renovação nem em conversão', () => {
    const r = buildContractEdit({ contract: contrato, plan: plano, value: 1390, startsAt: D(2026, 7, 1) });
    expect(r.leadPatch.renewalHandledCheckpoints).toBeUndefined();
    expect(r.leadPatch.status).toBeUndefined();
    expect(r.leadPatch.convertedAt).toBeUndefined();
  });

  it('guarda o valor de tabela do plano novo, para o desconto continuar legível', () => {
    const r = buildContractEdit({ contract: contrato, plan: plano, value: 1240, startsAt: D(2026, 7, 1) });
    expect(r.contractPatch.listValue).toBe(1390);
    expect(r.contractPatch.value).toBe(1240);
  });
});

describe('deriveLeadContractStatus', () => {
  it('lê o resumo denormalizado do lead, inclusive o início', () => {
    const lead = {
      currentContractStartsAt: D(2026, 9, 1),
      currentContractEndsAt: D(2027, 9, 1),
      currentContractStatus: CONTRACT_STATUS.ATIVO
    };
    expect(deriveLeadContractStatus(lead, NOW)).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('cliente legado sem vigência gravada devolve null', () => {
    expect(deriveLeadContractStatus({ currentContractStatus: 'ativo' }, NOW)).toBeNull();
  });
});

describe('buildMatriculaWrites — sinal de indicação para o caller', () => {
  const plan = { id: 'p1', name: 'Mensal', value: 200, durationMonths: 1 };
  const referredLead = {
    id: 'l1', name: 'João Souza',
    referredById: 'ref9', referredByName: 'Maria Silva',
    consultantId: 'c1', consultantAuthUid: 'u1'
  };

  it('matrícula de lead indicado devolve notifyReferrerId e o texto do 🎉', () => {
    const out = buildMatriculaWrites({
      lead: referredLead, plan, value: 200, startsAt: D(2026, 8, 1), appUser: {}
    });
    expect(out.notifyReferrerId).toBe('ref9');
    expect(out.referrerInteractionText).toBe('🎉 João Souza que você indicou fechou matrícula');
  });

  it('renovação NÃO re-notifica o indicador (senão todo ciclo dispara 🎉)', () => {
    const out = buildMatriculaWrites({
      lead: referredLead, plan, value: 200, startsAt: D(2026, 8, 1), appUser: {}, mode: 'renovacao'
    });
    expect(out.notifyReferrerId).toBe(null);
  });

  it('lead sem vínculo: sinal nulo', () => {
    const out = buildMatriculaWrites({
      lead: { id: 'l2', name: 'Ana' }, plan, value: 200, startsAt: D(2026, 8, 1), appUser: {}
    });
    expect(out.notifyReferrerId).toBe(null);
  });
});

describe('buildMatriculaWrites — funil Vencidos', () => {
  // Sem isto, o cliente que voltou e vencesse de novo daqui a dois anos
  // reapareceria na etapa da vida passada.
  it('limpa o reactivationStageId junto com os campos de renovação', () => {
    const { leadPatch } = buildMatriculaWrites({
      plan: { name: 'Mensal', priceCents: 10000 },
      startsAt: new Date(2026, 7, 18),
      months: 1,
    });
    expect(leadPatch.reactivationStageId).toBeNull();
    expect(leadPatch.renewalDeclined).toBe(false);
  });
});
