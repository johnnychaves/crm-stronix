// O modelo puro da aba Contratos (src/lib/contractsTab.js): quem é o destaque
// e o próximo, os fatos de cada contrato e a geometria da linha do tempo.
// Hoje é 30/09/2026, às 10h, como no mockup aprovado.
import { describe, it, expect } from 'vitest';
import {
  contractFactsOf, contractTimelineOf, contractsTabModel, gapText, heroActionsOf, heroCountdownOf, inUseReplacementOf, joinTextOf,
  originTextOf, shortContractId, summaryContractOf
} from '../contractsTab.js';
import { CONTRACT_STATUS } from '../contracts.js';
import { HISTORY_STATUS } from '../contractHistory.js';
import { normalizeContracts } from '../operacional/base.js';
import { daysBetween } from '../dates.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const HOJE = new Date(2026, 8, 30, 10, 0);
const L = 'l1';
const K = (id, extra) => ({
  id, leadId: L, planName: `Plano ${id}`, value: 1200, listValue: 1200, durationMonths: 12, status: 'ativo', consultantName: 'Ana', ...extra
});

// O Trimestral, cancelado em 22/06/2024; o Start de 2024, trancado 20 dias e
// esticado até 10/10/2025; o Start em uso, com desconto; o Flow marcado.
const trimestral = K('t1', {
  planName: 'Trimestral', value: 447, listValue: 447, durationMonths: 3, status: 'cancelado',
  startsAt: D(2024, 5, 6), endsAt: D(2024, 8, 6), cancelledAt: D(2024, 6, 22), cancelReason: 'Financeiro', createdAt: D(2024, 5, 6)
});
const start24 = K('s1', {
  planName: 'Start', value: 1188, listValue: 1188, startsAt: D(2024, 9, 20), endsAt: D(2025, 10, 10), createdAt: D(2024, 9, 20),
  pausedDaysTotal: 20, resumedAt: D(2025, 1, 25), pauseHistory: [{ pausedAt: D(2025, 1, 5), resumedAt: D(2025, 1, 25) }]
});
const emUso = K('k1', {
  planName: 'Start', value: 1308, listValue: 1428, discountReason: 'Fidelidade', renewedFromId: 's1',
  startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9)
});
const proximo = K('k2', {
  planName: 'Flow', value: 1788, listValue: 1788, renewedFromId: 'k1', seamless: true,
  startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28)
});
const lead = (currentContractId, extra = {}) => ({ id: L, currentContractId, ...extra });

