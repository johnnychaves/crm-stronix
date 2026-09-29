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
  buildRenewalCancel,
  contractDiscountOf,
  correctionMovesStart,
  correctionNeedsReason,
  deriveContractStatus,
  deriveLeadContractStatus,
  editListValueOf,
  hasLiveContract,
  isImportedContract,
  isImportPause,
  isRenewalNotStarted,
  isSeamlessStart,
  liveRenewalOf,
  neverTookEffect,
  renewalJoinOf,
  renewalStartProblem
} from '../contracts.js';
import { DISCOUNT_MODES } from '../renewal.js';

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

  // O Operacional precisa saber em que meses o cliente esteve trancado, e o
  // contrato só guardava a pausa atual.
  it('guarda a pausa encerrada no histórico', () => {
    const r = buildContractResume({ contract: contrato, resumedAt: D(2026, 7, 28) });
    expect(r.contractPatch.pauseHistory).toEqual([{ pausedAt: D(2026, 7, 8), resumedAt: D(2026, 7, 28) }]);
  });

  it('acrescenta ao histórico que já existe', () => {
    const antiga = { pausedAt: D(2026, 3, 1), resumedAt: D(2026, 3, 11) };
    const r = buildContractResume({
      contract: { ...contrato, pauseHistory: [antiga], pausedDaysTotal: 10, resumedAt: D(2026, 3, 11) },
      resumedAt: D(2026, 7, 28)
    });
    expect(r.contractPatch.pauseHistory).toEqual([antiga, { pausedAt: D(2026, 7, 8), resumedAt: D(2026, 7, 28) }]);
  });

  it('pausa de antes do histórico entra como primeiro item, reconstruída pelo total de dias', () => {
    const r = buildContractResume({
      contract: { ...contrato, pausedDaysTotal: 10, resumedAt: D(2026, 5, 1) },
      resumedAt: D(2026, 7, 28)
    });
    expect(r.contractPatch.pauseHistory).toEqual([
      { pausedAt: D(2026, 4, 21), resumedAt: D(2026, 5, 1), reconstructed: true },
      { pausedAt: D(2026, 7, 8), resumedAt: D(2026, 7, 28) }
    ]);
  });

  // A importação grava pausedAt = hora da importação, no dia em que o contrato
  // nasce (importedAt), e nunca grava motivo. Na pausa refeita o motivo não
  // serve de sinal: fica gravado de uma pausa para a outra.
  it('marca a pausa que veio da importação: começa no dia em que o contrato foi gravado', () => {
    const importado = { ...contrato, importBatchId: 'lote-1', importedAt: new Date(2026, 6, 8, 15), createdAt: new Date(2026, 6, 8, 15) };
    expect(buildContractResume({ contract: importado, resumedAt: D(2026, 7, 28) }).contractPatch.pauseHistory)
      .toEqual([{ pausedAt: D(2026, 7, 8), resumedAt: D(2026, 7, 28), fromImport: true }]);
    // Trancado pela ficha em outro dia, com ou sem motivo, é pausa de verdade.
    [{ pauseReason: 'Viagem' }, {}].forEach((extra) => {
      const r = buildContractResume({ contract: { ...importado, pausedAt: D(2026, 7, 10), ...extra }, resumedAt: D(2026, 7, 28) });
      expect(r.contractPatch.pauseHistory[0]).not.toHaveProperty('fromImport');
    });
    // Sem importedAt, vale o createdAt.
    const semImportedAt = { ...importado, importedAt: undefined };
    expect(buildContractResume({ contract: semImportedAt, resumedAt: D(2026, 7, 28) }).contractPatch.pauseHistory[0])
      .toHaveProperty('fromImport', true);
  });

  it('a pausa refeita de um importado reativado sem histórico também leva a marca', () => {
    // Importado às 15h de 10/05; a ficha reativou em 10/06 (meia-noite) sem
    // histórico. São 30 dias arredondados, e a pausa refeita começa em 11/05.
    const r = buildContractResume({
      contract: {
        importBatchId: 'lote-1', importedAt: new Date(2026, 4, 10, 15), createdAt: new Date(2026, 4, 10, 15),
        endsAt: D(2026, 12, 31), resumedAt: D(2026, 6, 10), pausedDaysTotal: 30, pausedAt: D(2026, 7, 5), pauseReason: 'Viagem'
      },
      resumedAt: D(2026, 8, 4)
    });
    expect(r.contractPatch.pauseHistory).toEqual([
      { pausedAt: D(2026, 5, 11), resumedAt: D(2026, 6, 10), reconstructed: true, fromImport: true },
      { pausedAt: D(2026, 7, 5), resumedAt: D(2026, 8, 4) }
    ]);
  });

  // A ficha sempre grava o motivo do trancamento (ContractOutcomeModal), e a
  // importação nunca grava. Na pausa atual, motivo gravado quer dizer ficha,
  // mesmo no dia em que o contrato foi importado.
  it('trancado pela ficha no mesmo dia da importação é pausa de verdade', () => {
    const importado = { ...contrato, importBatchId: 'lote-1', importedAt: new Date(2026, 6, 8, 15), createdAt: new Date(2026, 6, 8, 15) };
    expect(isImportPause(importado, importado.pausedAt)).toBe(true);
    const pelaFicha = { ...importado, ...buildContractPause({ pausedAt: new Date(2026, 6, 8, 18), reason: 'Viagem' }).contractPatch };
    expect(isImportPause(pelaFicha, pelaFicha.pausedAt)).toBe(false);
    expect(buildContractResume({ contract: pelaFicha, resumedAt: D(2026, 7, 28) }).contractPatch.pauseHistory[0])
      .not.toHaveProperty('fromImport');
  });

  it('sem pausedAt não mexe no histórico', () => {
    const r = buildContractResume({ contract: { endsAt: D(2027, 1, 10) }, resumedAt: D(2026, 7, 28) });
    expect(r.contractPatch).not.toHaveProperty('pauseHistory');
  });
});

describe('isImportedContract', () => {
  it('reconhece qualquer uma das marcas da importação', () => {
    expect(isImportedContract({ importBatchId: 'lote' })).toBe(true);
    expect(isImportedContract({ importSource: 'NextFit' })).toBe(true);
    expect(isImportedContract({ importedBy: 'u1' })).toBe(true);
    expect(isImportedContract({ consultantId: 'ana' })).toBe(false);
    expect(isImportedContract(null)).toBe(false);
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
    expect(leadPatch.renewalDeclinedAt).toBe(null);
    expect(leadPatch.renewalDeclineReason).toBe(null);
  });
});

