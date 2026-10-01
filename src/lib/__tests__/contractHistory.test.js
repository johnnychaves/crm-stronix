// Origem de cada contrato de uma pessoa, na aba Contratos da ficha. A ordem é
// a do Gerencial (saleTypeOf): renovação, upgrade, retorno e primeira. O último
// bloco compara as duas, para a ficha e o Gerencial não se separarem.

import { describe, it, expect } from 'vitest';
import {
  CONTRACT_ORIGIN, HISTORY_STATUS, HISTORY_STATUS_LABEL, contractEndOf, contractOriginOf, historyStatusOf, isInUseAt,
  runningPredecessorOf
} from '../contractHistory.js';
import { CONTRACT_STATUS } from '../contracts.js';
import { normalizeContracts, indexContracts } from '../operacional/base.js';
import { saleTypeOf, SALE_TYPES } from '../gerencial/scope.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const ts = (date) => ({ toDate: () => date });
const L = 'lead-1';
const K = (id, extra) => ({ id, leadId: L, planName: `Plano ${id}`, value: 100, durationMonths: 1, ...extra });

const a = K('a', { startsAt: D(2025, 1, 10), endsAt: D(2025, 2, 10), createdAt: D(2025, 1, 10) });
const b = K('b', { renewedFromId: 'a', startsAt: D(2025, 2, 11), endsAt: D(2025, 5, 11), createdAt: D(2025, 2, 5) });
const c = K('c', { renewedFromId: 'b', startsAt: D(2025, 5, 12), endsAt: D(2026, 5, 12), createdAt: D(2025, 5, 1) });
const d = K('d', { startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1), createdAt: D(2026, 9, 1) });
const e = K('e', { renewedFromId: 'd', startsAt: D(2027, 9, 2), endsAt: D(2028, 9, 2), createdAt: D(2027, 8, 1) });
const todos = [a, b, c, d, e];