describe('contractsTabModel: destaque, próximo e Histórico', () => {
  it('sem próximo: o último contrato é o destaque', () => {
    const m = contractsTabModel({ lead: lead('k1'), contracts: [trimestral, start24, emUso], now: HOJE });
    expect(m.latest).toBe(emUso);
    expect(m.hero).toBe(emUso);
    expect(m.next).toBeNull();
    expect(m.join).toBeNull();
    expect(m.history.map((c) => c.id)).toEqual(['s1', 't1']);
  });

  it('renovação emendada que ainda não começou: o em uso é o destaque, a renovação é o próximo, sem intervalo', () => {
    const m = contractsTabModel({ lead: lead('k2'), contracts: [trimestral, start24, emUso, proximo], now: HOJE });
    expect(m.latest).toBe(proximo);
    expect(m.hero).toBe(emUso);
    expect(m.next).toBe(proximo);
    expect(m.history.map((c) => c.id)).toEqual(['s1', 't1']);
    expect(joinTextOf(m.join)).toBe('sem intervalo');
  });

  it('renovação com intervalo: o encaixe diz os dias sem contrato', () => {
    const depois = { ...proximo, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, depois], now: HOJE });
    expect(m.hero).toBe(emUso);
    expect(joinTextOf(m.join)).toBe('8 dias sem contrato antes');
  });

  it('em uso trancado continua o destaque, e reativado com o fim depois do início do próximo os dois se cruzam', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) };
    expect(contractsTabModel({ lead: lead('k2'), contracts: [trancado, proximo], now: HOJE }).hero).toBe(trancado);
    const reativado = { ...emUso, endsAt: D(2026, 10, 21), pausedDaysTotal: 10 };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [reativado, proximo], now: HOJE });
    expect(m.hero).toBe(reativado);
    expect(joinTextOf(m.join)).toBe('10 dias junto com o atual');
  });

  it('em uso cancelado: o último contrato é o destaque, como agendado, e o cancelado vai para o Histórico', () => {
    const cancelado = { ...emUso, status: 'cancelado', cancelledAt: D(2026, 9, 25) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [cancelado, proximo], now: HOJE });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history).toEqual([cancelado]);
  });

  it('agendado sem nenhum contrato em uso', () => {
    const vencido = { ...emUso, endsAt: D(2026, 9, 10) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [vencido, proximo], now: HOJE });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history).toEqual([vencido]);
  });

  it('sem ligação, vale outro contrato em uso do lead, o de início mais recente', () => {
    const solto = { ...proximo, renewedFromId: null, seamless: false };
    const paralelo = K('p1', { planName: 'Pilates', startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 3, 1) });
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, paralelo, solto], now: HOJE });
    expect(m.hero).toBe(paralelo);
    expect(m.next).toBe(solto);
    expect(m.history).toEqual([emUso]);
  });

  it('no dia em que o próximo começa, ele assume o destaque', () => {
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, proximo], now: D(2026, 10, 12) });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history).toEqual([emUso]);
  });

  it('último contrato sem documento na lista sai do resumo do lead', () => {
    const resumo = lead('k9', {
      currentPlanName: 'Start', currentContractValue: 1308, currentContractStartsAt: D(2025, 10, 11),
      currentContractEndsAt: D(2026, 10, 11), currentContractStatus: 'ativo'
    });
    const m = contractsTabModel({ lead: resumo, contracts: [trimestral], now: HOJE });
    expect(m.hero).toEqual(summaryContractOf(resumo));
    expect(m.hero.fromSummary).toBe(true);
    expect(m.hero.planName).toBe('Start');
    expect(m.history).toEqual([trimestral]);
  });

  it('sem contrato nenhum', () => {
    expect(contractsTabModel({ lead: { id: L }, contracts: [], now: HOJE })).toEqual({ latest: null, hero: null, next: null, history: [], join: null });
  });
});

// Decisão do Johnny (01/10/2026): com dois contratos ativos, cancelar um deixa
// o cliente ativo pelo outro. Quem continua é o contrato em uso de início mais
// recente, fora o cancelado, a mesma escolha que o destaque faz para o em uso
// sem ligação. O ContractOutcomeModal passa o resultado ao buildContractCancel.
describe('inUseReplacementOf: quem continua quando o último contrato é cancelado', () => {
  const emUso = K('k1', { startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) });
  const paralelo = K('k3', { startsAt: D(2026, 6, 1), endsAt: D(2026, 12, 1) });
  const renovacao = K('k2', { renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) });

  it('o contrato em uso de início mais recente, nunca o excluído nem um cancelado', () => {
    expect(inUseReplacementOf({ contracts: [emUso, paralelo, renovacao], excludeId: 'k2', now: HOJE })).toBe(paralelo);
    expect(inUseReplacementOf({ contracts: [emUso, paralelo, renovacao], excludeId: 'k3', now: HOJE })).toBe(emUso);
    const cancelado = { ...paralelo, status: 'cancelado', cancelledAt: D(2026, 8, 1) };
    expect(inUseReplacementOf({ contracts: [emUso, cancelado, renovacao], excludeId: 'k2', now: HOJE })).toBe(emUso);
  });

  it('o agendado não conta, e sem contrato em uso devolve null', () => {
    const agendado = K('k4', { startsAt: D(2026, 11, 1), endsAt: D(2027, 11, 1) });
    expect(inUseReplacementOf({ contracts: [agendado, renovacao], excludeId: 'k2', now: HOJE })).toBeNull();
    expect(inUseReplacementOf({ contracts: [emUso], excludeId: 'k1', now: HOJE })).toBeNull();
    expect(inUseReplacementOf({ contracts: [], excludeId: 'k1', now: HOJE })).toBeNull();
    expect(inUseReplacementOf({ excludeId: 'k1', now: HOJE })).toBeNull();
  });

  it('o trancado conta enquanto nenhum sucessor começou, como isInUseAt', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) };
    expect(inUseReplacementOf({ contracts: [trancado, renovacao], excludeId: 'k2', now: HOJE })).toBe(trancado);
    // Com a renovação já começada, a pausa fechou no início dela: fora de uso.
    expect(inUseReplacementOf({ contracts: [trancado, renovacao], excludeId: 'k2', now: D(2026, 10, 15) })).toBeNull();
  });
});