describe('buildMatriculaWrites — funil Upgrade', () => {
  const plan = { id: 'p2', name: 'Trimestral', value: 500, durationMonths: 3 };
  const noFunil = { id: 'l1', name: 'Carla', upgradeStageId: 'st1', currentContractId: 'k1' };
  const foraDoFunil = { id: 'l2', name: 'Bruno', currentContractId: 'k2' };

  it('todo contrato novo limpa a etapa e a entrada do Upgrade', () => {
    const { leadPatch } = buildMatriculaWrites({ lead: noFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {} });
    expect(leadPatch.upgradeStageId).toBeNull();
    expect(leadPatch.upgradeEnteredAt).toBeNull();
  });

  it('marca o contrato como fechado pelo Upgrade quando o cliente estava no funil (decisão 9)', () => {
    const { contract } = buildMatriculaWrites({ lead: noFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {}, mode: 'renovacao', renewedFromId: 'k1' });
    expect(contract.closedFromUpgrade).toBe(true);
    // Uma venda só: continua sendo renovação também.
    expect(contract.renewedFromId).toBe('k1');
  });

  it('em modo matrícula (cliente sem contrato vivo) a marca vem do funil do mesmo jeito', () => {
    const { contract } = buildMatriculaWrites({ lead: noFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {} });
    expect(contract.closedFromUpgrade).toBe(true);
  });

  it('fora do funil, o contrato NÃO é upgrade, mesmo que o plano seja maior', () => {
    const { contract } = buildMatriculaWrites({ lead: foraDoFunil, plan, value: 500, startsAt: D(2026, 9, 1), appUser: {}, mode: 'renovacao' });
    expect(contract.closedFromUpgrade).toBe(false);
  });
});

describe('hasLiveContract', () => {
  const base = { currentContractId: 'k1', currentContractStartsAt: D(2026, 1, 10), currentContractEndsAt: D(2027, 1, 10) };
  it('ativo, a vencer, agendado e trancado são contrato vivo', () => {
    expect(hasLiveContract(base, NOW)).toBe(true);
    expect(hasLiveContract({ ...base, currentContractEndsAt: D(2026, 8, 20) }, NOW)).toBe(true);
    expect(hasLiveContract({ ...base, currentContractStartsAt: D(2026, 9, 1) }, NOW)).toBe(true);
    expect(hasLiveContract({ ...base, currentContractStatus: 'trancado' }, NOW)).toBe(true);
  });
  it('vencido, cancelado e sem contrato não são', () => {
    expect(hasLiveContract({ ...base, currentContractEndsAt: D(2026, 1, 10) }, NOW)).toBe(false);
    expect(hasLiveContract({ ...base, currentContractStatus: 'cancelado' }, NOW)).toBe(false);
    expect(hasLiveContract({ name: 'sem contrato' }, NOW)).toBe(false);
  });
});

describe('contractDiscountOf: tabela menos valor, como no Gerencial', () => {
  it('é a diferença entre a tabela e o valor fechado', () => {
    expect(contractDiscountOf({ value: 1177.2, listValue: 1308 })).toBe(130.8);
  });

  it('ignora o discountValue gravado', () => {
    expect(contractDiscountOf({ value: 1308, listValue: 1308, discountValue: 130.8 })).toBe(0);
  });

  it('sem tabela, ou acima dela, não tem desconto', () => {
    expect(contractDiscountOf({ value: 100 })).toBe(0);
    expect(contractDiscountOf({ value: 1400, listValue: 1308 })).toBe(0);
  });
});

describe('buildContractEdit: desconto recalculado', () => {
  const base = {
    planId: 'p1', planName: 'Start', value: 1177.2, listValue: 1308, durationMonths: 12,
    startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1),
    discountMode: 'percent', discountValue: 130.8, discountReason: 'Fidelidade'
  };
  const plano = { id: 'p1', name: 'Start', value: 1308, durationMonths: 12 };

  it('corrigir para o valor cheio apaga desconto e motivo', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1308, startsAt: D(2026, 9, 1) });
    expect(r.contractPatch).toMatchObject({ discountMode: 'nenhum', discountValue: 0, discountReason: null });
  });

  it('valor abaixo da tabela grava a diferença e o motivo escolhido', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1200, startsAt: D(2026, 9, 1), discountReason: 'Campanha' });
    expect(r.contractPatch).toMatchObject({ discountMode: 'final', discountValue: 108, discountReason: 'Campanha' });
  });

  it('só a data mudou: mantém o modo e o motivo', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1177.2, startsAt: D(2026, 9, 5) });
    expect(r.contractPatch).toMatchObject({ discountMode: 'percent', discountValue: 130.8, discountReason: 'Fidelidade' });
  });

  it('valor acima da tabela não vira desconto negativo', () => {
    const r = buildContractEdit({ contract: base, plan: plano, value: 1400, startsAt: D(2026, 9, 1) });
    expect(r.contractPatch).toMatchObject({ discountMode: 'nenhum', discountValue: 0, discountReason: null });
  });

  it('plano reajustado depois da venda: corrigir só a data mantém a tabela e o desconto', () => {
    const reajustado = { ...plano, value: 1500 };
    const r = buildContractEdit({ contract: base, plan: reajustado, value: 1177.2, startsAt: D(2026, 9, 5) });
    expect(r.contractPatch).toMatchObject({ listValue: 1308, discountMode: 'percent', discountValue: 130.8, discountReason: 'Fidelidade' });
  });

  it('grava os mesmos modos de DISCOUNT_MODES', () => {
    expect(DISCOUNT_MODES.NENHUM).toBe('nenhum');
    expect(DISCOUNT_MODES.FINAL).toBe('final');
  });
});

describe('editListValueOf: a tabela que vale na correção', () => {
  it('mesmo plano: fica a tabela gravada no contrato, não a do catálogo de hoje', () => {
    expect(editListValueOf({ planId: 'p1', listValue: 1308 }, { id: 'p1', value: 1500 })).toBe(1308);
  });

  it('plano trocado: vale a tabela do plano novo', () => {
    expect(editListValueOf({ planId: 'p1', listValue: 1308 }, { id: 'p2', value: 1390 })).toBe(1390);
  });

  it('mesmo plano, mas o contrato não tem tabela gravada: usa a do plano', () => {
    expect(editListValueOf({ planId: 'p1', value: 1177.2 }, { id: 'p1', value: 1500 })).toBe(1500);
  });
});

// A mesma conta decide, na correção, se a emenda é recalculada
// (buildContractEdit) e se a regra de início da renovação vale
// (ContractEditModal).
describe('correctionMovesStart: a correção muda o início?', () => {
  it('conta por dia do calendário: o mesmo dia com outra hora não é mudança', () => {
    const contrato = { startsAt: new Date(2026, 7, 1, 14, 30) };
    expect(correctionMovesStart(contrato, D(2026, 8, 1))).toBe(false);
    expect(correctionMovesStart(contrato, new Date(2026, 7, 1, 23, 59))).toBe(false);
    expect(correctionMovesStart(contrato, D(2026, 8, 2))).toBe(true);
    expect(correctionMovesStart(contrato, D(2026, 7, 31))).toBe(true);
  });

  it('aceita o doc cru do Firestore', () => {
    const ts = (d) => ({ toDate: () => d });
    expect(correctionMovesStart({ startsAt: ts(new Date(2026, 7, 1, 14, 30)) }, D(2026, 8, 1))).toBe(false);
    expect(correctionMovesStart({ startsAt: ts(D(2026, 8, 1)) }, D(2026, 8, 3))).toBe(true);
  });

  it('sem início gravado conta como mudança', () => {
    expect(correctionMovesStart({ startsAt: null }, D(2026, 8, 1))).toBe(true);
    expect(correctionMovesStart({}, D(2026, 8, 1))).toBe(true);
    expect(correctionMovesStart(null, D(2026, 8, 1))).toBe(true);
  });
});