describe('contractOriginOf', () => {
  it('primeiro contrato da pessoa', () => {
    expect(contractOriginOf(a, todos)).toEqual({ kind: CONTRACT_ORIGIN.PRIMEIRA, previous: null, ordinal: 0, gapDays: null, coverageEnd: null });
  });

  it('renovação conta só a sequência ligada', () => {
    const o = contractOriginOf(c, todos);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RENOVACAO);
    expect(o.previous).toBe(b);
    expect(o.ordinal).toBe(2);
    expect(o.gapDays).toBeNull();
  });

  it('contrato sem ligação depois de um tempo sem contrato é retorno', () => {
    const o = contractOriginOf(d, todos);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.previous).toBe(c);
    expect(o.gapDays).toBe(111);
  });

  it('a contagem de renovações recomeça depois de um retorno', () => {
    expect(contractOriginOf(e, todos).ordinal).toBe(1);
  });

  it('retorno depois de cancelamento conta o intervalo desde o cancelamento', () => {
    const cancelado = { ...c, status: 'cancelado', cancelledAt: D(2025, 8, 1) };
    const o = contractOriginOf(d, [a, b, cancelado, d]);
    expect(o.gapDays).toBe(395);
  });

  it('contrato fechado pelo funil Upgrade, sem ligação, é upgrade', () => {
    const up = K('up', { closedFromUpgrade: true, startsAt: D(2026, 9, 1), endsAt: D(2027, 9, 1), createdAt: D(2026, 9, 1) });
    expect(contractOriginOf(up, [a, b, c, up]).kind).toBe(CONTRACT_ORIGIN.UPGRADE);
  });

  it('contrato sem ligação que encosta no anterior é retorno sem intervalo', () => {
    const colado = K('colado', { startsAt: D(2026, 5, 13), endsAt: D(2027, 5, 13), createdAt: D(2026, 5, 10) });
    const o = contractOriginOf(colado, [a, b, c, colado]);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.gapDays).toBeNull();
  });

  it('renovação cujo contrato ligado não está na lista continua renovação', () => {
    const solta = K('solta', { renewedFromId: 'sumiu', startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), createdAt: D(2026, 1, 1) });
    expect(contractOriginOf(solta, [solta])).toEqual({ kind: CONTRACT_ORIGIN.RENOVACAO, previous: null, ordinal: 1, gapDays: null, coverageEnd: null });
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    const t1 = K('t1', { startsAt: ts(D(2025, 1, 1)), endsAt: ts(D(2025, 2, 1)), createdAt: ts(D(2025, 1, 1)) });
    const t2 = K('t2', { startsAt: ts(D(2025, 6, 1)), endsAt: ts(D(2025, 7, 1)), createdAt: ts(D(2025, 6, 1)) });
    const o = contractOriginOf(t2, [t1, t2]);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.gapDays).toBe(119);
  });

  it('contrato paralelo: o intervalo conta da cobertura, não da venda mais recente', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 31), createdAt: D(2026, 1, 1) });
    const p = K('p', { startsAt: D(2026, 3, 1), endsAt: D(2026, 4, 1), createdAt: D(2026, 3, 1) });
    const z = K('z', { startsAt: D(2026, 6, 1), endsAt: D(2027, 6, 1), createdAt: D(2026, 6, 1) });
    const o = contractOriginOf(z, [x, p, z]);
    expect(o.previous).toBe(x);
    expect(o.gapDays).toBeNull();
    expect(o.coverageEnd).toEqual(D(2026, 12, 31));
  });

  it('retorno depois de renovação cancelada antes de começar mostra o contrato que valeu', () => {
    const anual = K('anual', { planName: 'Anual', startsAt: D(2025, 1, 1), endsAt: D(2025, 12, 31), createdAt: D(2025, 1, 1) });
    const semestral = K('semestral', { planName: 'Semestral', renewedFromId: 'anual', status: 'cancelado', startsAt: D(2026, 1, 1), endsAt: D(2026, 7, 1), cancelledAt: D(2025, 12, 20), createdAt: D(2025, 12, 1) });
    const volta = K('volta', { startsAt: D(2026, 3, 1), endsAt: D(2027, 3, 1), createdAt: D(2026, 3, 1) });
    const o = contractOriginOf(volta, [anual, semestral, volta]);
    expect(o.kind).toBe(CONTRACT_ORIGIN.RETORNO);
    expect(o.previous).toBe(anual);
    expect(o.coverageEnd).toEqual(D(2025, 12, 31));
  });

  it('renovação cancelada antes de começar não conta como cobertura', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 31), createdAt: D(2026, 1, 1) });
    const y = K('y', { renewedFromId: 'x', status: 'cancelado', startsAt: D(2027, 1, 1), endsAt: D(2028, 1, 1), cancelledAt: D(2026, 11, 15), createdAt: D(2026, 10, 1) });
    const z = K('z', { startsAt: D(2027, 1, 1), endsAt: D(2028, 1, 1), createdAt: D(2026, 12, 1) });
    expect(contractOriginOf(z, [x, y, z]).gapDays).toBeNull();
  });

  it('cancelamento antes do início, mesmo depois do fim do anterior, não estende a cobertura', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 31), createdAt: D(2026, 1, 1) });
    const y = K('y', { renewedFromId: 'x', status: 'cancelado', startsAt: D(2027, 1, 10), endsAt: D(2028, 1, 10), cancelledAt: D(2027, 1, 5), createdAt: D(2026, 12, 1) });
    const z = K('z', { startsAt: D(2027, 1, 10), endsAt: D(2028, 1, 10), createdAt: D(2027, 1, 6) });
    expect(contractOriginOf(z, [x, y, z]).gapDays).toBe(9);
  });

  it('horários diferentes no fim e no início não mudam o intervalo', () => {
    const x = K('x', { startsAt: D(2026, 1, 10), endsAt: new Date(2026, 1, 10, 14, 0), createdAt: D(2026, 1, 10) });
    const z = K('z', { startsAt: D(2026, 2, 12), endsAt: D(2027, 2, 12), createdAt: D(2026, 2, 12) });
    expect(contractOriginOf(z, [x, z]).gapDays).toBe(1);
  });

  it('cancelado ainda trancado termina no cancelamento', () => {
    const x = K('x', { status: 'cancelado', startsAt: D(2025, 2, 1), endsAt: D(2026, 2, 1), pausedAt: D(2026, 1, 20), cancelledAt: D(2026, 3, 15), createdAt: D(2025, 2, 1) });
    const z = K('z', { startsAt: D(2026, 3, 20), endsAt: D(2027, 3, 20), createdAt: D(2026, 3, 20) });
    expect(contractOriginOf(z, [x, z]).gapDays).toBe(4);
  });

  it('renovação com intervalo conta os dias sem contrato', () => {
    const x = K('x', { startsAt: D(2026, 1, 1), endsAt: D(2026, 6, 1), createdAt: D(2026, 1, 1) });
    const r = K('r', { renewedFromId: 'x', startsAt: D(2026, 6, 11), endsAt: D(2027, 6, 11), createdAt: D(2026, 6, 1) });
    expect(contractOriginOf(r, [x, r]).gapDays).toBe(9);
  });
});