describe('heroCountdownOf: o bloco de contagem do card', () => {
  it('em uso: restam N dias; com próximo, o rótulo diz em uso', () => {
    expect(heroCountdownOf({ contract: emUso, status: CONTRACT_STATUS.A_VENCER, now: HOJE })).toEqual({ label: 'Restam', days: 11, note: 'vence 11/10/2026' });
    expect(heroCountdownOf({ contract: emUso, status: CONTRACT_STATUS.ATIVO, hasNext: true, now: HOJE }).label).toBe('Em uso · restam');
  });

  it('trancado: há N dias, até o início de hoje', () => {
    expect(heroCountdownOf({ contract: { ...emUso, pausedAt: D(2026, 9, 20) }, status: CONTRACT_STATUS.TRANCADO, now: HOJE }))
      .toEqual({ label: 'Trancado há', days: 10, note: 'desde 20/09/2026' });
  });

  it('agendado: começa em N dias', () => {
    expect(heroCountdownOf({ contract: proximo, status: CONTRACT_STATUS.AGENDADO, now: HOJE })).toEqual({ label: 'Começa em', days: 12, note: 'início 12/10/2026' });
  });

  it('no último dia: restam 0 dias, e a linha de baixo diz que vence hoje', () => {
    expect(heroCountdownOf({ contract: emUso, status: CONTRACT_STATUS.ATIVO, hasNext: true, now: new Date(2026, 9, 11, 10, 0) }))
      .toEqual({ label: 'Em uso · restam', days: 0, note: 'vence hoje' });
    expect(heroCountdownOf({ contract: emUso, status: CONTRACT_STATUS.A_VENCER, now: new Date(2026, 9, 10, 10, 0) }).note).toBe('vence 11/10/2026');
  });
});

describe('heroActionsOf: os botões em cada situação', () => {
  it('em uso sem próximo: Renovar, e Corrigir, Trancar, Cancelar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.ATIVO })).toEqual({ primary: 'renovar', actions: ['corrigir', 'trancar', 'cancelar'] });
    expect(heroActionsOf({ status: CONTRACT_STATUS.A_VENCER })).toEqual({ primary: 'renovar', actions: ['corrigir', 'trancar', 'cancelar'] });
  });
  it('em uso trancado sem próximo: Reativar, e Corrigir, Cancelar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.TRANCADO })).toEqual({ primary: 'reativar', actions: ['corrigir', 'cancelar'] });
  });
  it('em uso com próximo: só Trancar (ou Reativar) e Cancelar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.ATIVO, hasNext: true })).toEqual({ primary: null, actions: ['trancar', 'cancelar'] });
    expect(heroActionsOf({ status: CONTRACT_STATUS.TRANCADO, hasNext: true })).toEqual({ primary: null, actions: ['reativar', 'cancelar'] });
  });
  it('agendado sem contrato em uso: Ativar agora, e Corrigir, Cancelar, sem Trancar', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.AGENDADO })).toEqual({ primary: 'ativar', actions: ['corrigir', 'cancelar'] });
  });
  // O card fechado (vencido ou cancelado) só oferece a matrícula nova: nunca
  // renovar, corrigir, trancar ou cancelar (revisão de 30/09/2026).
  it('vencido ou cancelado: só a matrícula nova', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.VENCIDO })).toEqual({ primary: 'matricula', actions: [] });
    expect(heroActionsOf({ status: CONTRACT_STATUS.CANCELADO })).toEqual({ primary: 'matricula', actions: [] });
  });
  // No último dia do contrato em uso (fim gravado à meia-noite), o status por
  // instante já diz vencido, mas com próximo contrato o card continua o em
  // uso: só Trancar e Cancelar, nunca a matrícula nova (revisão final).
  it('vencido por instante com próximo: Trancar e Cancelar, nunca a matrícula nova', () => {
    expect(heroActionsOf({ status: CONTRACT_STATUS.VENCIDO, hasNext: true })).toEqual({ primary: null, actions: ['trancar', 'cancelar'] });
  });
});