describe('correctionNeedsReason: quando a correção exige o motivo do desconto', () => {
  const contract = { planId: 'p1', value: 1177.2, listValue: 1308 };
  const plan = { id: 'p1', value: 1500 };

  it('sem desconto nunca exige, mesmo com plano e valor trocados', () => {
    expect(correctionNeedsReason({ contract, plan, value: 1177.2, hasDiscount: false })).toBe(false);
    expect(correctionNeedsReason({ contract, plan: { id: 'p2', value: 1390 }, value: 1390, hasDiscount: false })).toBe(false);
  });

  it('mesmo plano e mesmo valor, sem motivo gravado: só a data mudou, não trava', () => {
    expect(correctionNeedsReason({ contract, plan, value: 1177.2, hasDiscount: true })).toBe(false);
  });

  it('valor trocado com desconto: exige', () => {
    expect(correctionNeedsReason({ contract, plan, value: 1100, hasDiscount: true })).toBe(true);
  });

  it('plano trocado com desconto: exige', () => {
    expect(correctionNeedsReason({ contract, plan: { id: 'p2', value: 1390 }, value: 1177.2, hasDiscount: true })).toBe(true);
  });

  it('mesmo negócio, mas o contrato já tinha motivo: exige', () => {
    const comMotivo = { ...contract, discountReason: 'Fidelidade' };
    expect(correctionNeedsReason({ contract: comMotivo, plan, value: 1177.2, hasDiscount: true })).toBe(true);
  });
});

describe('emendado: começa no dia seguinte ao fim do contrato renovado', () => {
  it('renewalJoinOf lê emenda, intervalo e sobreposição por dia do calendário', () => {
    const end = new Date(2026, 9, 11, 15, 32);
    expect(renewalJoinOf(end, new Date(2026, 9, 12, 0, 0))).toEqual({ seamless: true, overlaps: false, previousEndsAt: null });
    expect(renewalJoinOf(end, D(2026, 10, 20))).toEqual({ seamless: false, overlaps: false, previousEndsAt: null });
    expect(renewalJoinOf(end, D(2026, 10, 11))).toEqual({ seamless: false, overlaps: true, previousEndsAt: D(2026, 10, 10) });
    expect(renewalJoinOf(null, D(2026, 10, 11))).toEqual({ seamless: false, overlaps: false, previousEndsAt: null });
  });

  it('isSeamlessStart', () => {
    expect(isSeamlessStart(D(2026, 10, 31), D(2026, 11, 1))).toBe(true);
    expect(isSeamlessStart(D(2026, 12, 31), D(2027, 1, 1))).toBe(true);
    expect(isSeamlessStart(D(2026, 10, 11), D(2026, 10, 11))).toBe(false);
    expect(isSeamlessStart(D(2026, 10, 11), D(2026, 10, 13))).toBe(false);
  });

  it('emendado com início no futuro é ativo; sem a marca, agendado', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 8, 20), endsAt: D(2027, 8, 20), seamless: true }, NOW)).toBe(CONTRACT_STATUS.ATIVO);
    expect(deriveContractStatus({ startsAt: D(2026, 8, 20), endsAt: D(2027, 8, 20) }, NOW)).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('emendado curto que acaba dentro da janela de aviso é a vencer', () => {
    expect(deriveContractStatus({ startsAt: D(2026, 8, 1), endsAt: D(2026, 8, 20), seamless: true }, NOW)).toBe(CONTRACT_STATUS.A_VENCER);
  });

  it('o resumo do lead leva a marca', () => {
    expect(deriveLeadContractStatus({
      currentContractStatus: 'ativo',
      currentContractStartsAt: D(2026, 8, 20),
      currentContractEndsAt: D(2027, 8, 20),
      currentContractSeamless: true
    }, NOW)).toBe(CONTRACT_STATUS.ATIVO);
  });

  it('sobreposição de vários dias encurta para a véspera do novo', () => {
    expect(renewalJoinOf(D(2026, 10, 11), D(2026, 10, 8))).toEqual({ seamless: false, overlaps: true, previousEndsAt: D(2026, 10, 7) });
  });

  it('a marca de emendado nunca ganha de cancelado nem de trancado', () => {
    const base = { startsAt: D(2026, 8, 20), endsAt: D(2027, 8, 20), seamless: true };
    expect(deriveContractStatus({ ...base, status: 'cancelado' }, NOW)).toBe(CONTRACT_STATUS.CANCELADO);
    expect(deriveContractStatus({ ...base, status: 'trancado' }, NOW)).toBe(CONTRACT_STATUS.TRANCADO);
  });

  it('renewalJoinOf aceita Timestamp do Firestore', () => {
    const ts = (d) => ({ toDate: () => d });
    expect(renewalJoinOf(ts(D(2026, 10, 11)), ts(D(2026, 10, 12))).seamless).toBe(true);
  });
});