describe('contractEndOf', () => {
  it('é o fim, ou o cancelamento quando ele veio antes', () => {
    expect(contractEndOf(a)).toEqual(D(2025, 2, 10));
    expect(contractEndOf({ ...a, cancelledAt: D(2025, 1, 20) })).toEqual(D(2025, 1, 20));
    expect(contractEndOf({ ...a, status: 'cancelado', pausedAt: D(2025, 1, 20), cancelledAt: D(2025, 3, 15) })).toEqual(D(2025, 3, 15));
    expect(contractEndOf(null)).toBeNull();
  });
});

describe('contractOriginOf dá o mesmo tipo que o Gerencial', () => {
  it('em todos os casos da lista', () => {
    const up = K('up', { renewedFromId: 'd', closedFromUpgrade: true, startsAt: D(2027, 9, 2), endsAt: D(2028, 9, 2), createdAt: D(2027, 8, 2) });
    const up2 = K('up2', { closedFromUpgrade: true, startsAt: D(2029, 1, 1), endsAt: D(2030, 1, 1), createdAt: D(2029, 1, 1) });
    const raw = [...todos, up, up2];
    const norm = normalizeContracts(raw);
    const { byPerson } = indexContracts(norm);
    const TO_SALE = {
      [CONTRACT_ORIGIN.RENOVACAO]: SALE_TYPES.RENOVACAO,
      [CONTRACT_ORIGIN.UPGRADE]: SALE_TYPES.UPGRADE,
      [CONTRACT_ORIGIN.RETORNO]: SALE_TYPES.RETORNO,
      [CONTRACT_ORIGIN.PRIMEIRA]: SALE_TYPES.NOVA
    };
    norm.forEach((n, i) => {
      expect(TO_SALE[contractOriginOf(raw[i], raw).kind], raw[i].id).toBe(saleTypeOf(n, byPerson));
    });
  });
});