describe('contractFactsOf: os fatos de cada contrato', () => {
  const todos = [trimestral, start24, emUso, proximo];

  it('contrato esticado pelo trancamento: fim previsto pela duração, fim de fato depois, com o motivo', () => {
    const f = contractFactsOf(start24, todos, HOJE, 30);
    expect(f).toMatchObject({
      id: 's1', shortId: 'S1', planName: 'Start', months: 12, start: D(2024, 9, 20), plannedEnd: D(2025, 9, 20), actualEnd: D(2025, 10, 10),
      pausedDays: 20, pauseCount: 1, value: 1188, monthly: 99, listValue: 1188, discount: 0, discountReason: null,
      closedBy: 'Ana', closedAt: D(2024, 9, 20), cancelledAt: null, cancelReason: null, cancelNote: null,
      status: HISTORY_STATUS.RENOVADO, lockedAtRenewalStart: false
    });
    expect(f.endReason).toEqual({ kind: 'trancamento', days: 20, text: '20 dias depois, pelo trancamento' });
    expect(f.pauses).toEqual([{ from: D(2025, 1, 5), to: D(2025, 1, 25), fromImport: false, reconstructed: false }]);
    // Do dia seguinte ao cancelamento (22/06) à véspera do início (20/09): 89 dias
    // sem contrato (contractOriginOf conta assim; o "90" do mockup é dado de exemplo).
    expect(originTextOf(f.origin)).toBe('retorno, 89 dias depois');
  });

  it('cancelado: fim de fato no cancelamento, com o motivo, e sem trancamento', () => {
    const f = contractFactsOf(trimestral, todos, HOJE, 30);
    expect(f).toMatchObject({
      plannedEnd: D(2024, 8, 6), actualEnd: D(2024, 6, 22), pausedDays: 0, pauseCount: 0, pauses: [], monthly: 149,
      status: CONTRACT_STATUS.CANCELADO, cancelledAt: D(2024, 6, 22), cancelReason: 'Financeiro'
    });
    expect(f.endReason).toEqual({ kind: 'cancelado', days: 45, text: 'cancelado · Financeiro' });
    expect(originTextOf(f.origin)).toBe('primeira matrícula');
  });

  it('encurtado pela renovação: N dias antes, e a origem conta a renovação', () => {
    const encurtado = { ...emUso, endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const antecipada = { ...proximo, startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5) };
    const f = contractFactsOf(encurtado, [start24, encurtado, antecipada], D(2026, 11, 1), 30);
    expect(f.plannedEnd).toEqual(D(2026, 10, 11));
    expect(f.endReason).toEqual({ kind: 'renovacao', days: 7, text: '7 dias antes, pela renovação' });
    expect(f.status).toBe(HISTORY_STATUS.RENOVADO);
    expect(originTextOf(f.origin)).toBe('1ª renovação');
  });

  it('desconto: tabela menos valor, com o motivo', () => {
    expect(contractFactsOf(emUso, todos, HOJE, 30)).toMatchObject({ discount: 120, listValue: 1428, discountReason: 'Fidelidade', monthly: 109 });
  });

  it('trancado agora: a pausa aberta conta até o início de hoje; ainda trancado quando a renovação começou, vira renovado com a nota', () => {
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20), pausedDaysTotal: 5, pauseHistory: [{ pausedAt: D(2026, 3, 1), resumedAt: D(2026, 3, 6) }] };
    const f = contractFactsOf(trancado, [trancado, proximo], HOJE, 30);
    expect(f).toMatchObject({ pausedDays: 15, pauseCount: 2, status: CONTRACT_STATUS.TRANCADO, lockedAtRenewalStart: false });
    expect(f.pauses[1]).toEqual({ from: D(2026, 9, 20), to: null, fromImport: false, reconstructed: false });
    expect(f.endReason.kind).toBeNull();
    // Com a renovação já começada, a pausa fecha em 12/10 (22 dias) e o contrato
    // volta a correr junto com ela até 02/11: em uso até lá, renovado depois.
    expect(contractFactsOf(trancado, [trancado, proximo], D(2026, 10, 15), 30)).toMatchObject({ status: HISTORY_STATUS.EM_USO, lockedAtRenewalStart: true, pausedDays: 27, actualEnd: D(2026, 11, 2) });
    expect(contractFactsOf(trancado, [trancado, proximo], D(2026, 12, 15), 30)).toMatchObject({ status: HISTORY_STATUS.RENOVADO, lockedAtRenewalStart: true, pausedDays: 27 });
  });

  it('cancelado ainda trancado: a pausa aberta vai até o cancelamento', () => {
    const c = { ...emUso, status: 'cancelado', pausedAt: D(2026, 9, 20), cancelledAt: D(2026, 9, 25), cancelReason: 'Saúde ou lesão' };
    const f = contractFactsOf(c, [c], HOJE, 30);
    expect(f.pauses).toEqual([{ from: D(2026, 9, 20), to: D(2026, 9, 25), fromImport: false, reconstructed: false }]);
    expect(f.pausedDays).toBe(5);
    expect(f.actualEnd).toEqual(D(2026, 9, 25));
  });

  it('importado sem valor, sem plano e sem duração: valor e média nulos, fim previsto pelo fim gravado', () => {
    const importado = { id: 'i1', leadId: L, planName: null, value: null, durationMonths: null, status: 'ativo', createdAt: D(2026, 9, 4), endsAt: D(2026, 12, 31), importBatchId: 'lote' };
    const f = contractFactsOf(importado, [importado], HOJE, 30);
    expect(f).toMatchObject({ planName: null, months: 0, value: null, monthly: null, start: D(2026, 9, 4), plannedEnd: D(2026, 12, 31), actualEnd: D(2026, 12, 31), pausedDays: 0 });
    expect(f.endReason.kind).toBeNull();
  });

  it('pausa antiga sem histórico entra refeita pelo total, como no Operacional', () => {
    const antigo = { ...start24, pauseHistory: undefined };
    expect(contractFactsOf(antigo, todos, HOJE, 30).pauses).toEqual([{ from: D(2025, 1, 5), to: D(2025, 1, 25), fromImport: false, reconstructed: true }]);
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    const ts = (d) => ({ toDate: () => d });
    const cru = { ...start24, startsAt: ts(start24.startsAt), endsAt: ts(start24.endsAt), createdAt: ts(start24.createdAt) };
    expect(contractFactsOf(cru, [cru], HOJE, 30)).toMatchObject({ start: D(2024, 9, 20), plannedEnd: D(2025, 9, 20), actualEnd: D(2025, 10, 10) });
  });
});