describe('buildMatriculaWrites: renovação emendada e sobreposta', () => {
  const plan = { id: 'p1', name: 'Anual', value: 1308, durationMonths: 12 };
  const lead = {
    id: 'l1', name: 'Ana', consultantId: 'c1', consultantAuthUid: 'u1',
    currentContractId: 'k1', currentContractStartsAt: D(2025, 10, 11), currentContractEndsAt: D(2026, 10, 11)
  };
  // O documento do contrato atual, como chega da coleção de contratos.
  const atual = { id: 'k1', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const renovar = (startsAt, { from = lead, doc = atual } = {}) => buildMatriculaWrites({
    lead: from, plan, value: 1308, startsAt, mode: 'renovacao', renewedFromId: 'k1', previousContract: doc
  });

  it('começa no dia seguinte ao fim: emendada, sem encurtar o atual', () => {
    const r = renovar(D(2026, 10, 12));
    expect(r.contract.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
  });

  it('começa depois de um intervalo: não é emendada', () => {
    const r = renovar(D(2026, 10, 20));
    expect(r.contract.seamless).toBe(false);
    expect(r.previousPatch).toBeNull();
  });

  // Encurtado o atual para a véspera do novo, o novo começa no dia seguinte ao
  // fim dele: é emendado, igual a quem emendou no fim original.
  it('começa antes do fim: o atual termina na véspera do novo, e o novo conta como emendado', () => {
    const r = renovar(D(2026, 9, 28));
    expect(r.contract.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousContractId).toBe('k1');
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11) });
  });

  it('com início no futuro, a renovação que encurta o atual não fica agendada', () => {
    // Hoje é 29/09. O atual ia até 11/10, a renovação começa em 05/10, e o
    // atual passa a terminar em 04/10: o cliente não fica um dia sem contrato.
    const hoje = D(2026, 9, 29);
    const r = renovar(D(2026, 10, 5));
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11) });
    expect(deriveContractStatus(r.contract, hoje)).not.toBe(CONTRACT_STATUS.AGENDADO);
    expect(deriveLeadContractStatus(r.leadPatch, hoje)).not.toBe(CONTRACT_STATUS.AGENDADO);
    // Sem o documento do atual, nada é encurtado, os dois valem juntos e o
    // novo continua agendado até começar.
    const semDoc = renovar(D(2026, 10, 5), { doc: null });
    expect(semDoc.previousPatch).toBeNull();
    expect(deriveContractStatus(semDoc.contract, hoje)).toBe(CONTRACT_STATUS.AGENDADO);
    expect(deriveLeadContractStatus(semDoc.leadPatch, hoje)).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('começa no próprio dia do fim também encurta', () => {
    expect(renovar(D(2026, 10, 11)).previousPatch).toEqual({ endsAt: D(2026, 10, 10), originalEndsAt: D(2026, 10, 11) });
  });

  it('sem o documento do contrato atual, não encurta nada nem marca emendada', () => {
    const r = buildMatriculaWrites({ lead, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1' });
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
    expect(r.contract.renewedFromId).toBe('k1');
    expect(r.contract.seamless).toBe(false);
    expect(r.leadPatch.currentContractSeamless).toBe(false);
  });

  it('um documento que não é o atual do lead também não encurta nada', () => {
    const r = renovar(D(2026, 9, 28), { doc: { ...atual, id: 'k0' } });
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
  });

  // O Kanban e a Meta Diária passam o lead da lista, que pode estar velho; o
  // documento vem da coleção assinada. Com o fim velho mais tarde, o
  // "encurtamento" esticaria o contrato e guardaria um fim original falso.
  it('o fim que vale é o do documento: o resumo velho do lead não estica o contrato', () => {
    const velho = { ...lead, currentContractEndsAt: D(2026, 12, 11) };
    const r = renovar(D(2026, 11, 1), { from: velho });
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
    expect(r.contract.seamless).toBe(false);
  });

  it('com o resumo velho mais cedo, encurta pelo fim do documento', () => {
    const r = renovar(D(2026, 9, 28), { from: { ...lead, currentContractEndsAt: D(2026, 9, 1) } });
    expect(r.previousContractId).toBe('k1');
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11) });
  });

  it('a marca de emendada também sai do documento', () => {
    const r = renovar(D(2026, 10, 12), { from: { ...lead, currentContractEndsAt: D(2026, 12, 11) } });
    expect(r.contract.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
  });

  it('sem o documento, o resumo do lead decide só a marca de emendada', () => {
    const r = renovar(D(2026, 10, 12), { doc: null });
    expect(r.contract.seamless).toBe(true);
    expect(r.previousPatch).toBeNull();
  });

  it('não encurta para antes do início do contrato atual', () => {
    expect(renovar(D(2025, 10, 5)).previousPatch).toBeNull();
    // A véspera cairia no próprio início: contrato de duração zero.
    expect(renovar(D(2025, 10, 12)).previousPatch).toBeNull();
    expect(renovar(D(2025, 10, 12)).contract.seamless).toBe(false);
    expect(renovar(D(2025, 10, 13)).previousPatch).toEqual({ endsAt: D(2025, 10, 12), originalEndsAt: D(2026, 10, 11) });
    expect(renovar(D(2025, 10, 13)).contract.seamless).toBe(true);
  });

  // Lead velho na lista, ainda apontando para um contrato que outra renovação
  // já encurtou. Encurtar de novo trocaria o fim original pelo fim encurtado.
  it('contrato já encurtado por outra renovação não é encurtado de novo', () => {
    const encurtado = { ...atual, endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const r = renovar(D(2026, 9, 20), { doc: encurtado });
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
    expect(r.contract.renewedFromId).toBe('k1');
    expect(r.contract.seamless).toBe(false);
    // Com a renovação desfeita (shortenedById volta a null), encurta de novo.
    expect(renovar(D(2026, 9, 20), { doc: { ...atual, originalEndsAt: null, shortenedById: null } }).previousPatch)
      .toEqual({ endsAt: D(2026, 9, 19), originalEndsAt: D(2026, 10, 11) });
  });

  it('importado sem início: o limite é a criação, como no Operacional', () => {
    const importado = { id: 'k1', startsAt: null, createdAt: D(2026, 9, 4), endsAt: D(2026, 10, 11) };
    expect(renovar(D(2026, 9, 28), { doc: importado }).previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11) });
    expect(renovar(D(2026, 9, 5), { doc: importado }).previousPatch).toBeNull();
    expect(renovar(D(2026, 9, 28), { doc: { ...importado, createdAt: null } }).previousPatch).toBeNull();
  });

  it('matrícula nunca é emendada nem encurta nada', () => {
    const r = buildMatriculaWrites({ lead, plan, value: 1308, startsAt: D(2026, 10, 12) });
    expect(r.contract.seamless).toBe(false);
    expect(r.leadPatch.currentContractSeamless).toBe(false);
    expect(r.previousPatch).toBeNull();
  });
});

describe('renewalStartProblem: quando a renovação não pode ser gravada', () => {
  // Contrato renovado que começou em 11/10/2025: a renovação começa a partir de 13/10.
  const cedo = 'A renovação precisa começar a partir de 13/10/2025, dois dias depois do início do contrato renovado. Para trocar o plano desse contrato, use Corrigir na ficha do cliente.';

  it('contrato trancado não renova', () => {
    expect(renewalStartProblem({ status: 'trancado', startsAt: D(2025, 10, 11) }, D(2026, 10, 12)))
      .toBe('Este contrato está trancado. Reative o contrato antes de renovar.');
  });

  it('renovação não começa no dia do início do contrato renovado, nem antes', () => {
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2025, 10, 11))).toBe(cedo);
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2025, 10, 6))).toBe(cedo);
  });

  // No dia seguinte ao início, a véspera do novo cairia no próprio início do
  // renovado e ele não teria como ser encurtado: os dois valeriam juntos.
  it('nem no dia seguinte ao início do contrato renovado', () => {
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2025, 10, 12))).toBe(cedo);
  });

  it('a partir de dois dias depois do início, pode', () => {
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2025, 10, 13))).toBeNull();
  });

  it('conta dias do calendário: o horário não muda a resposta', () => {
    // 46 horas, mas só um dia do calendário.
    expect(renewalStartProblem({ status: 'ativo', startsAt: new Date(2025, 9, 11, 1, 0) }, new Date(2025, 9, 12, 23, 0)))
      .toBe(cedo);
    // 26 horas, mas dois dias do calendário.
    expect(renewalStartProblem({ status: 'ativo', startsAt: new Date(2025, 9, 11, 23, 0) }, new Date(2025, 9, 13, 1, 0)))
      .toBeNull();
  });

  it('aceita Timestamp do Firestore no início do contrato renovado', () => {
    const ts = (d) => ({ toDate: () => d });
    expect(renewalStartProblem({ status: 'ativo', startsAt: ts(D(2025, 10, 11)) }, D(2025, 10, 11))).toBe(cedo);
    expect(renewalStartProblem({ status: 'ativo', startsAt: ts(D(2025, 10, 11)) }, D(2025, 10, 13))).toBeNull();
  });

  // Dentro do Corrigir, mandar usar o Corrigir não ajuda: fica só a regra.
  it('na correção, só a regra, sem a dica do Corrigir', () => {
    const regra = 'A renovação precisa começar a partir de 13/10/2025, dois dias depois do início do contrato renovado.';
    expect(renewalStartProblem({ startsAt: D(2025, 10, 11) }, D(2025, 10, 12), { correcting: true })).toBe(regra);
    expect(renewalStartProblem({ startsAt: D(2025, 10, 11) }, D(2025, 10, 11), { correcting: true })).toBe(regra);
    expect(renewalStartProblem({ startsAt: D(2025, 10, 11) }, D(2025, 10, 13), { correcting: true })).toBeNull();
    // Na renovação, com ou sem a opção, o texto segue completo.
    expect(renewalStartProblem({ startsAt: D(2025, 10, 11) }, D(2025, 10, 12))).toBe(cedo);
    expect(renewalStartProblem({ startsAt: D(2025, 10, 11) }, D(2025, 10, 12), { correcting: false })).toBe(cedo);
    expect(cedo.startsWith(`${regra} `)).toBe(true);
  });

  it('sem problema devolve null', () => {
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, D(2026, 10, 12))).toBeNull();
    expect(renewalStartProblem({}, D(2026, 10, 12))).toBeNull();
    expect(renewalStartProblem(undefined, D(2026, 10, 12))).toBeNull();
    expect(renewalStartProblem({ status: 'ativo', startsAt: D(2025, 10, 11) }, null)).toBeNull();
  });
});

