import { describe, it, expect } from 'vitest';
import { buildContractResume } from '../contracts.js';
import { normalizeContract, computeChurn, countLockedAt, computeBaseMovement } from '../operacional/base.js';
import { ownerOf, renewalCohort, summarizeCohort, milestones, upcomingExpirations } from '../operacional/renewal.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo',
  startsAt: D(2026, 3, 1), endsAt: D(2026, 9, 20), createdAt: D(2026, 3, 1), ...over
});
const SEP = { start: new Date(2026, 8, 1), end: new Date(2026, 9, 1), graceDays: 15 };

describe('renewalCohort', () => {
  const contracts = [
    C('antes'), C('antes-r', { leadId: 'antes', renewedFromId: 'antes', startsAt: D(2026, 9, 20), endsAt: D(2027, 3, 20), createdAt: D(2026, 9, 5) }),
    C('dia'), C('dia-r', { leadId: 'dia', renewedFromId: 'dia', startsAt: D(2026, 9, 20), endsAt: D(2027, 3, 20), createdAt: D(2026, 9, 20, 18) }),
    C('depois'), C('depois-r', { leadId: 'depois', startsAt: D(2026, 9, 25), endsAt: D(2027, 3, 25), createdAt: D(2026, 9, 25) }),
    C('nao'),
    C('venceu', { endsAt: D(2026, 9, 5) }),
    C('pendente', { endsAt: D(2026, 9, 28) }),
    C('cancelado', { status: 'cancelado', cancelledAt: D(2026, 9, 2) })
  ];
  const leadsById = new Map([
    ['nao', { id: 'nao', consultantId: 'diego', renewalDeclined: true, renewalDeclineReason: 'Financeiro' }],
    ['venceu', { id: 'venceu', consultantId: 'ana' }]
  ]);
  const rows = renewalCohort(contracts, { ...SEP, asOf: D(2026, 9, 26), leadsById });
  const byId = Object.fromEntries(rows.map((r) => [r.contract.id, r]));

  it('fica fora quem foi cancelado antes do fim', () => {
    expect(byId.cancelado).toBeUndefined();
    expect(rows).toHaveLength(6);
  });

  it('classifica desfecho e quando renovou', () => {
    expect(byId.antes).toMatchObject({ outcome: 'renew', when: 'antes' });
    expect(byId.dia).toMatchObject({ outcome: 'renew', when: 'no' });
    expect(byId.depois).toMatchObject({ outcome: 'renew', when: 'depois' });
    expect(byId.nao).toMatchObject({ outcome: 'wont', reason: 'Financeiro', owner: 'diego' });
    expect(byId.venceu.outcome).toBe('lapsed');
    expect(byId.pendente.outcome).toBe('pending');
  });

  it('declínio sem motivo vira "Outro"; declínio depois do corte ainda não vale', () => {
    const list = [C('x', { endsAt: D(2026, 9, 5) })];
    const legacy = new Map([['x', { id: 'x', renewalDeclined: true }]]);
    expect(renewalCohort(list, { ...SEP, asOf: D(2026, 9, 26), leadsById: legacy })[0]).toMatchObject({ outcome: 'wont', reason: 'Outro' });
    const later = new Map([['x', { id: 'x', renewalDeclined: true, renewalDeclinedAt: D(2026, 9, 27) }]]);
    expect(renewalCohort(list, { ...SEP, asOf: D(2026, 9, 26), leadsById: later })[0].outcome).toBe('lapsed');
  });

  it('declínio do lead não vale para um contrato que não é o mais recente', () => {
    const list = [
      C('velho', { leadId: 'P', endsAt: D(2026, 9, 5) }),
      C('novo', { leadId: 'P', startsAt: D(2026, 12, 1), endsAt: D(2027, 6, 1), createdAt: D(2026, 12, 1) })
    ];
    const leads = new Map([['P', { id: 'P', renewalDeclined: true }]]);
    expect(renewalCohort(list, { ...SEP, asOf: D(2026, 9, 26), leadsById: leads })[0].outcome).toBe('lapsed');
  });
});

describe('summarizeCohort', () => {
  it('taxa = renovados ÷ com desfecho; filtro por responsável atual', () => {
    const rows = [
      { owner: 'ana', outcome: 'renew', when: 'antes', reason: null },
      { owner: 'ana', outcome: 'renew', when: 'depois', reason: null },
      { owner: 'ana', outcome: 'lapsed', when: null, reason: null },
      { owner: 'ana', outcome: 'pending', when: null, reason: null },
      { owner: 'diego', outcome: 'wont', when: null, reason: 'Financeiro' }
    ];
    const team = summarizeCohort(rows);
    expect(team).toMatchObject({ cohort: 5, decided: 4, rate: 50, counts: { renew: 2, wont: 1, lapsed: 1, pending: 1 }, when: { antes: 1, no: 0, depois: 1 } });
    expect(team.wontReasons).toEqual({ total: 1, items: [{ name: 'Financeiro', count: 1 }] });
    expect(summarizeCohort(rows, { owner: 'ana' })).toMatchObject({ cohort: 4, decided: 3, rate: 67 });
  });

  it('sem desfecho a taxa é nula', () => {
    expect(summarizeCohort([]).rate).toBe(null);
  });
});