describe('textos curtos', () => {
  it('gapText: dias até quatro meses, meses depois', () => {
    expect(gapText(1)).toBe('1 dia');
    expect(gapText(90)).toBe('90 dias');
    expect(gapText(120)).toBe('4 meses');
    expect(gapText(400)).toBe('13 meses');
  });
  it('shortContractId', () => {
    expect(shortContractId('k3f9a2qdx7')).toBe('K3F9A2QD');
    expect(shortContractId(null)).toBe('');
  });
  it('originTextOf: upgrade com o intervalo, e sem origem é primeira matrícula', () => {
    expect(originTextOf({ kind: 'upgrade', gapDays: 3 })).toBe('upgrade, 3 dias depois');
    expect(originTextOf({ kind: 'upgrade', gapDays: null })).toBe('upgrade');
    expect(originTextOf(null)).toBe('primeira matrícula');
  });
});

describe('contractTimelineOf: a linha do tempo, em porcentagem', () => {
  it('um segmento por contrato que valeu, com o tipo, a trilha, os cantos e o title', () => {
    const t = contractTimelineOf({ contracts: [trimestral, start24, emUso, proximo], heroId: 'k1', nextId: 'k2', now: HOJE, checkpoints: [90, 60, 30] });
    expect(t.start).toEqual(D(2024, 5, 6));
    expect(t.end).toEqual(D(2027, 10, 12));
    expect(t.lanes).toHaveLength(1);
    expect(t.lanes[0].map((s) => [s.id, s.kind])).toEqual([['t1', 'cancelado'], ['s1', 'encerrado'], ['k1', 'em_uso'], ['k2', 'proximo']]);
    const [t1, s1, k1, k2] = t.lanes[0];
    expect(t1.title).toBe('Trimestral · cancelado em 22/06/2024');
    expect(s1.title).toBe('Start · 20/09/2024 a 10/10/2025');
    expect(k1.title).toBe('Start · em uso até 11/10/2026');
    expect(k2.title).toBe('Flow · começa em 12/10/2026');
    expect(t1.leftPct).toBe(0);
    expect(k2.leftPct + k2.widthPct).toBeCloseTo(100, 0);
    // Segmentos em ordem, sem se cruzar, e os cantos só onde um não encosta no outro.
    expect(s1.leftPct).toBeGreaterThan(t1.leftPct + t1.widthPct);
    expect(k1.leftPct).toBeGreaterThanOrEqual(s1.leftPct + s1.widthPct);
    expect([t1.joinsPrev, t1.joinsNext, s1.joinsPrev, s1.joinsNext, k1.joinsPrev, k1.joinsNext, k2.joinsPrev, k2.joinsNext])
      .toEqual([false, false, false, true, true, true, true, false]);
    expect(t.todayPct).toBeGreaterThan(k1.leftPct);
    expect(t.todayPct).toBeLessThan(k2.leftPct);
    expect(t.years.map((y) => y.year)).toEqual([2025, 2026, 2027]);
    expect(s1.pauses).toHaveLength(1);
    expect(s1.pauses[0].title).toBe('Trancado de 05/01/2025 a 25/01/2025');
    expect(s1.pauses[0].leftPct).toBeGreaterThan(s1.leftPct);
    expect(t.heroLane).toBe(0);
    expect(t.marks.map((m) => m.days)).toEqual([90, 60, 30]);
    expect(t.marks[2].title).toBe('Marco de 30 dias · 11/09/2026 · passou sem contato');
    expect(t.marks[2].pct).toBeGreaterThan(k1.leftPct);
    expect(t.marks[2].pct).toBeLessThan(t.todayPct);
  });

  it('contratos que se cruzam vão para a segunda trilha', () => {
    const paralelo = K('p1', { planName: 'Pilates', startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1) });
    const t = contractTimelineOf({ contracts: [emUso, paralelo], heroId: 'k1', now: HOJE });
    expect(t.lanes).toHaveLength(2);
    expect(t.lanes[0].map((s) => s.id)).toEqual(['k1']);
    expect(t.lanes[1].map((s) => s.id)).toEqual(['p1']);
    expect(t.heroLane).toBe(0);
  });

  it('renovação desfeita fica de fora, e sem contrato que valeu não há linha', () => {
    const desfeita = { ...proximo, status: 'cancelado', cancelledAt: D(2026, 9, 29) };
    const t = contractTimelineOf({ contracts: [emUso, desfeita], heroId: 'k1', now: HOJE });
    expect(t.lanes.flat().map((s) => s.id)).toEqual(['k1']);
    expect(contractTimelineOf({ contracts: [desfeita], now: HOJE })).toBeNull();
    expect(contractTimelineOf({ contracts: [], now: HOJE })).toBeNull();
  });

  it('o eixo vai até hoje quando hoje passa do fim mais distante, e o trancado em uso projeta o fim pelos dias parados', () => {
    const vencido = { ...emUso, endsAt: D(2026, 9, 10) };
    const t = contractTimelineOf({ contracts: [vencido], now: HOJE });
    expect(t.end).toEqual(HOJE);
    expect(t.todayPct).toBe(100);
    expect(t.heroLane).toBeNull();
    expect(t.marks).toEqual([]);
    const trancado = { ...emUso, status: 'trancado', pausedAt: D(2026, 9, 20) };
    const tt = contractTimelineOf({ contracts: [trancado], heroId: 'k1', now: HOJE });
    const seg = tt.lanes[0][0];
    expect(seg.kind).toBe('em_uso');
    expect(seg.pauses[0].title).toBe('Trancado desde 20/09/2026');
    expect(tt.end).toEqual(D(2026, 10, 21));
  });
});