describe('liveRenewalOf: renovação ainda de pé do contrato', () => {
  const antigo = { id: 'k1', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const renovacao = { id: 'k2', renewedFromId: 'k1', status: 'ativo', planName: 'Anual', startsAt: D(2026, 10, 12) };
  const desfeita = { id: 'k3', renewedFromId: 'k1', status: 'cancelado', startsAt: D(2026, 10, 12) };
  const outra = { id: 'k9', renewedFromId: 'k8', status: 'ativo' };

  it('acha a renovação que não foi cancelada', () => {
    expect(liveRenewalOf('k1', [antigo, desfeita, renovacao, outra])).toBe(renovacao);
  });

  it('renovação cancelada não conta', () => {
    expect(liveRenewalOf('k1', [antigo, desfeita, outra])).toBeNull();
  });

  it('ignora contrato que renova outro', () => {
    expect(liveRenewalOf('k1', [antigo, outra])).toBeNull();
    expect(liveRenewalOf('k2', [antigo, renovacao, outra])).toBeNull();
  });

  it('sem id ou sem lista devolve null', () => {
    expect(liveRenewalOf(null, [renovacao])).toBeNull();
    expect(liveRenewalOf(undefined, [renovacao])).toBeNull();
    expect(liveRenewalOf('k1', null)).toBeNull();
    expect(liveRenewalOf('k1', undefined)).toBeNull();
  });
});

// A mesma regra serve à ficha (docs crus, com Timestamp) e aos painéis
// (contratos normalizados, com Date). O caso normalizado é testado também em
// operacional.base.test.js.
describe('neverTookEffect: contrato que nunca valeu', () => {
  const ts = (d) => ({ toDate: () => d });
  const inicio = new Date(2026, 9, 12, 0, 0);

  it('cancelado antes do início nunca valeu', () => {
    expect(neverTookEffect({ status: 'cancelado', startsAt: inicio, cancelledAt: D(2026, 9, 20) })).toBe(true);
  });

  it('cancelado no instante do início também não', () => {
    expect(neverTookEffect({ status: 'cancelado', startsAt: inicio, cancelledAt: new Date(inicio.getTime()) })).toBe(true);
  });

  it('cancelado um minuto depois do início chegou a valer', () => {
    expect(neverTookEffect({ status: 'cancelado', startsAt: inicio, cancelledAt: new Date(2026, 9, 12, 0, 1) })).toBe(false);
  });

  it('aceita o doc cru do Firestore', () => {
    expect(neverTookEffect({ status: 'cancelado', startsAt: ts(inicio), cancelledAt: ts(D(2026, 9, 20)) })).toBe(true);
    expect(neverTookEffect({ status: 'cancelado', startsAt: ts(inicio), cancelledAt: ts(new Date(inicio.getTime())) })).toBe(true);
    expect(neverTookEffect({ status: 'cancelado', startsAt: ts(inicio), cancelledAt: ts(new Date(2026, 9, 12, 0, 1)) })).toBe(false);
  });

  it('sem cancelamento ou sem início, não', () => {
    expect(neverTookEffect({ status: 'ativo', startsAt: inicio, cancelledAt: null })).toBe(false);
    expect(neverTookEffect({ status: 'cancelado', startsAt: null, cancelledAt: D(2026, 9, 20) })).toBe(false);
    expect(neverTookEffect({})).toBe(false);
    expect(neverTookEffect(null)).toBe(false);
    expect(neverTookEffect(undefined)).toBe(false);
  });
});

// Cancelar a renovação que ainda não começou desfaz a renovação: ela nunca
// valeu, e o cliente volta ao contrato que ela renovava, com o fim de antes do
// encurtamento. Decisão do Johnny (29/09/2026).
describe('renovação cancelada antes de começar', () => {
  const ts = (d) => ({ toDate: () => d });
  // O Start ia até 11/10 e foi encurtado para 27/09 pela renovação, que começa em 28/09.
  const previous = {
    id: 'k1', planName: 'Start', value: 1308, status: 'ativo', seamless: false,
    startsAt: D(2025, 10, 11), endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2'
  };
  const renewal = {
    id: 'k2', planName: 'Flow', renewedFromId: 'k1', status: 'ativo', seamless: true,
    startsAt: D(2026, 9, 28), endsAt: D(2027, 9, 28)
  };

  describe('isRenewalNotStarted', () => {
    it('vale até o instante do início, a mesma regra do contrato que nunca valeu', () => {
      expect(isRenewalNotStarted(renewal, previous, D(2026, 9, 27))).toBe(true);
      // A data do modal é a meia-noite do dia escolhido: o próprio dia do
      // início ainda desfaz a renovação.
      expect(isRenewalNotStarted(renewal, previous, D(2026, 9, 28))).toBe(true);
      expect(isRenewalNotStarted(renewal, previous, D(2026, 9, 29))).toBe(false);
    });

    it('início com hora: o cancelamento na meia-noite do mesmo dia ainda vem antes', () => {
      const comHora = { ...renewal, startsAt: new Date(2026, 8, 28, 14, 30) };
      expect(isRenewalNotStarted(comHora, previous, D(2026, 9, 28))).toBe(true);
    });

    it('não vale sem o contrato renovado, com ele cancelado, sem ligação ou com a renovação já cancelada', () => {
      expect(isRenewalNotStarted(renewal, null, D(2026, 9, 20))).toBe(false);
      expect(isRenewalNotStarted(renewal, { ...previous, status: 'cancelado' }, D(2026, 9, 20))).toBe(false);
      expect(isRenewalNotStarted({ ...renewal, renewedFromId: null }, previous, D(2026, 9, 20))).toBe(false);
      expect(isRenewalNotStarted({ ...renewal, renewedFromId: 'k0' }, previous, D(2026, 9, 20))).toBe(false);
      expect(isRenewalNotStarted({ ...renewal, status: 'cancelado', cancelledAt: D(2026, 9, 10) }, previous, D(2026, 9, 20))).toBe(false);
    });

    it('sem data ou sem contrato, não vale', () => {
      expect(isRenewalNotStarted(renewal, previous, null)).toBe(false);
      expect(isRenewalNotStarted(null, previous, D(2026, 9, 20))).toBe(false);
      expect(isRenewalNotStarted(undefined, undefined, undefined)).toBe(false);
    });

    it('aceita o doc cru do Firestore', () => {
      const cru = { ...renewal, startsAt: ts(D(2026, 9, 28)) };
      expect(isRenewalNotStarted(cru, previous, D(2026, 9, 28))).toBe(true);
      expect(isRenewalNotStarted(cru, previous, D(2026, 9, 29))).toBe(false);
    });
  });

  describe('buildRenewalCancel', () => {
    it('devolve o fim de antes ao contrato encurtado e o resumo do lead a ele', () => {
      const r = buildRenewalCancel({ contract: renewal, previous, cancelledAt: D(2026, 9, 20), reason: 'Financeiro', note: 'Mudou de ideia' });
      expect(r.contractPatch).toEqual({ status: 'cancelado', cancelledAt: D(2026, 9, 20), cancelReason: 'Financeiro', cancelNote: 'Mudou de ideia' });
      expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
      expect(r.leadPatch).toEqual({
        currentContractId: 'k1',
        currentPlanName: 'Start',
        currentContractValue: 1308,
        currentContractStartsAt: D(2025, 10, 11),
        currentContractEndsAt: D(2026, 10, 11),
        currentContractStatus: 'ativo',
        currentContractSeamless: false
      });
      expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow, motivo Financeiro. O contrato Plano Start volta a valer até 11/10/2026.');
    });

    it('sem motivo, sem ", motivo" no texto', () => {
      const r = buildRenewalCancel({ contract: renewal, previous, cancelledAt: D(2026, 9, 20) });
      expect(r.contractPatch).toEqual({ status: 'cancelado', cancelledAt: D(2026, 9, 20), cancelReason: null, cancelNote: null });
      expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow. O contrato Plano Start volta a valer até 11/10/2026.');
    });

    it('renovação emendada: o contrato renovado não foi encurtado e fica como está', () => {
      const r = buildRenewalCancel({
        contract: { ...renewal, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) },
        previous: { ...previous, endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null },
        cancelledAt: D(2026, 9, 20)
      });
      expect(r.previousPatch).toBeNull();
      expect(r.leadPatch.currentContractEndsAt).toEqual(D(2026, 10, 11));
      expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow. O contrato Plano Start volta a valer até 11/10/2026.');
    });

    // Só volta o fim que esta renovação mudou. O contrato que outra renovação
    // encurtou fica com o fim dela.
    it('contrato encurtado por outra renovação: o fim não volta', () => {
      const r = buildRenewalCancel({ contract: renewal, previous: { ...previous, shortenedById: 'k9' }, cancelledAt: D(2026, 9, 20) });
      expect(r.previousPatch).toBeNull();
      expect(r.leadPatch.currentContractEndsAt).toEqual(D(2026, 9, 27));
    });

    // Renovação com intervalo, desfeita depois de o contrato renovado vencer.
    it('contrato renovado que já venceu: volta a ser o atual, sem "volta a valer"', () => {
      const vencido = { ...previous, endsAt: D(2026, 9, 10), originalEndsAt: null, shortenedById: null };
      const depois = { ...renewal, startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5), seamless: false };
      const r = buildRenewalCancel({ contract: depois, previous: vencido, cancelledAt: D(2026, 9, 29), reason: 'Financeiro' });
      expect(r.previousPatch).toBeNull();
      expect(r.leadPatch.currentContractEndsAt).toEqual(D(2026, 9, 10));
      expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow, motivo Financeiro. O contrato Plano Start, que venceu em 10/09/2026, volta a ser o atual.');
    });

    it('contrato renovado que termina no próprio dia do cancelamento ainda volta a valer', () => {
      const r = buildRenewalCancel({
        contract: { ...renewal, startsAt: D(2026, 10, 5), seamless: false },
        previous: { ...previous, endsAt: new Date(2026, 8, 29, 18, 0), originalEndsAt: null, shortenedById: null },
        cancelledAt: D(2026, 9, 29)
      });
      expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow. O contrato Plano Start volta a valer até 29/09/2026.');
    });

    it('sem nome de plano, o texto diz renovação e contrato anterior', () => {
      const semPlano = { contract: { ...renewal, planName: null }, previous: { ...previous, planName: null } };
      expect(buildRenewalCancel({ ...semPlano, cancelledAt: D(2026, 9, 20), reason: 'Financeiro' }).interactionText)
        .toBe('Renovação cancelada antes de começar: renovação, motivo Financeiro. O contrato anterior volta a valer até 11/10/2026.');
      const vencido = { ...semPlano.previous, endsAt: D(2026, 9, 10), originalEndsAt: null, shortenedById: null };
      expect(buildRenewalCancel({ contract: semPlano.contract, previous: vencido, cancelledAt: D(2026, 9, 29) }).interactionText)
        .toBe('Renovação cancelada antes de começar: renovação. O contrato anterior, que venceu em 10/09/2026, volta a ser o atual.');
      expect(buildRenewalCancel({ ...semPlano, cancelledAt: D(2026, 9, 20) }).leadPatch.currentPlanName).toBeNull();
    });

    it('contrato renovado sem fim gravado: volta a ser o atual, sem data', () => {
      const r = buildRenewalCancel({ contract: renewal, previous: { ...previous, endsAt: null, originalEndsAt: null, shortenedById: null }, cancelledAt: D(2026, 9, 20) });
      expect(r.leadPatch.currentContractEndsAt).toBeNull();
      expect(r.interactionText).toBe('Renovação cancelada antes de começar: Plano Flow. O contrato Plano Start volta a ser o atual.');
    });

    // Importado pode vir sem valor, sem início e sem status gravado.
    it('resumo do lead: sem valor fica null, sem início vale a criação, sem status é ativo', () => {
      const importado = { id: 'k1', planName: 'Start', value: null, startsAt: null, createdAt: D(2026, 9, 4), endsAt: D(2026, 10, 11), seamless: true };
      const r = buildRenewalCancel({ contract: renewal, previous: importado, cancelledAt: D(2026, 9, 20) });
      expect(r.leadPatch.currentContractValue).toBeNull();
      expect(r.leadPatch.currentContractStartsAt).toEqual(D(2026, 9, 4));
      expect(r.leadPatch.currentContractStatus).toBe('ativo');
      expect(r.leadPatch.currentContractSeamless).toBe(true);
    });

    it('aceita o doc cru do Firestore e grava Date', () => {
      const cru = { ...previous, startsAt: ts(D(2025, 10, 11)), endsAt: ts(D(2026, 9, 27)), originalEndsAt: ts(D(2026, 10, 11)) };
      const r = buildRenewalCancel({ contract: renewal, previous: cru, cancelledAt: D(2026, 9, 20) });
      expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
      expect(r.previousPatch.endsAt).toBeInstanceOf(Date);
      expect(r.leadPatch.currentContractStartsAt).toEqual(D(2025, 10, 11));
      expect(r.leadPatch.currentContractEndsAt).toEqual(D(2026, 10, 11));
    });
  });

  // Ida e volta pelas funções de verdade: renovar encurtando o contrato atual e
  // desfazer antes de começar devolve o contrato e o resumo do lead como eram.
  it('renovar encurtando e desfazer devolve o contrato e o lead como estavam', () => {
    const antes = {
      id: 'k1', planId: 'p1', planName: 'Start', value: 1308, listValue: 1308, durationMonths: 12, status: 'ativo', seamless: false,
      startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 11)
    };
    const resumo = {
      currentContractId: 'k1',
      currentPlanName: 'Start',
      currentContractValue: 1308,
      currentContractStartsAt: D(2025, 10, 11),
      currentContractEndsAt: D(2026, 10, 11),
      currentContractStatus: 'ativo',
      currentContractSeamless: false
    };
    const lead = { id: 'l1', name: 'Ana', consultantId: 'c1', consultantAuthUid: 'u1', ...resumo };

    const w = buildMatriculaWrites({
      lead, plan: { id: 'p2', name: 'Flow', value: 1500, durationMonths: 12 }, value: 1500,
      startsAt: D(2026, 10, 5), mode: 'renovacao', renewedFromId: 'k1', previousContract: antes
    });
    expect(w.previousContractId).toBe('k1');
    // Como o banco fica depois da renovação: commitMatricula grava o
    // encurtamento com shortenedById e o lead aponta para o contrato novo.
    const encurtado = { ...antes, ...w.previousPatch, shortenedById: 'k2' };
    const renovacao = { id: 'k2', ...w.contract };
    const leadRenovado = { ...lead, ...w.leadPatch, currentContractId: 'k2' };
    expect(encurtado.endsAt).toEqual(D(2026, 10, 4));

    const cancelamento = D(2026, 9, 29);
    expect(isRenewalNotStarted(renovacao, encurtado, cancelamento)).toBe(true);
    const r = buildRenewalCancel({ contract: renovacao, previous: encurtado, cancelledAt: cancelamento, reason: 'Financeiro' });

    expect({ ...encurtado, ...r.previousPatch }).toEqual({ ...antes, originalEndsAt: null, shortenedById: null });
    expect(r.leadPatch).toEqual(resumo);
    const leadDepois = { ...leadRenovado, ...r.leadPatch };
    Object.keys(resumo).forEach((k) => expect(leadDepois[k], k).toEqual(lead[k]));
    // A renovação desfeita nunca valeu: os painéis não a contam.
    expect(neverTookEffect({ ...renovacao, ...r.contractPatch })).toBe(true);
  });
});