describe('ownerOf', () => {
  it('responsável atual do lead vence o consultor do contrato', () => {
    const c = C('z', { consultantId: 'ana' });
    expect(ownerOf(c, new Map([['z', { consultantId: 'larissa' }]]))).toBe('larissa');
    expect(ownerOf(c, new Map())).toBe('ana');
  });
});

describe('milestones', () => {
  it('conta quem cruzou o marco no mês e quem teve contato de renovação até o próximo marco', () => {
    const contracts = [
      C('m1', { endsAt: D(2026, 10, 20) }),  // marco de 30 dias em 20/09
      C('m2', { endsAt: D(2026, 10, 25) }),  // marco de 30 dias em 25/09, sem contato
      C('m3', { endsAt: D(2026, 10, 22) }),  // renovou antes do marco: fica fora
      C('m3-r', { leadId: 'm3', renewedFromId: 'm3', startsAt: D(2026, 10, 22), endsAt: D(2027, 4, 22), createdAt: D(2026, 9, 1) })
    ];
    const interactions = [
      { type: 'daily_goal_done', dailyGoalCategory: 'renovacao', leadId: 'm1', createdAt: D(2026, 9, 22) }
    ];
    const r = milestones(contracts, { start: SEP.start, end: SEP.end, checkpoints: [90, 60, 30], interactions, leadsById: new Map() });
    const m30 = r.find((m) => m.days === 30);
    expect(m30).toEqual({ days: 30, total: 2, done: 1, pct: 50 });
    expect(r.map((m) => m.days)).toEqual([90, 60, 30]);
  });
});

describe('upcomingExpirations', () => {
  it('faixas sem sobreposição a partir de agora, só o contrato mais recente da pessoa', () => {
    const now = D(2026, 9, 11);
    const contracts = [
      C('a', { endsAt: D(2026, 9, 30) }),
      C('b', { endsAt: D(2026, 11, 1) }),
      C('c', { endsAt: D(2026, 11, 30) }),
      C('d', { endsAt: D(2027, 3, 1) }),
      C('e', { endsAt: D(2026, 9, 25) }),
      C('e-r', { leadId: 'e', renewedFromId: 'e', startsAt: D(2026, 9, 25), endsAt: D(2027, 3, 25), createdAt: D(2026, 9, 2) })
    ];
    expect(upcomingExpirations(contracts, { now, leadsById: new Map() })).toEqual({ d30: 1, d60: 1, d90: 1 });
  });
});

describe('trancado não vence', () => {
  // Faltam 15 dias para o fim (25/09) quando tranca em 10/09, por 60 dias.
  const raw = {
    id: 't', leadId: 't', consultantId: 'ana', status: 'trancado', pauseReason: 'Viagem',
    startsAt: D(2026, 3, 25), endsAt: D(2026, 9, 25), createdAt: D(2026, 3, 25), pausedAt: D(2026, 9, 10)
  };
  const OCT = { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1), graceDays: 15 };
  const NOV = { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1), graceDays: 15 };

  it('parado: não vira "venceu", não conta churn e continua em trancados', () => {
    const c = normalizeContract(raw);
    expect(renewalCohort([c], { ...SEP, asOf: D(2026, 10, 20), leadsById: new Map() })).toEqual([]);
    expect(computeChurn([c], OCT).exits).toBe(0);
    expect(countLockedAt([c], D(2026, 10, 31))).toBe(1);
    expect(computeBaseMovement([c], SEP)).toMatchObject({ trancaram: 1, steps: { venceram: 0 } });
  });

  it('reativado 60 dias depois: o fim anda, vai para a coorte do mês novo e o passado segue trancado', () => {
    const { contractPatch } = buildContractResume({ contract: raw, resumedAt: D(2026, 11, 9) });
    const c = normalizeContract({ ...raw, ...contractPatch });
    expect(c.endsAt).toEqual(D(2026, 11, 24));
    expect(renewalCohort([c], { ...SEP, asOf: D(2026, 11, 10), leadsById: new Map() })).toEqual([]);
    expect(renewalCohort([c], { ...NOV, asOf: D(2026, 11, 10), leadsById: new Map() })).toHaveLength(1);
    expect(countLockedAt([c], D(2026, 10, 31))).toBe(1);
    expect(computeChurn([c], OCT).exits).toBe(0);
    expect(computeBaseMovement([c], { start: NOV.start, end: D(2026, 11, 15) })).toMatchObject({ destrancaram: 1 });
  });

  it('cancelado ainda parado sai no cancelamento, mesmo depois do fim antigo', () => {
    const c = normalizeContract({ ...raw, status: 'cancelado', cancelledAt: D(2026, 10, 20) });
    expect(computeChurn([c], OCT).exits).toBe(1);
  });

  it('quem tem outro contrato trancado não saiu', () => {
    const list = [
      normalizeContract({ ...raw, id: 'velho', status: 'ativo', pausedAt: null, endsAt: D(2026, 9, 20) }),
      normalizeContract({ ...raw, id: 'novo', startsAt: D(2026, 9, 1), endsAt: D(2027, 3, 1), createdAt: D(2026, 8, 25) })
    ];
    expect(computeChurn(list, OCT).exits).toBe(0);
  });
});