// Revisão de 30/09/2026: o destaque nunca é um contrato velho nem alheio.
describe('contractsTabModel: destaque velho ou alheio', () => {
  // K1 trancado em 30/09/2026 com K2, a renovação emendada, marcada para 12/10.
  // K2 começa com K1 ainda trancado. Um ano depois K2 venceu e K3, a renovação
  // dela, está marcada com intervalo: o destaque é K3, agendado, K1 e K2 vão
  // para o Histórico e o K1 não tem ação nenhuma.
  const k1 = K('k1', { planName: 'Start', status: 'trancado', pausedAt: D(2026, 9, 30), startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9) });
  const k2 = K('k2', { planName: 'Flow', renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28) });
  const k3 = K('k3', { planName: 'Flow', renewedFromId: 'k2', seamless: false, startsAt: D(2027, 10, 20), endsAt: D(2028, 10, 20), createdAt: D(2027, 10, 14) });

  it('o trancado que a renovação já alcançou nunca é o destaque', () => {
    const m = contractsTabModel({ lead: lead('k3'), contracts: [k1, k2, k3], now: new Date(2027, 9, 15, 10) });
    expect(m.hero).toBe(k3);
    expect(m.next).toBeNull();
    expect(m.history.map((c) => c.id)).toEqual(['k2', 'k1']);
    // Antes de K2 começar, K1 trancado ainda é o destaque, e K2 o próximo.
    const antes = contractsTabModel({ lead: lead('k2'), contracts: [k1, k2], now: HOJE });
    expect(antes.hero).toBe(k1);
    expect(antes.next).toBe(k2);
  });

  it('um contrato paralelo nunca vira o destaque de uma renovação', () => {
    const pilates = K('p1', { planName: 'Pilates', startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 3, 1) });
    // O renovado cancelado: o destaque é a renovação, como agendada, e não o Pilates.
    const cancelado = { ...emUso, status: 'cancelado', cancelledAt: D(2026, 9, 25) };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [cancelado, proximo, pilates], now: HOJE });
    expect(m.hero).toBe(proximo);
    expect(m.next).toBeNull();
    expect(m.history.map((c) => c.id)).toEqual(['p1', 'k1']);
    // O renovado vencido, com a renovação depois de um intervalo: idem.
    const vencido = { ...emUso, endsAt: D(2026, 9, 10) };
    const depois = { ...proximo, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    expect(contractsTabModel({ lead: lead('k2'), contracts: [vencido, depois, pilates], now: HOJE }).hero).toBe(depois);
  });

  it('o último contrato cancelado nunca é o próximo: o em uso é o destaque e ele vai para o Histórico', () => {
    const desistiu = { ...proximo, status: 'cancelado', cancelledAt: D(2026, 10, 20), cancelReason: 'Financeiro' };
    const m = contractsTabModel({ lead: lead('k2'), contracts: [emUso, desistiu], now: HOJE });
    expect(m.hero).toBe(emUso);
    expect(m.next).toBeNull();
    expect(m.join).toBeNull();
    expect(m.history).toEqual([desistiu]);
    // Sem contrato em uso, o cancelado é o destaque, como card fechado.
    const semUso = contractsTabModel({ lead: lead('k2'), contracts: [{ ...emUso, endsAt: D(2026, 9, 10) }, desistiu], now: HOJE });
    expect(semUso.hero).toBe(desistiu);
    expect(semUso.next).toBeNull();
  });
});

