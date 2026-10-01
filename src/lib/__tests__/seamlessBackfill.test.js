// Decisão do scripts/backfill-contract-seamless.js: quais contratos e leads
// ganham a marca de emendado. Só marca true, nunca repete quem já tem e não
// encurta sobreposição antiga (decisão do Johnny, 28/09/2026).

import { describe, it, expect } from 'vitest';
import { planSeamlessBackfill } from '../seamlessBackfill.js';

const D = (y, m, d) => new Date(y, m - 1, d);
// Como o Firestore entrega as datas: Timestamp.
const ts = (date) => ({ toDate: () => date });
// Start de 11/10/2025 a 11/10/2026.
const anterior = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: ts(D(2025, 10, 11)), endsAt: ts(D(2026, 10, 11)) };
const renovacao = (id, inicio, extra = {}) => ({ id, planName: 'Flow', status: 'ativo', renewedFromId: 'k1', startsAt: ts(inicio), ...extra });
const contratosMarcados = (contracts) => planSeamlessBackfill(contracts, []).contractIds;

describe('planSeamlessBackfill: contratos', () => {
  it('marca a renovação que começa no dia seguinte ao fim do contrato renovado', () => {
    expect(contratosMarcados([anterior, renovacao('k2', D(2026, 10, 12))])).toEqual(['k2']);
  });

  it('não marca intervalo, sobreposição que não encurtou nem contrato sem ligação', () => {
    expect(contratosMarcados([
      anterior,
      renovacao('intervalo', D(2026, 10, 20)),
      renovacao('sobrepoe', D(2026, 9, 28)),
      renovacao('no-dia-do-fim', D(2026, 10, 11)),
      { id: 'solto', planName: 'Flow', status: 'ativo', startsAt: ts(D(2026, 10, 12)) }
    ])).toEqual([]);
  });

  it('não marca quando o contrato renovado não está na lista', () => {
    expect(contratosMarcados([renovacao('k2', D(2026, 10, 12))])).toEqual([]);
  });

  // Encurtado o contrato renovado para a véspera, a renovação começa no dia
  // seguinte ao fim novo dele: é emendada pela regra nova.
  it('marca a renovação que encurtou o contrato renovado', () => {
    const encurtado = { ...anterior, endsAt: ts(D(2026, 9, 27)), originalEndsAt: ts(D(2026, 10, 11)), shortenedById: 'k2' };
    expect(contratosMarcados([encurtado, renovacao('k2', D(2026, 9, 28))])).toEqual(['k2']);
  });

  // O fim que outra renovação encurtou não faz esta parecer emendada: a conta
  // é pelo fim previsto do contrato renovado.
  it('compara a data com o fim previsto, não com o fim encurtado por outra renovação', () => {
    const encurtado = { ...anterior, endsAt: ts(D(2026, 9, 27)), originalEndsAt: ts(D(2026, 10, 11)), shortenedById: 'k9' };
    expect(contratosMarcados([encurtado, renovacao('k2', D(2026, 9, 28))])).toEqual([]);
    expect(contratosMarcados([encurtado, renovacao('k2', D(2026, 10, 12))])).toEqual(['k2']);
  });

  it('não repete o contrato que já tem a marca, e marca o que ficou false', () => {
    expect(contratosMarcados([anterior, renovacao('k2', D(2026, 10, 12), { seamless: true })])).toEqual([]);
    expect(contratosMarcados([anterior, renovacao('k2', D(2026, 10, 12), { seamless: false })])).toEqual(['k2']);
  });

  // A renovação de que o cliente desistiu antes de começar nunca valeu
  // (neverTookEffect). A cancelada depois de começar chegou a valer.
  it('não marca a renovação cancelada antes de começar', () => {
    const desfeita = renovacao('k2', D(2026, 10, 12), { status: 'cancelado', cancelledAt: ts(D(2026, 9, 20)) });
    expect(contratosMarcados([anterior, desfeita])).toEqual([]);
    const depois = renovacao('k3', D(2026, 10, 12), { status: 'cancelado', cancelledAt: ts(D(2026, 11, 3)) });
    expect(contratosMarcados([anterior, depois])).toEqual(['k3']);
  });

  // O contrato renovado precisa ter valido até o fim previsto. O trancado não
  // corre, e o cancelado antes do fim parou antes de a renovação começar.
  it('não marca a renovação de contrato trancado', () => {
    const trancado = { ...anterior, status: 'trancado', pausedAt: ts(D(2026, 9, 1)) };
    expect(contratosMarcados([trancado, renovacao('k2', D(2026, 10, 12))])).toEqual([]);
  });

  it('não marca a renovação de contrato cancelado antes do fim previsto', () => {
    const cancelado = { ...anterior, status: 'cancelado', cancelledAt: ts(D(2026, 9, 29)) };
    expect(contratosMarcados([cancelado, renovacao('k2', D(2026, 10, 12))])).toEqual([]);
    // Cancelado no último dia, antes da hora do fim, ainda é antes do fim.
    const noUltimoDia = { ...anterior, status: 'cancelado', endsAt: ts(new Date(2026, 9, 11, 14, 30)), cancelledAt: ts(D(2026, 10, 11)) };
    expect(contratosMarcados([noUltimoDia, renovacao('k2', D(2026, 10, 12))])).toEqual([]);
    // O fim previsto de quem foi encurtado é o original.
    const encurtado = {
      ...anterior, status: 'cancelado', cancelledAt: ts(D(2026, 9, 20)),
      endsAt: ts(D(2026, 9, 27)), originalEndsAt: ts(D(2026, 10, 11)), shortenedById: 'k2'
    };
    expect(contratosMarcados([encurtado, renovacao('k2', D(2026, 9, 28))])).toEqual([]);
  });

  it('marca a renovação de contrato cancelado no fim previsto ou depois', () => {
    // A importação grava o cancelado da planilha com cancelledAt igual ao endsAt.
    const noFim = { ...anterior, status: 'cancelado', cancelledAt: ts(D(2026, 10, 11)) };
    expect(contratosMarcados([noFim, renovacao('k2', D(2026, 10, 12))])).toEqual(['k2']);
    const depois = { ...anterior, status: 'cancelado', cancelledAt: ts(D(2026, 11, 3)) };
    expect(contratosMarcados([depois, renovacao('k2', D(2026, 10, 12))])).toEqual(['k2']);
  });

  // Sem a data, não dá para saber se valeu até o fim. O cancelado ainda
  // trancado parou no trancamento, como no fim efetivo (contractEndOf).
  it('não marca com o cancelado sem data nem com o cancelado ainda trancado', () => {
    const semData = { ...anterior, status: 'cancelado', cancelledAt: null };
    expect(contratosMarcados([semData, renovacao('k2', D(2026, 10, 12))])).toEqual([]);
    const trancadoECancelado = { ...anterior, status: 'cancelado', pausedAt: ts(D(2026, 9, 1)), cancelledAt: ts(D(2026, 11, 3)) };
    expect(contratosMarcados([trancadoECancelado, renovacao('k2', D(2026, 10, 12))])).toEqual([]);
  });

  // A renovação emendada de um contrato que ainda não começou ficaria ativa
  // hoje, com o Operacional contando o cliente fora da base. O modal também
  // recusa renovar esse contrato. Hoje é 29/09/2026: o F1 começa em 20/10.
  it('não marca a renovação de contrato que ainda não começou, nem o lead dela', () => {
    const hoje = new Date(2026, 8, 29, 10, 0);
    const f1 = { id: 'f1', planName: 'Start', status: 'ativo', startsAt: ts(D(2026, 10, 20)), endsAt: ts(D(2027, 4, 20)) };
    const f2 = { id: 'f2', planName: 'Flow', status: 'ativo', renewedFromId: 'f1', startsAt: ts(D(2027, 4, 21)) };
    const leads = [{ id: 'l1', currentContractId: 'f2' }];
    expect(planSeamlessBackfill([f1, f2], leads, hoje)).toEqual({ contractIds: [], leadIds: [] });
    // Começou hoje mais cedo: já vale, e a renovação emendada é marcada.
    const comecou = { ...f1, startsAt: ts(new Date(2026, 8, 29, 8, 0)), endsAt: ts(new Date(2027, 2, 29, 8, 0)) };
    const depois = { ...f2, startsAt: ts(D(2027, 3, 30)) };
    expect(planSeamlessBackfill([comecou, depois], leads, hoje)).toEqual({ contractIds: ['f2'], leadIds: ['l1'] });
  });

  it('lista vazia, nula ou com buracos não quebra', () => {
    expect(planSeamlessBackfill([], [])).toEqual({ contractIds: [], leadIds: [] });
    expect(planSeamlessBackfill(null, undefined)).toEqual({ contractIds: [], leadIds: [] });
    expect(contratosMarcados([null, anterior, undefined, renovacao('k2', D(2026, 10, 12))])).toEqual(['k2']);
  });
});

