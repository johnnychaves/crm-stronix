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
});