// Decisão do Johnny (30/09/2026): o contrato ainda trancado no dia em que a
// renovação começa tem a pausa fechada nesse dia e volta a correr junto com ela
// pelos dias que faltavam, a mesma leitura do Operacional (closeOpenPause).
describe('o trancado que a renovação alcançou volta a correr junto com ela', () => {
  // K1 trancado em 30/09/2026 (fim 11/10); K2, a renovação emendada, começa em
  // 12/10 com K1 ainda trancado: a pausa fecha em 12/10 (12 dias) e K1 volta a
  // valer até 23/10, junto com K2. Os números não crescem com o passar dos dias.
  const k1 = K('k1', { planName: 'Start', value: 1200, listValue: 1200, status: 'trancado', pausedAt: D(2026, 9, 30), startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11), createdAt: D(2025, 10, 9) });
  const k2 = K('k2', { planName: 'Flow', renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12), createdAt: D(2026, 9, 28) });

  it('os fatos: 12 dias parados, fim de fato em 23/10, em uso até lá e renovado depois, com a nota', () => {
    [D(2026, 10, 15), D(2027, 1, 15), D(2027, 6, 15)].forEach((when) => {
      const f = contractFactsOf(k1, [k1, k2], when, 30);
      expect(f.pausedDays, String(when)).toBe(12);
      expect(f.pauseCount).toBe(1);
      expect(f.pauses).toEqual([{ from: D(2026, 9, 30), to: D(2026, 10, 12), fromImport: false, reconstructed: false }]);
      expect(f.actualEnd).toEqual(D(2026, 10, 23));
      expect(f.endReason).toEqual({ kind: 'trancamento', days: 12, text: '12 dias depois, pelo trancamento' });
      expect(f.lockedAtRenewalStart).toBe(true);
    });
    expect(contractFactsOf(k1, [k1, k2], D(2026, 10, 15), 30).status).toBe(HISTORY_STATUS.EM_USO);
    expect(contractFactsOf(k1, [k1, k2], D(2027, 1, 15), 30).status).toBe(HISTORY_STATUS.RENOVADO);
    // Antes de K2 começar, a pausa está aberta e conta até o início de hoje.
    const antes = contractFactsOf(k1, [k1, k2], new Date(2026, 9, 5, 10, 0), 30);
    expect(antes.pausedDays).toBe(5);
    expect(antes.pauses[0].to).toBeNull();
    expect(antes.status).toBe(CONTRACT_STATUS.TRANCADO);
    expect(antes.lockedAtRenewalStart).toBe(false);
  });

  it('a linha do tempo fecha a pausa em 12/10 e termina o segmento em 23/10, numa segunda trilha', () => {
    const t = contractTimelineOf({ contracts: [k1, k2], heroId: 'k2', nextId: null, now: D(2027, 1, 15) });
    const seg = t.lanes.flat().find((s) => s.id === 'k1');
    expect(seg.title).toBe('Start · 11/10/2025 a 23/10/2026');
    expect(seg.pauses).toHaveLength(1);
    expect(seg.pauses[0].title).toBe('Trancado de 30/09/2026 a 12/10/2026');
    // K2 começa antes de K1 terminar: trilhas separadas.
    expect(t.lanes).toHaveLength(2);
    expect(t.end).toEqual(D(2027, 10, 12));
  });

  it('paridade com o Operacional: o mesmo fim andado e os mesmos dias parados que normalizeContracts', () => {
    const cases = [
      [k1, k2],
      // Com intervalo: K2 começa em 20/10, a pausa dura 20 dias e K1 vale até 31/10.
      [k1, { ...k2, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) }],
      // Sucessor sem ligação: uma matrícula nova em 05/10 fecha a pausa com 5 dias.
      [k1, K('k3', { planName: 'Pilates', startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5), createdAt: D(2026, 10, 1) })]
    ];
    cases.forEach((docs) => {
      const norm = normalizeContracts(docs).find((c) => c.id === 'k1');
      const f = contractFactsOf(k1, docs, D(2027, 6, 15), 30);
      expect(f.actualEnd, docs[1].id).toEqual(norm.endsAt);
      const pausa = norm.pauses[0];
      expect(f.pauses[0].to, docs[1].id).toEqual(pausa.to);
      expect(f.pausedDays, docs[1].id).toBe(daysBetween(pausa.from, pausa.to));
    });
  });

  it('a faixa do próximo diz que o em uso está trancado, e não "sem intervalo"', () => {
    const m = contractsTabModel({ lead: lead('k2'), contracts: [k1, k2], now: HOJE });
    expect(m.hero).toBe(k1);
    expect(m.next).toBe(k2);
    expect(joinTextOf(m.join)).toBe('O contrato em uso está trancado. Quando este começar, os dias que sobram dele correm junto.');
  });

  it('a renovação desfeita: nunca começou, sem fim de fato, sem média e sem ordem de renovação', () => {
    const desfeita = { ...k2, status: 'cancelado', cancelledAt: D(2026, 9, 30), cancelReason: 'Outro' };
    const f = contractFactsOf(desfeita, [emUso, desfeita], new Date(2026, 9, 2, 10, 0), 30);
    expect(f.neverTookEffect).toBe(true);
    expect(f.actualEnd).toBeNull();
    expect(f.endReason).toEqual({ kind: 'cancelado', days: 0, text: 'nunca começou' });
    expect(f.monthly).toBeNull();
    expect(f.status).toBe(CONTRACT_STATUS.CANCELADO);
    expect(originTextOf(f.origin)).toBe('renovação');
    expect(contractFactsOf(emUso, [emUso], HOJE, 30).neverTookEffect).toBe(false);
  });
});