// Corrigir o início de uma renovação segue as regras da gravação dela
// (buildMatriculaWrites): a marca de emendada e o fim do contrato renovado
// acompanham o início novo. Decisão do Johnny (29/09/2026).
describe('buildContractEdit: renovação com o contrato anterior', () => {
  const plano = { id: 'p1', name: 'Flow', value: 1308, durationMonths: 12 };
  const anterior = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const renovacao = {
    id: 'k2', planId: 'p1', planName: 'Flow', value: 1308, listValue: 1308, durationMonths: 12,
    renewedFromId: 'k1', startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), seamless: true
  };
  // O Start, encurtado por esta renovação quando ela começava em 28/09.
  const encurtado = { ...anterior, endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
  const sobreposta = { ...renovacao, startsAt: D(2026, 9, 28), endsAt: D(2027, 9, 28) };
  const corrigir = (startsAt, { previous = anterior, contract = renovacao, value = 1308 } = {}) =>
    buildContractEdit({ contract, plan: plano, value, startsAt, previous });

  it('continua emendada: nada muda no anterior', () => {
    const r = corrigir(D(2026, 10, 12));
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toBeNull();
  });

  it('passa a sobrepor: o anterior termina na véspera, e a renovação segue emendada', () => {
    const r = corrigir(D(2026, 9, 28));
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
  });

  it('encurtou o anterior e volta para a emenda: o anterior volta ao fim original', () => {
    const r = corrigir(D(2026, 10, 12), { previous: encurtado, contract: sobreposta });
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
  });

  it('encurtou o anterior e muda de data dentro da sobreposição: encurta a partir do fim original', () => {
    const r = corrigir(D(2026, 10, 1), { previous: encurtado, contract: sobreposta });
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 30), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
  });

  it('encurtou o anterior e o início fica igual: nada a gravar no anterior', () => {
    const r = corrigir(D(2026, 9, 28), { previous: encurtado, contract: sobreposta, value: 1250 });
    expect(r.contractPatch.value).toBe(1250);
    expect(r.contractPatch.seamless).toBe(true);
    expect(r.leadPatch.currentContractSeamless).toBe(true);
    expect(r.previousPatch).toBeNull();
  });

  it('encurtou o anterior e vai para depois de um intervalo: o fim original volta, e ela deixa de ser emendada', () => {
    const r = corrigir(D(2026, 10, 20), { previous: encurtado, contract: sobreposta });
    expect(r.contractPatch.seamless).toBe(false);
    expect(r.leadPatch.currentContractSeamless).toBe(false);
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
  });

  // Só se mexe no fim que esta renovação mudou. Como na gravação, o contrato
  // que outra renovação encurtou não é encurtado de novo.
  it('anterior encurtado por outra renovação: não mexe nele, e a marca sai do fim gravado', () => {
    const deOutra = { ...encurtado, shortenedById: 'k9' };
    const emenda = corrigir(D(2026, 9, 28), { previous: deOutra });
    expect(emenda.previousPatch).toBeNull();
    expect(emenda.contractPatch.seamless).toBe(true);
    const sobrepoe = corrigir(D(2026, 9, 20), { previous: deOutra });
    expect(sobrepoe.previousPatch).toBeNull();
    expect(sobrepoe.contractPatch.seamless).toBe(false);
    const intervalo = corrigir(D(2026, 10, 13), { previous: deOutra });
    expect(intervalo.previousPatch).toBeNull();
    expect(intervalo.contractPatch.seamless).toBe(false);
  });

  // O fim do trancado ainda anda na reativação, e o do cancelado já parou.
  it('anterior trancado ou cancelado: a sobreposição não encurta nem marca emendada', () => {
    ['trancado', 'cancelado'].forEach((status) => {
      const r = corrigir(D(2026, 9, 28), { previous: { ...anterior, status } });
      expect(r.previousPatch, status).toBeNull();
      expect(r.contractPatch.seamless, status).toBe(false);
      expect(r.leadPatch.currentContractSeamless, status).toBe(false);
    });
  });

  it('não encurta para antes do início do contrato anterior', () => {
    // A véspera cairia no próprio início: contrato de duração zero.
    const r = corrigir(D(2025, 10, 12));
    expect(r.previousPatch).toBeNull();
    expect(r.contractPatch.seamless).toBe(false);
    expect(corrigir(D(2025, 10, 13)).previousPatch)
      .toEqual({ endsAt: D(2025, 10, 12), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
    // Importado sem início: o limite é a criação, como na gravação da renovação.
    const importado = { ...anterior, startsAt: null, createdAt: D(2026, 9, 4) };
    expect(corrigir(D(2026, 9, 28), { previous: importado }).previousPatch)
      .toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
    expect(corrigir(D(2026, 9, 5), { previous: importado }).previousPatch).toBeNull();
  });

  it('sem ligação com o anterior: não mexe em contrato nenhum, e a marca fica como estava', () => {
    [[undefined, false], [false, false], [true, true]].forEach(([marca, esperado]) => {
      const solto = { ...renovacao, renewedFromId: null, seamless: marca };
      const r = buildContractEdit({ contract: solto, plan: plano, value: 1308, startsAt: D(2026, 9, 28), previous: anterior });
      expect(r.previousPatch).toBeNull();
      expect(r.contractPatch.seamless).toBe(esperado);
      expect(r.leadPatch.currentContractSeamless).toBe(esperado);
    });
    // Sem o anterior carregado, ou com outro contrato no lugar dele, também não.
    [null, { ...anterior, id: 'k0' }].forEach((previous) => {
      const r = corrigir(D(2026, 9, 28), { previous });
      expect(r.previousPatch).toBeNull();
      expect(r.contractPatch.seamless).toBe(true);
    });
  });

  it('aceita o doc cru do Firestore e grava Date', () => {
    const ts = (d) => ({ toDate: () => d });
    const cru = { ...encurtado, startsAt: ts(D(2025, 10, 11)), endsAt: ts(D(2026, 9, 27)), originalEndsAt: ts(D(2026, 10, 11)) };
    const gravada = { ...sobreposta, startsAt: ts(D(2026, 9, 28)), endsAt: ts(D(2027, 9, 28)) };
    // Mesmo início, lido do Timestamp: nada a recalcular.
    expect(corrigir(D(2026, 9, 28), { previous: cru, contract: gravada }).previousPatch).toBeNull();
    const volta = corrigir(D(2026, 10, 12), { previous: cru, contract: gravada });
    expect(volta.previousPatch).toEqual({ endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null });
    expect(volta.previousPatch.endsAt).toBeInstanceOf(Date);
    // Dado desalinhado: o anterior já termina na véspera do início novo, embora
    // a renovação diga outro início. O patch sairia igual ao gravado, então
    // nada é gravado no anterior.
    const desalinhada = { ...gravada, startsAt: ts(D(2026, 10, 5)) };
    expect(corrigir(D(2026, 9, 28), { previous: cru, contract: desalinhada }).previousPatch).toBeNull();
  });

  // Só um início novo mexe na emenda. Corrigir o valor de uma renovação antiga
  // não encurta o contrato anterior: a sobreposição antiga fica como está
  // (decisão do Johnny, 28/09/2026).
  describe('com o mesmo início', () => {
    // Renovação de antes da regra: começou em 01/08/2026 com o Start valendo
    // até 11/10/2026, sem a marca de emendada e sem encurtar o Start.
    const antiga = { ...renovacao, startsAt: D(2026, 8, 1), endsAt: D(2027, 8, 1), seamless: undefined };

    it('corrigir só o valor de uma sobreposição antiga não encurta o anterior nem marca emendada', () => {
      const r = corrigir(D(2026, 8, 1), { contract: antiga, value: 1400 });
      expect(r.contractPatch.value).toBe(1400);
      expect(r.previousPatch).toBeNull();
      expect(r.contractPatch.seamless).toBe(false);
      expect(r.leadPatch.currentContractSeamless).toBe(false);
    });

    // O campo de data do modal dá a meia-noite, e o início gravado pode ter
    // hora ("Começar hoje"). O mesmo dia não é mudança.
    it('o mesmo dia com outra hora não é mudança', () => {
      const comHora = { ...antiga, startsAt: new Date(2026, 7, 1, 14, 30) };
      const r = corrigir(D(2026, 8, 1), { contract: comHora, value: 1400 });
      expect(r.previousPatch).toBeNull();
      expect(r.contractPatch.seamless).toBe(false);
      expect(r.leadPatch.currentContractSeamless).toBe(false);
      // A marca que a renovação já tinha também fica.
      const marcada = corrigir(D(2026, 8, 1), { contract: { ...comHora, seamless: true } });
      expect(marcada.previousPatch).toBeNull();
      expect(marcada.contractPatch.seamless).toBe(true);
    });

    it('mudar o início recalcula', () => {
      const r = corrigir(D(2026, 8, 2), { contract: antiga });
      expect(r.previousPatch).toEqual({ endsAt: D(2026, 8, 1), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
      expect(r.contractPatch.seamless).toBe(true);
    });

    it('renovação sem início gravado conta como mudança', () => {
      const r = corrigir(D(2026, 9, 28), { contract: { ...renovacao, startsAt: null } });
      expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' });
      expect(r.contractPatch.seamless).toBe(true);
    });
  });

  // O leitor da linha do tempo (contractEventOf) depende deste texto.
  it('o texto da linha do tempo não muda', () => {
    expect(corrigir(D(2026, 9, 28)).interactionText)
      .toBe('Contrato corrigido — Plano Flow (R$ 1.308,00), vigência 28/09/2026 → 28/09/2027.');
  });

  // Ida e volta pelas funções de verdade: renovar encurtando e corrigir o
  // início para a emenda devolve o contrato anterior como era.
  it('renovar encurtando e corrigir para a emenda devolve o anterior como estava', () => {
    const lead = { id: 'l1', name: 'Ana', currentContractId: 'k1', currentContractEndsAt: D(2026, 10, 11) };
    const w = buildMatriculaWrites({
      lead, plan: plano, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1', previousContract: anterior
    });
    const depois = { ...anterior, ...w.previousPatch, shortenedById: 'k2' };
    const r = corrigir(D(2026, 10, 12), { previous: depois, contract: { id: 'k2', ...w.contract } });
    expect({ ...depois, ...r.previousPatch }).toEqual({ ...anterior, originalEndsAt: null, shortenedById: null });
    expect(r.contractPatch.seamless).toBe(true);
  });
});