describe('planSeamlessBackfill: leads', () => {
  it('marca uma vez o lead cujo contrato atual é emendado, marcado agora ou antes', () => {
    const r = planSeamlessBackfill(
      [
        anterior,
        renovacao('k2', D(2026, 10, 12)),
        { id: 'k3', planName: 'Flow', status: 'ativo', renewedFromId: 'k9', startsAt: ts(D(2026, 1, 1)), seamless: true },
        { id: 'k4', planName: 'Flow', status: 'ativo', renewedFromId: 'k1', startsAt: ts(D(2026, 10, 20)) }
      ],
      [
        { id: 'l1', currentContractId: 'k2' },
        { id: 'l2', currentContractId: 'k3', currentContractSeamless: false },
        { id: 'l3', currentContractId: 'k3', currentContractSeamless: true },
        { id: 'l4', currentContractId: 'k1' },
        { id: 'l5', currentContractId: 'k4' },
        { id: 'l6', currentContractId: 'sumiu' },
        { id: 'l7', currentContractId: null },
        null
      ]
    );
    expect(r.contractIds).toEqual(['k2']);
    expect(r.leadIds).toEqual(['l1', 'l2']);
  });

  it('o lead da renovação que ficou de fora não é marcado', () => {
    const trancado = { ...anterior, status: 'trancado', pausedAt: ts(D(2026, 9, 1)) };
    expect(planSeamlessBackfill([trancado, renovacao('k2', D(2026, 10, 12))], [{ id: 'l1', currentContractId: 'k2' }]))
      .toEqual({ contractIds: [], leadIds: [] });
  });
});
