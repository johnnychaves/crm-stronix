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
  contractDiscountOf,
  correctionNeedsReason,
  deriveContractStatus,
  deriveLeadContractStatus,
  editListValueOf,
  hasLiveContract,
  isImportedContract,
  isImportPause,
  isSeamlessStart,
  renewalJoinOf
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

  it('começa antes do fim: o atual termina na véspera do novo', () => {
    const r = renovar(D(2026, 9, 28));
    expect(r.contract.seamless).toBe(false);
    expect(r.previousContractId).toBe('k1');
    expect(r.previousPatch).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11) });
  });

  it('começa no próprio dia do fim também encurta', () => {
    expect(renovar(D(2026, 10, 11)).previousPatch).toEqual({ endsAt: D(2026, 10, 10), originalEndsAt: D(2026, 10, 11) });
  });

  it('sem o documento do contrato atual, não encurta nada', () => {
    const r = buildMatriculaWrites({ lead, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1' });
    expect(r.previousPatch).toBeNull();
    expect(r.previousContractId).toBeNull();
    expect(r.contract.renewedFromId).toBe('k1');
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
    expect(renovar(D(2025, 10, 13)).previousPatch).toEqual({ endsAt: D(2025, 10, 12), originalEndsAt: D(2026, 10, 11) });
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