// O contrato que já tem renovação ligada, no Histórico e no card. Antes ele
// aparecia "A vencer" com o aluno já renovado.
describe('historyStatusOf e runningPredecessorOf', () => {
  const HOJE = D(2026, 9, 28);
  const atual = { id: 'k1', leadId: L, planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
  const renovacao = { id: 'k2', leadId: L, planName: 'Flow', status: 'ativo', renewedFromId: 'k1', seamless: true, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };

  it('contrato com renovação que ainda não começou está em uso', () => {
    expect(historyStatusOf(atual, [atual, renovacao], HOJE)).toBe(HISTORY_STATUS.EM_USO);
  });

  it('depois que a renovação começa, vira renovado', () => {
    expect(historyStatusOf(atual, [atual, renovacao], D(2026, 10, 12))).toBe(HISTORY_STATUS.RENOVADO);
  });

  it('renovação cancelada antes de começar não conta', () => {
    const desistiu = { ...renovacao, status: 'cancelado', cancelledAt: D(2026, 9, 20) };
    expect(historyStatusOf(atual, [atual, desistiu], HOJE)).toBe(CONTRACT_STATUS.A_VENCER);
  });

  it('nem a cancelada no instante do início', () => {
    const noInicio = { ...renovacao, status: 'cancelado', cancelledAt: D(2026, 10, 12) };
    expect(historyStatusOf(atual, [atual, noInicio], HOJE)).toBe(CONTRACT_STATUS.A_VENCER);
  });

  it('cancelado continua cancelado, e sem renovação vale o status comum', () => {
    expect(historyStatusOf({ ...atual, status: 'cancelado', cancelledAt: D(2026, 5, 1) }, [atual, renovacao], HOJE)).toBe(CONTRACT_STATUS.CANCELADO);
    expect(historyStatusOf(atual, [atual], HOJE)).toBe(CONTRACT_STATUS.A_VENCER);
  });

  // Trancado com renovação ligada: trancado até ela começar. Depois, a pausa
  // fecha no início dela e o contrato volta a correr junto com ela pelos dias
  // que faltavam, a mesma leitura do Operacional (closeOpenPause): "Em uso" até
  // esse fim andado, e "Renovado" depois (decisão do Johnny, 30/09/2026).
  it('trancado continua trancado até a renovação começar; depois corre junto com ela e só então vira renovado', () => {
    // Trancado em 30/09/2026 com o fim em 11/10: a renovação começa em 12/10, a
    // pausa dura 12 dias e o contrato volta a valer até 23/10.
    const trancado = { ...atual, status: 'trancado', pausedAt: D(2026, 9, 30) };
    expect(historyStatusOf(trancado, [trancado, renovacao], HOJE)).toBe(CONTRACT_STATUS.TRANCADO);
    expect(historyStatusOf(trancado, [trancado, renovacao], D(2026, 10, 12))).toBe(HISTORY_STATUS.EM_USO);
    expect(historyStatusOf(trancado, [trancado, renovacao], new Date(2026, 9, 23, 18, 0))).toBe(HISTORY_STATUS.EM_USO);
    expect(historyStatusOf(trancado, [trancado, renovacao], D(2026, 10, 24))).toBe(HISTORY_STATUS.RENOVADO);
    expect(historyStatusOf(trancado, [trancado, renovacao], D(2027, 6, 15))).toBe(HISTORY_STATUS.RENOVADO);
    // A renovação desfeita não conta.
    const desistiu = { ...renovacao, status: 'cancelado', cancelledAt: D(2026, 9, 20) };
    expect(historyStatusOf(trancado, [trancado, desistiu], D(2026, 10, 12))).toBe(CONTRACT_STATUS.TRANCADO);
    // Sucessor sem ligação (uma matrícula): depois do fim andado, vencido.
    const matricula = { id: 'k3', leadId: L, status: 'ativo', startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };
    expect(historyStatusOf(trancado, [trancado, matricula], D(2026, 10, 15))).toBe(HISTORY_STATUS.EM_USO);
    expect(historyStatusOf(trancado, [trancado, matricula], D(2026, 11, 15))).toBe(CONTRACT_STATUS.VENCIDO);
  });

  // No Histórico, o contrato que ainda não começou nunca está em uso nem
  // renovado, nem o emendado, que o status comum trata como ativo.
  it('a renovação que ainda não começou é agendada, mesmo emendada', () => {
    expect(historyStatusOf(renovacao, [atual, renovacao], HOJE)).toBe(CONTRACT_STATUS.AGENDADO);
  });

  it('com intervalo: em uso até o fim, renovado depois dele, mesmo antes de a renovação começar', () => {
    const depois = { ...renovacao, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    expect(historyStatusOf(atual, [atual, depois], HOJE)).toBe(HISTORY_STATUS.EM_USO);
    // O último dia do contrato ainda é dele.
    expect(historyStatusOf(atual, [atual, depois], new Date(2026, 9, 11, 18, 0))).toBe(HISTORY_STATUS.EM_USO);
    expect(historyStatusOf(atual, [atual, depois], D(2026, 10, 15))).toBe(HISTORY_STATUS.RENOVADO);
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    const tAtual = { ...atual, startsAt: ts(atual.startsAt), endsAt: ts(atual.endsAt) };
    const tRenovacao = { ...renovacao, startsAt: ts(renovacao.startsAt), endsAt: ts(renovacao.endsAt) };
    expect(historyStatusOf(tAtual, [tAtual, tRenovacao], HOJE)).toBe(HISTORY_STATUS.EM_USO);
    expect(runningPredecessorOf(tRenovacao, [tAtual, tRenovacao], HOJE)).toBe(tAtual);
  });

  it('os selos têm rótulo', () => {
    expect(HISTORY_STATUS_LABEL[HISTORY_STATUS.EM_USO]).toBe('Em uso');
    expect(HISTORY_STATUS_LABEL[HISTORY_STATUS.RENOVADO]).toBe('Renovado');
  });

  it('runningPredecessorOf acha o contrato em uso da renovação', () => {
    expect(runningPredecessorOf(renovacao, [atual, renovacao], HOJE)).toBe(atual);
    expect(runningPredecessorOf(renovacao, [atual, renovacao], D(2026, 10, 12))).toBeNull();
    expect(runningPredecessorOf(atual, [atual, renovacao], HOJE)).toBeNull();
  });

  it('runningPredecessorOf ignora o anterior cancelado', () => {
    const cancelado = { ...atual, status: 'cancelado', cancelledAt: D(2026, 9, 1) };
    expect(runningPredecessorOf(renovacao, [cancelado, renovacao], HOJE)).toBeNull();
  });

  // O contrato parado também está em uso: o fim dele não corre, e é ele que o
  // cliente tem enquanto a renovação não começa.
  it('runningPredecessorOf aceita o anterior trancado, mesmo com o fim gravado já passado', () => {
    const trancado = { ...atual, status: 'trancado', pausedAt: D(2026, 9, 1) };
    expect(runningPredecessorOf(renovacao, [trancado, renovacao], HOJE)).toBe(trancado);
    const depois = { ...renovacao, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    expect(runningPredecessorOf(depois, [trancado, depois], D(2026, 10, 15))).toBe(trancado);
  });

  it('runningPredecessorOf: com intervalo, o anterior só vale até o fim dele', () => {
    const depois = { ...renovacao, seamless: false, startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    expect(runningPredecessorOf(depois, [atual, depois], HOJE)).toBe(atual);
    expect(runningPredecessorOf(depois, [atual, depois], D(2026, 10, 15))).toBeNull();
  });

  it('runningPredecessorOf: o anterior encurtado vale até o fim encurtado', () => {
    const encurtado = { ...atual, endsAt: D(2026, 10, 4), originalEndsAt: D(2026, 10, 11), shortenedById: 'k2' };
    const antecipada = { ...renovacao, startsAt: D(2026, 10, 5), endsAt: D(2027, 10, 5) };
    const emUso = runningPredecessorOf(antecipada, [encurtado, antecipada], HOJE);
    expect(emUso).toBe(encurtado);
    expect(contractEndOf(emUso)).toEqual(D(2026, 10, 4));
  });

  it('runningPredecessorOf sem o anterior na lista, ou com ele ainda sem começar', () => {
    expect(runningPredecessorOf(renovacao, [renovacao], HOJE)).toBeNull();
    expect(runningPredecessorOf(renovacao, null, HOJE)).toBeNull();
    const futuro = { ...atual, startsAt: D(2026, 10, 1) };
    expect(runningPredecessorOf(renovacao, [futuro, renovacao], HOJE)).toBeNull();
  });
});

describe('isInUseAt: o contrato que o cliente usa num instante', () => {
  const HOJE = D(2026, 9, 30);
  const c = { id: 'k1', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };

  it('vale do início ao último dia do fim efetivo, por dia do calendário', () => {
    expect(isInUseAt(c, HOJE)).toBe(true);
    expect(isInUseAt(c, new Date(2026, 9, 11, 18, 0))).toBe(true);
    expect(isInUseAt(c, D(2026, 10, 12))).toBe(false);
    expect(isInUseAt(c, D(2025, 10, 10))).toBe(false);
  });

  it('cancelado não está em uso, nem depois do cancelamento; trancado está, mesmo com o fim gravado passado', () => {
    expect(isInUseAt({ ...c, status: 'cancelado', cancelledAt: D(2026, 9, 1) }, HOJE)).toBe(false);
    expect(isInUseAt({ ...c, status: 'trancado', pausedAt: D(2026, 9, 1) }, D(2026, 10, 20))).toBe(true);
  });

  it('importado sem início vale pela criação; sem fim, ou sem contrato, não vale', () => {
    expect(isInUseAt({ id: 'k1', createdAt: D(2026, 9, 4), endsAt: D(2026, 10, 11) }, HOJE)).toBe(true);
    expect(isInUseAt({ id: 'k1', startsAt: D(2025, 10, 11) }, HOJE)).toBe(false);
    expect(isInUseAt(null, HOJE)).toBe(false);
  });

  it('aceita as datas como Timestamp do Firestore', () => {
    expect(isInUseAt({ ...c, startsAt: ts(c.startsAt), endsAt: ts(c.endsAt) }, HOJE)).toBe(true);
  });

  // O trancado que um sucessor já alcançou não está mais em uso: a pausa fecha
  // no início do sucessor e o contrato volta a correr junto com ele, no
  // Histórico (decisão do Johnny, 30/09/2026). Antes do sucessor, está em uso.
  it('trancado com sucessor já começado não está em uso; antes do sucessor, está', () => {
    const trancado = { ...c, status: 'trancado', pausedAt: D(2026, 9, 30) };
    const renovacao = { id: 'k2', renewedFromId: 'k1', status: 'ativo', startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) };
    expect(isInUseAt(trancado, D(2026, 10, 5), [trancado, renovacao])).toBe(true);
    expect(isInUseAt(trancado, D(2026, 10, 12), [trancado, renovacao])).toBe(false);
    expect(isInUseAt(trancado, D(2027, 10, 15), [trancado, renovacao])).toBe(false);
    // Outro contrato da pessoa que começa depois da pausa também é sucessor,
    // como no Operacional; o que já corria antes dela é paralelo.
    const matricula = { id: 'k3', status: 'ativo', startsAt: D(2026, 10, 20), endsAt: D(2027, 10, 20) };
    expect(isInUseAt(trancado, D(2026, 10, 25), [trancado, matricula])).toBe(false);
    const paralelo = { id: 'p1', status: 'ativo', startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1) };
    expect(isInUseAt(trancado, D(2026, 10, 25), [trancado, paralelo])).toBe(true);
    // A renovação desfeita não conta.
    const desfeita = { ...renovacao, status: 'cancelado', cancelledAt: D(2026, 10, 1) };
    expect(isInUseAt(trancado, D(2026, 10, 20), [trancado, desfeita])).toBe(true);
  });
});
